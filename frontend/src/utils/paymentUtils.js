/**
 * Shared payment/COD calculation utility.
 * Single source of truth for remaining balance and COD amount across all modules.
 *
 * Formula:
 *   remainingBalance = max(0, totalPrice − advanceAmount)
 *   codAmount        = isPaid ? 0 : remainingBalance
 */

export const isPaidOrder = (order) =>
  order?.paymentStatus === 'PAID' || order?.paymentStatus === 'FULL_PAID';

export const getRemainingBalance = (order) => {
  if (isPaidOrder(order)) return 0;
  return Math.max(0, (order?.totalPrice || 0) - parseFloat(order?.advanceAmount || 0));
};

export const getCodAmount = (order) => getRemainingBalance(order);

export const getPaymentInfo = (order) => {
  const paid = isPaidOrder(order);
  const remaining = getRemainingBalance(order);
  const hasAdvance = parseFloat(order?.advanceAmount || 0) > 0;

  if (paid) {
    return { isPaid: true, remainingBalance: 0, codAmount: 0, paymentLabel: 'PAID', paymentColor: 'emerald' };
  }
  if (hasAdvance) {
    return { isPaid: false, remainingBalance: remaining, codAmount: remaining, paymentLabel: `REMAINING COD: ₨${remaining.toLocaleString()}`, paymentColor: 'orange' };
  }
  return { isPaid: false, remainingBalance: remaining, codAmount: remaining, paymentLabel: 'CASH ON DELIVERY', paymentColor: 'red' };
};

export const fmt = (n) => `₨${(n || 0).toLocaleString()}`;
