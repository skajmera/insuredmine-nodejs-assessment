const { mongoose } = require('../config/database');

const userSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true, trim: true },
    dob: { type: Date },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    gender: { type: String, trim: true },
    userType: { type: String, trim: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  },
  { timestamps: true }
);

userSchema.index({ firstname: 1 });

module.exports = mongoose.model('User', userSchema);
