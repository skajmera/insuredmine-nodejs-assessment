const { mongoose } = require('../config/database');

const accountSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, unique: true, trim: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
