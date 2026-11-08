const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Configure reliable DNS servers (Google & Cloudflare) for MongoDB SRV lookups on macOS/Node
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  // Ignore in sandboxed environments
}

// Load environment variables from .env.local, .env, or parent workspace directories
const candidateEnvPaths = [
  path.resolve(__dirname, '.env.local'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
];
const foundEnvPath = candidateEnvPaths.find(p => fs.existsSync(p));
if (foundEnvPath) {
  require('dotenv').config({ path: foundEnvPath });
} else {
  require('dotenv').config();
}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const logger = require('./utils/logger');
const MenuItem = require('./models/MenuItem');
const ContactMessage = require('./models/ContactMessage');
const Customer = require('./models/Customer');
const Address = require('./models/Address');
const Order = require('./models/Order');
const StaffCredential = require('./models/StaffCredential');
const StaffUser = require('./models/StaffUser');
const {
  generateCustomerToken,
  verifyCustomerToken,
  requireCustomerAuth,
  verifyGoogleIdToken,
  generateStaffUserToken,
  verifyStaffUserToken,
} = require('./utils/auth');

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/paranjape_foods';

const corsOptions = {
  origin: true, // Dynamically allows the requesting origin (all Vercel domains, custom domains, and localhost)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-admin-token',
    'x-manager-token',
    'x-delivery-token',
    'x-requested-with',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(logger.requestLogger);

// Root Health & Service Identification Route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Paranjape Foods API',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Initialize Razorpay (only if keys are provided; deferred for now)
let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'your_razorpay_key_id') {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  console.log('Razorpay initialized');
} else {
  console.log('Razorpay keys not configured — payment deferred');
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'paranjape_foods',
})
  .then(() => {
    console.log('MongoDB connected');
    initStaffCredentials();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Real-time SSE (Server-Sent Events) subscription system
const sseSubscribers = new Map(); // orderId string -> Set of res objects
const adminSubscribers = new Set(); // Set of res objects for manager portal

function broadcastOrderUpdate(order, eventType = 'order_update') {
  try {
    const orderIdStr = order._id.toString();
    const payload = JSON.stringify(order);

    // 1. Notify customer listeners tracking this specific order
    const clients = sseSubscribers.get(orderIdStr);
    if (clients && clients.size > 0) {
      for (const client of clients) {
        client.write(`event: ${eventType}\ndata: ${payload}\n\n`);
      }
    }

    // 2. Notify kitchen / manager listeners
    if (adminSubscribers.size > 0) {
      for (const admin of adminSubscribers) {
        admin.write(`event: admin_order_update\ndata: ${payload}\n\n`);
      }
    }
  } catch (err) {
    logger.error('[Realtime SSE] Error broadcasting update:', err);
  }
}

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

// Helper to generate a unique key: YYYY-MM-DD_name
async function generateCustomerKey(name, phone, customDate) {
  const dateStr = customDate || new Date().toISOString().split('T')[0];
  const sanitizedName = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const baseKey = `${dateStr}_${sanitizedName}`;
  let key = baseKey;

  // Ensure key uniqueness across documents
  let existing = await Customer.findOne({ customerKey: key });
  let counter = 1;
  while (existing) {
    const suffix = phone && phone.length >= 4 ? phone.slice(-4) : counter;
    key = `${baseKey}_${suffix}`;
    existing = await Customer.findOne({ customerKey: key });
    counter++;
  }

  return key;
}

// ===== CUSTOMER AUTHENTICATION (PHONE + PASSWORD & GOOGLE SSO) =====

// Register new customer with Phone & Password
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, password, email } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required for registration.' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').trim();
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    }
    if (!password || String(password).trim().length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    const existing = await Customer.findOne({ phone: cleanPhone });
    if (existing) {
      return res.status(409).json({
        error: 'An account with this phone number already exists. Please log in.',
        code: 'ACCOUNT_EXISTS',
      });
    }

    const cleanName = name.trim();
    const customerKey = await generateCustomerKey(cleanName, cleanPhone);

    const customer = new Customer({
      customerKey,
      phone: cleanPhone,
      name: cleanName,
      email: email ? email.trim().toLowerCase() : '',
      authProvider: 'phone_password',
      lastLoginAt: new Date(),
    });
    await customer.setPassword(String(password).trim());
    await customer.save();

    const token = generateCustomerToken(customer);
    logger.info(`[Auth Register] New customer registered: ${customer._id} (${cleanPhone})`);

    res.status(201).json({
      success: true,
      token,
      customer: customer.toJSON(),
      message: 'Account registered successfully',
    });
  } catch (error) {
    logger.error('[Auth Register] Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login customer with Phone & Password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').trim();
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const customer = await Customer.findOne({ phone: cleanPhone })
      .select('+passwordHash')
      .populate('addresses');

    if (!customer) {
      return res.status(404).json({
        error: 'No account found with this phone number. Please register first.',
        code: 'USER_NOT_FOUND',
      });
    }

    // If account was created before passwords existed, initialize their password now
    if (!customer.passwordHash) {
      await customer.setPassword(String(password).trim());
      await customer.save();
    } else {
      const isMatch = await customer.comparePassword(String(password).trim());
      if (!isMatch) {
        return res.status(401).json({
          error: 'Incorrect password. Please try again.',
          code: 'INVALID_CREDENTIALS',
        });
      }
    }

    customer.lastLoginAt = new Date();
    await customer.save();

    const token = generateCustomerToken(customer);
    logger.info(`[Auth Login] Customer logged in: ${customer._id} (${cleanPhone})`);

    res.json({
      success: true,
      token,
      customer: customer.toJSON(),
      message: 'Login successful',
    });
  } catch (error) {
    logger.error('[Auth Login] Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Customer Password Reset: verify phone and update password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword) {
      return res.status(400).json({ error: 'Phone number and new password are required.' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (String(newPassword).trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const customer = await Customer.findOne({
      $or: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }],
    }).select('+passwordHash');

    if (!customer) {
      return res.status(404).json({ error: 'No account found with this phone number.' });
    }

    await customer.setPassword(String(newPassword).trim());
    customer.lastLoginAt = new Date();
    await customer.save();

    const token = generateCustomerToken(customer);
    logger.info(`[Auth Reset] Password reset successfully for customer ${customer._id} (${cleanPhone})`);

    res.json({
      success: true,
      token,
      customer: customer.toJSON(),
      message: 'Password reset successfully. You are now logged in.',
    });
  } catch (error) {
    logger.error('[Auth Reset] Reset error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
});

// Google SSO: Verify Google Identity Services ID token & sign in / register
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required.' });
    }

    const payload = await verifyGoogleIdToken(credential);
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google account did not provide an email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let customer = await Customer.findOne({
      $or: [{ googleId }, { email: cleanEmail }],
    }).populate('addresses');

    if (!customer) {
      // Register new user via Google
      const customerKey = await generateCustomerKey(name || 'google_user', 'google');
      customer = await Customer.create({
        customerKey,
        name: name || 'Google Customer',
        email: cleanEmail,
        googleId,
        avatar: picture || '',
        authProvider: 'google',
        lastLoginAt: new Date(),
      });
      logger.info(`[Auth Google] New customer registered via Google SSO: ${customer._id} (${cleanEmail})`);
    } else {
      // Existing user logging in via Google
      if (!customer.googleId) customer.googleId = googleId;
      if (picture && !customer.avatar) customer.avatar = picture;
      customer.lastLoginAt = new Date();
      await customer.save();
      logger.info(`[Auth Google] Existing customer logged in via Google SSO: ${customer._id} (${cleanEmail})`);
    }

    const token = generateCustomerToken(customer);
    res.json({
      success: true,
      token,
      customer: customer.toJSON(),
      message: 'Google login successful',
    });
  } catch (error) {
    logger.error('[Auth Google] Google authentication error:', error);
    res.status(400).json({ error: error.message || 'Google authentication failed.' });
  }
});

// Get currently authenticated customer session
app.get('/api/auth/me', requireCustomerAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.customer.customerId)
      .populate('addresses')
      .populate('orders');

    if (!customer) {
      return res.status(404).json({ error: 'Customer session not found.' });
    }

    res.json({
      success: true,
      customer: customer.toJSON(),
    });
  } catch (error) {
    logger.error('[Auth Me] Error fetching session:', error);
    res.status(500).json({ error: 'Failed to retrieve customer session.' });
  }
});

// Get, create, or update customer by phone number
app.post('/api/customer', async (req, res) => {
  try {
    const { phone, name, email } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/\D/g, '').trim();
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    }

    const cleanName = (name || '').trim();

    // Find customer strictly by phone number
    let customer = await Customer.findOne({ phone: cleanPhone }).populate('addresses');

    if (!customer) {
      // NEW CUSTOMER: Create record
      if (!cleanName) {
        return res.status(400).json({ error: 'Name is required for new registration.' });
      }

      const customerKey = await generateCustomerKey(cleanName, cleanPhone);
      customer = await Customer.create({
        customerKey,
        phone: cleanPhone,
        name: cleanName,
        email: email ? email.trim() : '',
        lastLoginAt: new Date(),
      });
    } else {
      // EXISTING CUSTOMER: Update profile fields by phone number
      if (cleanName) {
        customer.name = cleanName;
      }
      if (email !== undefined && email !== null) {
        customer.email = email.trim();
      }
      customer.lastLoginAt = new Date();

      // Backfill customerKey if missing from an earlier record
      if (!customer.customerKey) {
        const createdDate = customer.createdAt
          ? customer.createdAt.toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        customer.customerKey = await generateCustomerKey(customer.name, cleanPhone, createdDate);
      }

      await customer.save();
    }

    const token = generateCustomerToken(customer);
    const customerObj = customer.toJSON ? customer.toJSON() : customer.toObject();
    res.json({ ...customerObj, token });
  } catch (error) {
    console.error('Customer processing error:', error);
    res.status(500).json({ error: 'Unable to process customer request.' });
  }
});

// Get customer by phone number
app.get('/api/customer/phone/:phone', async (req, res) => {
  try {
    const cleanPhone = String(req.params.phone).replace(/\D/g, '').trim();
    const customer = await Customer.findOne({ phone: cleanPhone })
      .populate('addresses')
      .populate('orders');
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch customer by phone.' });
  }
});

// Get customer by unique key (YYYY-MM-DD_name)
app.get('/api/customer/key/:customerKey', async (req, res) => {
  try {
    const customer = await Customer.findOne({ customerKey: req.params.customerKey })
      .populate('addresses')
      .populate('orders');
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch customer by key.' });
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

// Validate and save address directly from customer input
app.post('/api/address/validate', async (req, res) => {
  try {
    const { customerId, flatNo, buildingName, street, city, state, zipCode, latitude, longitude } = req.body;

    const trimmedFlat = String(flatNo || '').trim();
    const trimmedBldg = String(buildingName || '').trim();
    const trimmedStreet = String(street || '').trim();

    if (!customerId || (!trimmedStreet && !trimmedBldg) || !city) {
      return res.status(400).json({ error: 'Please provide building/street and city.' });
    }

    let lat = typeof latitude === 'number' ? latitude : parseFloat(latitude);
    let lng = typeof longitude === 'number' ? longitude : parseFloat(longitude);

    // Default coordinates if unset
    if (isNaN(lat) || isNaN(lng)) {
      lat = 18.5204;
      lng = 73.8567;
    }

    const address = await Address.create({
      customerId,
      flatNo: trimmedFlat,
      buildingName: trimmedBldg,
      street: trimmedStreet || trimmedBldg,
      city,
      state: state || 'Maharashtra',
      zipCode: zipCode || '',
      latitude: lat,
      longitude: lng,
    });

    // Update customer's addresses
    await Customer.findByIdAndUpdate(customerId, { $push: { addresses: address._id } });

    res.status(201).json(address);
  } catch (error) {
    console.error('Address save error:', error);
    res.status(500).json({ error: error.message || 'Unable to save address.' });
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

// Create order
app.post('/api/order/create', async (req, res) => {
  try {
    const { customerId, items, totalAmount, addressId, paymentMethod = 'razorpay' } = req.body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0 || !totalAmount || !addressId) {
      logger.warn('[Order Create] Missing required fields in request body:', { customerId, itemsLength: items?.length, totalAmount, addressId });
      return res.status(400).json({ error: 'Missing required order fields (customer, items, address, or total).' });
    }

    // Format items ensuring menuItemId is string and quantity/price are clean numbers
    const formattedItems = items.map((i) => ({
      menuItemId: (i.menuItemId || i._id || 'item').toString(),
      title: i.title || 'Delicious Food',
      quantity: Math.max(1, Number(i.quantity) || 1),
      price: Math.max(0, Number(String(i.price).replace(/[^0-9.]/g, '')) || 0),
    }));

    // Create order in DB with 'pending' status
    const order = await Order.create({
      customerId,
      items: formattedItems,
      totalAmount: Number(totalAmount),
      addressId,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'placed',
      statusHistory: [
        {
          status: 'placed',
          timestamp: new Date(),
          message: 'Order received and confirmed by Paranjape Foods.',
        },
      ],
    });

    // Link order to customer record
    await Customer.findByIdAndUpdate(customerId, { $push: { orders: order._id } });

    logger.info(`[Order Create] Order created successfully: ${order._id}`, {
      customerId,
      itemCount: formattedItems.length,
      totalAmount,
    });

    // Broadcast new order to Kitchen/Manager portal
    try {
      const populatedNewOrder = await Order.findById(order._id)
        .populate('customerId')
        .populate('addressId')
        .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');
      if (populatedNewOrder) {
        broadcastOrderUpdate(populatedNewOrder, 'new_order');
      }
    } catch (popErr) {
      // Non-blocking broadcast
    }

    // Check if Razorpay is configured with real keys
    let razorpayOrderId = null;
    const isRealRazorpayKey =
      process.env.RAZORPAY_KEY_ID &&
      !process.env.RAZORPAY_KEY_ID.includes('your_') &&
      !process.env.RAZORPAY_KEY_ID.includes('placeholder');

    if (razorpay && isRealRazorpayKey) {
      try {
        const razorpayOrder = await razorpay.orders.create({
          amount: Math.round(Number(totalAmount) * 100), // Convert to paise
          currency: 'INR',
          receipt: `order_${order._id.toString().slice(-8)}`,
          notes: {
            orderId: order._id.toString(),
            customerId: customerId.toString(),
          },
        });
        razorpayOrderId = razorpayOrder.id;
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();
        logger.info(`[Order Create] Razorpay order initialized: ${razorpayOrderId}`);
      } catch (rzpErr) {
        logger.warn('[Order Create] Razorpay creation failed, fallback to Pay on Delivery:', rzpErr.message);
      }
    }

    res.status(201).json({
      orderId: order._id,
      razorpayOrderId,
      amount: totalAmount,
      isRazorpayConfigured: !!razorpayOrderId,
      paymentMethod: razorpayOrderId ? 'razorpay' : 'cod',
      message: razorpayOrderId
        ? 'Razorpay order created successfully.'
        : 'Order placed successfully! (Payment can be completed via Cash/UPI on delivery)',
    });
  } catch (error) {
    logger.error('[Order Create] Failed to create order:', error);
    res.status(500).json({ error: error.message || 'Unable to create order.' });
  }
});

// Endpoint to inspect recent logs
app.get('/api/logs', (req, res) => {
  try {
    const logPath = path.join(__dirname, 'logs', 'server.log');
    if (!fs.existsSync(logPath)) {
      return res.json({ count: 0, logs: ['No logs recorded yet.'] });
    }
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const recent = lines.slice(-100);
    res.json({ count: recent.length, logs: recent });
  } catch (err) {
    res.status(500).json({ error: 'Unable to read log file.' });
  }
});

// Verify payment and confirm order
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) return res.status(404).json({ error: 'Order not found.' });

    // If Razorpay is not configured, skip signature verification
    if (!razorpay) {
      existingOrder.paymentStatus = 'unpaid'; // Will be collected on delivery
      existingOrder.orderStatus = 'confirmed';
      await existingOrder.save();
      return res.json({ status: 'ok', order: existingOrder });
    }

    // Razorpay signature verification
    const rzpOrderRef = razorpayOrderId || existingOrder.razorpayOrderId;
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update((rzpOrderRef || orderId) + '|' + razorpayPaymentId);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpaySignature) {
      logger.warn(`[Payment Verify] Signature mismatch for order ${orderId}`);
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    // Update order with payment details
    existingOrder.paymentStatus = 'paid';
    existingOrder.paymentMethod = 'razorpay';
    existingOrder.razorpayPaymentId = razorpayPaymentId;
    existingOrder.orderStatus = 'confirmed';
    if (!Array.isArray(existingOrder.statusHistory)) existingOrder.statusHistory = [];
    existingOrder.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date(),
      message: `Payment of ₹${existingOrder.totalAmount} received successfully via Razorpay (ID: ${razorpayPaymentId}).`,
    });
    await existingOrder.save();

    const populated = await Order.findById(existingOrder._id)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');

    broadcastOrderUpdate(populated, 'order_update');
    logger.info(`[Payment Verify] Order ${existingOrder._id} verified and paid via Razorpay`);

    res.json({ success: true, order: populated });
  } catch (error) {
    logger.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});

// Get order details
app.get('/api/order/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (error) {
    logger.error('[Order Get] Error fetching order:', error);
    res.status(500).json({ error: 'Unable to fetch order.' });
  }
});

// Get customer's orders
app.get('/api/orders/:customerId', async (req, res) => {
  try {
    const orders = await Order.find({ customerId: req.params.customerId })
      .populate('addressId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    logger.error('[Customer Orders] Error fetching orders:', error);
    res.status(500).json({ error: 'Unable to fetch orders.' });
  }
});

// ===== KITCHEN & DELIVERY AUTHENTICATION =====
const isProduction = process.env.NODE_ENV === 'production';
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || (isProduction ? null : 'admin2026') || 'admin2026';
const MANAGER_PASSCODE = process.env.MANAGER_PASSCODE || (isProduction ? null : 'paranjape2026') || 'paranjape2026';
const DELIVERY_PASSCODE = process.env.DELIVERY_PASSCODE || (isProduction ? null : 'rider2026') || 'rider2026';
const AUTH_SECRET = process.env.MANAGER_AUTH_SECRET || process.env.JWT_SECRET || 'paranjape_kitchen_auth_secret_key_2026';

async function initStaffCredentials() {
  try {
    const roles = [
      { role: 'admin', defaultPass: ADMIN_PASSCODE },
      { role: 'manager', defaultPass: MANAGER_PASSCODE },
      { role: 'delivery', defaultPass: DELIVERY_PASSCODE },
    ];
    for (const item of roles) {
      const exists = await StaffCredential.findOne({ role: item.role });
      if (!exists && item.defaultPass) {
        const cred = new StaffCredential({ role: item.role, updatedBy: 'system' });
        await cred.setPasscode(item.defaultPass);
        await cred.save();
        logger.info(`[Staff Credentials] Initialized default credentials for role: ${item.role}`);
      }
    }

    // Seed default Manager & Delivery StaffUser accounts if none exist
    const staffCount = await StaffUser.countDocuments();
    if (staffCount === 0) {
      const defaultOwner = new StaffUser({
        name: 'Kitchen Manager / Owner',
        phone: '9082305196',
        email: 'manager@paranjapefoods.com',
        role: 'owner',
        isActive: true,
      });
      await defaultOwner.setPassword('paranjape2026');
      await defaultOwner.save();

      const defaultRider = new StaffUser({
        name: 'Delivery Rider 1',
        phone: '9082305196',
        role: 'delivery',
        vehicleNumber: 'MH 47 PF 2026',
        isActive: true,
      });
      await defaultRider.setPassword('rider2026');
      await defaultRider.save();

      logger.info('[Staff Users] Seeded initial Owner (9876540001) and Delivery Partner (9876540002)');
    }
  } catch (err) {
    logger.error('[Staff Credentials] Error initializing credentials:', err);
  }
}

async function verifyRolePasscode(role, candidatePasscode) {
  const clean = String(candidatePasscode || '').trim();
  if (!clean) return false;

  try {
    const cred = await StaffCredential.findOne({ role });
    if (cred && cred.passcodeHash) {
      const match = await cred.comparePasscode(clean);
      if (match) return true;
    }
  } catch (err) {
    logger.error(`[Staff Auth] Error verifying credential for role ${role}:`, err);
  }

  // Fallback to env passcodes
  if (role === 'admin' && ADMIN_PASSCODE && clean === ADMIN_PASSCODE) return true;
  if (role === 'manager' && MANAGER_PASSCODE && clean === MANAGER_PASSCODE) return true;
  if (role === 'delivery' && DELIVERY_PASSCODE && clean === DELIVERY_PASSCODE) return true;

  // Master Admin passcode can also authenticate manager & delivery
  if (ADMIN_PASSCODE && clean === ADMIN_PASSCODE) return true;

  return false;
}

if (isProduction && (!process.env.MANAGER_PASSCODE || !process.env.DELIVERY_PASSCODE)) {
  logger.warn('[Auth Warning] MANAGER_PASSCODE or DELIVERY_PASSCODE is not set in environment variables! Please configure in Heroku / production.');
}

function generateStaffToken(role = 'manager') {
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours validity
  const payload = `${role}:${expiry}`;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

function verifyStaffToken(token, allowedRoles = ['admin', 'owner', 'manager', 'delivery']) {
  if (!token || typeof token !== 'string') return null;

  // 1. Check if token is a modern StaffUser JWT
  if (token.includes('.')) {
    const jwtStaff = verifyStaffUserToken(token, allowedRoles);
    if (jwtStaff) {
      return {
        role: jwtStaff.role,
        staffId: jwtStaff.staffId,
        name: jwtStaff.name,
        phone: jwtStaff.phone,
        vehicleNumber: jwtStaff.vehicleNumber,
      };
    }
  }

  // 2. Fallback to HMAC staff token (role:expiry:signature)
  const parts = token.split(':');
  if (parts.length === 3) {
    const [role, expiryStr, signature] = parts;
    if (!allowedRoles.includes(role)) return null;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return null;
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(`${role}:${expiryStr}`).digest('hex');
    if (signature === expected) {
      return { role, expiry };
    }
  }

  return null;
}

function generateManagerToken() {
  return generateStaffToken('manager');
}

function verifyManagerToken(token) {
  return !!verifyStaffToken(token, ['manager', 'owner', 'admin']);
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['x-admin-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  if (!token || !verifyStaffToken(token, ['admin'])) {
    logger.warn(`[Admin Auth] Unauthorized access attempt to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      error: 'Unauthorized. Master administrator authentication required.',
      code: 'UNAUTHORIZED_ADMIN',
    });
  }
  next();
}

function requireManagerAuth(req, res, next) {
  const authHeader = req.headers['x-manager-token'] || req.headers['x-admin-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  const staff = verifyStaffToken(token, ['manager', 'owner', 'admin']);
  if (!token || !staff) {
    logger.warn(`[Manager Auth] Unauthorized access attempt to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      error: 'Unauthorized. Kitchen manager or owner authentication required.',
      code: 'UNAUTHORIZED_MANAGER',
    });
  }
  req.staff = staff;
  next();
}

function requireDeliveryAuth(req, res, next) {
  const authHeader = req.headers['x-delivery-token'] || req.headers['x-manager-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  const staff = verifyStaffToken(token, ['delivery', 'manager', 'owner', 'admin']);
  if (!token || !staff) {
    logger.warn(`[Delivery Auth] Unauthorized access attempt to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      error: 'Unauthorized. Delivery partner authentication required.',
      code: 'UNAUTHORIZED_DELIVERY',
    });
  }
  req.staff = staff;
  next();
}

// Authenticate kitchen staff / manager with Phone + Password OR passcode
app.post('/api/admin/auth/verify', async (req, res) => {
  try {
    const { phone, password, passcode } = req.body;

    // A. Phone + Password (Individual Staff Account)
    if (phone && password) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const staffUser = await StaffUser.findOne({
        $or: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }],
      }).select('+passwordHash');

      if (!staffUser) {
        return res.status(401).json({
          success: false,
          error: 'No manager or owner account found with this phone number.',
        });
      }

      if (!staffUser.isActive) {
        return res.status(403).json({
          success: false,
          error: 'This manager account has been deactivated.',
        });
      }

      if (!['owner', 'manager'].includes(staffUser.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access restricted to Managers and Owners.',
        });
      }

      const isMatch = await staffUser.comparePassword(String(password).trim());
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect password. Please try again.',
        });
      }

      staffUser.lastLoginAt = new Date();
      await staffUser.save();

      const token = generateStaffUserToken(staffUser);
      logger.info(`[Manager Auth] Staff ${staffUser.name} (${staffUser.phone}) logged in to Kitchen Portal`);
      return res.json({
        success: true,
        token,
        role: staffUser.role,
        user: staffUser.toJSON(),
        message: 'Authentication successful',
      });
    }

    // B. Passcode fallback
    const cleanPasscode = String(passcode || password || '').trim();
    const isValid = await verifyRolePasscode('manager', cleanPasscode);

    if (!isValid) {
      logger.warn('[Manager Auth] Invalid passcode attempt entered');
      return res.status(401).json({
        success: false,
        error: 'Incorrect credentials. Enter your phone & password or staff passcode.',
      });
    }

    const token = generateManagerToken();
    logger.info('[Manager Auth] Staff authenticated to Kitchen Portal via passcode');
    res.json({
      success: true,
      token,
      role: 'manager',
      expiresIn: '24h',
      message: 'Authentication successful',
    });
  } catch (err) {
    logger.error('[Manager Auth] Error verifying passcode:', err);
    res.status(500).json({ error: 'Server authentication error.' });
  }
});

// Check if manager session token is still valid
app.get('/api/admin/auth/check', (req, res) => {
  const authHeader = req.headers['x-manager-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  const staff = token ? verifyStaffToken(token, ['manager', 'owner', 'admin']) : null;
  if (staff) {
    return res.json({ authenticated: true, role: staff.role, user: staff });
  }
  res.status(401).json({ authenticated: false, error: 'Session expired or invalid.' });
});

// Authenticate delivery partner with Phone + PIN OR passcode
app.post('/api/delivery/auth/verify', async (req, res) => {
  try {
    const { phone, password, passcode } = req.body;

    // A. Phone + PIN (Individual Delivery Partner Account)
    if (phone && (password || passcode)) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const staffUser = await StaffUser.findOne({
        $or: [{ phone: cleanPhone }, { phone: `+91${cleanPhone}` }, { phone: `91${cleanPhone}` }],
      }).select('+passwordHash');

      if (!staffUser) {
        return res.status(401).json({
          success: false,
          error: 'No rider account found with this phone number.',
        });
      }

      if (!staffUser.isActive) {
        return res.status(403).json({
          success: false,
          error: 'This delivery partner account is currently inactive.',
        });
      }

      if (!['delivery', 'owner'].includes(staffUser.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access restricted to Delivery Fleet partners.',
        });
      }

      const inputPin = String(password || passcode).trim();
      const isMatch = await staffUser.comparePassword(inputPin);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect rider PIN. Please try again.',
        });
      }

      staffUser.lastLoginAt = new Date();
      await staffUser.save();

      const token = generateStaffUserToken(staffUser);
      logger.info(`[Delivery Auth] Rider ${staffUser.name} (${staffUser.phone}) logged in to Rider Portal`);
      return res.json({
        success: true,
        token,
        role: staffUser.role,
        user: staffUser.toJSON(),
        message: 'Delivery partner authentication successful',
      });
    }

    // B. Passcode fallback
    const cleanPasscode = String(passcode || password || '').trim();
    const isValid = (await verifyRolePasscode('delivery', cleanPasscode)) || (await verifyRolePasscode('manager', cleanPasscode));

    if (!isValid) {
      logger.warn('[Delivery Auth] Invalid delivery passcode attempt entered');
      return res.status(401).json({
        success: false,
        error: 'Incorrect rider credentials. Enter your phone & PIN or staff passcode.',
      });
    }

    const token = generateStaffToken('delivery');
    logger.info('[Delivery Auth] Delivery partner authenticated to Delivery Portal via passcode');
    res.json({
      success: true,
      token,
      role: 'delivery',
      expiresIn: '24h',
      message: 'Delivery partner authentication successful',
    });
  } catch (err) {
    logger.error('[Delivery Auth] Error verifying delivery passcode:', err);
    res.status(500).json({ error: 'Server authentication error.' });
  }
});

// Check if delivery partner session token is still valid
app.get('/api/delivery/auth/check', (req, res) => {
  const authHeader = req.headers['x-delivery-token'] || req.headers['x-manager-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  const staff = token ? verifyStaffToken(token, ['delivery', 'manager', 'owner', 'admin']) : null;
  if (staff) {
    return res.json({ authenticated: true, role: staff.role, user: staff });
  }
  res.status(401).json({ authenticated: false, error: 'Session expired or invalid.' });
});

// Delivery Partner: Fetch orders relevant to pickup & delivery
app.get('/api/delivery/orders', requireDeliveryAuth, async (req, res) => {
  try {
    const orders = await Order.find({
      orderStatus: { $in: ['ready', 'out_for_delivery', 'delivered'] },
    })
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus')
      .sort({ updatedAt: -1 })
      .limit(60);

    // Sort order: active in-transit first, then ready for pickup, then delivered
    const priority = { out_for_delivery: 1, ready: 2, delivered: 3 };
    orders.sort((a, b) => (priority[a.orderStatus] || 99) - (priority[b.orderStatus] || 99));

    res.json(orders);
  } catch (error) {
    logger.error('[Delivery Orders] Error fetching delivery orders:', error);
    res.status(500).json({ error: 'Unable to fetch delivery orders.' });
  }
});

// Delivery Partner: Mark order as Picked Up (Out for Delivery)
app.put('/api/delivery/order/:orderId/pickup', requireDeliveryAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    order.orderStatus = 'out_for_delivery';

    // Auto-assign to current rider if not already assigned
    if (!order.assignedRiderId && req.staff && req.staff.staffId) {
      order.assignedRiderId = req.staff.staffId;
      order.assignedAt = new Date();
    }

    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    order.statusHistory.push({
      status: 'out_for_delivery',
      timestamp: new Date(),
      message: 'Delivery partner has picked up your food container and is on the way to your doorstep.',
    });

    await order.save();
    const populated = await Order.findById(order._id)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');

    broadcastOrderUpdate(populated, 'order_update');
    logger.info(`[Delivery Pickup] Order ${order._id} marked out for delivery`);
    res.json(populated);
  } catch (error) {
    logger.error('[Delivery Pickup] Failed to mark order picked up:', error);
    res.status(500).json({ error: 'Failed to mark picked up.' });
  }
});

// Delivery Partner: Mark order as Delivered to customer
app.put('/api/delivery/order/:orderId/deliver', requireDeliveryAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    order.orderStatus = 'delivered';
    order.paymentStatus = 'paid'; // Cash / UPI collected at doorstep
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    order.statusHistory.push({
      status: 'delivered',
      timestamp: new Date(),
      message: 'Order safely handed over to resident. Thank you for choosing Paranjape Foods!',
    });

    await order.save();
    const populated = await Order.findById(order._id)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');

    broadcastOrderUpdate(populated, 'order_update');
    logger.info(`[Delivery Complete] Order ${order._id} marked delivered`);
    res.json(populated);
  } catch (error) {
    logger.error('[Delivery Complete] Failed to mark order delivered:', error);
    res.status(500).json({ error: 'Failed to mark delivered.' });
  }
});

// Admin / Kitchen Manager: Fetch all orders with optional filter
app.get('/api/admin/orders', requireManagerAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status === 'active') {
      query.orderStatus = { $in: ['placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery'] };
    } else if (status === 'completed') {
      query.orderStatus = 'delivered';
    } else if (status === 'cancelled') {
      query.orderStatus = 'cancelled';
    } else if (status && status !== 'all') {
      query.orderStatus = status;
    }

    const orders = await Order.find(query)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(orders);
  } catch (error) {
    logger.error('[Admin Orders] Error fetching orders:', error);
    res.status(500).json({ error: 'Unable to fetch orders for manager.' });
  }
});

// Update order status (for kitchen/delivery tracking)
app.put('/api/order/:orderId/status', requireManagerAuth, async (req, res) => {
  try {
    const { orderStatus, note, porterStatus, estimatedETA } = req.body;
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const statusDescriptions = {
      placed: 'Order received and confirmed.',
      confirmed: 'Order acknowledged by Paranjape Foods kitchen.',
      preparing: 'Chef is preparing and packaging your dishes.',
      ready: 'Meal is neatly packed, sealed & ready for delivery pickup.',
      out_for_delivery: 'Delivery partner has picked up your meal and is on the way.',
      delivered: 'Order safely handed over to resident. Bon appétit!',
      cancelled: 'Order has been cancelled.',
    };

    if (orderStatus) {
      order.orderStatus = orderStatus;
      const message = note || statusDescriptions[orderStatus] || `Status updated to ${orderStatus}`;
      if (!Array.isArray(order.statusHistory)) {
        order.statusHistory = [];
      }
      order.statusHistory.push({
        status: orderStatus,
        timestamp: new Date(),
        message,
      });
    }

    if (porterStatus) order.porterStatus = porterStatus;
    if (estimatedETA) order.estimatedETA = new Date(estimatedETA);

    await order.save();

    const populated = await Order.findById(order._id)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');

    // Real-time broadcast to customer & kitchen streams
    broadcastOrderUpdate(populated, 'order_update');

    logger.info(`[Order Status] Order ${order._id} updated to ${orderStatus}`);
    res.json(populated);
  } catch (error) {
    logger.error('[Order Status] Failed to update order status:', error);
    res.status(500).json({ error: 'Unable to update order status.' });
  }
});

// Manager / Admin: Edit Customer Delivery Address on an Order
app.put('/api/admin/order/:orderId/address', requireManagerAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { flatNo, buildingName, street, city, state, zipCode } = req.body;

    const order = await Order.findById(orderId).populate('addressId');
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    let address = null;
    if (order.addressId && order.addressId._id) {
      address = await Address.findById(order.addressId._id);
    }

    if (address) {
      if (flatNo !== undefined) address.flatNo = String(flatNo).trim();
      if (buildingName !== undefined) address.buildingName = String(buildingName).trim();
      if (street !== undefined) address.street = String(street).trim();
      if (city !== undefined) address.city = String(city).trim();
      if (state !== undefined) address.state = String(state).trim();
      if (zipCode !== undefined) address.zipCode = String(zipCode).trim();
      await address.save();
    } else {
      address = await Address.create({
        customerId: order.customerId,
        flatNo: String(flatNo || '').trim(),
        buildingName: String(buildingName || '').trim(),
        street: String(street || buildingName || '').trim(),
        city: String(city || '').trim(),
        state: String(state || '').trim(),
        zipCode: String(zipCode || '').trim(),
        latitude: 18.5204,
        longitude: 73.8567,
      });
      order.addressId = address._id;
      await order.save();
    }

    const updatedOrder = await Order.findById(orderId)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');

    // Broadcast update to real-time SSE streams
    broadcastOrderUpdate(updatedOrder, 'order_update');

    logger.info(`[Order Address] Manager updated delivery address for order ${orderId}`);
    res.json({
      success: true,
      message: 'Delivery address updated successfully.',
      order: updatedOrder,
      address,
    });
  } catch (err) {
    logger.error('[Order Address] Error updating order address:', err);
    res.status(500).json({ error: 'Failed to update delivery address.' });
  }
});

// Manager / Admin: Fetch Active Delivery Fleet Partners
app.get('/api/staff/riders', requireManagerAuth, async (req, res) => {
  try {
    const riders = await StaffUser.find({ role: 'delivery', isActive: true })
      .select('name phone vehicleNumber currentStatus lastLoginAt')
      .sort({ name: 1 });
    res.json(riders);
  } catch (err) {
    logger.error('[Staff Riders] Error fetching delivery fleet:', err);
    res.status(500).json({ error: 'Failed to fetch delivery fleet.' });
  }
});

// Manager / Admin: Assign or Reassign an Order to a Delivery Partner
app.put('/api/admin/order/:orderId/assign-rider', requireManagerAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    let rider = null;
    if (riderId) {
      rider = await StaffUser.findOne({ _id: riderId, role: 'delivery', isActive: true });
      if (!rider) {
        return res.status(400).json({ error: 'Selected delivery partner was not found or is inactive.' });
      }

      order.assignedRiderId = rider._id;
      order.assignedAt = new Date();

      if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
      order.statusHistory.push({
        status: order.orderStatus,
        timestamp: new Date(),
        message: `Assigned to delivery partner ${rider.name} (${rider.vehicleNumber || rider.phone})`,
      });

      logger.info(`[Order Assign] Order ${orderId} assigned to rider ${rider.name} (${rider.phone})`);
    } else {
      // Unassign
      order.assignedRiderId = null;
      order.assignedAt = null;

      if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
      order.statusHistory.push({
        status: order.orderStatus,
        timestamp: new Date(),
        message: 'Order unassigned from delivery partner.',
      });

      logger.info(`[Order Assign] Order ${orderId} unassigned`);
    }

    await order.save();

    const populated = await Order.findById(orderId)
      .populate('customerId')
      .populate('addressId')
      .populate('assignedRiderId', 'name phone vehicleNumber currentStatus');

    // Broadcast update to real-time SSE streams
    broadcastOrderUpdate(populated, 'order_update');

    res.json({
      success: true,
      message: rider ? `Order assigned to ${rider.name}!` : 'Order unassigned successfully.',
      order: populated,
      rider: rider ? { id: rider._id, name: rider.name, phone: rider.phone, vehicleNumber: rider.vehicleNumber } : null,
    });
  } catch (err) {
    logger.error('[Order Assign] Error assigning rider:', err);
    res.status(500).json({ error: 'Failed to assign delivery partner.' });
  }
});

// Real-Time SSE Stream for a single order (Customer Live Tracking)
app.get('/api/order/:orderId/stream', (req, res) => {
  const { orderId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  if (!sseSubscribers.has(orderId)) {
    sseSubscribers.set(orderId, new Set());
  }
  sseSubscribers.get(orderId).add(res);

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', orderId })}\n\n`);

  req.on('close', () => {
    const clients = sseSubscribers.get(orderId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseSubscribers.delete(orderId);
    }
  });
});

// Real-Time SSE Stream for Manager Portal (All Orders live updates)
app.get('/api/admin/orders/stream', (req, res) => {
  const authHeader = req.headers['x-manager-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  if (!token || !verifyManagerToken(token)) {
    return res.status(401).json({ error: 'Unauthorized stream connection.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  adminSubscribers.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', role: 'manager' })}\n\n`);

  req.on('close', () => {
    adminSubscribers.delete(res);
  });
});

// ===== ADMIN MASTER PORTAL & CREDENTIAL MANAGEMENT APIS =====

// 1. Admin Master Login
app.post('/api/admin/master-auth', async (req, res) => {
  try {
    const { passcode } = req.body;
    const isValid = await verifyRolePasscode('admin', passcode);

    if (!isValid) {
      logger.warn('[Admin Auth] Invalid admin passcode attempt');
      return res.status(401).json({ success: false, error: 'Invalid master admin passcode.' });
    }

    const token = generateStaffToken('admin');
    logger.info('[Admin Auth] Administrator authenticated successfully');
    res.json({
      success: true,
      token,
      role: 'admin',
      expiresIn: '24h',
      message: 'Admin authentication successful',
    });
  } catch (err) {
    logger.error('[Admin Auth] Login error:', err);
    res.status(500).json({ error: 'Server authentication error.' });
  }
});

// 2. Admin Session Check
app.get('/api/admin/auth/check-master', (req, res) => {
  const authHeader = req.headers['x-admin-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  if (token && verifyStaffToken(token, ['admin'])) {
    return res.json({ authenticated: true, role: 'admin' });
  }
  res.status(401).json({ authenticated: false, error: 'Admin session expired or invalid.' });
});

// 3. Admin Overview / Analytics
app.get('/api/admin/overview', requireAdminAuth, async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalMenuItems = await MenuItem.countDocuments();

    // Aggregated revenue (exclude cancelled)
    const revenueAgg = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    // Status breakdown
    const statusCounts = await Order.aggregate([
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
    ]);
    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    // Recent 10 orders
    const recentOrders = await Order.find()
      .populate('customerId', 'name phone')
      .populate('addressId', 'buildingName street city')
      .sort({ createdAt: -1 })
      .limit(10);

    // Today's live operational metrics (resets every midnight IST)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayStart = new Date(`${todayStr}T00:00:00+05:30`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999+05:30`);

    const todayOrdersCount = await Order.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    const todayDeliveredCount = await Order.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
      orderStatus: 'delivered',
    });

    const todayRevenueAgg = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: todayStart, $lte: todayEnd },
          orderStatus: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    let todayRevenue = 0;
    let todayUpiRevenue = 0;
    let todayCodRevenue = 0;
    todayRevenueAgg.forEach((r) => {
      todayRevenue += r.total;
      if (r._id === 'razorpay' || r._id === 'upi') todayUpiRevenue += r.total;
      else todayCodRevenue += r.total;
    });

    res.json({
      totalRevenue,
      totalOrders,
      totalCustomers,
      totalMenuItems,
      statusCounts: statusMap,
      recentOrders,
      today: {
        date: todayStr,
        ordersCount: todayOrdersCount,
        deliveredCount: todayDeliveredCount,
        revenue: todayRevenue,
        upiRevenue: todayUpiRevenue,
        codRevenue: todayCodRevenue,
      },
    });
  } catch (err) {
    logger.error('[Admin Overview] Error generating stats:', err);
    res.status(500).json({ error: 'Failed to retrieve overview stats.' });
  }
});

// 3B. Comprehensive Reports & Historical Analytics (Daily, Monthly, Custom Range)
app.get('/api/admin/reports', requireManagerAuth, async (req, res) => {
  try {
    const { period = 'daily', month, date, startDate, endDate } = req.query;

    let query = {};
    if (date) {
      const dayStart = new Date(`${date}T00:00:00+05:30`);
      const dayEnd = new Date(`${date}T23:59:59.999+05:30`);
      query.createdAt = { $gte: dayStart, $lte: dayEnd };
    } else if (month) {
      const [year, m] = month.split('-');
      const monthStart = new Date(`${year}-${m}-01T00:00:00+05:30`);
      const lastDay = new Date(parseInt(year, 10), parseInt(m, 10), 0).getDate();
      const monthEnd = new Date(`${year}-${m}-${String(lastDay).padStart(2, '0')}T23:59:59.999+05:30`);
      query.createdAt = { $gte: monthStart, $lte: monthEnd };
    } else if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00+05:30`);
      const end = new Date(`${endDate}T23:59:59.999+05:30`);
      query.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(query)
      .populate('customerId', 'name phone email')
      .populate('addressId', 'buildingName street city zipCode')
      .populate('assignedRiderId', 'name phone vehicleNumber')
      .sort({ createdAt: -1 });

    let totalOrders = orders.length;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    let activeOrders = 0;
    let totalRevenue = 0;
    let upiRevenue = 0;
    let codRevenue = 0;

    const timelineMap = {};
    const dishMap = {};
    const riderMap = {};

    orders.forEach((o) => {
      const istDateStr = new Date(o.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const istMonthStr = istDateStr.slice(0, 7); // YYYY-MM
      const groupKey = period === 'monthly' ? istMonthStr : istDateStr;

      const isDelivered = o.orderStatus === 'delivered';
      const isCancelled = o.orderStatus === 'cancelled';
      const amount = Number(o.totalAmount) || 0;
      const isUPI = o.paymentMethod === 'razorpay' || o.paymentMethod === 'upi';

      if (isDelivered) deliveredOrders++;
      else if (isCancelled) cancelledOrders++;
      else activeOrders++;

      if (!isCancelled) {
        totalRevenue += amount;
        if (isUPI) upiRevenue += amount;
        else codRevenue += amount;
      }

      if (!timelineMap[groupKey]) {
        timelineMap[groupKey] = {
          key: groupKey,
          label: period === 'monthly'
            ? new Date(`${groupKey}-01T12:00:00+05:30`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            : new Date(`${groupKey}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' }),
          ordersCount: 0,
          deliveredCount: 0,
          cancelledCount: 0,
          activeCount: 0,
          totalRevenue: 0,
          upiRevenue: 0,
          codRevenue: 0,
          dishesSold: 0,
          dishTally: {},
          orders: [],
        };
      }

      const t = timelineMap[groupKey];
      t.ordersCount++;
      if (isDelivered) t.deliveredCount++;
      else if (isCancelled) t.cancelledCount++;
      else t.activeCount++;

      if (!isCancelled) {
        t.totalRevenue += amount;
        if (isUPI) t.upiRevenue += amount;
        else t.codRevenue += amount;
      }

      t.orders.push({
        _id: o._id,
        orderId: o._id.toString(),
        shortId: o._id.toString().slice(-6).toUpperCase(),
        totalAmount: amount,
        orderStatus: o.orderStatus,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        customerName: o.customerId?.name || 'Customer',
        customerPhone: o.customerId?.phone || '-',
        addressSummary: o.addressId ? `${o.addressId.buildingName || ''} ${o.addressId.street || ''} ${o.addressId.city || ''}`.trim() : '-',
        riderName: o.assignedRiderId?.name || 'Unassigned',
        createdAt: o.createdAt,
        itemsCount: (o.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0),
        dishesText: (o.items || []).map((it) => `${it.title || 'Item'} × ${it.quantity}`).join(', '),
      });

      // Dishes sold tally
      (o.items || []).forEach((item) => {
        const title = item.title || 'Specialty Dish';
        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const itemRev = qty * price;

        t.dishesSold += qty;
        t.dishTally[title] = (t.dishTally[title] || 0) + qty;

        if (!dishMap[title]) {
          dishMap[title] = { title, quantity: 0, revenue: 0 };
        }
        if (!isCancelled) {
          dishMap[title].quantity += qty;
          dishMap[title].revenue += itemRev;
        }
      });

      // Rider settlement tally
      if (o.assignedRiderId) {
        const rId = o.assignedRiderId._id ? o.assignedRiderId._id.toString() : o.assignedRiderId.toString();
        const rName = o.assignedRiderId.name || 'Rider';
        if (!riderMap[rId]) {
          riderMap[rId] = {
            riderId: rId,
            name: rName,
            phone: o.assignedRiderId.phone || '',
            vehicleNumber: o.assignedRiderId.vehicleNumber || '',
            deliveredCount: 0,
            activeCount: 0,
            cashCollected: 0,
            onlineDelivered: 0,
          };
        }
        if (isDelivered) {
          riderMap[rId].deliveredCount++;
          if (!isUPI) {
            riderMap[rId].cashCollected += amount;
          } else {
            riderMap[rId].onlineDelivered += amount;
          }
        } else if (!isCancelled) {
          riderMap[rId].activeCount++;
        }
      }
    });

    const timeline = Object.values(timelineMap)
      .map((entry) => {
        let topDish = '-';
        let topCount = 0;
        Object.entries(entry.dishTally).forEach(([name, count]) => {
          if (count > topCount) {
            topCount = count;
            topDish = `${name} (${count})`;
          }
        });
        return {
          ...entry,
          topDish,
          avgOrderValue: entry.ordersCount > 0 ? Math.round(entry.totalRevenue / entry.ordersCount) : 0,
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key));

    const topDishes = Object.values(dishMap).sort((a, b) => b.quantity - a.quantity);
    const riderSettlement = Object.values(riderMap).sort((a, b) => b.deliveredCount - a.deliveredCount);

    res.json({
      success: true,
      period,
      filter: { month: month || null, date: date || null, startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        activeOrders,
        totalRevenue,
        upiRevenue,
        codRevenue,
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        deliveredRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0,
      },
      timeline,
      topDishes,
      riderSettlement,
    });
  } catch (err) {
    logger.error('[Reports API] Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

// 4. Admin Customers List & Search
app.get('/api/admin/customers', requireAdminAuth, async (req, res) => {
  try {
    const query = String(req.query.search || '').trim();
    let filter = {};
    if (query) {
      filter = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { phone: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } },
        ],
      };
    }

    const customers = await Customer.find(filter)
      .populate('addresses')
      .sort({ createdAt: -1 })
      .limit(100);

    // Attach order count
    const customerIds = customers.map(c => c._id);
    const orderCounts = await Order.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } },
    ]);
    const orderCountMap = {};
    orderCounts.forEach(o => { orderCountMap[String(o._id)] = o.count; });

    const enriched = customers.map(c => ({
      ...c.toJSON(),
      orderCount: orderCountMap[String(c._id)] || 0,
      addressCount: (c.addresses || []).length,
    }));

    res.json(enriched);
  } catch (err) {
    logger.error('[Admin Customers] Error fetching customers:', err);
    res.status(500).json({ error: 'Failed to fetch customer directory.' });
  }
});

// 5. Admin Reset Customer Password
app.post('/api/admin/customers/:id/reset-password', requireAdminAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    await customer.setPassword(String(newPassword).trim());
    await customer.save();

    logger.info(`[Admin Customer] Admin reset password for customer ${customer._id} (${customer.phone})`);
    res.json({
      success: true,
      message: `Password successfully reset for customer ${customer.name} (${customer.phone}).`,
    });
  } catch (err) {
    logger.error('[Admin Customer] Error resetting customer password:', err);
    res.status(500).json({ error: 'Failed to reset customer password.' });
  }
});

// 6. Admin Get Staff Passcodes Status
app.get('/api/admin/staff-credentials', requireAdminAuth, async (req, res) => {
  try {
    const creds = await StaffCredential.find().select('-passcodeHash');
    res.json(creds);
  } catch (err) {
    logger.error('[Admin Credentials] Error fetching credentials:', err);
    res.status(500).json({ error: 'Failed to retrieve credentials status.' });
  }
});

// 7. Admin Reset Staff Passcode (Manager, Delivery, or Admin)
app.post('/api/admin/staff-credentials/reset', requireAdminAuth, async (req, res) => {
  try {
    const { role, newPasscode } = req.body;
    if (!role || !['manager', 'delivery', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be manager, delivery, or admin.' });
    }
    if (!newPasscode || String(newPasscode).trim().length < 4) {
      return res.status(400).json({ error: 'New passcode must be at least 4 characters long.' });
    }

    let cred = await StaffCredential.findOne({ role });
    if (!cred) {
      cred = new StaffCredential({ role });
    }
    await cred.setPasscode(String(newPasscode).trim());
    cred.updatedBy = 'admin';
    cred.lastUpdated = new Date();
    await cred.save();

    logger.info(`[Admin Credentials] Reset passcode for role: ${role}`);
    res.json({
      success: true,
      role,
      message: `Passcode for ${role} has been updated successfully.`,
    });
  } catch (err) {
    logger.error('[Admin Credentials] Error updating passcode:', err);
    res.status(500).json({ error: 'Failed to update passcode.' });
  }
});

// 8. Staff Self-Reset (From /manager or /delivery with Admin Key)
app.post('/api/admin/staff/self-reset', async (req, res) => {
  try {
    const { role, adminRecoveryKey, newPasscode } = req.body;
    if (!role || !['manager', 'delivery'].includes(role)) {
      return res.status(400).json({ error: 'Role must be manager or delivery.' });
    }
    if (!newPasscode || String(newPasscode).trim().length < 4) {
      return res.status(400).json({ error: 'New passcode must be at least 4 characters.' });
    }

    const isAdminValid = await verifyRolePasscode('admin', adminRecoveryKey);
    if (!isAdminValid) {
      return res.status(401).json({ error: 'Invalid Admin Recovery Key. Authorization rejected.' });
    }

    let cred = await StaffCredential.findOne({ role });
    if (!cred) {
      cred = new StaffCredential({ role });
    }
    await cred.setPasscode(String(newPasscode).trim());
    cred.updatedBy = 'self-reset-via-admin-key';
    cred.lastUpdated = new Date();
    await cred.save();

    logger.info(`[Staff Self-Reset] Successfully updated ${role} passcode via admin recovery key`);
    res.json({
      success: true,
      message: `Passcode for ${role} has been updated successfully. You can now log in with the new passcode.`,
    });
  } catch (err) {
    logger.error('[Staff Self-Reset] Error in self-reset:', err);
    res.status(500).json({ error: 'Self-reset failed. Please try again.' });
  }
});

// 9. Admin Staff Users Directory (Get all managers/owners and delivery fleet)
app.get('/api/admin/staff-users', requireAdminAuth, async (req, res) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role && ['owner', 'manager', 'delivery'].includes(role)) {
      filter.role = role;
    }
    const staffList = await StaffUser.find(filter).sort({ role: 1, createdAt: -1 });
    res.json(staffList);
  } catch (err) {
    logger.error('[Admin Staff] Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff directory.' });
  }
});

// 10. Admin Create Staff User (Manager, Owner, or Delivery Partner)
app.post('/api/admin/staff-users', requireAdminAuth, async (req, res) => {
  try {
    const { name, phone, email, role, password, vehicleNumber } = req.body;
    if (!name || !phone || !role || !password) {
      return res.status(400).json({ error: 'Name, 10-digit phone, role, and password/PIN are required.' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!['owner', 'manager', 'delivery'].includes(role)) {
      return res.status(400).json({ error: 'Role must be owner, manager, or delivery.' });
    }
    if (String(password).trim().length < 4) {
      return res.status(400).json({ error: 'Password/PIN must be at least 4 characters long.' });
    }

    const existing = await StaffUser.findOne({ phone: cleanPhone });
    if (existing) {
      return res.status(400).json({ error: 'A staff member with this phone number already exists.' });
    }

    const staffUser = new StaffUser({
      name: name.trim(),
      phone: cleanPhone,
      email: email ? email.trim().toLowerCase() : '',
      role,
      vehicleNumber: vehicleNumber ? vehicleNumber.trim().toUpperCase() : '',
      isActive: true,
      createdBy: 'admin',
    });
    await staffUser.setPassword(String(password).trim());
    await staffUser.save();

    logger.info(`[Admin Staff] Created new staff member: ${staffUser.name} (${cleanPhone}, ${role})`);
    res.status(201).json({
      success: true,
      message: `${role.toUpperCase()} account created successfully.`,
      user: staffUser.toJSON(),
    });
  } catch (err) {
    logger.error('[Admin Staff] Error creating staff member:', err);
    res.status(500).json({ error: 'Failed to create staff member.' });
  }
});

// 11. Admin Update Staff User Details / Active Status
app.put('/api/admin/staff-users/:id', requireAdminAuth, async (req, res) => {
  try {
    const { name, email, role, vehicleNumber, isActive } = req.body;
    const staffUser = await StaffUser.findById(req.params.id);
    if (!staffUser) return res.status(404).json({ error: 'Staff member not found.' });

    if (name !== undefined) staffUser.name = String(name).trim();
    if (email !== undefined) staffUser.email = String(email).trim().toLowerCase();
    if (role !== undefined && ['owner', 'manager', 'delivery'].includes(role)) staffUser.role = role;
    if (vehicleNumber !== undefined) staffUser.vehicleNumber = String(vehicleNumber).trim().toUpperCase();
    if (isActive !== undefined) staffUser.isActive = Boolean(isActive);

    await staffUser.save();
    logger.info(`[Admin Staff] Updated staff member ${staffUser._id} (${staffUser.name})`);
    res.json({
      success: true,
      message: 'Staff member details updated.',
      user: staffUser.toJSON(),
    });
  } catch (err) {
    logger.error('[Admin Staff] Error updating staff member:', err);
    res.status(500).json({ error: 'Failed to update staff member.' });
  }
});

// 12. Admin Reset Specific Staff Password / PIN
app.post('/api/admin/staff-users/:id/reset-password', requireAdminAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const staffUser = await StaffUser.findById(req.params.id);
    if (!staffUser) return res.status(404).json({ error: 'Staff member not found.' });

    await staffUser.setPassword(String(newPassword).trim());
    await staffUser.save();

    logger.info(`[Admin Staff] Reset password for staff user ${staffUser._id} (${staffUser.phone}, ${staffUser.role})`);
    res.json({
      success: true,
      message: `Password/PIN reset successfully for ${staffUser.name}.`,
    });
  } catch (err) {
    logger.error('[Admin Staff] Error resetting staff password:', err);
    res.status(500).json({ error: 'Failed to reset staff password.' });
  }
});

// 13. Admin Delete Staff User
app.delete('/api/admin/staff-users/:id', requireAdminAuth, async (req, res) => {
  try {
    const staffUser = await StaffUser.findByIdAndDelete(req.params.id);
    if (!staffUser) return res.status(404).json({ error: 'Staff member not found.' });

    logger.info(`[Admin Staff] Deleted staff member ${staffUser.name} (${staffUser.phone})`);
    res.json({
      success: true,
      message: `Staff member ${staffUser.name} removed.`,
    });
  } catch (err) {
    logger.error('[Admin Staff] Error deleting staff member:', err);
    res.status(500).json({ error: 'Failed to delete staff member.' });
  }
});

app.listen(port, () => {
  console.log(`Express backend running on http://localhost:${port}`);
});

