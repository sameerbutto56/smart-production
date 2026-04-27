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
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const prisma = new PrismaClient();

app.use(cors({ origin: frontendUrl }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('<h1>Smart Production Backend is LIVE!</h1><p>Health check at <a href="/health">/health</a></p>');
});

const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const inventoryRoutes = require('./routes/inventory.routes');

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
  try {
    await prisma.$connect();
    console.log('✅ Connected to the database successfully');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }
});

module.exports = { app, io, prisma };
