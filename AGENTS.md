## Goal
- Complete POS advance/balance payment flow — order lookup by phone or bill number, card charges, receipt polish, dashboard tracking for order-linked sales.

## Constraints & Preferences
- QR code on receipt must encode per-outlet Google Maps review URL (not receipt data)
- QR must print at the very bottom of the receipt (after all text)
- Receipt must show column headings: ITEM, QTY×PRICE, TOTAL
- Order number in OrderEntry must be manually entered (no auto-generate)
- Inventory data must never be deleted or modified by any cleanup script
- Cart panel must scroll fully so products + summary are both visible
- Balance orders (advance + POS) must be tracked in dashboard with ORDER badge

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

### Done (latest session)
- **Receipt layout fixes**: brand letter-spacing removed, summary order reverted (Subtotal → Alteration → Discount → Final Amount last)
- **QR code on receipt**: per-outlet Google Maps review URL (Johar Town, Jail Road, Abbottabad), placed at bottom after Payment line
- **Receipt column headings**: `ITEM` / `QTY×PRICE` / `TOTAL` above items
- **OrderEntry order number**: always editable & required for outlet (no auto-generate)
- **Inventory backup script**: `backend/prisma/backup-inventory.js` exports InventoryItem, OutletInventory to `backups/`
- **Johar Town phone** `0325-6666063` in receipt header
- **Advance/Balance feature**: `PosSale.advanceAmount`, receipt shows Advance/Balance lines; advance input in POS cart; `PosSale.orderId` links sale to order & marks order PAID
- **Order lookup**: `GET /api/pos/order-lookup` searches by orderNumber OR phone; auto-detects input type; 600ms debounce; sets advance + customer name
- **Dashboard**: Balance Orders section (amber) listing order-linked POS sales; empty state always visible; all 3 payment methods always shown
- **Cart overflow fix**: scrollable cart with summary visible
- **Card charges**: `PosSale.cardChargesPct`/`cardChargesAmount`; percentage input on CARD selection; shown on receipt
- **Auto-load order items**: on order lookup, matches items to outlet inventory by name/color/size and adds to cart
- **Customer phone field**: optional phone input in POS cart; stored on PosSale; shown on receipt print

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
- Order lookup uses one input field that auto-detects phone number vs order number by regex.
- Advance amount stored separately on PosSale (not merged into grandTotal) so receipt can show historic advance + current payment.
- Card charges percentage applies to amount after discount.
- Dashboard Balance Orders section pulled from `posSale` table (`orderId != null`), always visible with empty state.

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
- Latest commit includes: Auto-load order items into cart on lookup, customer phone field, balance orders always visible in dashboard.
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
- **`PosSale` now has fields**: `advanceAmount`, `orderId`, `cardChargesPct`, `cardChargesAmount`, `customerPhone`
- **Order lookup**: auto-detects phone vs order number via regex; sets advance, customer name, phone; auto-loads cart items matched by name/color/size
- **Balance Orders dashboard section**: always visible even when empty, shows all order-linked POS sales with paid/advance/total breakdown

## Relevant Files
- `backend/src/controllers/pos.controller.js`: `getPosInventory` now loops all 3 outlets for variant creation; new `initializeInventory` bulk endpoint; `generateBarcode` exported; `createSale` accepts `customerPhone`, `advanceAmount`, `orderId`, `cardChargesPct`; `getSalesDashboard` returns `balanceOrders`; `orderLookup` by orderNumber or phone
- `backend/src/routes/pos.routes.js`: Added `POST /initialize-inventory` route with `authorize('STORE', 'ADMIN', 'SUPER_ADMIN')`; `GET /api/pos/order-lookup`
- `backend/prisma/schema.prisma`: PosSale model — added `advanceAmount`, `orderId`, `cardChargesPct`, `cardChargesAmount`, `customerPhone`
- `backend/prisma/backup-inventory.js`: backup script for inventory tables
- `backend/src/utils/cache.js`: POS_TTL reduced 10min→2min
- `frontend/src/pages/OutletPOSInventory.jsx`: Full rewrite — init modal, outlet labels, background pre-fetch, OUTLET CRUD on own outlet
- `frontend/src/hooks/useCache.js`: Reverted aggressive data reset; exports `setCache` for external cache seeding
- `frontend/src/pages/WarehouseDashboard.jsx`: Fixed `storeLoading` ReferenceError
- `frontend/src/components/ErrorBoundary.jsx`: Error message visible in production
- `frontend/src/pages/OutletPOS.jsx`: receipt print (QR, headings, advance/balance, card charges, phone, customer phone), cart UI (order lookup, advance input, card charges input, scroll fix, phone input), dashboard (payment cards, balance orders section, ORDER badge)
