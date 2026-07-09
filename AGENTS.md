## Goal
Add POS Dashboard and Total Invoices tabs to Outlet Dashboard; fix Balance Collection filter + invoice balance status logic in POS module.

## Constraints & Preferences
- QR code on receipt must encode per-outlet Google Maps review URL (not receipt data)
- QR must print at the very bottom of the receipt (after all text)
- Receipt must show column headings: ITEM, QTY×PRICE, TOTAL
- Order number auto-generated when order-number search finds no client; falls back to manual input only if generation fails
- Inventory data must never be deleted or modified by any cleanup script
- Cart panel must scroll fully so products + summary are both visible
- Balance orders (advance + POS) must be tracked in dashboard with ORDER badge
- Print options modal must let user pick Complete Invoice / Gate Pass (or both) before printing
- Client Registration measurements use flat key-value; Outlet Order Entry uses per-product nested structure
- Backend must NOT write per-product sizeData back to Client.sizeDetails (corrupts flat format)
- All changes must preserve existing Online/Faisal/Admin workflows — Outlet-only modifications
- POS Dashboard and Total Invoices must be accessible from Outlet Dashboard without modifying existing POS billing workflow
- Do not modify Admin Dashboard, Faisal/Online Dashboard, or existing reports/analytics/APIs
- Balance status must be computed from actual payment records: remaining = grandTotal − (advanceAmount + sum of all balancePayments)
- Only invoices with outstanding balance > 0.01 show BAL status; fully paid invoices show PAID
- Filters (All / Paid / Balance) must send statusFilter to backend; backend filters before returning

## Progress
### Done
- Ran cleanup script `prisma/seed-cleanup.js` then deleted it — removed 7 orders, 75 audit logs, 30 stages, 17 routing entries, 5 production records (Inventory/Users preserved).
- Restored Cap Quantity section in both Female and Male tailoring in `OrderEntry.jsx`.
- Fixed CAPS category not showing branding tab — added `'CAPS'` to `isAccessory` / `isCustomizableProduct` arrays (DB stores `CAPS`, not `CAP`).
- Added `deliveryCharges Float @default(0)` to Prisma schema and pushed to DB.
- Added delivery charges input in Basics tab of `OrderEntry.jsx` and in edit form; included in Financial Summary, `totalPrice`, and `combinedOrder` payload.
- Added delivery charges to backend order creation (`finalDeliveryCharges`, included in `finalTotalPrice`).
- Added `paymentStatus: 'PENDING'` to `formData` with "Order Already Paid" toggle (emerald checkbox with descriptive text) in Basics tab.
- Passed `paymentStatus` through `handleAddToCart` payload and `handleCheckout` `combinedOrder`.
- Backend: added `paymentStatus` to order creation; auto-calls `calculateAndRecordRevenue` when `paymentStatus === 'PAID'`.
- Many styling, status label, and UI polish items across order entry, job sheet, error boundary, etc.
- **PosBalancePayment model** (`backend/prisma/schema.prisma`): New model tracking partial balance payments.
- **Backend balance endpoints** (`pos.controller.js`): `getBalanceInvoices`, `getInvoiceBalance`, `payBalance`, `getBalanceCollections`, `getBalancePaymentHistory`; updated `getSalesDashboard` for payment-date-based revenue.
- **Balance Payment Routes** (`pos.routes.js`): 5 new routes with auth middleware.
- **Balance Collection Card** (`OutletPOS.jsx`): Date-filtered balance collection card above Revenue cards.
- **Remaining Balance section**: Lists invoices with outstanding balance > 0, Pay Balance button.
- **Pay Remaining Balance modal**: Invoice summary, partial/full payment, method selector.
- **Balance Payment Success / Receipt modal**: Confirmation with `printBalanceReceipt`.
- **printBalanceReceipt**: Dedicated balance payment receipt layout.
- **Balance Payment History modal**: Paginated history with date/payment-method/amount filters.
- **Revenue date-based methodology**: Advance as sale-date revenue + balance payments on payment dates.
- **POS Print Options**: Modal with Complete Invoice / Gate Pass checkboxes; `printReceipt` accepts `{ includeInvoice, includeGatePass }`; reprint in Sales History also shows modal.
- **Client Size Auto-Fetch Fix**: Flat Client Registration measurements normalized, stored in `clientMeasurements`, auto-populated into `sizeData[productName]` when product is added; per-product format detected vs flat format; backend write-back to `Client.sizeDetails` removed.
- **Client Registration measurements updated**: Replaced old custom measurement fields with Shirt group (Shirt Length, Shoulder, Sleeves Length, Sleeves Hole, Chest, Bottom) and Trouser group (Waist, Length, Pancha, Thighs, Asan) with color-coded headers; "Add More" (extra measurements) preserved.
- **Sizing mode toggles** in Size Chart step: Standard Size (dropdown with saved sizes, auto-applied to all products) vs Custom Measurements (all 11 fields + extras auto-populated per-product); mode auto-detected from `measurementChart` + `sizeDetails` shape.
- **Standard size plain string detection**: `sizeDetails` as `"XL"` (Standard Size Chart) now correctly detected, not silently dropped by `JSON.parse`.
- **`selectedStandardSize` stored as `_standardSize` snapshot** in `sizeData` per product for order preservation.
- **`GET /api/outlet-orders/generate-number`**: New backend endpoint returning unique order number (e.g., `JT-836194`) using outlet prefix.
- **Order number auto-generation**: When order-number search returns 404 or empty clients, auto-calls new endpoint; generated number displayed as read-only badge in Customer Details step; used in submit payload.
- **Fix 1 – Workflow acceptance**: Changed destination stage in `outletOrder.controller.js` from `IN_PROGRESS` + `startedAt` to `PENDING` — orders now appear in Unseen Tasks and require explicit Accept before routing.
- **Fix 2 – Duplicate measurement fields**: Updated `FIELD_NAME_MAP` — `sleeve→Sleeves Length`, `thigh→Thighs` — so old names map to standard names used in `allFields`; added per-product `sizeData` key normalization on load in `selectClient`.
- **Fix 3 – Job Sheet measurements**: Added Outlet per-product sizeData flattening (`{Product: {Chest:42}}` → `{Chest:42}`) in `AllOrders.jsx`, `OrderCard.jsx`, `printReport.js`; replaced hardcoded 6-field PRODUCTION card table with dynamic `Object.entries`; added measurement values grid after size badges in print.
- **Fix 4 – Clean output**: Added `.filter(([k, v]) => v && k !== 'specialNote')` across single-item grid, multi-item inline, PRODUCTION card table, and print measurements — only fields with actual values display.
- **Fix 5 – POS Dashboard `ReferenceError`**: Moved `allSales`/`saleIds`/`balancePayments` declarations before first use in `getSalesDashboard` (Temporal Dead Zone). Eliminated duplicate `bpWithMethod` query by including `paymentMethod` in unified `balancePayments` query.
- **Fix 6 – Dashboard error UI**: Added `dashboardError` destructure, error banner with Retry button, `console.error` logging; added `: null` else branch to ternary; bumped cache version to `v2` to clear stale IndexedDB error entries.
- **Fix 7 – NULL `faisalTake` records**: Changed `{ faisalTake: false }` to `{ faisalTake: { not: true } }` in both `getSalesDashboard` and `getBalanceInvoices` — older records where `faisalTake` is NULL are now included.
- **Fix 8 – Remaining Balance**: Added `orderId: { not: null }` to `getBalanceInvoices` where clause — only order-linked advance/balance sales appear; regular POS sales (cash/card with full upfront payment) excluded.
- **Fix 9 – Revenue calculation**: Regular POS sales (no `orderId`) now count full `grandTotal` as revenue instead of `advanceAmount` (which is 0 for regular sales); added `orderId` to `allSales` select; used `saleRevenue(s)` helper consistently in `totalSales`, `paymentTotals`, and `salesByDay`.
- **Fix 10 – `useCache` race condition**: Added request serial number (`reqRef`) — only latest request's response updates UI; hot cache now revalidates in background when `staleWhileRevalidate=true` (previously returned immediately with no refresh).
- **Fix 11 – Cache bump**: Bumped all POS cache keys from `v2` to `v3` (products, dashboard, sales, returns) to force fresh fetches and clear stale empty arrays.
- **`OutletPOSDashboard.jsx`** created — standalone POS dashboard component (KPIs, charts, payment breakdown, top products, recent sales, Faisal Takes).
- **`OutletInvoiceHistory.jsx`** created — standalone invoice history component (search, date range, All/Paid/Balance filters, Print, Pay Balance, Payment History, Excel download).
- **`OutletDashboard.jsx`** — Added `'pos-dashboard'` and `'invoices'` tabs; replaced horizontal tab buttons with dropdown menu (closes on outside click).
- **Backend `getBalanceCollections` month range fix**: Changed from "last 30 days" to start of current month to now (`startLimit = 1st of month`, `endLimit = now`).
- **Balance Collection custom date UI**: Added `balanceCollectionDateFrom`/`balanceCollectionDateTo` state in `OutletPOS.jsx`; date inputs appear when "Custom" is selected in Balance Collection card; `fetchBalanceCollections` passes `dateFrom`/`dateTo`; `useEffect` re-fetches on date change.
- **Backend `getSales` balance computation**: Added `balancePayments` to `include`; computes `_balanceRemaining` (= max(0, grandTotal − advanceAmount − sum(balancePayments))) and `_balanceStatus` ('paid' / 'balance'); accepts `statusFilter` query param (`all` | `paid` | `balance`) to filter sales server-side.
- **Frontend `OutletInvoiceHistory.jsx` rewrite**: Uses backend-computed `_balanceRemaining`/`_balanceStatus`; removed separate `balanceInvoices` state + fallback `getBalanceInfo`; filter buttons replaced by All Invoices / Paid / Balance toggle that sends `statusFilter` to backend; summary counts (Paid / Balance) shown below filters.
- Build passes with 0 errors across all commits.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Balance revenue uses payment-date-based methodology (advance on sale date, balance payments on their dates) for accurate daily tracking.
- `printReceipt` accepts options parameter instead of creating separate functions for invoice vs gate pass.
- Client measurements stored flat in `clientMeasurements` state; per-product nesting built dynamically when product is added to cart.
- Backend write-back to `Client.sizeDetails` removed to prevent corruption of flat measurement format.
- Order number generation uses backend endpoint to guarantee uniqueness (avoid race conditions from client-side generation).
- FIELD_NAME_MAP used for normalization with lowercase lookup → standard capitalized display names.
- `{ faisalTake: { not: true } }` instead of `{ faisalTake: false }` to include legacy NULL-value records.
- Regular POS sales (no `orderId`) count full `grandTotal` as revenue; advance/balance sales use `advanceAmount`.
- `useCache` race condition solved with request serial number — only the latest in-flight response is applied.
- State-based tab switching in Outlet Dashboard (not nested routes) for POS Dashboard and Total Invoices.
- Balance status computed server-side in `getSales` by including `balancePayments` and deriving `_balanceRemaining`/`_balanceStatus` — frontend uses these fields directly instead of cross-referencing a separate endpoint.
- `getBalanceCollections` month range uses start of current month (not last 30 days) to align with user expectation of "This Month".
- Balance Collection custom range: date inputs added in card UI, `fetchBalanceCollections` passes `dateFrom`/`dateTo` only when `range === 'custom'`.

## Next Steps
- (none — all current work is complete)

## Critical Context
- Latest commits: `9f98887` — dropdown tab menu; `eec65d0` — POS Dashboard + Invoice History tabs + Balance Collection filter fix
- Build passes with 0 errors.
- `isAccessory` uses substring matching (`catUpper.includes('COAT')`).
- `calculateAndRecordRevenue` at line 2482 of `order.controller.js` is idempotent.
- Cap pricing is hardcoded `capUnitPrice = 500`.
- `advanceAmount` field on PosSale: 0 for regular POS sales, stores advance for order-linked sales.
- `sleeveLength` and `shirtLength` are per-product top-level fields in `productDetails` (not inside `femaleOptions`), applied to all genders.
- `instructionNotes` stored as `String?` on Order model, displayed in Job Sheet and print output.
- **Route validation**: `manualRouteOrder` and `requestStageCompletion` validate destination is in `validAllStages` before routing.
- **WORKERS stage**: Added to valid stages, manual-only route, not auto-advance.
- **All 3 outlets receive OutletVariant records (stock=0)** on first `getProducts` call after DB reset.
- **Outlet order number prefix**: `JT-` for Johar Town, `JL-` for Jail Road, `OUT-` for others.
- **Client Registration measurements**: Flat object with Shirt and Trouser groups; extra measurements stored in `_extra` array.
- **Outlet Order Entry measurements**: Per-product nested object `{ productName: { Chest: '42', Waist: '34', _standardSize: 'XL' } }`.
- **Client size auto-population**: `clientMeasurements` (flat, normalized) → `sizeData[productName]` (per-product) on product add; field name mapping handles lowercase→capitalized conversion.
- **Backend write-back removed**: `createOutletOrder` no longer writes `sizeData` back to `Client.sizeDetails`.
- **Auto-generated order number**: Displayed as read-only badge in Customer Details step; falls back to manual input only if generation endpoint fails.
- **`DESTINATION_STAGES`**: Maps to `PENDING` (not `IN_PROGRESS`).
- **POS Dashboard fixes applied**: TDZ fixed, faisalTake NULL handling, regular sale revenue count, useCache race guard, cache version v3.
- `formatCurrency` defined locally in OutletPOS.jsx as `₨${(n || 0).toLocaleString()}`.
- Print functions (`printReceipt`, `printBalanceReceipt`) are defined inline in OutletPOS.jsx — not extracted to utilities.
- **Balance status calculation** (backend `getSales`): `_balanceRemaining = max(0, grandTotal − advanceAmount − sum(balancePayments.amountPaidNow))`; `_balanceStatus = remaining > 0.01 ? 'balance' : 'paid'`.
- **`getBalanceCollections` month range**: `startLimit = 1st of current month`, `endLimit = now` — returns collections from start of current month only.
- **Balance Collection custom range**: Frontend `balanceCollectionDateFrom`/`balanceCollectionDateTo` states passed as `dateFrom`/`dateTo` query params only when `range === 'custom'`; date inputs appear inline in the card.

## Relevant Files
- `backend/prisma/schema.prisma`: PosSale + PosBalancePayment models; Client model with `measurementChart`, `sizeDetails`, `standardSizes`
- `backend/src/controllers/pos.controller.js`: `getSales` (now includes `balancePayments`, computes `_balanceRemaining`/`_balanceStatus`, filters by `statusFilter`), `getBalanceInvoices`, `getInvoiceBalance`, `payBalance`, `getBalanceCollections` (month range fixed), `getBalancePaymentHistory`, `getSalesDashboard` — all with fixes (TDZ, faisalTake NULL, revenue calc)
- `backend/src/routes/pos.routes.js`: 5 balance routes + existing POS routes
- `backend/src/controllers/outletOrder.controller.js`: Destination stage PENDING; `createOutletOrder` with optional `orderNumber`, auto-generate; write-back removed; `generateOrderNumberEndpoint` (GET /generate-number)
- `backend/src/routes/outletOrder.routes.js`: Added `GET /generate-number` route with auth
- `backend/src/controllers/order.controller.js`: `calculateAndRecordRevenue` at line 2482
- `backend/src/controllers/route.controller.js`: `manualRouteOrder`, `requestStageCompletion`
- `frontend/src/pages/OutletPOS.jsx`: Dashboard, cart, checkout, receipt print (with print options), balance cards/modals/history, Balance Collection card with custom date inputs, `printReceipt`, `printBalanceReceipt`, `formatCurrency`
- `frontend/src/pages/OutletOrderEntry.jsx`: Order lookup, sizing mode toggles, client select with measurement normalization (`FIELD_NAME_MAP` fix), auto-populate on product add, Size Chart, auto-generated order number
- `frontend/src/pages/ClientRegistration.jsx`: Updated measurement fields — Shirt group (Shirt Length, Shoulder, Sleeves Length, Sleeves Hole, Chest, Bottom) and Trouser group (Waist, Length, Pancha, Thighs, Asan) with "Add More" extras
- `frontend/src/pages/OrderEntry.jsx`: Cap quantity, delivery charges, paymentStatus toggle, branding tab for CAPS
- `frontend/src/hooks/useCache.js`: Race condition guard (`reqRef`), hot cache revalidation when `staleWhileRevalidate=true`
- `frontend/src/components/ErrorBoundary.jsx`: Error message visible in production
- `frontend/src/utils/printReport.js`: `printJobSheet` — now flattens Outlet per-product sizeData and displays measurement values grid
- `frontend/src/pages/AllOrders.jsx`: Job Sheet modal — Outlet per-product sizeData flattening, clean filter, per-product name lookup for multi-item inline
- `frontend/src/components/OrderCard.jsx`: Full Sheet modal + PRODUCTION card — Outlet per-product flattening, dynamic measurement table (replaced hardcoded 6-field)
- `frontend/src/pages/OutletDashboard.jsx`: State-based tab switching with dropdown menu — Dashboard, POS Dashboard, Total Invoices, Order Track, Tasks tabs
- `frontend/src/components/OutletPOSDashboard.jsx`: Standalone POS dashboard component (KPIs, charts, payment breakdown, top products, recent sales, Faisal Takes, date presets + custom range)
- `frontend/src/components/OutletInvoiceHistory.jsx`: Standalone invoice history (search, date range, All/Paid/Balance filters, expanded details, Print, Pay Balance modal, Payment History modal, receipt modals, Excel download; uses backend-computed `_balanceRemaining`/`_balanceStatus`)
