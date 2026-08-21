const router = require('express').Router();
const upload = require('../middlewares/upload');
const { uploadLimiter } = require('../middlewares/rateLimiter');
const { uploadPolicyData } = require('../controllers/upload.controller');

router.post('/', uploadLimiter, upload.single('file'), uploadPolicyData);

module.exports = router;
