// Normalizes socket event payloads from varying backend shapes into consistent format.
// Backend emits 'order-updated' with multiple shapes:
//   { order, createdById } — full object
//   { orderId, createdById } — only ID
//   { orderId, paymentStatus, createdById } — partial update
//   { orderId, deleted, orderNumber } — deletion

export function normalizeOrderEvent(payload) {
  if (!payload) return null;

  const orderId = payload.orderId || payload.order?.id || null;
  const createdById = payload.createdById || payload.order?.createdById || null;

  // Full order object provided
  if (payload.order) {
    return { type: 'full', order: payload.order, orderId: payload.order.id || orderId, createdById };
  }

  // Deletion event
  if (payload.deleted) {
    return { type: 'deleted', orderId, orderNumber: payload.orderNumber, createdById };
  }

  // Partial update (e.g., payment status)
  if (orderId) {
    return { type: 'partial', orderId, createdById, changes: extractChanges(payload) };
  }

  return null;
}

function extractChanges(payload) {
  const keys = ['paymentStatus', 'dispatchStatus', 'currentStage', 'status', 'refundStatus'];
  const changes = {};
  for (const key of keys) {
    if (payload[key] !== undefined) changes[key] = payload[key];
  }
  return changes;
}

export function normalizeInventoryEvent(payload) {
  if (!payload) return null;
  if (payload.deleted) return { type: 'deleted', id: payload.deleted };
  if (payload.cleared) return { type: 'cleared' };
  if (payload.bulkUpdate) return { type: 'bulk' };
  if (payload.id) return { type: 'item', item: payload };
  if (payload.source === 'production') return { type: 'production', orderId: payload.orderId };
  return { type: 'unknown', payload };
}

export function normalizeOrderList(orders) {
  if (!Array.isArray(orders)) return [];
  return orders.map(o => ({
    ...o,
    productDetails: typeof o.productDetails === 'string' ? safeJsonParse(o.productDetails) : (o.productDetails || []),
    courierDetails: typeof o.courierDetails === 'string' ? safeJsonParse(o.courierDetails) : (o.courierDetails || {}),
  }));
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return str; }
}
