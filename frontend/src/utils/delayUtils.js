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

export const DEFAULT_DELAY_CONFIG = {
  VERIFICATION: { acceptanceMinutes: 30, totalHours: 2 },
  STORE: { acceptanceMinutes: 30, totalHours: 4 },
  LOGO: { acceptanceMinutes: 30, totalHours: 3 },
  PRODUCTION: { acceptanceMinutes: 30, totalHours: 24 },
  DISPATCH: { acceptanceMinutes: 30, totalHours: 4 }
};

export const STAGE_CONFIG_MAP = {
  ORDER_ENTRY: 'VERIFICATION',
  VERIFICATION: 'VERIFICATION',
  STORE: 'STORE',
  STORE_RECEIVE: 'STORE',
  STORE_PRODUCTION: 'STORE',
  LOGO_DESIGN: 'LOGO',
  LOGO: 'LOGO',
  PRODUCTION_ACCEPTANCE: 'PRODUCTION',
  PRODUCTION: 'PRODUCTION',
  WORKERS: 'PRODUCTION',
  DISPATCH: 'DISPATCH',
  IN_DISPATCH: 'DISPATCH',
  OUTLET_RECEIVE: 'DISPATCH',
  ENAMELS_DELIVERY: 'DISPATCH',
  OUT_FOR_DELIVERY: 'DISPATCH'
};

// Auto delay detection from the order's active stage (supports custom delay config).
// Returns null when on time.
export const getDelayInfo = (order, delayConfig = null) => {
  if (!order) return null;
  const status = (order.status || '').toUpperCase();
  if (['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(status)) return null;

  const effectiveStage = getEffectiveStage(order);
  if (!effectiveStage || effectiveStage === 'DELIVERED') return null;

  const stages = Array.isArray(order.stages) ? order.stages : [];
  const active = stages.find(
    (s) => s.stageName === effectiveStage && ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
  );

  let phaseStart;
  if (!active && effectiveStage === 'VERIFICATION') {
    const entryStage = stages.find((s) => s.stageName === 'ORDER_ENTRY');
    phaseStart = (entryStage && (entryStage.completedAt || entryStage.updatedAt || entryStage.createdAt)) || order.createdAt;
  } else if (!active) {
    // If no active stage record is found, fall back to order.createdAt or updatedAt
    phaseStart = order.updatedAt || order.createdAt;
  } else {
    phaseStart = active.startedAt || active.createdAt || order.createdAt;
  }
  if (!phaseStart) return null;

  const now = Date.now();
  const startMs = new Date(phaseStart).getTime();

  const configKey = STAGE_CONFIG_MAP[effectiveStage] || 'STORE';
  const cfg = (delayConfig && delayConfig[configKey]) || DEFAULT_DELAY_CONFIG[configKey] || { acceptanceMinutes: 30, totalHours: 24 };

  const isPendingAcceptance = active ? active.status === 'PENDING' : false;
  let allowedMs;
  let reasonLabel;

  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';

  if (isPendingAcceptance) {
    allowedMs = (cfg.acceptanceMinutes || 30) * 60 * 1000;
    reasonLabel = `${department} Acceptance Delayed`;
  } else {
    allowedMs = (cfg.totalHours || 24) * 3600 * 1000;
    reasonLabel = DELAY_REASONS[department] || `Delayed in ${department}`;
  }

  let expectedDeadline = active?.deadlineAt ? new Date(active.deadlineAt).getTime() : null;
  if (!expectedDeadline) {
    expectedDeadline = startMs + allowedMs;
  } else {
    // If deadlineAt exists, take the earlier threshold to strictly enforce config
    expectedDeadline = Math.min(expectedDeadline, startMs + allowedMs);
  }

  if (expectedDeadline >= now) return null;

  const totalStart = order.createdAt ? new Date(order.createdAt).getTime() : startMs;
  return {
    orderId: order.id,
    stage: effectiveStage,
    stageLabel: stageLabel(effectiveStage),
    department,
    reason: reasonLabel,
    isAcceptanceDelay: isPendingAcceptance,
    phaseStart: startMs,
    phaseElapsed: Math.max(0, now - startMs),
    totalElapsed: Math.max(0, now - totalStart),
    delayDuration: Math.max(0, now - expectedDeadline),
  };
};

export const getStageDelays = (orders, delayConfig = null) => {
  const map = {};
  (orders || []).forEach((o) => {
    const d = getDelayInfo(o, delayConfig);
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
