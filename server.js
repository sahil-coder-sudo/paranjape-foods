require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const MenuItem = require('./models/MenuItem');
const ContactMessage = require('./models/ContactMessage');

const app = express();
const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sunrise-bistro';

app.use(cors());
app.use(express.json());

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

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

app.listen(port, () => {
  console.log(`Express backend running on http://localhost:${port}`);
});
