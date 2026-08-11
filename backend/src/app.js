const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { authenticate } = require('./middleware/auth.middleware');

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

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: frontendUrl,
  credentials: frontendUrl !== "*"
}));
app.use(express.json());
// Rate limiting per endpoint category
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global baseline — high enough for normal multi-tab usage on Vercel
app.use('/api/', apiLimiter);

// Stricter limits for heavy dashboard/analytics endpoints
app.use('/api/pos/sales/dashboard', heavyLimiter);
app.use('/api/pos/book/:id/summary', heavyLimiter);
app.use('/api/analytics/', heavyLimiter);
app.use('/api/store-dashboard', heavyLimiter);
app.use('/api/online-dashboard', heavyLimiter);
app.use('/api/inventory', heavyLimiter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Allow CDN/browser caching for GET API responses (5s) to reduce duplicate requests
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') res.set('Cache-Control', 'public, max-age=5, s-maxage=10');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is alive!', time: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is alive!', time: new Date().toISOString() });
});

app.post('/api/upload', authenticate, upload.single('image'), (req, res) => {
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
const warehouseRoutes = require('./routes/warehouse.routes');
const storeDashboardRoutes = require('./routes/storeDashboard.routes');
const onlineDashboardRoutes = require('./routes/onlineDashboard.routes');
const alterationRoutes = require('./routes/alteration.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const engravingRoutes = require('./routes/engraving.routes');
const ceoRoutes = require('./routes/ceo.routes');
const auditRoutes = require('./routes/audit.routes');
const softwareSettingsRoutes = require('./routes/softwareSettings.routes');

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
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/store-dashboard', storeDashboardRoutes);
app.use('/api/online-dashboard', onlineDashboardRoutes);
app.use('/api/alterations', alterationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/verification', require('./routes/verification.routes'));
app.use('/api/return-exchange', require('./routes/returnExchange.routes'));
app.use('/api/outlet-detailed', require('./routes/outletDetailed.routes'));
app.use('/api/bank-deposit', require('./routes/bankDeposit.routes'));
app.use('/api/engravings', engravingRoutes);
app.use('/api/in-dispatch', require('./routes/inDispatch.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/ceo', ceoRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/software-settings', softwareSettingsRoutes);

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
