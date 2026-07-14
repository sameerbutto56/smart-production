const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { getMessages, sendMessage, uploadVoice, markDelivered, markRead, markPlayed, getReceipts, togglePin, deleteMessage } = require('../controllers/chat.controller');

const router = express.Router();

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) return cb(null, true);
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.webm', '.ogg', '.wav', '.mp3', '.m4a'].includes(ext)) return cb(null, true);
    cb(new Error('Only audio files are allowed'));
  },
});

router.get('/messages', authenticate, getMessages);
router.post('/messages', authenticate, sendMessage);
router.post('/voice', authenticate, voiceUpload.single('audio'), uploadVoice);
router.post('/messages/:id/delivered', authenticate, markDelivered);
router.post('/messages/:id/read', authenticate, markRead);
router.post('/messages/:id/played', authenticate, markPlayed);
router.get('/messages/:id/receipts', authenticate, getReceipts);
router.patch('/messages/:id/pin', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), togglePin);
router.delete('/messages/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), deleteMessage);

module.exports = router;
