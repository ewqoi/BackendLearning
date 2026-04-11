const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const uploadsDir = path.join(__dirname, '../uploads');
const resumeDir = path.join(__dirname, '../resume-uploads');
const filesInfoDir = path.join(__dirname, '../files-info');

[uploadsDir, resumeDir, filesInfoDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

router.get('/status/:fileId', (req, res) => {
  const { fileId } = req.params;

  const sessionPath = path.join(resumeDir, `${fileId}.json`);

  if (!fs.existsSync(sessionPath)) {
    return res.status(404).json({
      success: false,
      message: '上传会话不存在'
    });
  }

  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

  const tempFilePath = path.join(resumeDir, `${fileId}.tmp`);
  let uploadedSize = 0;

  if (fs.existsSync(tempFilePath)) {
    const stats = fs.statSync(tempFilePath);
    uploadedSize = stats.size;
  }

  res.json({
    success: true,
    data: {
      fileId,
      filename: session.filename,
      fileSize: session.fileSize,
      uploadedSize,
      remainingSize: session.fileSize - uploadedSize,
      progress: Math.round((uploadedSize / session.fileSize) * 100),
      createdAt: session.createdAt,
      lastModified: session.lastModified
    }
  });
});

router.post('/init', (req, res) => {
  const { filename, fileSize, fileHash } = req.body;

  if (!filename || !fileSize) {
    return res.status(400).json({
      success: false,
      message: '文件名和文件大小为必填项'
    });
  }

  if (fileHash) {
    const infoPath = path.join(filesInfoDir, `${fileHash}.json`);
    if (fs.existsSync(infoPath)) {
      const existingInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      return res.json({
        success: true,
        message: '文件已存在，秒传成功',
        data: {
          fileId: existingInfo.fileId,
          uploaded: true,
          url: existingInfo.url,
          instantUpload: true
        }
      });
    }
  }

  const fileId = uuidv4();
  const session = {
    fileId,
    filename,
    fileSize,
    fileHash,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };

  const sessionPath = path.join(resumeDir, `${fileId}.json`);
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));

  const tempFilePath = path.join(resumeDir, `${fileId}.tmp`);
  fs.writeFileSync(tempFilePath, '');

  res.json({
    success: true,
    message: '断点续传会话初始化成功',
    data: {
      fileId,
      uploadedSize: 0,
      fileSize
    }
  });
});

router.post('/upload', (req, res) => {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk.toString('binary');
  });

  req.on('end', () => {
    try {
      const boundary = req.headers['content-type'].split('boundary=')[1];
      const parts = body.split(`--${boundary}`);

      let fileId = null;
      let startByte = 0;
      let fileData = null;

      for (const part of parts) {
        if (part.includes('name="fileId"')) {
          const match = part.match(/name="fileId"\r\n\r\n(.*)\r\n/);
          if (match) fileId = match[1].trim();
        }
        if (part.includes('name="start"')) {
          const match = part.match(/name="start"\r\n\r\n(.*)\r\n/);
          if (match) startByte = parseInt(match[1].trim());
        }
        if (part.includes('name="data"')) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd !== -1) {
            fileData = part.substring(headerEnd + 4);
            const lastNewline = fileData.lastIndexOf('\r\n');
            if (lastNewline !== -1) {
              fileData = fileData.substring(0, lastNewline);
            }
          }
        }
      }

      if (!fileId) {
        return res.status(400).json({
          success: false,
          message: '缺少 fileId'
        });
      }

      const sessionPath = path.join(resumeDir, `${fileId}.json`);
      if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({
          success: false,
          message: '上传会话不存在'
        });
      }

      const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      const tempFilePath = path.join(resumeDir, `${fileId}.tmp`);

      const fd = fs.openSync(tempFilePath, 'a');
      const buffer = Buffer.from(fileData, 'binary');
      fs.writeSync(fd, buffer, 0, buffer.length, null);
      fs.closeSync(fd);

      session.lastModified = new Date().toISOString();
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));

      const stats = fs.statSync(tempFilePath);
      const uploadedSize = stats.size;

      res.json({
        success: true,
        message: '数据块上传成功',
        data: {
          fileId,
          uploadedSize,
          fileSize: session.fileSize,
          progress: Math.round((uploadedSize / session.fileSize) * 100)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '上传失败',
        error: error.message
      });
    }
  });
});

router.post('/complete', async (req, res) => {
  const { fileId } = req.body;

  if (!fileId) {
    return res.status(400).json({
      success: false,
      message: 'fileId 为必填项'
    });
  }

  const sessionPath = path.join(resumeDir, `${fileId}.json`);
  const tempFilePath = path.join(resumeDir, `${fileId}.tmp`);

  if (!fs.existsSync(sessionPath) || !fs.existsSync(tempFilePath)) {
    return res.status(404).json({
      success: false,
      message: '上传会话或临时文件不存在'
    });
  }

  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
  const stats = fs.statSync(tempFilePath);

  if (stats.size !== session.fileSize) {
    return res.status(400).json({
      success: false,
      message: '文件大小不匹配',
      data: {
        expected: session.fileSize,
        actual: stats.size
      }
    });
  }

  const ext = path.extname(session.filename);
  const newFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  const finalPath = path.join(uploadsDir, newFilename);

  fs.copyFileSync(tempFilePath, finalPath);

  const fileHash = session.fileHash || await calculateFileHash(finalPath);

  const newFileId = uuidv4();
  const fileInfo = {
    fileId: newFileId,
    filename: newFilename,
    originalname: session.filename,
    size: session.fileSize,
    hash: fileHash,
    path: finalPath,
    url: `/uploads/${newFilename}`,
    uploadedAt: new Date().toISOString(),
    uploadType: 'resume'
  };

  saveFileInfo(fileHash, fileInfo);

  fs.unlinkSync(tempFilePath);
  fs.unlinkSync(sessionPath);

  res.json({
    success: true,
    message: '文件上传完成',
    data: {
      fileId: newFileId,
      filename: newFilename,
      originalname: session.filename,
      size: session.fileSize,
      hash: fileHash,
      url: `/uploads/${newFilename}`
    }
  });
});

router.delete('/cancel/:fileId', (req, res) => {
  const { fileId } = req.params;

  const sessionPath = path.join(resumeDir, `${fileId}.json`);
  const tempFilePath = path.join(resumeDir, `${fileId}.tmp`);

  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }

  res.json({
    success: true,
    message: '上传已取消'
  });
});

function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function saveFileInfo(fileHash, info) {
  const infoPath = path.join(filesInfoDir, `${fileHash}.json`);
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
}

module.exports = router;
