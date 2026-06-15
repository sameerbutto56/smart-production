## Goal
- Add Prepaid Order workflow with Paid/Unpaid toggle, auto-revenue recording, PAID badges across all modules, and analytics filtering.

## Constraints & Preferences
- Delivery riders primarily use mobile devices – UI must be fully responsive with compact cards and expandable details.
- Backend controllers, frontend pages, and build must pass without errors.
- Inventory data must never be deleted.
- Print output must be clean A4 format, suppress UI chrome, and support printer-connected direct printing.
- Prepaid orders must skip payment collection at delivery (only Deliver / No Response / Return shown).
- Prepaid orders must record revenue immediately at creation.

## Progress
### Done
- Ran cleanup script `prisma/seed-cleanup.js` then deleted it – removed 7 orders, 75 audit logs, 30 stages, 17 routing entries, 5 production records (Inventory/Users preserved).
- Restored Cap Quantity section in both Female and Male tailoring in `OrderEntry.jsx`.
- Fixed CAPS category not showing branding tab – added `'CAPS'` to `isAccessory` / `isCustomizableProduct` arrays (DB stores `CAPS`, not `CAP`).
- Added `deliveryCharges Float @default(0)` to Prisma schema and pushed to DB.
- Added delivery charges input in Basics tab of `OrderEntry.jsx` and in edit form.
- Added delivery charges row in Financial Summary (checkout review) + included in `totalPrice` and `combinedOrder` payload.
- Added delivery charges to backend order creation (`finalDeliveryCharges`, included in `finalTotalPrice`).
- Added `paymentStatus: 'PENDING'` to `formData` with "Order Already Paid" toggle (emerald checkbox with descriptive text) in Basics tab.
- Passed `paymentStatus` through `handleAddToCart` payload and `handleCheckout` `combinedOrder`.
- Backend: added `paymentStatus` to order creation destructuring and `order.create` data; auto-calls `calculateAndRecordRevenue` when `paymentStatus === 'PAID'`.
- Made `calculateAndRecordRevenue` idempotent (skips `revenueRecord.create` if one already exists for the order).
- Updated `OrderCard.jsx`: added `'PAID'` status badge (green, "PAID" label), hides "Record Payment" button for PAID orders.
- Updated `DeliveryDashboard.jsx`: shows PAID badge on cards; for PAID orders replaces full payment-method UI with simplified 3-button grid (Deliver / No Reply / Return). Cleaned up duplicate code that was left behind from edit.
- Updated `DeliverySheet.jsx`: added "Payment" column to both screen and print tables with PAID/Unpaid badges.
- Updated `AllOrders.jsx`: added PAID badge in table rows, grouped view payment summary, and modal display.
- Updated `AdminDashboard.jsx`: added PAID badge next to status in recent orders and outlet analytics tables.
- Updated `UnifiedAnalytics.jsx`: added Payment Status filter dropdown (All / Paid / Unpaid), paid/unpaid summary cards.
- Updated backend `analytics.controller.js`: added `paymentStatus` query filter (supports `'paid'` and `'unpaid'`), returns `paidOrders` / `unpaidOrders` counts.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- `deliveryCharges` stored as `Float @default(0)` on Order model – simple, queryable per-order.
- `paymentStatus` uses existing `String @default("PENDING")` field, reusing `'PAID'` value consistently across all modules.
- Prepaid revenue recorded immediately via `calculateAndRecordRevenue(order)` at creation time – duplicate call at completion is safe because `calculateAndRecordRevenue` is now idempotent (checks for existing record).
- Delivery dashboard conditionally renders two entirely different button layouts (PAID vs unpaid) to avoid complex visibility logic.

## Next Steps
- Confirm build passes, then commit and push all prepaid order changes.

## Critical Context
- Latest pushed commit: `1188ace` – Add delivery charges input in checkout review summary.
- Prepaid Order changes are UNCOMMITTED – include all files touched (OrderEntry.jsx, OrderCard.jsx, DeliveryDashboard.jsx, DeliverySheet.jsx, AllOrders.jsx, AdminDashboard.jsx, UnifiedAnalytics.jsx, order.controller.js, analytics.controller.js).
- All 2933+ frontend modules transform and build without errors (verified per-edit).
- `calculateAndRecordRevenue` now idempotent – won't create duplicate `RevenueRecord` entries.

## Relevant Files
- `frontend/src/pages/OrderEntry.jsx`: delivery charges input + PAID toggle in Basics; reset logic; checkout payload includes both fields
- `frontend/src/components/OrderCard.jsx`: PAID badge (green), hides payment button for PAID
- `frontend/src/pages/DeliveryDashboard.jsx`: PAID badge + simplified action buttons for PAID orders; removed duplicate old code block
- `frontend/src/pages/DeliverySheet.jsx`: Payment Status column (screen + print tables)
- `frontend/src/pages/AllOrders.jsx`: PAID badges in table, grouped view, modal
- `frontend/src/pages/AdminDashboard.jsx`: PAID badges in recent orders + outlet tables
- `frontend/src/pages/UnifiedAnalytics.jsx`: payment filter dropdown + paid/unpaid summary cards
- `backend/src/controllers/order.controller.js`: deliveryCharges + paymentStatus in order create; auto-revenue for PAID (idempotent); paymentStatus in updatePayment
- `backend/src/controllers/analytics.controller.js`: paymentStatus filter for paid/unpaid queries
- `backend/prisma/schema.prisma`: deliveryCharges field on Order model
- `AGENTS.md`: this file
