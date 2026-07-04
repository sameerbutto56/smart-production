## Goal
- Complete cache-first rollout across all outlets with independent per-outlet inventory, bulk initialization, and instant tab switching.

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

### P1 — Cache-First Foundation
- **Centralized API client**: Migrated all 21 frontend files from raw `axios` to the centralized `api` service (`src/services/api.js`). Eliminated duplicate `sessionStorage.getItem('token')` and `Authorization` header patterns.
- **Fixed WebSocket in production**: Rewrote `src/socket.js` — uses WebSocket only when explicitly configured (`VITE_WS_URL`) or running locally; falls back to stub on Vercel.
- **Event normalizer**: Created `src/utils/normalizeEvents.js` — handles varying `order-updated` payload shapes.
- **IndexedDB wrapper**: Created `src/utils/db.js` — `getItem`/`setItem`/`removeItem` with TTL expiry + hot in-memory cache layer.
- **`useCache` hook**: Created `src/hooks/useCache.js` — cache-first data fetching: hot memory → IndexedDB → API revalidation. Stale-while-revalidate pattern.
- **Sync queue**: Created `src/utils/syncQueue.js` — persistent IndexedDB queue for write operations.
- **No backend files modified** — zero impact on inventory or production data.
- **Build passes with 0 errors**.

### Done (current session)
- **ErrorBoundary**: Now shows actual error message in production (was dev-only).
- **`storeLoading` ReferenceError fixed**: `WarehouseDashboard.jsx:89` — added `loading: storeLoading` to `useCache` destructure.
- **Outlet name indicators** added to `OutletPOSInventory.jsx` — every product card shows `[outletName]` next to category.
- **`useCache` reverted aggressive data reset**: Restored original `staleWhileRevalidate` behavior. TTL increased from 30s→2min.
- **Backend `getPosInventory` pre-populates all 3 outlets**: Auto-creates OutletVariant records for ALL three outlets (stock=0) when any outlet tab is visited.
- **Backend `POST /api/pos/initialize-inventory`**: Bulk init endpoint accepting `{ stockData: { "Johar Town": [...], ... } }`. Creates missing variants and/or updates stock for all 3 outlets. Clears all `pos:*` backend caches.
- **Frontend "Init All" modal** (`OutletPOSInventory.jsx`): STORE/ADMIN-only modal showing all products with per-variant × per-outlet stock inputs. Submits to `/api/pos/initialize-inventory`.
- **Background pre-fetch for other outlets**: `useEffect` fires parallel API calls for non-active outlets, seeding IndexedDB cache (via `setCache`) for instant tab switching.
- **`OutletPOSInventory.jsx` fully rewritten**: Consolidated add/edit modals, init modal, outlet tabs, search/filter, per-variant stock display.
- **Backend `cache.js`**: POS_TTL reduced from 10min→2min for fresher data.
- **Code review fixes**:
  - `isReadOnly` now computed as `isOutlet && selectedOutlet !== defaultOutlet` — OUTLET users get full CRUD on own outlet, read-only on others.
  - Background pre-fetch now seeds `useCache` via `setCache()` for instant tab switching.
  - Init All modal no longer filters out stock=0 entries — all stock values sent to backend.
  - Add Product button restricted to STORE/ADMIN/SUPER_ADMIN only (creating products affects global catalog, not just one outlet).
- **Build passes with 0 errors**.

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
1. Verify all 3 outlets load instantly after the first tab visit (variants pre-created by `getPosInventory`).
2. Run initial bulk stock setup via the "Init All" modal to assign opening stock per outlet.
3. Confirm per-outlet stock isolation: edit stock in one outlet → other outlets unchanged.
4. Ensure build passes with 0 errors after any future changes.

## Notes
- `useCache` stale-while-revalidate bug fixed (Jul 3): When cached IndexedDB data exists and `staleWhileRevalidate=true`, loading now immediately becomes `false` so stale data is shown while revalidating in background. Previously loading stayed `true` the entire time, causing blank screen until API responded. Also fixed bug where `loading` never became `false` on cold loads with `staleWhileRevalidate=true`.
- Transfer `createTransfer` (Jul 3): Now auto-creates destination `OutletVariant` when transferring to an outlet that doesn't have one yet. Previously stock was deducted from source but silently lost if no destination variant existed. Uses `generateBarcode` exported from `pos.controller.js`.
- Barcode print (Jul 3): Changed JsBarcode from `width:2.2, height:28, margin:0` to `width:1.8, height:48, margin:12` — adds critical quiet zone (12px each side ≈ 10× X-dimension) for scanner readability. Removed viewBox stretching; SVG keeps natural dimensions with `max-width/max-height` CSS. Removed unused `sizeInfo` variable.

## Critical Context
- Latest commit includes: P1 foundation — centralized API client (21 files migrated), fixed WebSocket, event normalizer, IndexedDB wrapper, useCache hook, sync queue.
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
- **All 3 outlets receive OutletVariant records (stock=0) on first `getPosInventory` call** to any outlet.
- **`POST /api/pos/initialize-inventory` accepts per-outlet, per-variant stock assignments** — creates and/or updates records.
- **`setCache` exported from `useCache.js`** — can seed both hot cache and IndexedDB from outside the hook.
- **OUTLET role**: full CRUD on own outlet's variants, read-only on other outlets. Cannot add products or initialize inventory.

## Relevant Files
- `backend/src/controllers/pos.controller.js`: `getPosInventory` now loops all 3 outlets for variant creation; new `initializeInventory` bulk endpoint; `generateBarcode` exported
- `backend/src/routes/pos.routes.js`: Added `POST /initialize-inventory` route with `authorize('STORE', 'ADMIN', 'SUPER_ADMIN')`
- `backend/src/utils/cache.js`: POS_TTL reduced 10min→2min
- `frontend/src/pages/OutletPOSInventory.jsx`: Full rewrite — init modal, outlet labels, background pre-fetch, OUTLET CRUD on own outlet
- `frontend/src/hooks/useCache.js`: Reverted aggressive data reset; exports `setCache` for external cache seeding
- `frontend/src/pages/WarehouseDashboard.jsx`: Fixed `storeLoading` ReferenceError
- `frontend/src/components/ErrorBoundary.jsx`: Error message visible in production
