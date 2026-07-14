## Goals
1. Add **POS Inventory** option to **Faisal Profile** (view-only access) with POS Inventory nav item.
2. Add **Variant Search** inside each product's variant list (per-product, filtering by color/size/barcode).
3. Display **Warehouse stock** column alongside outlet stocks (JT/JR/AB/WH) in unified inventory view.
4. Implement **POS Open Book / Close Book** workflow for daily cashier shift management and end-of-day reconciliation.

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
- **POS Inventory for Faisal**: Added `'FAISAL'` to nav item roles in `Layout.jsx`; Faisal gets read-only `ViewOnlyInventory` (not management CRUD).
- **Per-product variant search**: Removed global variant search bar; added search input inside each product's variant list (both ViewOnlyInventory and ManagementInventory) that filters by color/size/barcode in real-time.
- **Warehouse stock column**: Backend `getAllOutletsView` now fetches `InventoryItem` records and includes them as `outletName: 'Warehouse'` with expanded variant arrays; frontend displays **WH** column alongside JT/JR/AB.
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
- **Fixed `instructionNotes` not showing** — added to `hasEng`/`outHasEngraving` guard so engraving section renders even without other engraving data
- **Removed duplicate `instructionNotes`** from top-level Job Sheet display (was showing twice)
- **Fixed `Icon is not defined` ReferenceError** in `OutletPOSDashboard.jsx` payment breakdown
- **Fixed 504 timeout on outlet analytics** — added cache-first read (was write-only), increased TTL from 5ms to 600s (all) / 120s (other)
- **Fixed POS dashboard 504** — added `cashier` to cache key, adaptive TTL (300s for all, 30s default)
- **Fixed analytics TTL unit bug** — was passing seconds instead of milliseconds to `cache.set()`
- **SUPER FAST checkout** — skip stock decrement for Faisal Takes, send response before async cache invalidation (`setImmediate`)
- **SUPER FAST dashboards** — `getSales` now adaptive TTL (300s for all), response before `cache.set`; all 3 POS dashboard endpoints cache-first with long TTL for `range=all`
- **Fix 12 – Status never updating** (ChatPage.jsx): `sendTextMessage` now adds message to local state from API response (was relying solely on `chat:new-message` socket event, causing race when `chat:status-update` arrived first). Added `pendingStatusRef` queue — if `chat:status-update` arrives before the message is in state, the status is stored and applied in `handleNewMessage` when the message finally arrives. Removed unused `applied` variable.
- **Fix 13 – Voice notes not sending** (ChatPage.jsx): Removed manual `Content-Type: multipart/form-data` header from voice upload Axios call (was overriding Axios's boundary detection, causing multer rejection). Voice message response now also added to local state (same race fix as text messages).
- **Fix 14 – Auto-read firing for sender** (ChatPage.jsx): read-receipt `useEffect` already filtered `m.senderId !== currentUserId` — unchanged but confirmed correct (no longer runs on every `messages` change, only when unread others exist).
- **Fix 15 – Socket blocked in production** (`socket.js`): Removed `canWebSocket` gatekeeper that only allowed connections on localhost — now always connects when token is present.
- **Fix 16 – Socket auth middleware** (`server.js`): Added JWT verification middleware on socket connections for security.
- **Notes Module (simplified)**: No auth/password. Notes are read-only after saving — shared notice board.
  - **PersonalNote model** (`schema.prisma`): `id`, `ownerName` (employee name), `content`, `createdAt`, `updatedAt` — indexed by `ownerName`.
  - **Backend** (`notes.controller.js` + `notes.routes.js`): `GET /api/notes` (all notes, newest first), `POST /api/notes` (create with `employeeName` + `content`). No update, no delete, no password verification.
  - **NotesPage.jsx**: Opens directly (no login). "New Note" button shows form with Employee Name + Content fields. Saved notes display employee name, date/time, and content. No edit/delete buttons.
  - **Navbar** (`Layout.jsx`): `Notes` nav item for `FAISAL`, `STORE`, `OUTLET` roles with `StickyNote` icon.
  - **Route** (`App.jsx`): `/notes` route with lazy-loaded `NotesPage`.
- **Fix 17 – Store Profile "Complete Task" instead of "Accept Task"**: Root cause was old cleanup script deleted STAGE records from DB while leaving `order.currentStage` intact. 61 STORE, 37 PRODUCTION, 27 DISPATCH, 8 LOGO_DESIGN, 8 OUT_FOR_DELIVERY, 2 PRODUCTION_ACCEPTANCE, 1 STORE_RECEIVE stages re-created via `fix-missing-stages.js` (since deleted). Frontend safety net: `OrderCard.jsx:14` now creates a synthetic `{ stageName, status: 'PENDING', id: null }` when `order.stages` has no matching entry for `order.currentStage`, preventing wrong button rendering.
- **Auto-reload on stale chunk** (`ErrorBoundary.jsx:16`): `componentDidCatch` detects `Failed to fetch dynamically imported module` / `ChunkLoadError` and calls `window.location.reload()` automatically after deployment (stale chunk). (commit `124a8b0`)
- **Logo Design cart option**: Added `logoDesign` boolean to PosSaleItem schema (₨300/unit), cart init, toggle button, line total, custCharges useMemo, checkout payload, backend calculation, and financial summary. Mirrors Name Engrave exactly. (commit `033af46`)
- **Job sheet Urdu labels – Half, Regular, Sleeves**: Updated `printReport.js` (section labels + 4 display maps), `OrderCard.jsx`, and `AllOrders.jsx` — `Half` → `Half ہاف`, `Regular` → `Regular ریگولر`, `Sleeves` → `Sleeves بازو`. (commits `76579d5` + `371b346`)
- **Close Book sync with Dashboard**: Rewrote `getBookSummary` in `pos.book.controller.js` — uses `saleRevenue(s) = advanceAmount > 0 ? min(advanceAmount, grandTotal) : grandTotal` (same as `getSalesDashboard`), fetches `posBalancePayment` records within session range, adds `paymentBreakdown` array with gross/returns/journalExpenses/net per method. Payment methods and employee collections are clickable with drill-down modals. (commit `3bad1ba`)
- **Close Book summary sync fix** (`pos.book.controller.js`): Fixed returns query to include sale relation for CASH_ONLINE split; made CASH_ONLINE payment amounts proportional to `saleRevenue(s)` (previously used raw `cashAmount`/`onlineAmount` which over-counted for advance/balance sales); split CASH_ONLINE returns proportionally by original sale's `cashAmount`/`onlineAmount` ratio — now matches `getSalesDashboard` exactly.
- **Register Open/Close with Employee Auth** (`OutletPOS.jsx`): Added auth modal requiring Employee Name + Password before opening or closing the register. Verified against hardcoded employee map. `openedBy`/`closedBy` tracked on the session. `verifiedCloser` state used in print.
- **Print Register Information** (`printCloseBook` in `OutletPOS.jsx`): Thermal and A4 reports now include Register Information section at top with Opened by, Open Date, Open Time, Closed by, Close Date, Close Time.

### In Progress
- (none)

### Blocked
- (none)

### Fixed This Session — Cash+Online Payment Allocation
- **Root cause**: `getSalesDashboard` counted the full CASH_ONLINE sale revenue under a single `paymentTotals['CASH_ONLINE']` bucket instead of splitting `cashAmount` → CASH and `onlineAmount` → ONLINE. Dashboard CASH card and ONLINE card were under-counted by the split amounts.
- **Fix 1** (`paymentTotals` loop in `getSalesDashboard`): CASH_ONLINE sales now split revenue proportionally: `(cashAmount / total) * received` added to CASH, `(onlineAmount / total) * received` added to ONLINE. The full received amount still tracked under CASH_ONLINE for the separate display card.
- **Fix 2** (`returnsByMethod` loop in `getSalesDashboard`): CASH_ONLINE returns also split proportionally by `cashAmount`/`onlineAmount` ratio of the original sale. Added `cashAmount: true, onlineAmount: true` to the return's sale select.
- **Consistency**: Both `getSalesDashboard` and `getBookSummary` now use the same `saleRevenue(s)` formula and split CASH_ONLINE amounts identically.

### Fixed This Session — Store Profile Duplicate Orders
- **Root cause**: `storeRouteOrder` and `requestStageCompletion` are NOT wrapped in Prisma `$transaction`. If a database error occurs between "mark stage COMPLETED" and "update `order.currentStage`", the order ends up with `currentStage: 'STORE'` but a COMPLETED STORE stage — still picked up by `getStoreDashboardOrders` and `getUnseenOrders` which only check `currentStage`, not stage status.
- **Fix 1** (`getStoreDashboardOrders`): Added `stages: { some: { stageName: 'STORE', status: { in: ['PENDING', 'IN_PROGRESS'] } } }` to the base query — only orders with a genuinely active STORE stage appear.
- **Fix 2** (`getUnseenOrders`): Same `stages: { some }` filter for the unseen-tasks endpoint.
- **Fix 3** (`storeRouteOrder`): Wrapped core routing (stage COMPLETED → create new stage → update currentStage) in `prisma.$transaction`. `RETURN_TO_SOURCE` path also atomized.
- **Fix 4** (`requestStageCompletion`): Moved stage completion from BEFORE validation to AFTER validation — previously, a validation failure would leave the stage COMPLETED but `currentStage` unchanged (order stuck).
- **Diagnostic script** (`backend/prisma/fix-stuck-store-orders.js`): Finds orders stuck at STORE with no active stage and auto-fixes them (advances to next pending stage, or creates a fresh PENDING STORE stage).

## Key Decisions
- Store dashboard and unseen-tasks endpoints now require an active (PENDING/IN_PROGRESS) stage record matching the role's stage — prevents orders with completed/inactive stages from appearing.
- `requestStageCompletion` validates transitions BEFORE marking stage COMPLETED — eliminates inconsistent state from validation failures.
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
- Latest commits: `124a8b0` — auto-reload stale chunk; `033af46` — Logo Design cart option; `76579d5` + `371b346` — Urdu labels; `3bad1ba` — Close Book sync + drill-down; `fcac5a7` — summary sync fix, employee auth for Open/Close, print register info
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
- `formatCurrency` defined locally in OutletPOS.jsx as `PKR ${(n || 0).toLocaleString()}`.
- **PosBookSession**: Session tracked in DB by `outletName` and `status`. Only one OPEN book per outlet at a time. Summary computed server-side from sales/journal/returns within session time range. Available cash = cash sales − journal entries − cash returns. Remaining cash = available cash − transferred cash.
- **Close Book modal** in OutletPOS.jsx fetches summary from `GET /api/pos/book/:id/summary`, displays all breakdowns, lets user enter transfer amount, then posts to `POST /api/pos/book/:id/close` with full summary. Print buttons (Thermal + A4) toggle before closing.
- Print functions (`printReceipt`, `printBalanceReceipt`) are defined inline in OutletPOS.jsx — not extracted to utilities.
- **Balance status calculation** (backend `getSales`): `_balanceRemaining = max(0, grandTotal − advanceAmount − sum(balancePayments.amountPaidNow))`; `_balanceStatus = remaining > 0.01 ? 'balance' : 'paid'`.
- **`getBalanceCollections` month range**: `startLimit = 1st of current month`, `endLimit = now` — returns collections from start of current month only.
- **Balance Collection custom range**: Frontend `balanceCollectionDateFrom`/`balanceCollectionDateTo` states passed as `dateFrom`/`dateTo` query params only when `range === 'custom'`; date inputs appear inline in the card.

- `sendTextMessage` now adds message to local state from API response — eliminates race with `chat:status-update`.
- `pendingStatusRef` (useRef) stores status updates for messages not yet in state; applied in `handleNewMessage`.
- Voice upload must NOT set `Content-Type: multipart/form-data` manually — Axios sets boundary automatically.
- **OrderCard.jsx:14 stage fallback**: When `order.stages` has no entry matching `order.currentStage`, creates synthetic `{ stageName: order.currentStage, status: 'PENDING', id: null }` to prevent wrong button rendering. Old cleanup script deleted ~142 stage records from DB — recreated via one-time script (since deleted).

## Relevant Files
- `backend/prisma/schema.prisma`: PosSale + PosBalancePayment models; Client model with `measurementChart`, `sizeDetails`, `standardSizes`
- `backend/src/controllers/pos.controller.js`: `getSales` (now includes `balancePayments`, computes `_balanceRemaining`/`_balanceStatus`, filters by `statusFilter`), `getBalanceInvoices`, `getInvoiceBalance`, `payBalance`, `getBalanceCollections` (month range fixed), `getBalancePaymentHistory`, `getSalesDashboard` — all with fixes (TDZ, faisalTake NULL, revenue calc)
- `backend/src/routes/pos.routes.js`: 5 balance routes + existing POS routes
- `backend/src/controllers/outletOrder.controller.js`: Destination stage PENDING; `createOutletOrder` with optional `orderNumber`, auto-generate; write-back removed; `generateOrderNumberEndpoint` (GET /generate-number)
- `backend/src/routes/outletOrder.routes.js`: Added `GET /generate-number` route with auth
- `backend/src/controllers/order.controller.js`: `calculateAndRecordRevenue` at line 2482, `storeRouteOrder` transaction at line 2722, `requestStageCompletion` validation-before-complete at line 698
- `backend/prisma/fix-stuck-store-orders.js`: Diagnostic script to find and fix orders stuck at STORE with completed/inactive stage records
- `backend/src/controllers/route.controller.js`: `manualRouteOrder`, `requestStageCompletion`
- `frontend/src/pages/OutletPOS.jsx`: Dashboard, cart, checkout, receipt print (with print options), balance cards/modals/history, Balance Collection card with custom date inputs, `printReceipt`, `printBalanceReceipt`, `formatCurrency`
- `frontend/src/pages/OutletOrderEntry.jsx`: Order lookup, sizing mode toggles, client select with measurement normalization (`FIELD_NAME_MAP` fix), auto-populate on product add, Size Chart, auto-generated order number
- `frontend/src/pages/ClientRegistration.jsx`: Updated measurement fields — Shirt group (Shirt Length, Shoulder, Sleeves Length, Sleeves Hole, Chest, Bottom) and Trouser group (Waist, Length, Pancha, Thighs, Asan) with "Add More" extras
- `frontend/src/pages/OrderEntry.jsx`: Cap quantity, delivery charges, paymentStatus toggle, branding tab for CAPS
- `frontend/src/hooks/useCache.js`: Race condition guard (`reqRef`), hot cache revalidation when `staleWhileRevalidate=true`
- `frontend/src/components/ErrorBoundary.jsx`: Error message visible in production
- `frontend/src/utils/printReport.js`: `printJobSheet` — now flattens Outlet per-product sizeData and displays measurement values grid
- `frontend/src/pages/AllOrders.jsx`: Job Sheet modal — Outlet per-product sizeData flattening, clean filter, per-product name lookup for multi-item inline
- `frontend/src/components/OrderCard.jsx`: Full Sheet modal + PRODUCTION card — Outlet per-product flattening, dynamic measurement table (replaced hardcoded 6-field). Stage fallback at line 14 creates synthetic stage when DB has no entry matching `order.currentStage`.
- `frontend/src/pages/OutletDashboard.jsx`: State-based tab switching with dropdown menu — Dashboard, POS Dashboard, Total Invoices, Order Track, Tasks tabs
- `frontend/src/components/OutletPOSDashboard.jsx`: Standalone POS dashboard component (KPIs, charts, payment breakdown, top products, recent sales, Faisal Takes, date presets + custom range)
- `frontend/src/components/OutletInvoiceHistory.jsx`: Standalone invoice history (search, date range, All/Paid/Balance filters, expanded details, Print, Pay Balance modal, Payment History modal, receipt modals, Excel download; uses backend-computed `_balanceRemaining`/`_balanceStatus`)
- `frontend/src/pages/ChatPage.jsx`: Main chat page — `sendTextMessage` adds message to local state, `pendingStatusRef` queue for status-update race, voice upload without manual Content-Type header, StatusIcon component for single/double/blue ticks, right-click context menu, Message Info modal
- `backend/src/controllers/chat.controller.js`: `sendMessage` (returns full message), `uploadVoice` (writes file), `markDelivered`/`markRead`/`markPlayed` (updates DB + broadcasts via socket), `getReceipts`
- `backend/src/routes/chat.routes.js`: All chat route definitions (GET messages, POST message, POST voice, PATCH pin, DELETE, delivery/read/played status, GET receipts)
- **PosBookSession model** (`backend/prisma/schema.prisma`): New model with `id`, `outletName`, `openedBy`, `openedAt`, `closedAt`, `closedBy`, `summary` (JSON), `status` (OPEN/CLOSED).
- **Backend Book endpoints** (`pos.book.controller.js` + `pos.book.routes.js`): `POST /api/pos/book/open` (create session), `GET /api/pos/book/current` (get open session), `GET /api/pos/book/:id/summary` (compute payment breakdown, employee collections, journals, returns), `POST /api/pos/book/:id/close` (save summary, mark CLOSED).
- **Frontend** (`OutletPOS.jsx`): Book status bar (Open/Close indicator in POS tab), Open Book button, Close Book modal with full payment summary, employee-wise collections, journal/return deductions, cash-in-locker calculation, transfer-to-system field, Thermal + A4 print options, 9 PM reminder.
- **Summary computation** (server-side `getBookSummary`): Queries all sales (non-Faisal), Faisal Takes, returns, and journal entries within the session's open/close time range; computes payment totals, per-employee breakdowns, deductions, and available cash.
