const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const server = http.createServer(app);
const frontendUrl = process.env.FRONTEND_URL || "*";

const io = socketIo(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: frontendUrl !== "*"
  }
});

// Global Error Handler to prevent process crashes
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const prisma = new PrismaClient();

const path = require('path');
const multer = require('multer');

// Configure Multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

// ⚡️ IMMEDIATE HEALTH CHECK (Before anything else)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is alive!', time: new Date().toISOString() });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
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

// Socket.io logic
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Pass io to routes/controllers via middleware or app.set
app.set('io', io);

const { syncShopifyOrders } = require('./services/shopify.service');

// Sync Shopify orders every 5 minutes
setInterval(() => {
  syncShopifyOrders(prisma, io);
}, 5 * 60 * 1000);

// Initial sync on startup
setTimeout(() => {
  syncShopifyOrders(prisma, io);
}, 5000);

const PORT = process.env.PORT || 5000;

// Connect to DB with a slight delay if needed
const connectDB = async (retries = 5) => {
  while (retries) {
    try {
      await prisma.$connect();
      console.log('✅ Connected to the database successfully');
      break;
    } catch (err) {
      console.error(`❌ Database connection failed (Retries left: ${retries - 1}):`, err.message);
      retries -= 1;
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

connectDB();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
});

module.exports = { app, io, prisma };
