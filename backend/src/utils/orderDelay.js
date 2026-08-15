// Backend mirror of the frontend shared delay helpers (frontend/src/utils/delayUtils.js).
// Used by the Orders Excel export so the exported "delayed" dataset is classified with
// the exact same logic the Admin Orders screen uses to show delay filters. Mirrors the
// escalation scan: a stage is delayed when deadlineAt < now / active elapsed exceeds the
// configured hours; legacy stages without a deadline fall back to FALLBACK_STAGE_HOURS.

const { activeElapsedMs } = require('./systemPause');

const STAGE_DEPARTMENTS = {
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

const DELAY_REASONS = {
  'Store': 'Delayed in Store',
  'Production': 'Delayed in Production',
  'Logo': 'Delayed in Logo Department',
  'Dispatch': 'Delayed in Dispatch',
  'Inventory Verification': 'Delayed in Inventory Verification',
  'Verification': 'Delayed in Verification',
};

const STAGE_LABELS = {
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

const FALLBACK_STAGE_HOURS = {
  STORE: 24, WORKERS: 24, LOGO_DESIGN: 24, PRODUCTION_ACCEPTANCE: 4, PRODUCTION: 48,
  STORE_RECEIVE: 12, OUTLET_RECEIVE: 48, ENAMELS_DELIVERY: 24, DISPATCH: 12,
  OUT_FOR_DELIVERY: 12, ORDER_ENTRY: 24, IN_DISPATCH: 24, VERIFICATION: 24,
};

// Same defaults as the frontend delayUtils DEFAULT_DELAY_CONFIG (hours per config key).
const DEFAULT_DELAY_CONFIG = {
  VERIFICATION: 2, // 2 hours
  STORE: 2,        // 2 hours
  LOGO: 4,         // 4 hours
  PRODUCTION: 10,  // 10 hours
  DISPATCH: 4      // 4 hours
};

const STAGE_CONFIG_MAP = {
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

const stageLabel = (stageName) =>
  STAGE_LABELS[stageName] || String(stageName || '').replace(/_/g, ' ') || '';

const fmtDuration = (ms) => {
  const h = Math.floor((ms || 0) / 3600000);
  if (h < 24) return `${Math.max(h, 1)} Hour${Math.max(h, 1) === 1 ? '' : 's'}`;
  const d = Math.floor(h / 24);
  return `${d} Day${d === 1 ? '' : 's'}`;
};

const getEffectiveStage = (order) => {
  if (order?.goForVerification && !order?.verifiedAt && !order?.verificationReturnedAt) return 'VERIFICATION';
  return order?.currentStage;
};

// Identical classification to frontend getDelayInfo — returns null when on time.
const getDelayInfo = (order, delayConfig = null, pausePeriods = null, profileKey = null) => {
  if (!order) return null;
  const status = String(order.status || '').toUpperCase();
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
    phaseStart = order.updatedAt || order.createdAt;
  } else {
    phaseStart = active.startedAt || active.createdAt || order.createdAt;
  }
  if (!phaseStart) return null;

  const now = Date.now();
  const startMs = new Date(phaseStart).getTime();

  const configKey = STAGE_CONFIG_MAP[effectiveStage] || 'STORE';
  let deadlineHours = 24;
  if (delayConfig) {
    const rawVal = delayConfig[configKey];
    if (typeof rawVal === 'number') {
      deadlineHours = rawVal;
    } else if (rawVal && typeof rawVal.totalHours === 'number') {
      deadlineHours = rawVal.totalHours;
    }
  } else {
    deadlineHours = DEFAULT_DELAY_CONFIG[configKey] || 24;
  }

  const allowedMs = deadlineHours * 3600 * 1000;
  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';
  const reasonLabel = DELAY_REASONS[department] || `Delayed in ${department}`;

  const phaseActive = activeElapsedMs(startMs, now, pausePeriods, profileKey);
  if (phaseActive < allowedMs) return null;

  const totalStart = order.createdAt ? new Date(order.createdAt).getTime() : startMs;
  return {
    orderId: order.id,
    stage: effectiveStage,
    stageLabel: stageLabel(effectiveStage),
    department,
    reason: reasonLabel,
    isAcceptanceDelay: false,
    phaseStart: startMs,
    phaseElapsed: phaseActive,
    totalElapsed: activeElapsedMs(totalStart, now, pausePeriods, profileKey),
    delayDuration: Math.max(0, phaseActive - allowedMs),
  };
};

// Builds a { orderId: delayInfo } map for a list of orders (used by exports).
const getDelayMap = (orders, delayConfig = null, pausePeriods = null, profileKey = null) => {
  const map = {};
  (orders || []).forEach((o) => {
    const d = getDelayInfo(o, delayConfig, pausePeriods, profileKey);
    if (d) map[o.id] = d;
  });
  return map;
};

module.exports = {
  STAGE_DEPARTMENTS,
  DELAY_REASONS,
  STAGE_LABELS,
  FALLBACK_STAGE_HOURS,
  DEFAULT_DELAY_CONFIG,
  STAGE_CONFIG_MAP,
  stageLabel,
  fmtDuration,
  getEffectiveStage,
  getDelayInfo,
  getDelayMap,
};
