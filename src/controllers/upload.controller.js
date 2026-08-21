const fs = require('fs/promises');
const { processUploadedFile } = require('../services/upload.service');

async function uploadPolicyData(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded. Attach it under field name "file".' });
  }

  try {
    const summary = await processUploadedFile(req.file.path);
    res.status(200).json({ message: 'File processed successfully', ...summary });
  } catch (err) {
    next(err);
  } finally {
    fs.unlink(req.file.path).catch(() => {});
  }
}

module.exports = { uploadPolicyData };
