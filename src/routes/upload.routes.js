const router = require('express').Router();
const upload = require('../middlewares/upload');
const { uploadPolicyData } = require('../controllers/upload.controller');

router.post('/', upload.single('file'), uploadPolicyData);

module.exports = router;
