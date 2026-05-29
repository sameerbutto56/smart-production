const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const multer = require('multer');

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();
const app = express();
const frontendUrl = process.env.FRONTEND_URL || "*";

// Memory storage for serverless compatibility
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only images are allowed (jpeg, jpg, png, webp)'));
  }
});

app.use(cors({
  origin: frontendUrl,
  credentials: frontendUrl !== "*"
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is alive!', time: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is alive!', time: new Date().toISOString() });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.originalname}`;
  res.json({ url: fileUrl });
});

const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const adminRoutes = require('./routes/admin.routes');
const settingsRoutes = require('./routes/settings.routes');

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// Safe Socket.io stub for serverless environments (overridden in server.js)
const safeIo = {
  emit: () => {},
  to: () => ({ emit: () => {} }),
  on: () => {},
  sockets: { emit: () => {}, to: () => ({ emit: () => {} }) }
};
app.set('io', safeIo);

module.exports = { app, prisma };
