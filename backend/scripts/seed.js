// scripts/seed.js
// Run with: node scripts/seed.js (ensure MONGODB_URI env var set)

const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Customer = require('../models/Customer');
const fs = require('fs');
const path = require('path');
const candidateEnvPaths = [
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env.local'),
  path.resolve(__dirname, '../../.env'),
];
const foundEnvPath = candidateEnvPaths.find(p => fs.existsSync(p));
if (foundEnvPath) {
  require('dotenv').config({ path: foundEnvPath });
} else {
  require('dotenv').config();
}
console.log('MONGODB_URI=', !!process.env.MONGODB_URI);

const MONGODB_URI = process.env.MONGODB_URI;

const sampleMenu = [
  { title: 'Avocado Toast', description: 'Toasted sourdough, smashed avocado, chili flakes', price: '₹14', category: 'Breakfast' },
  { title: 'Granola Bowl', description: 'Greek yogurt, house granola, seasonal fruit', price: '₹12', category: 'Breakfast' },
  { title: 'Lemon Ricotta Pancakes', description: 'Fluffy pancakes, lemon curd, berries', price: '₹16', category: 'Breakfast' },
  { title: 'Smoked Turkey Club', description: 'Smoked turkey, bacon, lettuce, tomato, aioli', price: '₹18', category: "Sandwiches" },
  { title: 'Spicy Falafel Wrap', description: 'Falafel, tahini, pickles, greens', price: '₹15', category: "Sandwiches" },
  { title: 'Grilled Chicken Panini', description: 'Marinated chicken, pesto, provolone', price: '₹17', category: "Sandwiches" },
  { title: 'Kale Caesar', description: 'Crisp kale, parmesan, sourdough croutons', price: '₹13', category: 'Salads & Bowls' },
  { title: 'Roasted Beet Salad', description: 'Beets, goat cheese, candied pecans', price: '₹14', category: 'Salads & Bowls' },
  { title: 'Quinoa Harvest Bowl', description: 'Quinoa, roasted veg, tahini dressing', price: '₹16', category: 'Salads & Bowls' },
  { title: 'Chocolate Tart', description: 'Dark chocolate tart with sea salt', price: '₹9', category: 'Sweet treats' },
  { title: 'Berry Crumble', description: 'Warm seasonal berries with crisp oat crumble', price: '₹10', category: 'Sweet treats' },
  { title: 'Espresso Affogato', description: 'Vanilla gelato topped with a shot of hot espresso', price: '₹8', category: 'Sweet treats' },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'paranjape_foods',
    });
    console.log('Connected to MongoDB');

    await MenuItem.deleteMany({});
    const created = await MenuItem.create(sampleMenu);
    console.log(`Inserted ${created.length} menu items`);

    // Ensure customers collection is initialized in MongoDB Atlas
    const dateStr = new Date().toISOString().split('T')[0];
    await Customer.findOneAndUpdate(
      { phone: '9876543210', name: 'Demo Customer' },
      {
        customerKey: `${dateStr}_demo_customer`,
        phone: '9876543210',
        name: 'Demo Customer',
        email: 'demo@paranjapefoods.example',
        lastLoginAt: new Date(),
      },
      { upsert: true, new: true }
    );
    console.log('Customer collection initialized with demo customer');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Seed error', err);
    process.exit(1);
  }
}

seed();
