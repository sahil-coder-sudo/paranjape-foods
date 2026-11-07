const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    flatNo: {
      type: String,
      trim: true,
      default: '',
    },
    buildingName: {
      type: String,
      trim: true,
      default: '',
    },
    street: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    zipCode: {
      type: String,
      trim: true,
      default: '',
    },
    latitude: {
      type: Number,
      default: 18.5204, // Default to Pune center coordinates
    },
    longitude: {
      type: Number,
      default: 73.8567,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Address', addressSchema);
