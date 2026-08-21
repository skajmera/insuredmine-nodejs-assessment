const fs = require('fs');
const path = require('path');
const multer = require('multer');

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
    return cb(new Error('Only .csv, .xlsx and .xls files are allowed'));
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});
