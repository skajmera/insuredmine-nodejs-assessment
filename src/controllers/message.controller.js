const { scheduleMessage } = require('../services/scheduler.service');

async function createScheduledMessage(req, res, next) {
  try {
    const { message, day, time } = req.body;
    const allStrings = [message, day, time].every((v) => typeof v === 'string' && v.length > 0);
    if (!allStrings) {
      return res.status(400).json({ message: 'message, day and time are required strings' });
    }

    const result = await scheduleMessage({ message, day, time });
    res.status(201).json({ message: 'Message scheduled', ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { createScheduledMessage };
