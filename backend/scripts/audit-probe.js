// Read-only audit probe — deleted after use.
const prisma = require('../src/prisma');

const VALID_STAGES = ['ORDER_ENTRY','STORE','STORE_RECEIVE','PRODUCTION_ACCEPTANCE','PRODUCTION','WORKERS','LOGO_DESIGN','NAME_LOGO','CUSTOM_LOGO','INVENTORY_VIEW','DISPATCH','OUT_FOR_DELIVERY','ENAMELS_DELIVERY','OUTLET_RECEIVE','IN_DISPATCH','VERIFICATION'];
const TERMINAL = ['COMPLETED','DELIVERED','CANCELLED','REJECTED'];

const KNOWN_ACTIONS = new Set([
  'ORDER_CREATED','OUTLET_ORDER_CREATED','ORDER_UPDATED','STORE_ACCEPT','STORE_ROUTE','STAGE_ACCEPTED','STAGE_REJECTED','STAGE_COMPLETED',
  'MANUAL_ROUTE','RETURN_TO_STORE','RETURNED_FOR_CORRECTION','SENT_FOR_VERIFICATION','ORDER_VERIFIED','VERIFICATION_PENDING','RESUBMITTED_TO_STORE','RESUBMITTED_AFTER_VERIFICATION',
  'DISPATCH_ACCEPTED','DISPATCHED_ENAMELS','DISPATCHED_COURIER','COURIER_BOOKED','COURIER_DISPATCH_REQUESTED','COURIER_DELIVERED','COURIER_IN_TRANSIT','COURIER_DISPATCHED','COURIER_RETURNED','COURIER_REJECTED','COURIER_COMPLETED',
  'DELIVERY_ACCEPTED','DELIVERED','DELIVERY_FAILED','DELIVERED_TO_OUTLET','DISPATCH_RETURNED','DELIVERY_AUTO_RETURNED','PICKED_UP','CUSTOMER_TAKEN','ESCALATION_OVERDUE',
  'RETURN_INITIATED','REPLACEMENT_INITIATED','NO_RESPONSE_LOGGED','RETURN_STORE_PROCESSED','REPLACEMENT_FAISAL_APPROVED','REPLACEMENT_FAISAL_REJECTED','REPLACEMENT_DISPATCHED','REPLACEMENT_ORDER_CREATED','REPLACEMENT_STATUS_UPDATED','REPLACEMENT_ROUTED','REDISPATCH_REQUESTED','AUTO_RETURN_AFTER_3_ATTEMPTS','DELIVERY_RESCHEDULED','WAREHOUSE_RETURN_APPROVED','WAREHOUSE_RETURN_REJECTED','REPLACEMENT_ORIGINAL_RESTOCKED','RETURN_ROUTED_TO_PRODUCTION','REPLACEMENT_ROUTED_TO_PRODUCTION',
  'INVENTORY_ALLOCATED','ALLOCATION_ACCEPTED','ALLOCATION_REJECTED','CART_APPROVED','CART_REJECTED','INVENTORY_REVERSED','INVENTORY_DEDUCTED','AVAILABILITY_UPDATED',
  'ORDER_CANCELLED','CANCELLATION_REQUESTED','CANCELLATION_APPROVED','CANCELLATION_REJECTED','DELIVERY_DELAYED','COURIER_BOOKED_AGAIN',
  'EDIT_REQUESTED','EDIT_APPROVED','EDIT_REJECTED','RESUBMITTED_AFTER_CORRECTION','ORDER_RESTORED','ORDER_DELETED','PRODUCTION_STARTED','PRODUCTION_COMPLETED','LOGO_STARTED','LOGO_COMPLETED',
  'DEMAND_REQUEST_APPROVED','DEMAND_REQUEST_PARTIALLY_APPROVED','DEMAND_REQUEST_REJECTED','DEMAND_REQUEST_CREATED','DEMAND_REQUEST_ACCEPTED',
  'IN_DISPATCH_ROUTE','IN_DISPATCH_ROUTED','BALANCE_CLEARED','IN_DISPATCH_ACCEPTED','OUTLET_RECEIVED','RETURN_TO_OUTLET','OUTLET_ACCEPTED','OUTLET_COMPLETED','SENT_TO_IN_DISPATCH',
  'FORWARDED_TO_FAISAL','ORDER_VERIFIED_AND_ADVANCE','ADVANCE_UPDATED','ASSIGNED_TO_ROUTE','DELIVERY_ASSIGNED','DELIVERY_ACCEPTED_BY_RIDER'
]);

async function main() {
  const report = {};

  // 1. active orders whose currentStage is not a valid stage
  const activeOrders = await prisma.order.findMany({
    where: { status: { notIn: TERMINAL } },
    select: { id: true, orderNumber: true, currentStage: true, status: true, dispatchStatus: true }
  });
  report.invalidCurrentStage = activeOrders.filter(o => !VALID_STAGES.includes(o.currentStage)).map(o => `${o.orderNumber}:${o.currentStage}/${o.status}`);

  // 2. active orders whose currentStage has no active stage row, or >1 active rows for that stage
  const withStages = await prisma.order.findMany({
    where: { status: { notIn: TERMINAL } },
    select: {
      id: true, orderNumber: true, currentStage: true, status: true,
      stages: { where: { status: { in: ['PENDING','IN_PROGRESS','WAITING_APPROVAL'] } }, select: { stageName: true, status: true } }
    }
  });
  const noActiveStage = [];
  const dupActive = [];
  const dupDetails = [];
  for (const o of withStages) {
    const active = o.stages || [];
    const matches = active.filter(s => s.stageName === o.currentStage);
    if (matches.length === 0) noActiveStage.push(`${o.orderNumber}:${o.currentStage}/${o.status}`);
    if (active.length > 1) {
      const byName = {};
      for (const s of active) byName[s.stageName] = (byName[s.stageName] || 0) + 1;
      const dups = Object.entries(byName).filter(([, c]) => c > 1);
      if (dups.length) {
        dupActive.push(`${o.orderNumber}:${o.currentStage}`);
        dupDetails.push(`${o.orderNumber} ${dups.map(([n, c]) => `${n} x${c}`).join(',')}`);
      }
    }
  }
  report.noActiveStageForCurrentStage = noActiveStage;
  report.ordersWithDuplicateActiveStages = dupActive;
  report.dupDetails = dupDetails;

  // 3. walk-in delivered-but-stuck (dispatchStatus DELIVERED/PICKED_UP with non-terminal currentStage)
  report.walkinDeliveredButStuck = activeOrders
    .filter(o => ['DELIVERED','PICKED_UP'].includes(o.dispatchStatus) && !['COMPLETED','DELIVERED'].includes(o.currentStage))
    .map(o => `${o.orderNumber}:${o.currentStage}/${o.status}/dispatchStatus=${o.dispatchStatus}`);

  // 4. audit actions unknown to known set (order-scoped)
  const grouped = await prisma.auditLog.groupBy({ by: ['action'], _count: { _all: true }, where: { orderId: { not: null } }, orderBy: { _count: { action: 'desc' } } });
  report.auditActionCounts = grouped.map(g => ({ action: g.action, count: g._count._all }));
  report.unknownAuditActions = grouped.filter(g => !KNOWN_ACTIONS.has(g.action)).map(g => `${g.action}(${g._count._all})`);

  console.log(JSON.stringify(report, null, 2));
}

main().finally(() => prisma.$disconnect());
