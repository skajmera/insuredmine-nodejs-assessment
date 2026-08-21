const { mongoose } = require('../config/database');

const agentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Agent', agentSchema);
