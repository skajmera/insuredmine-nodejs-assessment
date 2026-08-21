const { mongoose } = require('../config/database');

const scheduledMessageSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    scheduledFor: { type: Date, required: true },
    insertedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);
