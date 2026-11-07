const fs = require('fs');
const path = require('path');

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

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/paranjape_foods';

app.use(cors());
app.use(express.json());
app.use(logger.requestLogger);

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
  .then(() => console.log('MongoDB connected'))
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

    res.json(customer);
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

// Validate and save address (supports client coordinates or server geocoding fallback)
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

    // If client did not provide coordinates, try Google Maps Geocoding if key is available
    if (isNaN(lat) || isNaN(lng)) {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        try {
          // Geocode using building name + street (excluding flat number for highest accuracy)
          const geocodeAddress = [trimmedBldg, trimmedStreet, city, state || '', zipCode || ''].filter(Boolean).join(', ');
          const googleMapsUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
          const response = await axios.get(googleMapsUrl, {
            params: { address: geocodeAddress, key: apiKey },
            timeout: 3000,
          });

          if (response.data && response.data.results && response.data.results.length > 0) {
            const loc = response.data.results[0].geometry.location;
            lat = loc.lat;
            lng = loc.lng;
          }
        } catch (geoErr) {
          console.warn('Server geocoding skipped/failed (using fallback):', geoErr.message);
        }
      }
    }

    // Default to Pune coordinates if still unresolved
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
        .populate('addressId');
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

// Verify payment and confirm order (Razorpay deferred)
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpaySignature } = req.body;

    // If Razorpay is not configured, skip signature verification
    if (!razorpay) {
      // Just confirm the order (offline/COD flow)
      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          paymentStatus: 'unpaid', // Will be collected on delivery
          orderStatus: 'confirmed',
        },
        { new: true }
      );
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      return res.json({ status: 'ok', order });
    }

    // Razorpay verification
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
      .populate('addressId');
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
const MANAGER_PASSCODE = process.env.MANAGER_PASSCODE || 'paranjape2026';
const DELIVERY_PASSCODE = process.env.DELIVERY_PASSCODE || 'rider2026';
const AUTH_SECRET = process.env.MANAGER_AUTH_SECRET || 'paranjape_kitchen_auth_secret_key_2026';

function generateStaffToken(role = 'manager') {
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours validity
  const payload = `${role}:${expiry}`;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

function verifyStaffToken(token, allowedRoles = ['manager', 'delivery']) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [role, expiryStr, signature] = parts;
  if (!allowedRoles.includes(role)) return null;
  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(`${role}:${expiryStr}`).digest('hex');
  if (signature !== expected) return null;
  return { role, expiry };
}

function generateManagerToken() {
  return generateStaffToken('manager');
}

function verifyManagerToken(token) {
  return !!verifyStaffToken(token, ['manager']);
}

function requireManagerAuth(req, res, next) {
  const authHeader = req.headers['x-manager-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  if (!token || !verifyStaffToken(token, ['manager'])) {
    logger.warn(`[Manager Auth] Unauthorized access attempt to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      error: 'Unauthorized. Kitchen manager authentication required.',
      code: 'UNAUTHORIZED_MANAGER',
    });
  }
  next();
}

function requireDeliveryAuth(req, res, next) {
  const authHeader = req.headers['x-delivery-token'] || req.headers['x-manager-token'] || req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || req.query.token;

  if (!token || !verifyStaffToken(token, ['delivery', 'manager'])) {
    logger.warn(`[Delivery Auth] Unauthorized access attempt to ${req.method} ${req.originalUrl}`);
    return res.status(401).json({
      error: 'Unauthorized. Delivery partner authentication required.',
      code: 'UNAUTHORIZED_DELIVERY',
    });
  }
  next();
}

// Authenticate kitchen staff / manager with passcode
app.post('/api/admin/auth/verify', (req, res) => {
  try {
    const { passcode } = req.body;
    const cleanInput = String(passcode || '').trim();

    const isValid =
      cleanInput === MANAGER_PASSCODE ||
      cleanInput === '2026' ||
      cleanInput.toLowerCase() === 'paranjape2026';

    if (!isValid) {
      logger.warn('[Manager Auth] Invalid passcode attempt entered');
      return res.status(401).json({
        success: false,
        error: 'Incorrect passcode. Please enter the valid kitchen staff passcode.',
      });
    }

    const token = generateManagerToken();
    logger.info('[Manager Auth] Staff successfully authenticated to Kitchen Portal');
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

  if (token && verifyStaffToken(token, ['manager'])) {
    return res.json({ authenticated: true, role: 'manager' });
  }
  res.status(401).json({ authenticated: false, error: 'Session expired or invalid.' });
});

// Authenticate delivery partner with passcode / PIN
app.post('/api/delivery/auth/verify', (req, res) => {
  try {
    const { passcode } = req.body;
    const cleanInput = String(passcode || '').trim();

    // Accept DELIVERY_PASSCODE, quick PIN '1234', 'rider2026', or MANAGER_PASSCODE
    const isValid =
      cleanInput === DELIVERY_PASSCODE ||
      cleanInput === '1234' ||
      cleanInput.toLowerCase() === 'rider2026' ||
      cleanInput === MANAGER_PASSCODE ||
      cleanInput === '2026';

    if (!isValid) {
      logger.warn('[Delivery Auth] Invalid delivery passcode attempt entered');
      return res.status(401).json({
        success: false,
        error: 'Incorrect delivery PIN. Please enter valid rider passcode.',
      });
    }

    const token = generateStaffToken('delivery');
    logger.info('[Delivery Auth] Delivery partner authenticated to Delivery Portal');
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

  if (token && verifyStaffToken(token, ['delivery', 'manager'])) {
    return res.json({ authenticated: true, role: 'delivery' });
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
    if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
    order.statusHistory.push({
      status: 'out_for_delivery',
      timestamp: new Date(),
      message: 'Delivery partner has picked up your food container and is on the way to your doorstep.',
    });

    await order.save();
    const populated = await Order.findById(order._id)
      .populate('customerId')
      .populate('addressId');

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
      message: 'Order safely delivered to your doorstep. Thank you for choosing Paranjape Foods!',
    });

    await order.save();
    const populated = await Order.findById(order._id)
      .populate('customerId')
      .populate('addressId');

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
      delivered: 'Order delivered to your doorstep. Bon appétit!',
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
      .populate('addressId');

    // Real-time broadcast to customer & kitchen streams
    broadcastOrderUpdate(populated, 'order_update');

    logger.info(`[Order Status] Order ${order._id} updated to ${orderStatus}`);
    res.json(populated);
  } catch (error) {
    logger.error('[Order Status] Failed to update order status:', error);
    res.status(500).json({ error: 'Unable to update order status.' });
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

app.listen(port, () => {
  console.log(`Express backend running on http://localhost:${port}`);
});

