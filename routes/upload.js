const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const uploadsDir = path.join(__dirname, '../uploads');
const filesInfoDir = path.join(__dirname, '../files-info');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
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

function getFileInfo(fileHash) {
  const infoPath = path.join(filesInfoDir, `${fileHash}.json`);
  if (fs.existsSync(infoPath)) {
    return JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
  }
  return null;
}

function saveFileInfo(fileHash, info) {
  if (!fs.existsSync(filesInfoDir)) {
    fs.mkdirSync(filesInfoDir, { recursive: true });
  }
  const infoPath = path.join(filesInfoDir, `${fileHash}.json`);
  fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
}

router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    const fileHash = await calculateFileHash(req.file.path);
    const existingFile = getFileInfo(fileHash);

    if (existingFile) {
      fs.unlinkSync(req.file.path);
      return res.json({
        success: true,
        message: '文件已存在（秒传）',
        data: {
          fileId: existingFile.fileId,
          filename: existingFile.filename,
          originalname: existingFile.originalname,
          size: existingFile.size,
          hash: fileHash,
          url: existingFile.url,
          instantUpload: true
        }
      });
    }

    const fileId = uuidv4();
    const fileInfo = {
      fileId,
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hash: fileHash,
      path: req.file.path,
      url: `/uploads/${req.file.filename}`,
      uploadedAt: new Date().toISOString()
    };

    saveFileInfo(fileHash, fileInfo);

    res.json({
      success: true,
      message: '文件上传成功',
      data: {
        fileId,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        hash: fileHash,
        url: `/uploads/${req.file.filename}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '文件上传失败',
      error: error.message
    });
  }
});

router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的文件'
      });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const fileHash = await calculateFileHash(file.path);
      const existingFile = getFileInfo(fileHash);

      if (existingFile) {
        fs.unlinkSync(file.path);
        uploadedFiles.push({
          fileId: existingFile.fileId,
          filename: existingFile.filename,
          originalname: existingFile.originalname,
          size: existingFile.size,
          hash: fileHash,
          url: existingFile.url,
          instantUpload: true
        });
      } else {
        const fileId = uuidv4();
        const fileInfo = {
          fileId,
          filename: file.filename,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          hash: fileHash,
          path: file.path,
          url: `/uploads/${file.filename}`,
          uploadedAt: new Date().toISOString()
        };

        saveFileInfo(fileHash, fileInfo);
        uploadedFiles.push({
          fileId,
          filename: file.filename,
          originalname: file.originalname,
          size: file.size,
          hash: fileHash,
          url: `/uploads/${file.filename}`
        });
      }
    }

    res.json({
      success: true,
      message: `成功上传 ${uploadedFiles.length} 个文件`,
      data: uploadedFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '文件上传失败',
      error: error.message
    });
  }
});

router.get('/info/:fileId', (req, res) => {
  const { fileId } = req.params;
  
  if (!fs.existsSync(filesInfoDir)) {
    return res.status(404).json({
      success: false,
      message: '文件不存在'
    });
  }
  
  const files = fs.readdirSync(filesInfoDir);
  for (const file of files) {
    const infoPath = path.join(filesInfoDir, file);
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    if (info.fileId === fileId) {
      return res.json({
        success: true,
        data: info
      });
    }
  }

  res.status(404).json({
    success: false,
    message: '文件不存在'
  });
});

router.delete('/:fileId', (req, res) => {
  const { fileId } = req.params;
  
  if (!fs.existsSync(filesInfoDir)) {
    return res.status(404).json({
      success: false,
      message: '文件不存在'
    });
  }
  
  const files = fs.readdirSync(filesInfoDir);
  for (const file of files) {
    const infoPath = path.join(filesInfoDir, file);
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    if (info.fileId === fileId) {
      if (fs.existsSync(info.path)) {
        fs.unlinkSync(info.path);
      }
      fs.unlinkSync(infoPath);
      return res.json({
        success: true,
        message: '文件删除成功'
      });
    }
  }

  res.status(404).json({
    success: false,
    message: '文件不存在'
  });
});

module.exports = router;
