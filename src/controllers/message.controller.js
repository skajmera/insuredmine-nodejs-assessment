const { scheduleMessage } = require('../services/scheduler.service');

async function createScheduledMessage(req, res, next) {
  try {
    const { message, day, time } = req.body;
    if (!message || !day || !time) {
      return res.status(400).json({ message: 'message, day and time are required' });
    }

    const result = await scheduleMessage({ message, day, time });
    res.status(201).json({ message: 'Message scheduled', ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { createScheduledMessage };
