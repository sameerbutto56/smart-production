## Goal
- Source-wise analytics dashboard with drill-down, filters, and visual charts.
- Every analytics section supports filters and clickable drill-down cards.
- Online, Jail Road, Johar Town automatically get independent analytics.
- Future outlets automatically inherit the same analytics structure.
- All backend queries run sequentially to avoid Vercel connection pool timeout (limit=1).

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
- **Sleeve Length & Shirt Length per product**: added gender-independent `sleeveLength` (Full/Half/Quarter) and `shirtLength` (Long/Short) dropdowns in OrderEntry Selection tab, stored per-item in `productDetails`. Displayed across AllOrders, OrderCard, print Job Sheet, and Job Sheet modals for all genders (not just Female).
- **Instruction Notes**: added `instructionNotes String?` to Prisma schema (pushed). Textarea in Basics tab (Standard Orders only). Stored on Order model, displayed in Job Sheet modal and print Job Sheet. Included in backend `createOrder` and `approveEditRequest` field mapping.

### Done (latest session)
- **Outlet Demand Request with Order Entry-style selection**: Rewrote `OutletStockRequest.jsx` — product cards no longer show stock counts or badges; cart items use dropdowns (not text inputs) for size/color with +/- quantity stepper; Warehouse Inventory tab renamed to Warehouse Catalog with availability badges removed.
- **Backend outletDemand.controller.js**: `getInventoryForOutlet` no longer queries `stock` field or computes availability — outlets see only product name, category, color, size, fabric.
- **Source-wise Analytics Dashboard**: Complete rewrite of `UnifiedAnalytics.jsx` with source tabs (All/Online/Jail Road/Johar Town/Abbottabad), date range presets (Today/Yesterday/Week/Month/3M/Custom), payment/status/city/delivery filters, and clickable drill-down cards.
- **Backend analytics endpoints**: `GET /api/analytics/sources`, `GET /api/analytics/source/:sourceId` (full analytics), `GET /api/analytics/source/:sourceId/orders` (drill-down lists). Sequential queries to avoid Vercel pool exhaustion. Backward-compatible with old `/api/analytics/unified?branch=` route.
- **Drill-down cards**: Delivered → COD/Online/Prepaid breakdown; Returns → Paid Returns (refund status), COD Returns, Financial Impact; Pending → stage-wise progress bars. Each drill view has "View Orders" modal showing order list.
- **Financial Overview**: Total Revenue (COD/Online/Prepaid split), Refund Analytics (count, amount, pending), Net Revenue calculation.
- **Visual Charts**: Order/Revenue trend (AreaChart), Return trend (LineChart), Revenue Distribution (PieChart).
- Added `shopifyOrderDate DateTime?` to Prisma schema (pushed to DB).
- Added Shopify Order Date input field (`datetime-local`) in OrderEntry Basics tab (after City field, before Delivery Charges).
- Backend `createOrder` accepts `shopifyOrderDate`, stores as `Date`.
- `editRequest.controller.js`: added `shopifyOrderDate` to `fieldsToMap` with date parsing.
- Both dates (Order Entry Date/Time + Shopify Order Date) now shown in:
  - AllOrders Job Sheet modal footer
  - OrderCard Full Sheet modal footer
  - printJobSheet output (green date row at top)
- **printJobSheet complete redesign** for maximum readability:
  - Font sizes dramatically increased (body 28px, headings 26px, tables 22px)
  - Google Fonts "Noto Nastaliq Urdu" loaded for Urdu text support
  - All section titles in Urdu: پروڈکٹس, اینگرونگ, پیمائش, ہدایات
  - Urdu labels for table column headers (پروڈکٹ, کپڑا اور رنگ, etc.)
  - Urdu measurement labels continue to display
  - `romanToUrdu()` transliteration function converts Roman English to Urdu
  - Instruction Notes displayed in Urdu via transliteration
  - High contrast, bold fonts, generous spacing for weak eyesight
  - Green date row showing both dates prominently
  - Financial Summary stays in English (admin purpose)

### Done (current session)
- Changed analytics default date range from "This Week" to "All Time" so all orders show on load.
- Fixed outlet demand request size/color dropdowns – backend preserves variants for OUTLET role, frontend falls back to flat size/color fields when variants are empty. Reverted backend changes per request (keep original controller), kept frontend fallback.
- Cleaned inventory (51 items deleted) and order data (75 orders + related tables) for fresh start.
- Restored inventory from seed (21 items), then removed all per user request (0 items).
- Fixed analytics source filter: `buildSourceFilter` now matches by `outletName` regardless of `source` field; `getSources` no longer restricts to `source: 'OUTLET'` so Online orders appear.
- **Shoes category size selection**: Added `isShoes` helper in `OrderEntry.jsx` to show size buttons for SHOES despite `isAccessory` returning `true`. Size buttons use default `['S', 'M', 'L', 'XL', '2XL']` sizes (not empty). `handleCategorySelect` skips `setSize('Standard')` for SHOES.
- **Fixed `useCallback` TDZ crash**, **Fixed missing deps**, **Branding fields preserved**, **logoName badge**, **Financial Summary split**, **Fixed `handleSizeSelect` stale closure** (see full details below).
- **Per-product availability toggles, backend classification, expanded toggles to Job Sheet** — all rolled out in prior session.
- **Routing System Fix**: Added route validation (`destinationStage` must be in `validAllStages`) in `manualRouteOrder` and `requestStageCompletion` — returns clear error message `"Cannot route order. Destination route X does not exist. Please configure the workflow route first."`. Previously no validation existed, routing to invalid stages would silently create orphan stages with no recipients.
- **WORKERS stage**: Added as a valid routing destination across the entire system — `validAllStages`, `validateStageTransition`, `getRolesForStage` (mapped to `PRODUCTION` role), `getRolesForStageBasedOnRole`, `getStageDurations`, `AUTO_TRANSITION_STAGES`, analytics `stageOrder`. Frontend routing UIs updated: OrderCard STORE dropdown, STORE_RECEIVE buttons, admin Move To, prompt-based routing, WarehouseDashboard quick-route buttons + modal, MyTasks bulk routing, AdminDashboard bulk routing.
- **SVG vector barcode printing**: Replaced canvas PNG with JsBarcode SVG rendering — vector format scales perfectly at any DPI. Added viewBox for zero-loss scaling. Label dimensions: 55mm × 33mm with 20mm barcode height (meets 20-25mm spec). Pure black bars on white background for max scanner contrast.
- **Fixed `acceptDemandRequest` outlet bug**: OutletVariant create/update now sets `outletName: existing.outletName` — stock no longer always lands in Johar Town. Variant find filters by `outletName` too, preventing cross-outlet stock corruption. Barcode collision check uses `findFirst({where:{barcode,outletName}})`.
- **Fixed `createPosProduct` OUTLETS**: Added `'Abbottabad'` to the hardcoded array (was `['Johar Town', 'Jail Road']`).
- **Fixed cache invalidation**: Changed `cache.del('pos:inventory')` to `cache.delPattern('pos:')` so per-outlet cached responses are cleared.
- **Added outlet selector in OutletPOSInventory.jsx**: Three tabs (Johar Town/Jail Road/Abbottabad) let users switch between outlet inventories. STORE/ADMIN sees all with full CRUD. OUTLET role sees own outlet (full CRUD) + other outlets (read-only — Edit/Add buttons hidden). Amber "Read-only view" banner when viewing another outlet.
- **Per-item Three Status system**: `inventoryDeducted: true` field in productDetails. `updateProductAvailability` now deducts inventory immediately on ✓ click. ✓ → `availabilityStatus: 'available'` + locked (no further toggling). ✗ → `availabilityStatus: 'not_available'` (no deduction).
- **Three visual states**: Default `undefined` → ⏳ Pending (gray badge), `true` → ✓ Completed (green badge), `false` → ✗ Rejected (red badge). Initialization from DB uses strict `=== 'available'` / `=== 'not_available'` checks.
- **Toggle protection**: ✓ button disabled+locked when Completed. Hover styles for pending items; Completed shows permanent green with `cursor-not-allowed`.
- **Routing-time skip**: `requestStageCompletion` STORE section filters `!item.inventoryDeducted` to skip already-deducted items. Only pending items get classified/deducted.
- **Clean avail payload**: STORE routing payload only includes explicitly `true`/`false` items.
- **All status badges updated**: OrderCard, AllOrders everywhere.
- **Build passes with 0 errors**.
- **Fixed 504 timeout on Transfers page**: Removed redundant auto-creation loop from `getProducts` (variants already created by `getPosInventory`). [Commit 0a6d653]
- **Fixed transfers load failure**: Added `parseItemVariants()` helper for JSON string `variants` field, null guard for orphaned `OutletVariant` records (null `inventoryItem`), split `Promise.all` for per-endpoint error messages. [Commit 39268f9]
- **`onDelete: Cascade` on OutletVariant.inventoryItem**: Prisma schema updated — deleting an InventoryItem now auto-removes all OutletVariants referencing it (eliminates orphan OV errors on product delete).
- **Batch variant auto-creation in `getPosInventory`**: Replaced per-variant `create` loop with single `createMany` call + one refetch (eliminates N+1 DB roundtrips during product creation).
- **Extracted delivery/refund controller**: Moved `updateDeliveryStatus`, `acceptDelivery`, `getDeliveryHistory`, `refundOrder`, `getRefundQueue`, `processRefund` into `order-delivery.controller.js`. Updated `order.controller.js` to export shared helpers (`isSystemPaused`, `createAuditLog`, `calculateAndRecordRevenue`, `reverseInventoryForRefund`). Updated `order.routes.js` imports accordingly.

## Performance Optimizations (Jun 20)
### Backend
- **Composite DB indexes**: Added indexes on `orderNumber`, `currentStage`, `outletName`, `createdAt`, `paymentStatus`, `dispatchStatus` in Prisma schema → pushed to DB.
- **`$transaction()` parallel queries**: Consolidated independent queries in `order.controller.js` (store routing, STORE_RECEIVE cleanup) and `analytics.controller.js` (22 sequential queries → 1 transaction).
- **`.select()` pruning**: Added field-restricted `select` to 5 queries in `production.controller.js` (records, dashboard, inventory) and `dispatch.controller.js` (dashboard) — prunes unused columns from DB transfer.
- **Batch N+1 inventory loop**: `order.controller.js` — replaced 20+ individual `findUnique` calls with 1 batch `findMany` + in-memory map.
- **Fixed N+1 in `getRoutingHistory`**: Removed redundant per-entry `prisma.user.findUnique` (data already loaded via `include: { sentByUser }`).

### Frontend
- **API service layer**: Created `frontend/src/services/api.js` — axios instance with auto token interceptor. Migrated `OrderEntry.jsx`, `ThemeContext.jsx`, `DispatchDashboard.jsx` from raw axios.
- **`useCallback`**: Wrapped 7 handlers in `OrderEntry.jsx` (`handleSizeSelect`, `toggleEditMode`, `fetchOrderByNumber`, `handleAddToCart`, `removeCartItem`, `editCartItem`, `handleCheckout`).
  - **Bug fix**: `handleAddToCart` deps referenced `computedTotalPrice`/`capCharges` (defined after `useCallback`) — removed from deps, values read from closure.
  - **Bug fix**: `removeCartItem` had missing deps array — switched to functional update with `[]` deps.
- **`useMemo`**: Wrapped `reduce()` calls and static objects extracted outside component in `OrderEntry.jsx`.
- **`React.memo`**: Wrapped `KpiCard`, `StageBadge`, `OrderListModal`, `DrillDetail` in `UnifiedAnalytics.jsx`.
- **Context memoization**: All 4 providers (`LanguageContext`, `ThemeContext`, `AuthContext`, `SearchContext`) now wrap children in `useMemo`.
- **Code splitting**: All 17 pages lazy-loaded via `React.lazy()` + `Suspense`. Main chunk 798 kB → 506 kB (37% reduction). Each page loads on-demand.
- **Socket debouncing**: Created `frontend/src/utils/debounce.js`. Wired into `AllOrders`, `DeliveryDashboard`, `ProgressChart`, `EditRequestDashboard`, `RefundManagement`, `DispatchDashboard` — groups rapid socket events into single API call (300ms window).
- **Build passes with 0 errors**.

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
- (none)

## Critical Context
- Latest commit includes: Fix 504 timeout on Transfers page, fix transfers load failure. [Commit 0a6d653]
- Build passes with 0 errors.
- `isAccessory` uses substring matching (`catUpper.includes('COAT')`).
- `calculateAndRecordRevenue` at line 2482 of `order.controller.js` is idempotent.
- Cap pricing is hardcoded `capUnitPrice = 500`.
- `advanceAmount` field added to Prisma schema, DB pushed, and backend controller updated to accept/store it.
- `sleeveLength` and `shirtLength` are per-product top-level fields in `productDetails` (not inside `femaleOptions`), applied to all genders.
- `instructionNotes` stored as `String?` on Order model, displayed in Job Sheet and print output.
- **Availability status** (`availabilityStatus: 'available' | 'not_available'`) stored per-item in `productDetails`; only products marked "available" trigger inventory deduction during STORE stage completion or approval.
- **Route validation**: `manualRouteOrder` and `requestStageCompletion` now validate destination is in `validAllStages` before routing. Invalid destinations return `"Cannot route order. Destination route X does not exist."`.
- **WORKERS stage**: Added to `validAllStages`, `getRolesForStage` (→ `PRODUCTION` role), `validateStageTransition` (from all stages), `getStageDurations`, `AUTO_TRANSITION_STAGES`, analytics `stageOrder`. NOT in `NEXT_STAGES` (manual-only route, not auto-advance).

## Relevant Files
- `frontend/src/pages/InventoryManagement.jsx`: `printBarcodeFromStore` — SVG vector barcode printing (55×33mm label, 20mm bars, viewBox scaling, JsBarcode SVG output)
- `backend/src/controllers/outletDemand.controller.js`: `acceptDemandRequest` — fixed `outletName` propagation, barcode collision check with per-outlet `findFirst`, cache invalidation with `delPattern('pos:')`
- `backend/src/controllers/pos.controller.js`: `createPosProduct` — `OUTLETS` array now includes `'Abbottabad'` (was missing)
- `frontend/src/pages/OutletPOSInventory.jsx`: three-outlet tab selector, read-only cross-outlet mode (OUTLET role), full CRUD for own outlet/STORE/ADMIN
- `frontend/src/components/OrderCard.jsx`: per-product availability toggles (STORE stage), per-product PRODUCTION/STORE rendering
- `backend/src/controllers/order.controller.js`: deliveryCharges, paymentStatus, advanceAmount, idempotent revenue recording, deliveryType filter, per-product availability (`requestStageCompletion`, `approveStageCompletion`, `classifyOrderItems`)
- `backend/src/controllers/editRequest.controller.js`: instructionNotes, shopifyOrderDate field mapping
- `backend/prisma/schema.prisma`: deliveryCharges, advanceAmount, shopifyOrderDate fields
- `frontend/src/hooks/usePolling.js`: polling hook (unchanged)
- `AGENTS.md`: full change log
