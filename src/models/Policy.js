const { mongoose } = require('../config/database');

const policySchema = new mongoose.Schema(
  {
    policyNumber: { type: String, required: true, unique: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    premiumAmount: { type: Number },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrier', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Policy', policySchema);
