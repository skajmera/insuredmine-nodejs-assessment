const { mongoose } = require('../config/database');

const carrierSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Carrier', carrierSchema);
