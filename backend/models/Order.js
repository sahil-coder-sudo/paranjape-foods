const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    items: [
      {
        menuItemId: {
          type: String, // Accepts both MongoDB ObjectId and string IDs (e.g. 'm1', 'm2')
          required: true,
        },
        title: {
          type: String,
          default: '',
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    addressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'cod', 'upi', 'offline'],
      default: 'razorpay',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'unpaid', 'paid', 'success', 'failed', 'refunded'],
      default: 'pending',
    },
    razorpayOrderId: {
      type: String,
      trim: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
    },
    orderStatus: {
      type: String,
      enum: ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        message: {
          type: String,
          default: '',
        },
      },
    ],
    porterDeliveryId: {
      type: String,
      trim: true,
    },
    porterStatus: {
      type: String,
      trim: true,
    },
    estimatedETA: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
