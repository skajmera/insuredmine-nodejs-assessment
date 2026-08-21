const { mongoose } = require('../config/database');

const categorySchema = new mongoose.Schema(
  {
    categoryName: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
