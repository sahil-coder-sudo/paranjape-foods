// backend/scripts/resetCustomerData.js
// Clears customers, addresses, and test orders for a clean slate
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const candidateEnvPaths = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
];
const envPath = candidateEnvPaths.find(p => fs.existsSync(p));
if (envPath) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

async function resetCustomerData() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'paranjape_foods' });
    console.log('Connected to MongoDB');

    const customerRes = await mongoose.connection.collection('customers').deleteMany({});
    const addressRes = await mongoose.connection.collection('addresses').deleteMany({});
    const orderRes = await mongoose.connection.collection('orders').deleteMany({});

    console.log(`Deleted ${customerRes.deletedCount} customers.`);
    console.log(`Deleted ${addressRes.deletedCount} addresses.`);
    console.log(`Deleted ${orderRes.deletedCount} orders.`);

    const remainingMenu = await mongoose.connection.collection('menuitems').countDocuments();
    console.log(`Preserved ${remainingMenu} menu items intact.`);

    await mongoose.disconnect();
    console.log('Reset complete. Disconnected from MongoDB.');
  } catch (err) {
    console.error('Error resetting customer data:', err);
    process.exit(1);
  }
}

resetCustomerData();
