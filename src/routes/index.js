const router = require('express').Router();

router.use('/upload', require('./upload.routes'));
router.use('/policies', require('./policy.routes'));
router.use('/messages', require('./message.routes'));

module.exports = router;
