const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffCredentialSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      unique: true,
      enum: ['admin', 'manager', 'delivery'],
    },
    passcodeHash: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: String,
      default: 'system',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

staffCredentialSchema.methods.setPasscode = async function (passcode) {
  const salt = await bcrypt.genSalt(10);
  this.passcodeHash = await bcrypt.hash(passcode, salt);
};

staffCredentialSchema.methods.comparePasscode = async function (candidate) {
  if (!this.passcodeHash) return false;
  return bcrypt.compare(candidate, this.passcodeHash);
};

module.exports = mongoose.model('StaffCredential', staffCredentialSchema);
