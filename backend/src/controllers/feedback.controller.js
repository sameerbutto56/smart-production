const prisma = require('../prisma');

const ensureTable = (() => {
  let done = false;
  return async () => {
    if (done) return;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CustomerFeedback" (
          "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
          "fullName" TEXT NOT NULL,
          "mobileNumber" TEXT NOT NULL,
          "emailAddress" TEXT,
          "outlet" TEXT NOT NULL,
          "q1" INTEGER NOT NULL,
          "q2" INTEGER NOT NULL,
          "q3" INTEGER NOT NULL,
          "q4" INTEGER NOT NULL,
          "q5" INTEGER NOT NULL,
          "q6" INTEGER NOT NULL,
          "q7" INTEGER NOT NULL,
          "q8" INTEGER NOT NULL,
          "q9" INTEGER NOT NULL,
          "q10" INTEGER NOT NULL,
          "averageRating" DOUBLE PRECISION NOT NULL,
          "comments" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "CustomerFeedback_outlet_idx" ON "CustomerFeedback"("outlet");
        CREATE INDEX IF NOT EXISTS "CustomerFeedback_createdAt_idx" ON "CustomerFeedback"("createdAt");
      `);
    } catch (_e) {}
    done = true;
  };
})();

const submitFeedback = async (req, res) => {
  try {
    await ensureTable();
    const { fullName, mobileNumber, emailAddress, outlet, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, comments } = req.body;
    if (!fullName?.trim()) return res.status(400).json({ message: 'Full Name is required' });
    if (!mobileNumber?.trim()) return res.status(400).json({ message: 'Mobile Number is required' });
    if (!outlet) return res.status(400).json({ message: 'Outlet selection is required' });

    const ratings = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10];
    for (let i = 0; i < ratings.length; i++) {
      const r = ratings[i];
      if (r === undefined || r === null || r < 1 || r > 5) {
        return res.status(400).json({ message: `Question ${i + 1} must have a rating between 1 and 5` });
      }
    }

    const averageRating = ratings.reduce((a, b) => a + b, 0) / 10;

    const feedback = await prisma.customerFeedback.create({
      data: {
        fullName: fullName.trim(),
        mobileNumber: mobileNumber.trim(),
        emailAddress: emailAddress?.trim() || null,
        outlet,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10,
        averageRating: Math.round(averageRating * 100) / 100,
        comments: comments?.trim() || null,
      },
    });
    res.status(201).json({ message: 'Thank you for your feedback!', feedback });
  } catch (error) {
    console.error('submitFeedback error:', error);
    res.status(500).json({ message: 'Failed to submit feedback', error: error.message });
  }
};

const getAllFeedback = async (req, res) => {
  try {
    await ensureTable();
    const { outlet, dateFrom, dateTo } = req.query;
    const where = {};
    if (outlet) where.outlet = outlet;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    const feedback = await prisma.customerFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(feedback);
  } catch (error) {
    console.error('getAllFeedback error:', error);
    res.status(500).json({ message: 'Failed to fetch feedback', error: error.message });
  }
};

const getFeedbackStats = async (req, res) => {
  try {
    await ensureTable();
    const { dateFrom, dateTo } = req.query;
    const where = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const all = await prisma.customerFeedback.findMany({ where, orderBy: { createdAt: 'desc' } });
    const total = all.length;
    if (total === 0) {
      return res.json({ total: 0, averageRating: 0, excellent: 0, good: 0, average: 0, poor: 0, veryPoor: 0, outletStats: [], monthlyTrend: [], dailyTrend: [] });
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

    const outletMap = {};
    all.forEach(f => {
      if (!outletMap[f.outlet]) outletMap[f.outlet] = { count: 0, totalRating: 0, excellent: 0, good: 0, average: 0, poor: 0, veryPoor: 0 };
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
    });
    const outletStats = Object.entries(outletMap).map(([outlet, data]) => ({
      outlet, count: data.count, averageRating: Math.round((data.totalRating / data.count) * 100) / 100,
      excellent: data.excellent, good: data.good, average: data.average, poor: data.poor, veryPoor: data.veryPoor,
    }));

    const monthMap = {};
    all.forEach(f => {
      const key = f.createdAt.toISOString().slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { count: 0, totalRating: 0 };
      monthMap[key].count++;
      monthMap[key].totalRating += f.averageRating;
    });
    const monthlyTrend = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0])).map(([month, data]) => ({
      month, count: data.count, averageRating: Math.round((data.totalRating / data.count) * 100) / 100,
    }));

    const dayMap = {};
    all.forEach(f => {
      const key = f.createdAt.toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { count: 0, totalRating: 0 };
      dayMap[key].count++;
      dayMap[key].totalRating += f.averageRating;
    });
    const dailyTrend = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-30).map(([day, data]) => ({
      day, count: data.count, averageRating: Math.round((data.totalRating / data.count) * 100) / 100,
    }));

    const ratingDistribution = [1, 2, 3, 4, 5].map(r => ({
      rating: r, count: allRatings.filter(x => x === r).length,
    }));

    res.json({
      total, averageRating: Math.round(avgOverall * 100) / 100,
      ...ratingBuckets, outletStats, monthlyTrend, dailyTrend, ratingDistribution,
    });
  } catch (error) {
    console.error('getFeedbackStats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
};

const deleteFeedback = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    await prisma.customerFeedback.delete({ where: { id } });
    res.json({ message: 'Feedback deleted' });
  } catch (error) {
    console.error('deleteFeedback error:', error);
    res.status(500).json({ message: 'Failed to delete feedback', error: error.message });
  }
};

const clearAllFeedback = async (req, res) => {
  try {
    await ensureTable();
    const count = await prisma.customerFeedback.deleteMany();
    res.json({ message: `All feedback cleared (${count.count} records removed)` });
  } catch (error) {
    console.error('clearAllFeedback error:', error);
    res.status(500).json({ message: 'Failed to clear feedback', error: error.message });
  }
};

module.exports = { submitFeedback, getAllFeedback, getFeedbackStats, deleteFeedback, clearAllFeedback };
