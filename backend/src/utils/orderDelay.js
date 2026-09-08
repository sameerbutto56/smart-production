// Backend delay engine — Phase-based working-hours delay detection.
// Uses computeWorkingMs (9AM-7PM PKT, Mon-Sat, Sundays excluded) for accurate
// delay computation. Each phase has an independent clock starting at stage.createdAt
// (phase entry) / stage.startedAt (acceptance). Delay = working time in phase beyond
// the configured threshold.

const {
  computeWorkingMs,
  computeWorkingHours,
  computeWorkingDeadline,
  WORK_HOURS_PER_DAY
} = require('./workingHours');

const STAGE_DEPARTMENTS = {
  STORE: 'Store',
  STORE_RECEIVE: 'Store Receive',
  WORKERS: 'Production',
  PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production Out',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'In Dispatch',
  OUTLET_RECEIVE: 'Production Receive Outlet',
  ENAMELS_DELIVERY: 'Delivery',
  OUT_FOR_DELIVERY: 'Out of Delivery',
  ORDER_ENTRY: 'Order Entry',
  VERIFICATION: 'Verification',
  RETURN_VERIFICATION: 'Return from Verification',
  DELIVERED: 'Completed',
};

const DELAY_REASONS = {
  'Store': 'Delayed in Store',
  'Store Receive': 'Delayed in Store Receive',
  'Production': 'Delayed in Production',
  'Production Acceptance': 'Delayed in Production Acceptance',
  'Production Out': 'Delayed in Production Out',
  'Logo': 'Delayed in Logo Department',
  'Dispatch': 'Delayed in Dispatch',
  'In Dispatch': 'Delayed in In Dispatch',
  'Out of Delivery': 'Delayed in Out of Delivery',
  'Production Receive Outlet': 'Delayed in Production Receive Outlet',
  'Delivery': 'Delayed in Delivery',
  'Order Entry': 'Delayed in Order Entry',
  'Inventory Verification': 'Delayed in Inventory Verification',
  'Verification': 'Delayed in Verification',
  'Return from Verification': 'Delayed in Return from Verification',
};

const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry',
  VERIFICATION: 'Verification',
  RETURN_VERIFICATION: 'Return from Verification',
  STORE: 'Store',
  STORE_RECEIVE: 'Store Receive',
  WORKERS: 'Production In',
  PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production Out',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'In Dispatch',
  OUTLET_RECEIVE: 'Production Receive Outlet',
  ENAMELS_DELIVERY: 'Delivery',
  OUT_FOR_DELIVERY: 'Out of Delivery',
  DELIVERED: 'Completed',
};

// Fallback allowed hours per phase when no config is available.
const FALLBACK_STAGE_HOURS = {
  ORDER_ENTRY: 4,
  VERIFICATION: 4,
  RETURN_VERIFICATION: 4,
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

// Default delay config for Software Settings (all phases, hours).
const DEFAULT_DELAY_CONFIG = {
  ORDER_ENTRY: 4,
  VERIFICATION: 4,
  RETURN_VERIFICATION: 4,
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
  RETURN_VERIFICATION: 'RETURN_VERIFICATION',
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
  if (!ms || ms <= 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (WORK_HOURS_PER_DAY * 60));
  const remainingMin = totalMin % (WORK_HOURS_PER_DAY * 60);
  const hours = Math.floor(remainingMin / 60);
  const minutes = remainingMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours} Hour${hours === 1 ? '' : 's'}`;
  return `${minutes} Min`;
};

const getEffectiveStage = (order) => {
  if (order?.verificationReturnedAt && !order?.verifiedAt && order?.currentStage === 'ORDER_ENTRY') return 'RETURN_VERIFICATION';
  if (order?.goForVerification && !order?.verifiedAt && !order?.verificationReturnedAt) return 'VERIFICATION';
  return order?.currentStage;
};

/**
 * Compute the allowed hours for a given phase from the delay config.
 * Falls back to FALLBACK_STAGE_HOURS when config is missing.
 */
const getAllowedHours = (stageName, delayConfig = null) => {
  if (delayConfig && typeof delayConfig === 'object') {
    // 1. Direct key match
    const directVal = delayConfig[stageName];
    if (typeof directVal === 'number' && directVal > 0) return directVal;
    if (directVal && typeof directVal.totalHours === 'number' && directVal.totalHours > 0) return directVal.totalHours;

    // 2. Mapped key match
    const configKey = STAGE_CONFIG_MAP[stageName] || stageName;
    const mappedVal = delayConfig[configKey];
    if (typeof mappedVal === 'number' && mappedVal > 0) return mappedVal;
    if (mappedVal && typeof mappedVal.totalHours === 'number' && mappedVal.totalHours > 0) return mappedVal.totalHours;

    // 3. Special fallback for RETURN_VERIFICATION -> VERIFICATION
    if (stageName === 'RETURN_VERIFICATION') {
      const verVal = delayConfig['VERIFICATION'];
      if (typeof verVal === 'number' && verVal > 0) return verVal;
    }
  }
  return FALLBACK_STAGE_HOURS[stageName] || 24;
};

/**
 * Compute the exact deadline timestamp for a given stage starting at startMs.
 */
const computeStageDeadline = (stageName, startMs, delayConfig = null) => {
  const allowedHours = getAllowedHours(stageName, delayConfig);
  return computeWorkingDeadline(startMs, allowedHours);
};

/**
 * Get comprehensive delay info for a single order.
 * Uses working-hours computation (9AM-7PM PKT, Mon-Sat) to determine elapsed time,
 * and system-pause awareness via computeWorkingMs which handles pause-period overlaps.
 *
 * @param {Object} order - Order with stages array
 * @param {Object|null} delayConfig - Phase config { VERIFICATION: 2, STORE: 24, ... }
 * @param {Array|null} pausePeriods - System pause periods
 * @param {string|null} profileKey - Caller's pause profile
 * @param {number|null} nowMs - Current timestamp (default Date.now())
 * @returns {Object|null} Delay info or null if on time
 */
const getDelayInfo = (order, delayConfig = null, pausePeriods = null, profileKey = null, nowMs = null) => {
  if (!order) return null;
  const status = String(order.status || '').toUpperCase();
  if (['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(status)) return null;

  const effectiveStage = getEffectiveStage(order);
  if (!effectiveStage || ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(effectiveStage)) return null;

  const stages = Array.isArray(order.stages) ? order.stages : [];
  const active = stages.find(
    (s) => s.stageName === effectiveStage && ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
  );

  // Phase entry time: when the order entered this phase
  let phaseEnteredAt;
  if (effectiveStage === 'ORDER_ENTRY') {
    // When Faisal creates an order, we capture shopifyOrderDate.
    // That Shopify date must be used as the starting reference for Order Entry delay.
    phaseEnteredAt = order.shopifyOrderDate || order.createdAt;
  } else if (effectiveStage === 'RETURN_VERIFICATION') {
    // Returned from verification: actual return timestamp
    phaseEnteredAt = order.verificationReturnedAt || order.updatedAt || order.createdAt;
  } else if (effectiveStage === 'VERIFICATION') {
    // In Verification: time when sent to verification
    const entryStage = stages.find((s) => s.stageName === 'ORDER_ENTRY');
    phaseEnteredAt = (entryStage && (entryStage.completedAt || entryStage.updatedAt || entryStage.createdAt)) || order.createdAt;
  } else if (effectiveStage === 'OUTLET_RECEIVE') {
    // Come from Production: time when routed/created in OUTLET_RECEIVE
    phaseEnteredAt = active?.createdAt || order.updatedAt || order.createdAt;
  } else if (!active) {
    phaseEnteredAt = order.updatedAt || order.createdAt;
  } else {
    phaseEnteredAt = active.createdAt || order.createdAt;
  }
  if (!phaseEnteredAt) return null;

  const now = nowMs || Date.now();
  const enteredMs = new Date(phaseEnteredAt).getTime();
  if (!Number.isFinite(enteredMs)) return null;

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

  // Total order elapsed (from order creation or shopifyOrderDate)
  const orderStartRef = order.shopifyOrderDate || order.createdAt;
  const orderCreatedMs = orderStartRef ? new Date(orderStartRef).getTime() : enteredMs;
  const totalElapsedMs = computeActiveWorkingMsSafe(orderCreatedMs, now, pausePeriods, profileKey);

  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';
  const reasonLabel = DELAY_REASONS[department] || `Delayed in ${department}`;

  // Calculate deadline: either from active.deadlineAt if consistent with working deadline, or computeWorkingDeadline
  const deadlineAt = active?.deadlineAt
    ? new Date(active.deadlineAt).getTime()
    : computeWorkingDeadline(enteredMs, allowedHours);

  // On time when working time in phase hasn't exceeded threshold
  if (phaseWorkingMs <= allowedMs) return null;

  // Working time past allowed threshold
  const delayDuration = Math.max(0, phaseWorkingMs - allowedMs);

  return {
    orderId: order.id,
    stage: effectiveStage,
    stageLabel: stageLabel(effectiveStage),
    department,
    reason: reasonLabel,
    isAcceptanceDelay: !acceptedAt,
    isDelayed: true,
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
    workingTimeRemainingMs: 0,
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

// Builds a { orderId: delayInfo } map for a list of orders (used by exports and admin orders).
const getDelayMap = (orders, delayConfig = null, pausePeriods = null, profileKey = null) => {
  const map = {};
  (orders || []).forEach((o) => {
    const d = getDelayInfo(o, delayConfig, pausePeriods, profileKey);
    if (d) map[o.id] = d;
  });
  return map;
};

/**
 * Mutates/attaches delayInfo and isDelayed to an array of orders.
 * Provides a uniform API interface so all backend endpoints return pre-computed delay states.
 */
const attachDelayInfoToOrders = (orders, delayConfig = null, pausePeriods = null) => {
  if (!Array.isArray(orders)) return orders;
  const now = Date.now();
  orders.forEach((o) => {
    if (!o) return;
    const d = getDelayInfo(o, delayConfig, pausePeriods, null, now);
    o.delayInfo = d || null;
    o.isDelayed = !!d;
    if (d && !o.currentStageDeadline) {
      o.currentStageDeadline = d.deadlineAt ? new Date(d.deadlineAt).toISOString() : null;
    }
  });
  return orders;
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
  getAllowedHours,
  computeStageDeadline,
  getDelayInfo,
  getDelayMap,
  attachDelayInfoToOrders,
  computeWorkingMs,
  computeWorkingHours,
  computeWorkingDeadline,
};
