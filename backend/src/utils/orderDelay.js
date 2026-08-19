// Backend delay engine — Phase-based working-hours delay detection.
// Uses computeWorkingMs (9AM-7PM PKT, Mon-Sat, Sundays excluded) for accurate
// delay computation. Each phase has an independent clock starting at stage.createdAt
// (phase entry) / stage.startedAt (acceptance). Delay = working time in phase beyond
// the configured threshold.

const { computeWorkingMs, computeWorkingHours } = require('./workingHours');

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

// Fallback allowed hours per phase when no config is available.
const FALLBACK_STAGE_HOURS = {
  ORDER_ENTRY: 4,
  VERIFICATION: 4,
  STORE: 24,
  STORE_RECEIVE: 12,
  WORKERS: 24,
  PRODUCTION_ACCEPTANCE: 4,
  PRODUCTION: 48,
  LOGO_DESIGN: 24,
  DISPATCH: 12,
  IN_DISPATCH: 24,
  OUTLET_RECEIVE: 48,
  ENAMELS_DELIVERY: 24,
  OUT_FOR_DELIVERY: 12,
};

// Each phase maps to a config key in the Software Settings delay config.
const STAGE_CONFIG_MAP = {
  ORDER_ENTRY: 'ORDER_ENTRY',
  VERIFICATION: 'VERIFICATION',
  STORE: 'STORE',
  STORE_RECEIVE: 'STORE_RECEIVE',
  WORKERS: 'WORKERS',
  PRODUCTION_ACCEPTANCE: 'PRODUCTION_ACCEPTANCE',
  PRODUCTION: 'PRODUCTION',
  LOGO_DESIGN: 'LOGO_DESIGN',
  DISPATCH: 'DISPATCH',
  IN_DISPATCH: 'IN_DISPATCH',
  OUTLET_RECEIVE: 'OUTLET_RECEIVE',
  ENAMELS_DELIVERY: 'ENAMELS_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
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

/**
 * Compute the allowed hours for a given phase from the delay config.
 * Falls back to FALLBACK_STAGE_HOURS when config is missing.
 */
const getAllowedHours = (stageName, delayConfig = null) => {
  const configKey = STAGE_CONFIG_MAP[stageName] || stageName;
  if (delayConfig) {
    const rawVal = delayConfig[configKey];
    if (typeof rawVal === 'number' && rawVal > 0) return rawVal;
    if (rawVal && typeof rawVal.totalHours === 'number' && rawVal.totalHours > 0) return rawVal.totalHours;
  }
  return FALLBACK_STAGE_HOURS[stageName] || 24;
};

/**
 * Get comprehensive delay info for a single order.
 * Uses working-hours computation (9AM-7PM PKT, Mon-Sat) to determine elapsed time,
 * and system-pause awareness via the combined computeWorkingMs which already handles
 * pause-period overlaps.
 *
 * @param {Object} order - Order with stages array
 * @param {Object|null} delayConfig - Phase config { VERIFICATION: 2, STORE: 24, ... }
 * @param {Array|null} pausePeriods - System pause periods
 * @param {string|null} profileKey - Caller's pause profile
 * @returns {Object|null} Delay info or null if on time
 */
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

  // Phase entry time: when the order entered this phase
  let phaseEnteredAt;
  if (!active && effectiveStage === 'VERIFICATION') {
    const entryStage = stages.find((s) => s.stageName === 'ORDER_ENTRY');
    phaseEnteredAt = (entryStage && (entryStage.completedAt || entryStage.updatedAt || entryStage.createdAt)) || order.createdAt;
  } else if (!active) {
    phaseEnteredAt = order.updatedAt || order.createdAt;
  } else {
    phaseEnteredAt = active.createdAt || order.createdAt;
  }
  if (!phaseEnteredAt) return null;

  const now = Date.now();
  const enteredMs = new Date(phaseEnteredAt).getTime();
  const allowedHours = getAllowedHours(effectiveStage, delayConfig);
  const allowedMs = allowedHours * 3600 * 1000;

  // Working time elapsed in this phase (9AM-7PM Mon-Sat, excluding pauses)
  const phaseWorkingMs = computeActiveWorkingMsSafe(enteredMs, now, pausePeriods, profileKey);

  // Acceptance time (if stage has been accepted)
  const acceptedAt = active?.startedAt ? new Date(active.startedAt).getTime() : null;
  const acceptanceWaitingMs = acceptedAt
    ? computeActiveWorkingMsSafe(enteredMs, acceptedAt, pausePeriods, profileKey)
    : computeActiveWorkingMsSafe(enteredMs, now, pausePeriods, profileKey);

  // Processing time (after acceptance)
  const processingMs = acceptedAt
    ? (active?.completedAt
        ? computeActiveWorkingMsSafe(acceptedAt, new Date(active.completedAt).getTime(), pausePeriods, profileKey)
        : computeActiveWorkingMsSafe(acceptedAt, now, pausePeriods, profileKey))
    : 0;

  // Total order elapsed (from order creation)
  const orderCreatedMs = order.createdAt ? new Date(order.createdAt).getTime() : enteredMs;
  const totalElapsedMs = computeActiveWorkingMsSafe(orderCreatedMs, now, pausePeriods, profileKey);

  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';
  const reasonLabel = DELAY_REASONS[department] || `Delayed in ${department}`;

  // On time when working time in phase hasn't exceeded threshold
  if (phaseWorkingMs < allowedMs) return null;

  const deadlineAt = active?.deadlineAt ? new Date(active.deadlineAt).getTime() : null;
  // For the delay duration, use working time past the allowed threshold
  const delayDuration = Math.max(0, phaseWorkingMs - allowedMs);

  // Working time remaining until deadline (if deadline exists)
  const workingTimeRemainingMs = deadlineAt
    ? computeActiveWorkingMsSafe(now, deadlineAt, pausePeriods, profileKey)
    : Math.max(0, allowedMs - phaseWorkingMs);

  return {
    orderId: order.id,
    stage: effectiveStage,
    stageLabel: stageLabel(effectiveStage),
    department,
    reason: reasonLabel,
    isAcceptanceDelay: !acceptedAt,
    phaseEnteredAt: enteredMs,
    acceptedAt,
    phaseWorkingMs,
    acceptanceWaitingMs,
    processingMs,
    totalElapsedMs,
    allowedHours,
    allowedMs,
    delayDuration,
    deadlineAt,
    workingTimeRemainingMs,
  };
};

// Wrapper that uses computeWorkingMs (working-hours-only) minus pause overlaps
const computeActiveWorkingMsSafe = (startMs, endMs, pausePeriods = null, profileKey = null) => {
  let workingMs = computeWorkingMs(startMs, endMs);
  if (!Array.isArray(pausePeriods) || pausePeriods.length === 0) return workingMs;
  const now = endMs;
  for (const p of pausePeriods) {
    if (!p || !p.startedAt) continue;
    if (profileKey && Array.isArray(p.profiles) && p.profiles.length && !p.profiles.includes(profileKey)) continue;
    const pStart = new Date(p.startedAt).getTime();
    if (!Number.isFinite(pStart)) continue;
    const pEnd = p.endedAt ? new Date(p.endedAt).getTime() : now;
    if (!Number.isFinite(pEnd)) continue;
    const overlapMs = computeWorkingMs(Math.max(startMs, pStart), Math.min(endMs, pEnd));
    workingMs -= overlapMs;
  }
  return Math.max(0, workingMs);
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
  STAGE_CONFIG_MAP,
  stageLabel,
  fmtDuration,
  getEffectiveStage,
  getAllowedHours,
  getDelayInfo,
  getDelayMap,
  computeWorkingMs,
  computeWorkingHours,
};
