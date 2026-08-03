// Shared delay-detection helpers used by the Admin Dashboard (Delay Orders card)
// and AllOrders.jsx (stage-based delay filters). Mirrors the backend escalation
// scan: a stage is delayed when deadlineAt < now (working-hours deadline computed
// by calculateDeadline); legacy stages without deadlineAt fall back to a static
// FALLBACK_STAGE_HOURS table.

export const STAGE_DEPARTMENTS = {
  STORE: 'Store',
  STORE_RECEIVE: 'Store',
  WORKERS: 'Production',
  PRODUCTION_ACCEPTANCE: 'Production',
  PRODUCTION: 'Production',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'Dispatch',
  OUTLET_RECEIVE: 'Dispatch',
  ENAMELS_DELIVERY: 'Dispatch',
  OUT_FOR_DELIVERY: 'Dispatch',
  ORDER_ENTRY: 'Inventory Verification',
  VERIFICATION: 'Verification',
  DELIVERED: 'Delivered',
};

export const DELAY_REASONS = {
  'Store': 'Delayed in Store',
  'Production': 'Delayed in Production',
  'Logo': 'Delayed in Logo Department',
  'Dispatch': 'Delayed in Dispatch',
  'Inventory Verification': 'Delayed in Inventory Verification',
  'Verification': 'Delayed in Verification',
};

export const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry',
  VERIFICATION: 'Verification',
  STORE: 'Store',
  STORE_RECEIVE: 'Store Receive',
  WORKERS: 'Workers',
  PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production',
  LOGO_DESIGN: 'Logo Design',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'In Dispatch',
  OUTLET_RECEIVE: 'Outlet Receive',
  ENAMELS_DELIVERY: 'Enamels Delivery',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};

// Canonical workflow order used to sort the stage filter chips.
export const STAGE_ORDER = [
  'ORDER_ENTRY', 'VERIFICATION', 'STORE', 'STORE_RECEIVE', 'LOGO_DESIGN',
  'PRODUCTION_ACCEPTANCE', 'PRODUCTION', 'WORKERS', 'DISPATCH', 'IN_DISPATCH',
  'OUTLET_RECEIVE', 'ENAMELS_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'
];

// Fallback expected phase duration (hours) when a stage has no deadlineAt (legacy rows)
export const FALLBACK_STAGE_HOURS = {
  STORE: 24, WORKERS: 24, LOGO_DESIGN: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48,
  STORE_RECEIVE: 12, OUTLET_RECEIVE: 48, ENAMELS_DELIVERY: 24, DISPATCH: 12,
  OUT_FOR_DELIVERY: 12, ORDER_ENTRY: 24, IN_DISPATCH: 24, VERIFICATION: 24,
};

export const stageLabel = (stageName) =>
  STAGE_LABELS[stageName] || (stageName || '').replace(/_/g, ' ') || '';

// <24h → "X Hours"; ≥24h → "X Day(s)" (never "48 Hours")
export const fmtDuration = (ms) => {
  const h = Math.floor((ms || 0) / 3600000);
  if (h < 24) return `${Math.max(h, 1)} Hour${Math.max(h, 1) === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `${d} Day${d === 1 ? '' : 's'}`;
};

// The workflow stage an order is actually stuck in for tracking/delay purposes.
// Verification keeps currentStage at ORDER_ENTRY — derive the real location from the
// same fields as the backend getTrackingStatus helper.
export const getEffectiveStage = (order) => {
  if (order?.goForVerification && !order?.verifiedAt && !order?.verificationReturnedAt) return 'VERIFICATION';
  return order?.currentStage;
};

// Auto delay detection from the order's active stage deadline (same machinery as the
// backend escalation scan: stage.deadlineAt < now → delayed). Returns null when on time.
export const getDelayInfo = (order) => {
  if (!order || !Array.isArray(order.stages) || order.stages.length === 0) return null;
  const effectiveStage = getEffectiveStage(order);
  const active = order.stages.find(
    (s) => s.stageName === effectiveStage && ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
  );

  let phaseStart;
  if (!active && effectiveStage === 'VERIFICATION') {
    // No dedicated VERIFICATION stage record exists — orders stay at ORDER_ENTRY.
    // Use the ORDER_ENTRY stage completion time as when verification began.
    const entryStage = order.stages.find((s) => s.stageName === 'ORDER_ENTRY');
    phaseStart = (entryStage && (entryStage.completedAt || entryStage.updatedAt || entryStage.createdAt)) || order.createdAt;
  } else if (!active) {
    return null;
  } else {
    phaseStart = active.startedAt || active.createdAt || order.createdAt;
  }
  if (!phaseStart) return null;

  const now = Date.now();
  const startMs = new Date(phaseStart).getTime();
  let expectedDeadline = active?.deadlineAt ? new Date(active.deadlineAt).getTime() : null;
  if (!expectedDeadline) {
    expectedDeadline = startMs + ((FALLBACK_STAGE_HOURS[effectiveStage] || 24) * 3600000);
  }
  if (expectedDeadline >= now) return null;

  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';
  const totalStart = order.createdAt ? new Date(order.createdAt).getTime() : startMs;
  return {
    orderId: order.id,
    stage: effectiveStage,
    stageLabel: stageLabel(effectiveStage),
    department,
    reason: DELAY_REASONS[department] || `Delayed in ${department}`,
    phaseStart: startMs,
    phaseElapsed: Math.max(0, now - startMs),
    totalElapsed: Math.max(0, now - totalStart),
    delayDuration: Math.max(0, now - expectedDeadline),
  };
};

// Group delayed orders by the workflow stage they are stuck in. Returns an array of
// { stage, label, department, count } ordered by the canonical workflow then count desc.
export const getStageDelays = (orders) => {
  const map = {};
  (orders || []).forEach((o) => {
    const d = getDelayInfo(o);
    if (!d) return;
    if (!map[d.stage]) map[d.stage] = { stage: d.stage, label: d.stageLabel, department: d.department, count: 0 };
    map[d.stage].count++;
  });
  return Object.values(map).sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a.stage);
    const ib = STAGE_ORDER.indexOf(b.stage);
    const oa = ia === -1 ? 999 : ia;
    const ob = ib === -1 ? 999 : ib;
    if (oa !== ob) return oa - ob;
    return b.count - a.count;
  });
};
