## Goal
- Add Prepaid Order workflow, per-product branding details in Summary/Job Sheet, printable Production Job Sheet, and proper CAP quantity pricing.

## Constraints & Preferences
- Delivery riders primarily use mobile devices – UI must be fully responsive with compact cards and expandable details.
- Backend controllers, frontend pages, and build must pass without errors.
- Inventory data must never be deleted.
- Print output must be clean A4 format, suppress UI chrome, and support printer-connected direct printing.
- Prepaid orders must skip payment collection at delivery (only Deliver / No Response / Return shown).
- Prepaid orders must record revenue immediately at creation.
- Job Sheet must be printable for physical production use – clean A4 with per-product branding.

## Progress
### Done
- Ran cleanup script `prisma/seed-cleanup.js` then deleted it – removed 7 orders, 75 audit logs, 30 stages, 17 routing entries, 5 production records (Inventory/Users preserved).
- Restored Cap Quantity section in both Female and Male tailoring in `OrderEntry.jsx`.
- Fixed CAPS category not showing branding tab – added `'CAPS'` to `isAccessory` / `isCustomizableProduct` arrays (DB stores `CAPS`, not `CAP`).
- Added `deliveryCharges Float @default(0)` to Prisma schema and pushed to DB.
- Added delivery charges input in Basics tab of `OrderEntry.jsx` and in edit form; included in Financial Summary, `totalPrice`, and `combinedOrder` payload.
- Added delivery charges to backend order creation (`finalDeliveryCharges`, included in `finalTotalPrice`).
- Added `paymentStatus: 'PENDING'` to `formData` with "Order Already Paid" toggle (emerald checkbox with descriptive text) in Basics tab.
- Passed `paymentStatus` through `handleAddToCart` payload and `handleCheckout` `combinedOrder`.
- Backend: added `paymentStatus` to order creation; auto-calls `calculateAndRecordRevenue` when `paymentStatus === 'PAID'`.
- Made `calculateAndRecordRevenue` idempotent (skips `revenueRecord.create` if one already exists for the order).
- Added PAYMENT_STATUS badges across all modules: `OrderCard.jsx`, `DeliveryDashboard.jsx`, `DeliverySheet.jsx`, `AllOrders.jsx`, `AdminDashboard.jsx`, `UnifiedAnalytics.jsx`.
- Backend `analytics.controller.js`: `paymentStatus` filter for paid/unpaid queries.
- Moved PAID toggle from header area into Basics tab as a full-width card before the City field.
- Enhanced per-product customization details in OrderEntry review modal, AllOrders Job Sheet modal, OrderCard PRODUCTION/STORE stage, and Full Sheet modal.
- Fixed LAB-COAT category missing color/size – changed `isAccessory`/`isCustomizableProduct` to substring match on `'COAT'`.
- Fixed empty-string color/size filtered out by truthiness checks – used strict `!= null && !== ''` filters.
- Reduced WarehouseDashboard polling from 10s to 60s with `document.hidden` check.
- Created `printJobSheet` in `printReport.js` – clean A4 layout with order header, products table, per-product branding, measurements, production timeline.
- Added "Print Job Sheet" button to AllOrders Job Sheet modal and OrderCard Full Sheet modal.
- Fixed blank checkout summary crash – `cartItems.reduce` callback used wrong parameter (`(s, idx)` where `idx` was element, not index).
- **Per-product Matching Cap**: moved cap from global `femaleOptions` to per-product toggle + quantity in Selection tab. Removed all 4 Cap Quantity sections from Tailoring tabs. Cap price fixed at `₨500` per unit.
- **Restructured Financial Summary** as comparison table (Calculated / Adjusted columns) with rows: Product Price, Customization Charges, Matching Cap Charges, Delivery Charges, Discount, Grand Total. Added discount field.
- **Advance Payment amount**: replaced boolean `advancePaid` checkbox with `advanceAmount` number input (+ `₨`). Added Advance Received (–) and Remaining Balance lines in Financial Summary. Propagated `advanceAmount` across all components (OrderEntry, AllOrders, DeliveryDashboard, DeliverySheet, History, EditRequestDashboard). Updated backend order creation and edit flow to store and return `advanceAmount`. Updated schema with `advanceAmount Float @default(0)`. Validation checks `advanceAmount > 0` for FULL_CUSTOM orders.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- `deliveryCharges` stored as `Float @default(0)` on Order model – simple, queryable per-order.
- `paymentStatus` reuses existing `String @default("PENDING")` field consistently across all modules.
- Prepaid revenue recorded idempotently – checks existing `RevenueRecord` before creating.
- Delivery dashboard uses two entirely different button layouts (PAID vs unpaid) for clarity.
- `isAccessory`/`isCustomizableProduct` switched from exact array matching to substring matching (`includes('COAT')`) for hyphenated categories like `LAB-COAT`.
- Print Job Sheet uses `openPrintWindow`/`closePrintWindow` pattern (not `@media print`) to avoid modal overlay artifacts.
- CAP pricing uses hardcoded `capUnitPrice = 500` per cap, included in per-item `totalPrice` and Financial Summary cap charges line.
- Advance amount replaces the old boolean `advancePaid` – `advanceAmount` is stored as a `Float` number; components now check `parseFloat(order.advanceAmount) > 0` instead of `order.advancePaid`.

## Next Steps
- Verify no remaining issues with color/size display for products missing variants.

## Critical Context
- Latest commit includes: Advance Payment amount feature.
- Build passes with 0 errors.
- `isAccessory` uses substring matching (`catUpper.includes('COAT')`).
- `calculateAndRecordRevenue` at line 2482 of `order.controller.js` is idempotent.
- Cap pricing is hardcoded `capUnitPrice = 500`.
- `advanceAmount` field added to Prisma schema, DB pushed, and backend controller updated to accept/store it.

## Relevant Files
- `frontend/src/pages/OrderEntry.jsx`: Matching Cap in Selection tab, restructured Financial Summary with discount + advance amount lines, advance amount input in Basics tabs, handleCheckout uses adjusted values
- `frontend/src/pages/AllOrders.jsx`: per-product branding sections, Job Sheet modal, PAID badges, advance amount display
- `frontend/src/components/OrderCard.jsx`: per-product PRODUCTION/STORE rendering, Print button
- `frontend/src/pages/DeliveryDashboard.jsx`: PAID badges + advance amount indicator
- `frontend/src/pages/DeliverySheet.jsx`: Payment Status column, COD check uses advanceAmount
- `frontend/src/pages/AdminDashboard.jsx`: PAID badges
- `frontend/src/pages/UnifiedAnalytics.jsx`: payment filter + paid/unpaid cards
- `frontend/src/pages/WarehouseDashboard.jsx`: polling 60s + visibility check
- `frontend/src/pages/History.jsx`: advance amount column
- `frontend/src/pages/EditRequestDashboard.jsx`: advance amount in diff fields
- `frontend/src/utils/printReport.js`: `printJobSheet` with Cap column in products table, per-product Matching Cap badge
- `backend/src/controllers/order.controller.js`: deliveryCharges, paymentStatus, advanceAmount, idempotent revenue recording
- `backend/src/controllers/analytics.controller.js`: paymentStatus filter
- `backend/prisma/schema.prisma`: deliveryCharges, advanceAmount fields
- `frontend/src/hooks/usePolling.js`: polling hook (unchanged)
- `AGENTS.md`: full change log
