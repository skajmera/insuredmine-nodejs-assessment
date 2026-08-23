const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { upload: uploadConfig } = require('../config/env');

const uploadDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const allowedExtensions = new Set(['.csv', '.xlsx', '.xls']);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.has(ext)) {
    const err = new Error('Only .csv, .xlsx and .xls files are allowed');
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: uploadConfig.maxFileSizeMb * 1024 * 1024 },
});
