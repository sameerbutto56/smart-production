/**
 * Shared payment/COD calculation utility.
 * Single source of truth for remaining balance and COD amount across all modules.
 *
 * Rules:
 *   An order is PREPAID / PAID IN ADVANCE if:
 *     - totalPrice <= 0.01, OR
 *     - advanceAmount >= totalPrice - 0.01, OR
 *     - order.isPrepaid === true
 *
 *   An order is a COD ORDER if:
 *     - totalPrice - advanceAmount > 0.01
 *     - Delivering a COD order does NOT make it an advance paid order.
 *
 *   Remaining COD / Balance:
 *     - If prepaid: 0
 *     - If RETURNED or CANCELLED: 0
 *     - Otherwise: max(0, totalPrice - advanceAmount - deliveryPayments)
 */

export const isPrepaidOrder = (order) => {
  if (!order) return false;
  if (order.isPrepaid === true) return true;
  const totalPrice = Number(order?.totalPrice || 0);
  const advanceAmount = Number(order?.advanceAmount || 0);
  if (totalPrice <= 0.01) return true;
  if (advanceAmount >= totalPrice - 0.01) return true;
  if (order.advancePaid && advanceAmount >= totalPrice - 0.01) return true;
  return false;
};

export const isCodOrder = (order) => !isPrepaidOrder(order);

export const getDeliveryCollected = (order) =>
  (order?.deliveryPayments || []).reduce((sum, p) => sum + (Number(p.cashAmount || 0) + Number(p.onlineAmount || 0)), 0);

export const getRemainingBalance = (order) => {
  if (isPrepaidOrder(order)) return 0;
  if (order?.status === 'RETURNED' || order?.status === 'CANCELLED') return 0;
  const deliveryPaid = getDeliveryCollected(order);
  const totalPrice = Number(order?.totalPrice || 0);
  const advanceAmount = Number(order?.advanceAmount || 0);
  const initialDue = Math.max(0, Math.round((totalPrice - advanceAmount) * 100) / 100);
  return Math.max(0, Math.round((initialDue - deliveryPaid) * 100) / 100);
};

export const getCodAmount = (order) => getRemainingBalance(order);

export const isPaidOrder = (order) => {
  if (!order) return false;
  if (isPrepaidOrder(order)) return true;
  if (getRemainingBalance(order) <= 0.01) return true;
  return false;
};

export const isBalanceOrder = (order) =>
  order?.paymentStatus === 'BALANCE' && !isPaidOrder(order);

/**
 * Single source of truth for Job Sheet Balance Indicator.
 * Returns true strictly when the customer has an outstanding balance > 0.
 * For zero, negative, prepaid, or fully paid orders, returns false.
 */
export const hasJobSheetOutstandingBalance = (order) => {
  if (!order) return false;
  if (order.isPrepaid === true) return false;
  const statusUpper = String(order.paymentStatus || '').trim().toUpperCase();
  if (statusUpper === 'PAID' || statusUpper === 'FULL_PAID') return false;
  if (order.status === 'RETURNED' || order.status === 'CANCELLED') return false;

  if (order.balanceAmount != null && !isNaN(parseFloat(order.balanceAmount))) {
    return parseFloat(order.balanceAmount) > 0.001;
  }

  const remaining = getRemainingBalance(order);
  return typeof remaining === 'number' && !isNaN(remaining) && remaining > 0.001;
};

/**
 * Returns '✓' when the order has a positive outstanding balance, otherwise empty string.
 */
export const getJobSheetBalanceIndicator = (order) => {
  return hasJobSheetOutstandingBalance(order) ? '✓' : '';
};

export const getPaymentInfo = (order) => {
  const prepaid = isPrepaidOrder(order);
  const remaining = getRemainingBalance(order);
  const paid = prepaid || remaining <= 0.01;
  const balance = isBalanceOrder(order);
  const hasAdvance = parseFloat(order?.advanceAmount || 0) > 0;

  if (prepaid) {
    return { isPaid: true, isPrepaid: true, isBalance: false, remainingBalance: 0, codAmount: 0, paymentLabel: 'PAID IN ADVANCE', paymentColor: 'emerald' };
  }
  if (paid) {
    return { isPaid: true, isPrepaid: false, isBalance: false, remainingBalance: 0, codAmount: 0, paymentLabel: 'PAID', paymentColor: 'emerald' };
  }
  if (balance) {
    return { isPaid: false, isPrepaid: false, isBalance: true, remainingBalance: remaining, codAmount: remaining, paymentLabel: `BALANCE: ₨${remaining.toLocaleString()}`, paymentColor: 'amber' };
  }
  if (hasAdvance) {
    return { isPaid: false, isPrepaid: false, isBalance: false, remainingBalance: remaining, codAmount: remaining, paymentLabel: `REMAINING COD: ₨${remaining.toLocaleString()}`, paymentColor: 'orange' };
  }
  return { isPaid: false, isPrepaid: false, isBalance: false, remainingBalance: remaining, codAmount: remaining, paymentLabel: 'CASH ON DELIVERY', paymentColor: 'red' };
};

export const fmt = (n) => `₨${(n || 0).toLocaleString()}`;
