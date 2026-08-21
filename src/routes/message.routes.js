const router = require('express').Router();
const { createScheduledMessage } = require('../controllers/message.controller');

router.post('/', createScheduledMessage);

module.exports = router;
