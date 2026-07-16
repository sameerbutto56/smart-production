const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');

dotenv.config({ path: path.join(__dirname, '../.env') });
const prisma = require('./prisma');

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

app.use(compression());
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

const { errorHandler } = require('./middleware/error.middleware');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const adminRoutes = require('./routes/admin.routes');
const settingsRoutes = require('./routes/settings.routes');
const stockRequestRoutes = require('./routes/stockRequest.routes');
const userRoutes = require('./routes/user.routes');
const dispatchRoutes = require('./routes/dispatch.routes');
const editRequestRoutes = require('./routes/editRequest.routes');
const productionRoutes = require('./routes/production.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const outletDemandRoutes = require('./routes/outletDemand.routes');
const clientRoutes = require('./routes/client.routes');
const biRoutes = require('./routes/bi.routes');
const posRoutes = require('./routes/pos.routes');
const transferRoutes = require('./routes/transfer.routes');
const journalRoutes = require('./routes/journal.routes');
const chatRoutes = require('./routes/chat.routes');
const notesRoutes = require('./routes/notes.routes');
const posBookRoutes = require('./routes/pos.book.routes');
const deliveryRoutes = require('./routes/delivery.routes');

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stock-requests', stockRequestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/dispatch-profile', require('./routes/dispatch-profile.routes'));
app.use('/api/edit-requests', editRequestRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/demand', outletDemandRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/bi', biRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/outlet-orders', require('./routes/outletOrder.routes'));
app.use('/api/journal', journalRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/pos/book', posBookRoutes);
app.use('/api/delivery', deliveryRoutes);

// Global error handler (must be last)
app.use(errorHandler);

// Safe Socket.io stub for serverless environments (overridden in server.js)
const safeIo = {
  emit: () => {},
  to: () => ({ emit: () => {} }),
  on: () => {},
  sockets: { emit: () => {}, to: () => ({ emit: () => {} }) }
};
app.set('io', safeIo);


module.exports = app;
