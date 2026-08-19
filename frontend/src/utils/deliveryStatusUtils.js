/**
 * Shared delivery status classification & display helpers.
 * Single source of truth used by DeliveryDashboard (delivery boy) and
 * EnamelsDeliveryCard (admin) so both panels show identical status
 * categories, badge colours, and tab counts.
 */

/* ─── Delivery tab classification ─────────────────────────────────────────── */
export const DELIVERY_TABS = [
  { key: 'pending',    label: 'Pending',   color: 'bg-blue-600 text-white' },
  { key: 'active',     label: 'Active',    color: 'bg-blue-600 text-white' },
  { key: 'noresponse', label: 'No Reply',  color: 'bg-amber-600 text-white' },
  { key: 'completed',  label: 'Done',      color: 'bg-emerald-600 text-white' },
];

/**
 * Classify an order (from /api/delivery/orders) into a delivery tab.
 * Both the delivery boy dashboard and admin analytics must agree on
 * which tab an order lands in.
 */
export const classifyDeliveryTab = (order) => {
  if (!order) return 'pending';

  const isDelivered = order.currentStage === 'DELIVERED' || order.status === 'COMPLETED';
  const hasAccepted = !!order.riderAcceptedAt;
  const noRespCount = order.noResponseCount || 0;

  if (isDelivered) return 'completed';
  if (noRespCount > 0 && !hasAccepted) return 'noresponse';
  if (hasAccepted) return 'active';
  return 'pending';
};

/* ─── Delivery status badges (admin analytics primaryStatus) ──────────────── */
export const STATUS_BADGE = {
  delivered:  'bg-emerald-500/20 text-emerald-400',
  returned:   'bg-red-500/20 text-red-400',
  cancelled:  'bg-rose-500/20 text-rose-400',
  failed:     'bg-orange-500/20 text-orange-400',
  noResponse: 'bg-gray-500/20 text-gray-400',
  inTransit:  'bg-indigo-500/20 text-indigo-400',
  pending:    'bg-amber-500/20 text-amber-400',
};

export const STATUS_LABEL = {
  delivered:  'Delivered',
  returned:   'Returned',
  cancelled:  'Cancelled',
  failed:     'Failed',
  noResponse: 'No Response',
  inTransit:  'In Transit',
  pending:    'Pending',
};

/* ─── Admin stat card color map ───────────────────────────────────────────── */
export const STAT_COLORS = {
  total:    { text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  accepted: { text: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  pickedUp: { text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  delivered:{ text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  pending:  { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  inTransit:{ text: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  returned: { text: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  noResponse:{ text: 'text-gray-400',   bg: 'bg-gray-500/10',    border: 'border-gray-500/20' },
  cancelled:{ text: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  failed:   { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  cash:     { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  online:   { text: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
  cashOnline:{ text: 'text-indigo-400', bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20' },
  jail:     { text: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20' },
};

/* ─── Filter option lists ─────────────────────────────────────────────────── */
export const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'All Order Statuses' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'ENAMELS_DELIVERY', label: 'Enamels Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'COMPLETED', label: 'Completed' },
];

export const DELIVERY_STATUS_OPTIONS = [
  { value: '', label: 'All Delivery Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'inTransit', label: 'In Transit' },
  { value: 'noResponse', label: 'No Response' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
];

export const PAYMENT_OPTIONS = [
  { value: '', label: 'All Payment Types' },
  { value: 'CASH', label: 'Cash' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'CARD', label: 'Card' },
  { value: 'CASH_ONLINE', label: 'Cash + Online' },
  { value: 'MULTIPLE_ONLINE', label: 'Multiple Online' },
];
