/**
 * Centralized Order Number validation/reuse guard.
 *
 * The `Order` table is the live registry of every non-deleted order number:
 * active/processing, delivered, completed/closed and cancelled orders all
 * remain in `Order`, so their numbers are permanently RESERVED (never reusable).
 *
 * Deleted orders are hard-deleted from `Order` (their audit snapshot lives in
 * `DeletedOrder`), so a number with no live `Order` row is AVAILABLE for reuse
 * while the deletion audit record is retained.
 *
 * Matching mirrors the existing `#`-prefix convention: some legacy rows store
 * `#50037`, the frontend submits bare `50037`. Both forms are checked.
 */

const bareNumber = (raw) => String(raw || '').trim().replace(/^#/, '');

/**
 * Check whether an order number is currently reusable.
 * @param prisma  Prisma client
 * @param orderNumber  the number as submitted (bare or `#`-prefixed)
 * @returns {Promise<{ available: boolean, reserved: boolean, order: Object|null, reason: string|null }>}
 */
const checkOrderNumberAvailable = async (prisma, orderNumber) => {
  const bare = bareNumber(orderNumber);
  if (!bare) {
    return { available: false, reserved: false, order: null, reason: 'Order number is required' };
  }

  const existing = await prisma.order.findFirst({
    where: {
      OR: [{ orderNumber: bare }, { orderNumber: `#${bare}` }],
      // A unique orderNumber is required; treat any row as the registry entry.
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      currentStage: true,
      createdAt: true,
      deliveredAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) {
    return { available: true, reserved: false, order: null, reason: null };
  }

  const cancelled = existing.status === 'CANCELLED';
  const reason = cancelled
    ? 'This order number has already been cancelled and cannot be reused.'
    : 'This order number already exists.';

  return { available: false, reserved: true, order: existing, reason };
};

module.exports = {
  bareNumber,
  checkOrderNumberAvailable,
};
