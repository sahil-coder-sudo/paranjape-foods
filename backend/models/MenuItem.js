const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: String, required: true },
  category: { type: String, required: true },
}, {
  timestamps: true,
});

module.exports = mongoose.models.MenuItem || mongoose.model('MenuItem', MenuItemSchema);
