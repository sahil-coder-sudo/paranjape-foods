const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const staffUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['owner', 'manager', 'delivery'],
      default: 'manager',
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Don't return password hash by default
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Specific to Delivery Fleet
    vehicleNumber: {
      type: String,
      trim: true,
      default: '',
    },
    currentStatus: {
      type: String,
      enum: ['available', 'on_delivery', 'offline'],
      default: 'available',
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: String,
      default: 'admin',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Password helper methods
staffUserSchema.methods.setPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(password, salt);
};

staffUserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

module.exports = mongoose.model('StaffUser', staffUserSchema);
