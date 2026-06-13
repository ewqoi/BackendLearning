const fs = require('fs');
const path = require('path');

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const storageRoot = isServerless ? '/tmp' : path.join(__dirname, '..');

const uploadsDir = path.join(storageRoot, 'uploads');
const chunksDir = path.join(storageRoot, 'chunks');
const filesInfoDir = path.join(storageRoot, 'files-info');
const resumeDir = path.join(storageRoot, 'resume-uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureStorageDirs() {
  [uploadsDir, chunksDir, filesInfoDir, resumeDir].forEach(ensureDir);
}

module.exports = {
  isServerless,
  storageRoot,
  uploadsDir,
  chunksDir,
  filesInfoDir,
  resumeDir,
  ensureDir,
  ensureStorageDirs,
};
