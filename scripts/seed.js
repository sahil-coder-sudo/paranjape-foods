// scripts/seed.js
// Run with: node scripts/seed.js (ensure MONGODB_URI env var set)

const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sunrise-bistro';

const sampleMenu = [
  { title: 'Avocado Toast', description: 'Toasted sourdough, smashed avocado, chili flakes', price: '₹14', category: 'Breakfast' },
  { title: 'Granola Bowl', description: 'Greek yogurt, house granola, seasonal fruit', price: '₹12', category: 'Breakfast' },
  { title: 'Lemon Ricotta Pancakes', description: 'Fluffy pancakes, lemon curd, berries', price: '₹16', category: 'Breakfast' },
  { title: 'Smoked Turkey Club', description: 'Smoked turkey, bacon, lettuce, tomato, aioli', price: '₹18', category: "Sandwiches" },
  { title: 'Spicy Falafel Wrap', description: 'Falafel, tahini, pickles, greens', price: '₹15', category: "Sandwiches" },
  { title: 'Grilled Chicken Panini', description: 'Marinated chicken, pesto, provolone', price: '₹17', category: "Sandwiches" },
  { title: 'Kale Caesar', description: 'Crisp kale, parmesan, sourdough croutons', price: '₹13', category: 'Salads' },
  { title: 'Roasted Beet Salad', description: 'Beets, goat cheese, candied pecans', price: '₹14', category: 'Salads' },
  { title: 'Quinoa Harvest Bowl', description: 'Quinoa, roasted veg, tahini dressing', price: '₹16', category: 'Salads' },
  { title: 'Chocolate Tart', description: 'Dark chocolate tart with sea salt', price: '₹9', category: 'Dessert' },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    await MenuItem.deleteMany({});
    const created = await MenuItem.create(sampleMenu);
    console.log(`Inserted ${created.length} menu items`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (err) {
    console.error('Seed error', err);
    process.exit(1);
  }
}

seed();
