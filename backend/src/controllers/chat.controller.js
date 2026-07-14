const prisma = require('../prisma');
const path = require('path');
const fs = require('fs');

const getUserBranch = (user) => {
  const role = String(user.role || '').toUpperCase();
  const name = String(user.name || '');
  if (role === 'OUTLET') {
    const n = name.toLowerCase();
    if (n.includes('johar') || name.includes('1')) return 'Johar Town';
    if (n.includes('jail') || name.includes('2')) return 'Jail Road';
    if (n.includes('abbottabad') || name.includes('3')) return 'Abbottabad';
    return name;
  }
  if (['STORE', 'PRODUCTION', 'LOGO_DESIGN', 'DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERY_BOY'].includes(role)) return 'Factory';
  if (role === 'FAISAL') return 'Online Orders';
  if (['ORDER_ENTRY', 'ADMIN', 'SUPER_ADMIN'].includes(role)) return 'Head Office';
  return '';
};

const emitStatus = (io, payload) => {
  if (io && io.to) io.to('chat:global').emit('chat:status-update', payload);
};

const upsertReceipt = async (messageId, user, status) => {
  const existing = await prisma.chatMessageReadReceipt.findUnique({
    where: { messageId_userId: { messageId, userId: user.id } },
  });
  if (existing) {
    if (status === 'delivered' && existing.status !== 'delivered') {
      return prisma.chatMessageReadReceipt.update({
        where: { id: existing.id },
        data: { status, timestamp: new Date() },
      });
    }
    if (status === 'read' && existing.status !== 'read') {
      return prisma.chatMessageReadReceipt.update({
        where: { id: existing.id },
        data: { status, timestamp: new Date() },
      });
    }
    if (status === 'played' && existing.status !== 'played') {
      return prisma.chatMessageReadReceipt.update({
        where: { id: existing.id },
        data: { status, timestamp: new Date() },
      });
    }
    return existing;
  }
  return prisma.chatMessageReadReceipt.create({
    data: {
      messageId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      status,
    },
  });
};

const getMessages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: { _count: { select: { readReceipts: true } } },
      }),
      prisma.chatMessage.count(),
    ]);

    res.json({ messages: messages.reverse(), total, page, limit });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { message, voiceUrl } = req.body;
    if (!message && !voiceUrl) {
      return res.status(400).json({ message: 'Message or voice URL required' });
    }

    const msg = await prisma.chatMessage.create({
      data: {
        senderId: req.user.id,
        senderName: req.user.name,
        senderRole: req.user.role,
        senderBranch: getUserBranch(req.user),
        message: message || '',
        voiceUrl: voiceUrl || null,
      },
      include: { _count: { select: { readReceipts: true } } },
    });

    const io = req.app.get('io');
    if (io && io.to) {
      io.to('chat:global').emit('chat:new-message', msg);
    }

    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

const uploadVoice = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No audio file uploaded' });

    const voiceDir = path.join(__dirname, '../../uploads/voice');
    if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });

    const ext = path.extname(req.file.originalname) || '.webm';
    const filename = `voice-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    const filePath = path.join(voiceDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const url = `${req.protocol}://${req.get('host')}/uploads/voice/${filename}`;
    res.json({ url });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload voice', error: error.message });
  }
};

const markDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    if (msg.senderId !== req.user.id) {
      await upsertReceipt(id, req.user, 'delivered');
      if (!msg.deliveredAt) {
        await prisma.chatMessage.update({ where: { id }, data: { deliveredAt: new Date() } });
      }
    }

    const io = req.app.get('io');
    emitStatus(io, { messageId: id, userId: req.user.id, userName: req.user.name, userRole: req.user.role, status: 'delivered' });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark delivered', error: error.message });
  }
};

const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    if (msg.senderId !== req.user.id) {
      await upsertReceipt(id, req.user, 'read');
      if (!msg.readAt) {
        await prisma.chatMessage.update({ where: { id }, data: { readAt: new Date() } });
      }
    }

    const io = req.app.get('io');
    emitStatus(io, { messageId: id, userId: req.user.id, userName: req.user.name, userRole: req.user.role, status: 'read' });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark read', error: error.message });
  }
};

const markPlayed = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (!msg.voiceUrl) return res.status(400).json({ message: 'Not a voice message' });

    if (msg.senderId !== req.user.id) {
      await upsertReceipt(id, req.user, 'played');
      if (!msg.playedAt) {
        await prisma.chatMessage.update({ where: { id }, data: { playedAt: new Date() } });
      }
    }

    const io = req.app.get('io');
    emitStatus(io, { messageId: id, userId: req.user.id, userName: req.user.name, userRole: req.user.role, status: 'played' });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark played', error: error.message });
  }
};

const getReceipts = async (req, res) => {
  try {
    const { id } = req.params;
    const receipts = await prisma.chatMessageReadReceipt.findMany({
      where: { messageId: id },
      orderBy: { timestamp: 'asc' },
    });
    res.json(receipts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get receipts', error: error.message });
  }
};

const togglePin = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    const updated = await prisma.chatMessage.update({
      where: { id },
      data: { isPinned: !msg.isPinned },
      include: { _count: { select: { readReceipts: true } } },
    });

    const io = req.app.get('io');
    if (io && io.to) {
      io.to('chat:global').emit('chat:message-pinned', updated);
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle pin', error: error.message });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const msg = await prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    await prisma.chatMessage.delete({ where: { id } });

    if (msg.voiceUrl) {
      const parts = msg.voiceUrl.split('/uploads/voice/');
      if (parts.length > 1) {
        const filePath = path.join(__dirname, '../../uploads/voice', parts[1]);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    const io = req.app.get('io');
    if (io && io.to) {
      io.to('chat:global').emit('chat:message-deleted', { id });
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete message', error: error.message });
  }
};

module.exports = { getMessages, sendMessage, uploadVoice, markDelivered, markRead, markPlayed, getReceipts, togglePin, deleteMessage };
