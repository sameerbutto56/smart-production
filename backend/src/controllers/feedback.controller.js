const prisma = require('../prisma');
const notify = require('../utils/notify');
const { resolvePktDateRange } = require('../utils/workingHours');
const crypto = require('crypto');

const ALLOWED_OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

const DEFAULT_TOKENS = [
  { outletName: 'Johar Town', token: 'jt-feedback-official', barcode: 'ENAMELS-FB-JT' },
  { outletName: 'Jail Road', token: 'jr-feedback-official', barcode: 'ENAMELS-FB-JR' },
  { outletName: 'Abbottabad', token: 'ab-feedback-official', barcode: 'ENAMELS-FB-AB' },
];

const ensureTokens = (() => {
  let done = false;
  return async () => {
    if (done) return;
    try {
      for (const item of DEFAULT_TOKENS) {
        const existing = await prisma.feedbackToken.findUnique({ where: { outletName: item.outletName } });
        if (!existing) {
          await prisma.feedbackToken.create({
            data: {
              outletName: item.outletName,
              token: item.token,
              barcode: item.barcode,
              isActive: true,
            },
          });
        }
      }
    } catch (_e) {}
    done = true;
  };
})();

/**
 * Public: Resolve a feedback token to its canonical outlet.
 * GET /api/feedback/resolve-token?token=...
 */
const resolveFeedbackToken = async (req, res) => {
  try {
    await ensureTokens();
    const token = (req.query.token || '').toString().trim();

    // Default: existing Johar Town QR points to /feedback without parameters
    if (!token || token === 'jt-feedback-official' || token === 'default') {
      const jt = await prisma.feedbackToken.findUnique({ where: { outletName: 'Johar Town' } });
      return res.json({
        success: true,
        valid: true,
        outlet: 'Johar Town',
        token: jt?.token || 'jt-feedback-official',
        barcode: jt?.barcode || 'ENAMELS-FB-JT',
        isDefault: true,
      });
    }

    const tokenRecord = await prisma.feedbackToken.findUnique({ where: { token } });
    if (!tokenRecord) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Invalid feedback link or token. Please scan the official outlet QR code.',
      });
    }

    if (!tokenRecord.isActive) {
      return res.status(403).json({
        success: false,
        valid: false,
        message: 'This feedback link has been deactivated. Please ask the outlet staff for an active QR code.',
      });
    }

    if (!ALLOWED_OUTLETS.includes(tokenRecord.outletName)) {
      return res.status(403).json({
        success: false,
        valid: false,
        message: 'This outlet is not configured for customer feedback.',
      });
    }

    return res.json({
      success: true,
      valid: true,
      outlet: tokenRecord.outletName,
      token: tokenRecord.token,
      barcode: tokenRecord.barcode,
      isDefault: tokenRecord.outletName === 'Johar Town',
    });
  } catch (error) {
    console.error('resolveFeedbackToken error:', error);
    return res.status(500).json({ success: false, valid: false, message: 'Failed to resolve feedback token' });
  }
};

/**
 * Public: Submit customer feedback.
 * POST /api/feedback
 */
const submitFeedback = async (req, res) => {
  try {
    await ensureTokens();
    const {
      token,
      fullName,
      mobileNumber,
      emailAddress,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
      comments,
    } = req.body;

    if (!fullName?.trim()) return res.status(400).json({ message: 'Full Name is required' });
    if (!mobileNumber?.trim()) return res.status(400).json({ message: 'Mobile Number is required' });

    // Validate token and resolve canonical outlet
    const suppliedToken = (token || '').toString().trim();
    let assignedOutlet = 'Johar Town';
    let assignedToken = 'jt-feedback-official';

    if (!suppliedToken || suppliedToken === 'jt-feedback-official' || suppliedToken === 'default') {
      assignedOutlet = 'Johar Town';
      assignedToken = 'jt-feedback-official';
    } else {
      const tokenRecord = await prisma.feedbackToken.findUnique({ where: { token: suppliedToken } });
      if (!tokenRecord) {
        return res.status(400).json({ message: 'Invalid feedback token. Submission rejected.' });
      }
      if (!tokenRecord.isActive) {
        return res.status(400).json({ message: 'This feedback token is inactive. Submission rejected.' });
      }
      if (!ALLOWED_OUTLETS.includes(tokenRecord.outletName)) {
        return res.status(400).json({ message: 'Unauthorized outlet for feedback.' });
      }
      assignedOutlet = tokenRecord.outletName;
      assignedToken = tokenRecord.token;
    }

    // ANTI-SPOOFING: Reject any attempt to spoof outlet via request body
    if (req.body.outlet && req.body.outlet !== assignedOutlet) {
      return res.status(400).json({
        message: 'Outlet mismatch detected. Outlet spoofing is strictly prohibited.',
        error: 'Outlet mismatch',
      });
    }

    // Validate 10 ratings
    const ratings = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10];
    for (let i = 0; i < ratings.length; i++) {
      const r = ratings[i];
      if (r === undefined || r === null || r < 1 || r > 5) {
        return res.status(400).json({ message: `Question ${i + 1} must have a rating between 1 and 5` });
      }
    }

    const averageRating = ratings.reduce((a, b) => a + b, 0) / 10;
    const cleanMobile = mobileNumber.trim();

    // DUPLICATE PROTECTION: Absorb duplicate clicks / network retries within 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingRecent = await prisma.customerFeedback.findFirst({
      where: {
        mobileNumber: cleanMobile,
        outlet: assignedOutlet,
        createdAt: { gte: twoMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingRecent) {
      return res.status(200).json({
        message: 'Thank you for your feedback! Your submission has been received.',
        feedback: existingRecent,
        isDuplicate: true,
      });
    }

    // Create feedback record with canonical outlet and token metadata
    const feedback = await prisma.customerFeedback.create({
      data: {
        fullName: fullName.trim(),
        mobileNumber: cleanMobile,
        emailAddress: emailAddress?.trim() || null,
        outlet: assignedOutlet,
        outletId: assignedOutlet,
        token: assignedToken,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        averageRating: Math.round(averageRating * 100) / 100,
        comments: comments?.trim() || null,
      },
    });

    // Notify Admin Dashboard
    await notify.create(req, {
      type: 'feedback',
      moduleName: 'Dashboard',
      path: '/dashboard',
      role: 'ADMIN',
      title: 'New Customer Feedback',
      message: `Feedback received from ${feedback.fullName} for ${assignedOutlet} (Rating: ${feedback.averageRating})`,
      action: 'Feedback Received',
      employeeName: feedback.fullName,
    }).catch(() => {});

    try {
      const io = req.app?.get ? req.app.get('io') : null;
      if (io) {
        io.emit('customer-feedback-submitted', {
          outlet: assignedOutlet,
          feedbackId: feedback.id,
          averageRating: feedback.averageRating,
        });
      }
    } catch (_e) {}

    return res.status(201).json({
      message: 'Thank you for your feedback!',
      feedback,
    });
  } catch (error) {
    console.error('submitFeedback error:', error);
    return res.status(500).json({ message: 'Failed to submit feedback', error: error.message });
  }
};

/**
 * Authenticated: Get all feedback with outlet & PKT date filtering.
 * GET /api/feedback
 */
const getAllFeedback = async (req, res) => {
  try {
    await ensureTokens();
    const { outlet, range, dateFrom, dateTo } = req.query;
    const where = {};

    // Outlet Filter: strictly limit to configured outlets
    if (outlet && ALLOWED_OUTLETS.includes(outlet)) {
      where.outlet = outlet;
    } else {
      where.outlet = { in: ALLOWED_OUTLETS };
    }

    // PKT Date Range Filtering
    if (range || dateFrom || dateTo) {
      const { start, end } = resolvePktDateRange({ range, dateFrom, dateTo });
      if (start || end) {
        where.createdAt = {};
        if (start) where.createdAt.gte = start;
        if (end) where.createdAt.lt = end;
      }
    }

    const feedback = await prisma.customerFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json(feedback);
  } catch (error) {
    console.error('getAllFeedback error:', error);
    return res.status(500).json({ message: 'Failed to fetch feedback', error: error.message });
  }
};

/**
 * Authenticated: Get outlet-aware feedback analytics.
 * GET /api/feedback/stats
 */
const getFeedbackStats = async (req, res) => {
  try {
    await ensureTokens();
    const { outlet, range, dateFrom, dateTo } = req.query;
    const where = {};

    if (outlet && ALLOWED_OUTLETS.includes(outlet)) {
      where.outlet = outlet;
    } else {
      where.outlet = { in: ALLOWED_OUTLETS };
    }

    if (range || dateFrom || dateTo) {
      const { start, end } = resolvePktDateRange({ range, dateFrom, dateTo });
      if (start || end) {
        where.createdAt = {};
        if (start) where.createdAt.gte = start;
        if (end) where.createdAt.lt = end;
      }
    }

    const all = await prisma.customerFeedback.findMany({ where, orderBy: { createdAt: 'desc' } });
    const total = all.length;

    if (total === 0) {
      return res.json({
        total: 0,
        averageRating: 0,
        excellent: 0,
        good: 0,
        average: 0,
        poor: 0,
        veryPoor: 0,
        outletStats: ALLOWED_OUTLETS.map(o => ({
          outlet: o,
          count: 0,
          averageRating: 0,
          excellent: 0,
          good: 0,
          average: 0,
          poor: 0,
          veryPoor: 0,
        })),
        monthlyTrend: [],
        dailyTrend: [],
        ratingDistribution: [1, 2, 3, 4, 5].map(r => ({ rating: r, count: 0 })),
      });
    }

    const avgOverall = all.reduce((s, f) => s + f.averageRating, 0) / total;
    const ratingBuckets = { excellent: 0, good: 0, average: 0, poor: 0, veryPoor: 0 };
    const allRatings = all.flatMap(f => [f.q1, f.q2, f.q3, f.q4, f.q5, f.q6, f.q7, f.q8, f.q9, f.q10]);

    allRatings.forEach(r => {
      if (r === 1) ratingBuckets.excellent++;
      else if (r === 2) ratingBuckets.good++;
      else if (r === 3) ratingBuckets.average++;
      else if (r === 4) ratingBuckets.poor++;
      else if (r === 5) ratingBuckets.veryPoor++;
    });

    // Outlet stats strictly for the allowed outlets
    const outletMap = {};
    ALLOWED_OUTLETS.forEach(o => {
      outletMap[o] = { count: 0, totalRating: 0, excellent: 0, good: 0, average: 0, poor: 0, veryPoor: 0 };
    });

    all.forEach(f => {
      if (outletMap[f.outlet]) {
        const o = outletMap[f.outlet];
        o.count++;
        o.totalRating += f.averageRating;
        [f.q1, f.q2, f.q3, f.q4, f.q5, f.q6, f.q7, f.q8, f.q9, f.q10].forEach(r => {
          if (r === 1) o.excellent++;
          else if (r === 2) o.good++;
          else if (r === 3) o.average++;
          else if (r === 4) o.poor++;
          else if (r === 5) o.veryPoor++;
        });
      }
    });

    const outletStats = Object.entries(outletMap).map(([outletName, data]) => ({
      outlet: outletName,
      count: data.count,
      averageRating: data.count > 0 ? Math.round((data.totalRating / data.count) * 100) / 100 : 0,
      excellent: data.excellent,
      good: data.good,
      average: data.average,
      poor: data.poor,
      veryPoor: data.veryPoor,
    }));

    const monthMap = {};
    all.forEach(f => {
      const key = f.createdAt.toISOString().slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { count: 0, totalRating: 0 };
      monthMap[key].count++;
      monthMap[key].totalRating += f.averageRating;
    });
    const monthlyTrend = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, data]) => ({
      month,
      count: data.count,
      averageRating: Math.round((data.totalRating / data.count) * 100) / 100,
    }));

    const dayMap = {};
    all.forEach(f => {
      const key = f.createdAt.toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { count: 0, totalRating: 0 };
      dayMap[key].count++;
      dayMap[key].totalRating += f.averageRating;
    });
    const dailyTrend = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-30).map(([day, data]) => ({
      day,
      count: data.count,
      averageRating: Math.round((data.totalRating / data.count) * 100) / 100,
    }));

    const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
      rating: r,
      count: allRatings.filter(x => x === r).length,
    }));

    return res.json({
      total,
      averageRating: Math.round(avgOverall * 100) / 100,
      ...ratingBuckets,
      outletStats,
      monthlyTrend,
      dailyTrend,
      ratingDistribution,
    });
  } catch (error) {
    console.error('getFeedbackStats error:', error);
    return res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
};

/**
 * Authenticated: Get QR & Barcode configurations for configured feedback outlets.
 * GET /api/feedback/qrs
 */
const getOutletQRs = async (req, res) => {
  try {
    await ensureTokens();
    const tokens = await prisma.feedbackToken.findMany({
      where: { outletName: { in: ALLOWED_OUTLETS } },
    });

    const tokenMap = {};
    tokens.forEach(t => { tokenMap[t.outletName] = t; });

    const host = (typeof req.get === 'function' ? req.get('host') : null) || req.headers?.host || 'localhost';
    const forwardedProto = typeof req.get === 'function' ? req.get('x-forwarded-proto') : req.headers?.['x-forwarded-proto'];
    const protocol = req.protocol === 'https' || forwardedProto === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    const list = ALLOWED_OUTLETS.map(outlet => {
      const rec = tokenMap[outlet] || DEFAULT_TOKENS.find(d => d.outletName === outlet);
      const isJohar = outlet === 'Johar Town';
      // Official existing Johar Town QR URL is /feedback (preserved)
      const feedbackUrl = isJohar ? `${baseUrl}/feedback` : `${baseUrl}/feedback?token=${rec.token}`;

      return {
        outlet,
        token: rec.token,
        barcode: rec.barcode,
        url: feedbackUrl,
        isExisting: isJohar,
        isActive: rec.isActive !== false,
      };
    });

    return res.json(list);
  } catch (error) {
    console.error('getOutletQRs error:', error);
    return res.status(500).json({ message: 'Failed to fetch outlet QRs', error: error.message });
  }
};

/**
 * Authenticated: Regenerate token for Jail Road or Abbottabad.
 * POST /api/feedback/regenerate-token
 */
const regenerateOutletToken = async (req, res) => {
  try {
    await ensureTokens();
    const { outlet, force } = req.body;

    if (!ALLOWED_OUTLETS.includes(outlet)) {
      return res.status(400).json({ message: 'Invalid outlet specified.' });
    }

    // Protect official Johar Town QR against accidental regeneration
    if (outlet === 'Johar Town' && !force) {
      return res.status(400).json({
        message: 'Johar Town is the official primary QR code. Regenerating it will affect existing printed material. Pass force=true if strictly intended.',
      });
    }

    const prefix = outlet === 'Johar Town' ? 'jt' : (outlet === 'Jail Road' ? 'jr' : 'ab');
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const newToken = `${prefix}-fb-${randomSuffix}`;

    const updated = await prisma.feedbackToken.upsert({
      where: { outletName: outlet },
      update: { token: newToken, isActive: true },
      create: {
        outletName: outlet,
        token: newToken,
        barcode: `ENAMELS-FB-${prefix.toUpperCase()}`,
        isActive: true,
      },
    });

    return res.json({
      message: `Token regenerated successfully for ${outlet}`,
      record: updated,
    });
  } catch (error) {
    console.error('regenerateOutletToken error:', error);
    return res.status(500).json({ message: 'Failed to regenerate token', error: error.message });
  }
};

const deleteFeedback = async (req, res) => {
  try {
    await ensureTokens();
    const { id } = req.params;
    await prisma.customerFeedback.delete({ where: { id } });
    return res.json({ message: 'Feedback deleted' });
  } catch (error) {
    console.error('deleteFeedback error:', error);
    return res.status(500).json({ message: 'Failed to delete feedback', error: error.message });
  }
};

const clearAllFeedback = async (req, res) => {
  try {
    await ensureTokens();
    const count = await prisma.customerFeedback.deleteMany();
    return res.json({ message: `All feedback cleared (${count.count} records removed)` });
  } catch (error) {
    console.error('clearAllFeedback error:', error);
    return res.status(500).json({ message: 'Failed to clear feedback', error: error.message });
  }
};

module.exports = {
  resolveFeedbackToken,
  submitFeedback,
  getAllFeedback,
  getFeedbackStats,
  getOutletQRs,
  regenerateOutletToken,
  deleteFeedback,
  clearAllFeedback,
  ALLOWED_OUTLETS,
};
