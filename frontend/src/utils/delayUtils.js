// Shared delay-detection helpers — Phase-Based Working-Hours Delay System.
// Uses computeWorkingMs (9AM-7PM PKT, Mon-Sat, Sundays excluded) so delays
// are computed only on working time, never on overnight/weekend hours.

import { computeWorkingMs, computeWorkingHours, WORK_HOURS_PER_DAY, fmtWorkingDuration } from './workingHours';

export const STAGE_DEPARTMENTS = {
  STORE: 'Store',
  STORE_RECEIVE: 'Store',
  WORKERS: 'Production',
  PRODUCTION_ACCEPTANCE: 'Production',
  PRODUCTION: 'Production',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'In Dispatch',
  OUTLET_RECEIVE: 'Dispatch',
  ENAMELS_DELIVERY: 'Delivery',
  OUT_FOR_DELIVERY: 'Out of Delivery',
  ORDER_ENTRY: 'Inventory Verification',
  VERIFICATION: 'Verification',
  RETURN_VERIFICATION: 'Return Verification',
  DELIVERED: 'Completed',
};

export const DELAY_REASONS = {
  'Store': 'Delayed in Store',
  'Production': 'Delayed in Production',
  'Logo': 'Delayed in Logo Department',
  'Dispatch': 'Delayed in Dispatch',
  'In Dispatch': 'Delayed in In Dispatch',
  'Out of Delivery': 'Delayed in Out of Delivery',
  'Inventory Verification': 'Delayed in Inventory Verification',
  'Verification': 'Delayed in Verification',
  'Return Verification': 'Delayed in Return Verification',
};

export const STAGE_LABELS = {
  ORDER_ENTRY: 'Order Entry',
  VERIFICATION: 'Verification',
  RETURN_VERIFICATION: 'Return Verification',
  STORE: 'Store',
  STORE_RECEIVE: 'Store Receive',
  WORKERS: 'Production In',
  PRODUCTION_ACCEPTANCE: 'Production Acceptance',
  PRODUCTION: 'Production Out',
  LOGO_DESIGN: 'Logo',
  DISPATCH: 'Dispatch',
  IN_DISPATCH: 'In Dispatch',
  OUTLET_RECEIVE: 'Outlet Receive',
  ENAMELS_DELIVERY: 'Delivery',
  OUT_FOR_DELIVERY: 'Out of Delivery',
  DELIVERED: 'Completed',
};

// Canonical workflow order for sorting stage filter chips.
export const STAGE_ORDER = [
  'ORDER_ENTRY', 'VERIFICATION', 'RETURN_VERIFICATION', 'STORE', 'STORE_RECEIVE', 'LOGO_DESIGN',
  'PRODUCTION_ACCEPTANCE', 'WORKERS', 'PRODUCTION', 'DISPATCH', 'IN_DISPATCH',
  'OUTLET_RECEIVE', 'ENAMELS_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'
];

// Fallback allowed hours per phase when config is unavailable.
export const FALLBACK_STAGE_HOURS = {
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
export const DEFAULT_DELAY_CONFIG = {
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

// Each stage maps to a config key in the delay config.
export const STAGE_CONFIG_MAP = {
  ORDER_ENTRY: 'ORDER_ENTRY',
  VERIFICATION: 'VERIFICATION',
  RETURN_VERIFICATION: 'VERIFICATION',
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

export const stageLabel = (stageName) =>
  STAGE_LABELS[stageName] || (stageName || '').replace(/_/g, ' ') || '';

export const fmtDuration = fmtWorkingDuration;

// The workflow stage an order is actually stuck in for tracking/delay purposes.
export const getEffectiveStage = (order) => {
  if (order?.verificationReturnedAt && !order?.verifiedAt && order?.currentStage === 'ORDER_ENTRY') return 'RETURN_VERIFICATION';
  if (order?.goForVerification && !order?.verifiedAt && !order?.verificationReturnedAt) return 'VERIFICATION';
  return order?.currentStage;
};

/**
 * Compute the allowed hours for a given phase from the delay config.
 * Falls back to FALLBACK_STAGE_HOURS when config is missing.
 */
export const getAllowedHours = (stageName, delayConfig = null) => {
  const configKey = STAGE_CONFIG_MAP[stageName] || stageName;
  if (delayConfig) {
    const rawVal = delayConfig[configKey];
    if (typeof rawVal === 'number' && rawVal > 0) return rawVal;
    if (rawVal && typeof rawVal.totalHours === 'number' && rawVal.totalHours > 0) return rawVal.totalHours;
  }
  return FALLBACK_STAGE_HOURS[stageName] || 24;
};

/**
 * Compute working milliseconds with system-pause awareness.
 * Subtracts pause overlaps from the working-hours total.
 */
export const computeActiveWorkingMs = (startMs, endMs, pausePeriods = null, profileKey = null) => {
  let workingMs = computeWorkingMs(startMs, endMs);
  if (!Array.isArray(pausePeriods) || pausePeriods.length === 0) return workingMs;
  const now = endMs;
  for (const p of pausePeriods) {
    if (!p || !p.startedAt) continue;
    if (profileKey && Array.isArray(p.profiles) && p.profiles.length && !p.profiles.includes(profileKey)) continue;
    const ps = new Date(p.startedAt || p.pausedAt).getTime();
    if (Number.isNaN(ps)) continue;
    const pe = p.endedAt ? new Date(p.endedAt).getTime() : now;
    if (Number.isNaN(pe)) continue;
    workingMs -= computeWorkingMs(Math.max(startMs, ps), Math.min(endMs, pe));
  }
  return Math.max(0, workingMs);
};

/**
 * Get comprehensive delay info for a single order.
 * Uses working-hours computation (9AM-7PM PKT, Mon-Sat) for all time measurements.
 * Returns null when the order is on time.
 *
 * @param {Object} order - Order with stages array
 * @param {Object|null} delayConfig - Phase config { VERIFICATION: 2, STORE: 24, ... }
 * @param {Array|null} pausePeriods - System pause periods
 * @param {string|null} profileKey - Caller's pause profile
 * @returns {Object|null} Delay info or null if on time
 */
export const getDelayInfo = (order, delayConfig = null, pausePeriods = null, profileKey = null) => {
  if (!order) return null;
  const status = (order.status || '').toUpperCase();
  if (['COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(status)) return null;

  const effectiveStage = getEffectiveStage(order);
  if (!effectiveStage || ['DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'RETURNED'].includes(effectiveStage)) return null;

  const stages = Array.isArray(order.stages) ? order.stages : [];
  const active = stages.find(
    (s) => s.stageName === effectiveStage && ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(s.status)
  );

  // Phase entry time
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

  // Working time elapsed in this phase
  const phaseWorkingMs = computeActiveWorkingMs(enteredMs, now, pausePeriods, profileKey);

  // Acceptance time
  const acceptedAt = active?.startedAt ? new Date(active.startedAt).getTime() : null;
  const acceptanceWaitingMs = acceptedAt
    ? computeActiveWorkingMs(enteredMs, acceptedAt, pausePeriods, profileKey)
    : computeActiveWorkingMs(enteredMs, now, pausePeriods, profileKey);

  // Processing time (after acceptance)
  const processingMs = acceptedAt
    ? (active?.completedAt
        ? computeActiveWorkingMs(acceptedAt, new Date(active.completedAt).getTime(), pausePeriods, profileKey)
        : computeActiveWorkingMs(acceptedAt, now, pausePeriods, profileKey))
    : 0;

  // Total order elapsed
  const orderCreatedMs = order.createdAt ? new Date(order.createdAt).getTime() : enteredMs;
  const totalElapsedMs = computeActiveWorkingMs(orderCreatedMs, now, pausePeriods, profileKey);

  const department = STAGE_DEPARTMENTS[effectiveStage] || 'Store';
  const reasonLabel = DELAY_REASONS[department] || `Delayed in ${department}`;

  // On time when working time hasn't exceeded threshold
  if (phaseWorkingMs < allowedMs) return null;

  const deadlineAt = active?.deadlineAt ? new Date(active.deadlineAt).getTime() : null;
  const delayDuration = Math.max(0, phaseWorkingMs - allowedMs);
  const workingTimeRemainingMs = deadlineAt
    ? computeActiveWorkingMs(now, deadlineAt, pausePeriods, profileKey)
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

export const getStageDelays = (orders, delayConfig = null, pausePeriods = null, profileKey = null) => {
  const map = {};
  (orders || []).forEach((o) => {
    const d = getDelayInfo(o, delayConfig, pausePeriods, profileKey);
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
