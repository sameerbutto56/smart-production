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
- **Fixed CAP pricing**: added `capCharges = femaleOptions.cap × 500` calculation; included in `handleAddToCart` totalPrice; added "Cap Charges" line in Financial Summary; added cap quantity badge in per-item review card.

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

## Next Steps
- Verify no remaining issues with color/size display for products missing variants.

## Critical Context
- All changes are committed and pushed.
- Latest pushes: prepaid order workflow, summary enhancements, LAB-COAT fix, warehouse polling fix, print job sheet, cap pricing fix.
- Build passes with 0 errors.
- `isAccessory` uses substring matching (`catUpper.includes('COAT')`) so `LAB-COAT`, `COAT`, etc. all behave as non-accessory.
- `calculateAndRecordRevenue` at line 2482 of `order.controller.js` is now idempotent.

## Relevant Files
- `frontend/src/pages/OrderEntry.jsx`: PAID toggle (before City), expanded per-product customization in review modal, cap pricing (capCharges = cap × 500, included in totalPrice & Financial Summary), `isAccessory`/`isCustomizableProduct` substring match, variant filter fixes
- `frontend/src/pages/AllOrders.jsx`: per-product branding sections in Job Sheet modal, richer table row badges, Print Job Sheet button
- `frontend/src/components/OrderCard.jsx`: multi-item PRODUCTION/STORE stage rendering, per-product customization sections, Print button in Full Sheet modal
- `frontend/src/pages/DeliveryDashboard.jsx`: PAID badge + simplified buttons for PAID orders
- `frontend/src/pages/DeliverySheet.jsx`: Payment Status column (screen + print)
- `frontend/src/pages/AdminDashboard.jsx`: PAID badges
- `frontend/src/pages/UnifiedAnalytics.jsx`: payment filter + paid/unpaid cards
- `frontend/src/pages/WarehouseDashboard.jsx`: polling reduced to 60s + visibility check
- `frontend/src/utils/printReport.js`: `printJobSheet` function for A4 printable production job sheet
- `backend/src/controllers/order.controller.js`: deliveryCharges + paymentStatus in order create; idempotent revenue recording
- `backend/src/controllers/analytics.controller.js`: paymentStatus filter
- `backend/prisma/schema.prisma`: deliveryCharges field
- `frontend/src/hooks/usePolling.js`: polling hook (unchanged)
- `AGENTS.md`: this file
