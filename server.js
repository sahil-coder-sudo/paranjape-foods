require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const Razorpay = require('razorpay');
const MenuItem = require('./models/MenuItem');
const ContactMessage = require('./models/ContactMessage');
const Customer = require('./models/Customer');
const Address = require('./models/Address');
const Order = require('./models/Order');

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sunrise-bistro';

app.use(cors());
app.use(express.json());

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// ===== EXISTING ENDPOINTS =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/menu', async (req, res) => {
  try {
    const items = await MenuItem.find().sort({ category: 1, title: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load menu items.' });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    const contact = await ContactMessage.create({ name, email, phone, message });
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: 'Unable to save contact request.' });
  }
});

app.get('/api/contact', async (req, res) => {
  try {
    const contacts = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load contact requests.' });
  }
});

// ===== NEW ORDERING ENDPOINTS =====

// Get or create customer by phone + name
app.post('/api/customer', async (req, res) => {
  try {
    const { phone, name, email } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ error: 'Phone and name are required.' });
    }

    let customer = await Customer.findOne({ phone, name }).populate('addresses');
    if (!customer) {
      customer = await Customer.create({ phone, name, email });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Unable to process customer request.' });
  }
});

// Get customer by ID
app.get('/api/customer/:customerId', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId).populate('addresses').populate('orders');
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch customer.' });
  }
});

// Validate and save address (using Google Maps Geocoding)
app.post('/api/address/validate', async (req, res) => {
  try {
    const { customerId, street, city, state, zipCode } = req.body;
    const fullAddress = `${street}, ${city}, ${state} ${zipCode}`;

    // Geocode address using Google Maps
    const googleMapsUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
    const params = {
      address: fullAddress,
      key: process.env.GOOGLE_MAPS_API_KEY,
    };

    const response = await axios.get(googleMapsUrl, { params });
    if (response.data.results.length === 0) {
      return res.status(400).json({ error: 'Address not found. Please check and try again.' });
    }

    const location = response.data.results[0].geometry.location;
    const address = await Address.create({
      customerId,
      street,
      city,
      state,
      zipCode,
      latitude: location.lat,
      longitude: location.lng,
    });

    // Update customer's addresses
    await Customer.findByIdAndUpdate(customerId, { $push: { addresses: address._id } });

    res.status(201).json(address);
  } catch (error) {
    console.error('Address validation error:', error);
    res.status(500).json({ error: 'Unable to validate address.' });
  }
});

// Get customer addresses
app.get('/api/addresses/:customerId', async (req, res) => {
  try {
    const addresses = await Address.find({ customerId: req.params.customerId });
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch addresses.' });
  }
});

// Create Razorpay order (order.html for payments)
app.post('/api/order/create', async (req, res) => {
  try {
    const { customerId, items, totalAmount, addressId } = req.body;

    if (!customerId || !items || !totalAmount || !addressId) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Create order in our DB (payment_status = pending)
    const order = await Order.create({
      customerId,
      items,
      totalAmount,
      addressId,
      paymentStatus: 'pending',
      orderStatus: 'placed',
    });

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100), // Convert to paise
      currency: 'INR',
      receipt: `order_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        customerId: customerId.toString(),
      },
    });

    // Update our order with Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Unable to create order.' });
  }
});

// Verify payment and confirm order
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpaySignature } = req.body;

    // Verify signature
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(orderId + '|' + razorpayPaymentId);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    // Update order with payment details
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: 'success',
        razorpayPaymentId,
        orderStatus: 'confirmed',
      },
      { new: true }
    );

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    res.json({ success: true, order });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// Get order details
app.get('/api/order/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('customerId')
      .populate('addressId')
      .populate('items.menuItemId');
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch order.' });
  }
});

// Get customer's orders
app.get('/api/orders/:customerId', async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.params.customerId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch orders.' });
  }
});

// Update order status (for tracking)
app.put('/api/order/:orderId/status', async (req, res) => {
  try {
    const { orderStatus, porterStatus, estimatedETA } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.orderId,
      {
        orderStatus,
        porterStatus,
        estimatedETA,
      },
      { new: true }
    );
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

app.listen(port, () => {
  console.log(`Express backend running on http://localhost:${port}`);
});

