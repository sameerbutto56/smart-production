/**
 * Shared payment/COD calculation utility.
 * Single source of truth for remaining balance and COD amount across all modules.
 *
 * Formula (mirrors backend getDeliveryAnalytics):
 *   deliveryCollected = sum(deliveryPayments: cashAmount + onlineAmount)
 *   remainingBalance  = max(0, totalPrice − advanceAmount − deliveryCollected)
 *   codAmount         = isPaid ? 0 : remainingBalance
 */

export const isPaidOrder = (order) => {
  if (!order) return false;
  if (order.isPrepaid === true) return true;
  if (order.paymentStatus === 'PAID' || order.paymentStatus === 'FULL_PAID') return true;
  const totalPrice = Number(order.totalPrice) || 0;
  const advanceAmount = Number(order.advanceAmount) || 0;
  if (totalPrice > 0 && advanceAmount >= totalPrice - 0.01) return true;
  if (order.advancePaid && advanceAmount >= totalPrice - 0.01) return true;
  return false;
};

export const isBalanceOrder = (order) =>
  order?.paymentStatus === 'BALANCE' && !isPaidOrder(order);

export const getDeliveryCollected = (order) =>
  (order?.deliveryPayments || []).reduce((sum, p) => sum + (p.cashAmount || 0) + (p.onlineAmount || 0), 0);

export const getRemainingBalance = (order) => {
  if (isPaidOrder(order)) return 0;
  const deliveryPaid = getDeliveryCollected(order);
  const totalPrice = Number(order?.totalPrice || 0);
  const advanceAmount = Number(order?.advanceAmount || 0);
  return Math.max(0, Math.round((totalPrice - advanceAmount - deliveryPaid) * 100) / 100);
};

export const getCodAmount = (order) => getRemainingBalance(order);

export const getPaymentInfo = (order) => {
  const paid = isPaidOrder(order);
  const balance = isBalanceOrder(order);
  const remaining = getRemainingBalance(order);
  const hasAdvance = parseFloat(order?.advanceAmount || 0) > 0;

  if (paid) {
    return { isPaid: true, isBalance: false, remainingBalance: 0, codAmount: 0, paymentLabel: 'PAID', paymentColor: 'emerald' };
  }
  if (balance) {
    return { isPaid: false, isBalance: true, remainingBalance: remaining, codAmount: remaining, paymentLabel: `BALANCE: ₨${remaining.toLocaleString()}`, paymentColor: 'amber' };
  }
  if (hasAdvance) {
    return { isPaid: false, isBalance: false, remainingBalance: remaining, codAmount: remaining, paymentLabel: `REMAINING COD: ₨${remaining.toLocaleString()}`, paymentColor: 'orange' };
  }
  return { isPaid: false, isBalance: false, remainingBalance: remaining, codAmount: remaining, paymentLabel: 'CASH ON DELIVERY', paymentColor: 'red' };
};

export const fmt = (n) => `₨${(n || 0).toLocaleString()}`;
