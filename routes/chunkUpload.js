const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const { chunksDir, uploadsDir, filesInfoDir, ensureDir, ensureStorageDirs } = require('../utils/storagePaths');

ensureStorageDirs();

const uploadInfo = new Map();

router.post('/init', (req, res) => {
  const { filename, fileSize, chunkSize = 5 * 1024 * 1024, fileHash } = req.body;

  if (!filename || !fileSize) {
    return res.status(400).json({
      success: false,
      message: '文件名和文件大小为必填项'
    });
  }

  const infoPath = path.join(filesInfoDir, `${fileHash}.json`);
  if (fileHash && fs.existsSync(infoPath)) {
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

  const uploadId = uuidv4();
  const totalChunks = Math.ceil(fileSize / chunkSize);

  uploadInfo.set(uploadId, {
    filename,
    fileSize,
    chunkSize,
    totalChunks,
    uploadedChunks: [],
    fileHash,
    createdAt: Date.now()
  });

  const uploadDir = path.join(chunksDir, uploadId);
  ensureDir(uploadDir);

  res.json({
    success: true,
    message: '分片上传初始化成功',
    data: {
      uploadId,
      totalChunks,
      chunkSize,
      uploadedChunks: []
    }
  });
});

router.post('/upload', (req, res) => {
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const { uploadId } = req.body;
        const uploadDir = path.join(chunksDir, uploadId);
        ensureDir(uploadDir);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const { chunkIndex } = req.body;
        cb(null, `chunk-${chunkIndex}`);
      }
    })
  }).single('chunk');

  upload(req, res, (err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: '分片上传失败',
        error: err.message
      });
    }

    const { uploadId, chunkIndex } = req.body;

    if (!uploadInfo.has(uploadId)) {
      return res.status(404).json({
        success: false,
        message: '上传任务不存在'
      });
    }

    const info = uploadInfo.get(uploadId);
    const chunkNum = parseInt(chunkIndex);

    if (!info.uploadedChunks.includes(chunkNum)) {
      info.uploadedChunks.push(chunkNum);
    }

    res.json({
      success: true,
      message: `分片 ${chunkIndex} 上传成功`,
      data: {
        chunkIndex: chunkNum,
        uploadedChunks: info.uploadedChunks.length,
        totalChunks: info.totalChunks,
        progress: Math.round((info.uploadedChunks.length / info.totalChunks) * 100)
      }
    });
  });
});

router.post('/merge', async (req, res) => {
  const { uploadId, filename, fileHash } = req.body;

  if (!uploadInfo.has(uploadId)) {
    return res.status(404).json({
      success: false,
      message: '上传任务不存在'
    });
  }

  const info = uploadInfo.get(uploadId);

  if (info.uploadedChunks.length !== info.totalChunks) {
    return res.status(400).json({
      success: false,
      message: '还有分片未上传完成',
      data: {
        uploadedChunks: info.uploadedChunks.length,
        totalChunks: info.totalChunks
      }
    });
  }

  const ext = path.extname(info.filename);
  const newFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
  const filePath = path.join(uploadsDir, newFilename);

  const writeStream = fs.createWriteStream(filePath);

  for (let i = 0; i < info.totalChunks; i++) {
    const chunkPath = path.join(chunksDir, uploadId, `chunk-${i}`);
    const chunkData = fs.readFileSync(chunkPath);
    writeStream.write(chunkData);
    fs.unlinkSync(chunkPath);
  }

  writeStream.end();

  const hash = fileHash || await calculateFileHash(filePath);

  const fileId = uuidv4();
  const fileInfo = {
    fileId,
    filename: newFilename,
    originalname: info.filename,
    size: info.fileSize,
    hash,
    path: filePath,
    url: `/uploads/${newFilename}`,
    uploadedAt: new Date().toISOString(),
    uploadType: 'chunk'
  };

  saveFileInfo(hash, fileInfo);

  fs.rmdirSync(path.join(chunksDir, uploadId));
  uploadInfo.delete(uploadId);

  res.json({
    success: true,
    message: '文件合并成功',
    data: {
      fileId,
      filename: newFilename,
      originalname: info.filename,
      size: info.fileSize,
      hash,
      url: `/uploads/${newFilename}`
    }
  });
});

router.post('/verify', (req, res) => {
  const { fileHash, filename, fileSize } = req.body;

  if (!fileHash) {
    return res.status(400).json({
      success: false,
      message: '文件哈希值为必填项'
    });
  }

  const infoPath = path.join(filesInfoDir, `${fileHash}.json`);

  if (fs.existsSync(infoPath)) {
    const existingInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    return res.json({
      success: true,
      message: '文件已存在，可以秒传',
      data: {
        exists: true,
        fileId: existingInfo.fileId,
        url: existingInfo.url,
        instantUpload: true
      }
    });
  }

  res.json({
    success: true,
    message: '文件不存在，需要上传',
    data: {
      exists: false,
      instantUpload: false
    }
  });
});

router.get('/status/:uploadId', (req, res) => {
  const { uploadId } = req.params;

  if (!uploadInfo.has(uploadId)) {
    const uploadDir = path.join(chunksDir, uploadId);
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const uploadedChunks = files
        .filter(f => f.startsWith('chunk-'))
        .map(f => parseInt(f.replace('chunk-', '')));

      return res.json({
        success: true,
        data: {
          uploadId,
          uploadedChunks,
          progress: 0
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: '上传任务不存在'
    });
  }

  const info = uploadInfo.get(uploadId);

  res.json({
    success: true,
    data: {
      uploadId,
      filename: info.filename,
      fileSize: info.fileSize,
      totalChunks: info.totalChunks,
      uploadedChunks: info.uploadedChunks,
      progress: Math.round((info.uploadedChunks.length / info.totalChunks) * 100)
    }
  });
});

router.delete('/cancel/:uploadId', (req, res) => {
  const { uploadId } = req.params;

  const uploadDir = path.join(chunksDir, uploadId);
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    files.forEach(file => fs.unlinkSync(path.join(uploadDir, file)));
    fs.rmdirSync(uploadDir);
  }

  uploadInfo.delete(uploadId);

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
