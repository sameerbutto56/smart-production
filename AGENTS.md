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
- **OrderEntry.jsx split (Context + 4 tab components)**: Split 4054-line `OrderEntry.jsx` into `OrderEntryContext.jsx` (all state + handlers + derived data, 711 lines), 4 tab components (`BasicInfoTab`, `ProductSelectionTab`, `EngravingTab`, `SizeChartTab`), and a thin shell importing context + tabs. Follows same Provider pattern as OutletPOS split. Net reduction of 1858 lines. Build passes with 0 errors. (commit `757a6a0`)
- **Removed inventory deduction** from STORE stage (`updateProductAvailability`, `requestStageCompletion`, `approveStageCompletion` in `order.controller.js`) — Store Profile now only marks `availabilityStatus` without calling `classifyOrderItems` / `deductInventoryItems`
- **Created Warehouse POS module** — context + 5 components (Products, Cart, Modals, History, Returns) + thin shell page; matches Outlet POS architecture exactly; uses `/api/warehouse/*` endpoints exclusively
- **Fixed 500 error** in warehouse endpoints — removed `isActive: true` filter on `InventoryItem` queries (field does not exist on model)
- **Created Store Dashboard Analytics** — new `analytics` tab in `WarehouseDashboard.jsx` with full sales/inventory/tasks/invoices/products/returns/delay/performance sections; backend controller + routes at `/api/store-dashboard`
- **Fixed Urdu font/RTL** — `LanguageContext.jsx` sets `dir="rtl"` on wrapper + `document.documentElement.lang/dir` on toggle; `.font-urdu` CSS includes `direction:rtl` + `text-align:right`; added RTL overrides for tables/inputs/flex
- **Warehouse POS variant selection** — Added `handleAddToCart(group)` + `confirmConfig()` to `WarehousePOSContext.jsx`; rewrote `WarehousePOSProducts.jsx` with clickable grouped cards (no per-variant buttons); added config modal to `WarehousePOSModals.jsx` with color/size selectors and qty +/- picker. Single-variant products add directly; multi-variant products open config modal on click.
- **Per-product Measurement Special Notes fix** — `printReport.js` now checks `item.sizeData.specialNote` from outer wrapper when collecting per-product notes, fixing regular OrderEntry orders where each product's note was stored in `sizeData` but printReport only read from order-level `sizeData.specialNote` (commit `4ff235c`).
- **Complete Order Tracking Timeline** — Rewrote `OrderTrack.jsx` with chronological timeline (employee name, date, time, color-coded entries); enhanced `getOrderTimeline` to include ALL audit actions (not just 7) with assignedEmployee names; `trackOrder` now includes `createdBy` (commit `ac50062`).
- **Added missing STAGE_LABELS** to backend `order.controller.js` (commit `e0ec0be`).
- **Employee Management System** — Extended User model with `outletName`, `isActive`, `subRole` fields; created `employee.controller.js` (CRUD + verify + by-role endpoints); created `employee.routes.js`; created `EmployeeManagement.jsx` (admin CRUD page); created `EmployeeLoginModal.jsx` (reusable module login); created `EmployeeContext.jsx` (active employee state); added `/employees` route and nav item (commit `36fe150`).
- **Permanent unique Invoice Number** — Added `invoiceNumber String? @unique` to Order model; `InvoiceSequence` model tracks per-outlet auto-incrementing counter; `generateInvoiceNumber()` uses atomic `upsert` inside `$transaction`; format `INV-{JT|JL|OUT}-00001`; never resets regardless of date.
- **Invoice Number in OutletOrderEntry** — Auto-generates order number + invoice number on mount via parallel API calls; shows both as read-only badges in Customer step; includes both in Review step; saved with order payload; shown in success screen.
- **Outlet Order Tracking by Order/Invoice** — `trackOrder` (outlet + global) now searches by `orderNumber` OR `invoiceNumber` (exact match first, then contains fallback); placeholder updated to "Enter Order # or Invoice #"; tracked order details show Invoice # when available.
- **POS-Outlet Order Entry Integration** — Full pipeline from POS checkout to outlet order creation and delivery:
  - **Backend OUTLET unseen-tasks**: Added `OUTLET: ['OUTLET_RECEIVE']` to `getRolesForStageBasedOnRole` in `order.controller.js` so unseen-tasks endpoint returns outlet orders.
  - **POS checkout order number**: `POSContext.jsx` `handleCheckout` generates order number when "Create Order Number" checkbox is enabled; `POSCart.jsx` checkbox UI; `POSModals.jsx` checkout success shows order number + "Create Order" button navigating to `/outlet-order-entry?orderNumber=JT-XXX`.
  - **OutletOrderEntry URL pre-fill**: Reads `orderNumber` from `useSearchParams`, pre-fills field, shows "From POS" badge instead of "Auto-generated"; still generates invoice number on mount.
  - **OutletOrderEntry payment removal**: Review step shows total amount only; removed advance/balance/payment-method fields (POS handles payment).
  - **Store "Send to Outlet"**: Added `OUTLET_RECEIVE` to destination chip list in OrderCard STORE_RECEIVE stage.
  - **Outlet "Deliver" action**: Added DELIVER + PROBLEM buttons for OUTLET role at OUTLET_RECEIVE stage; calls `/api/orders/:id/delivery` with `deliveryStatus: 'DELIVERED'`.
  - **Outlet "My Tasks" nav**: Added `'OUTLET'` to nav item roles in `Layout.jsx` + whitelist for `/tasks` route.
  - **PosSale orderNumber field**: Added `orderNumber String?` to PosSale schema; stored from checkout payload; returned in `getSalesDashboard`, `getSales`, and `getBalanceInvoices`.
  - **Print receipt order number**: `POSPrint.js` shows "Your Order #: JT-XXX" prominently in receipt header when `sale.orderNumber` is present.

### In Progress
- (none)

### Blocked
- (none)

### Fixed This Session — Pay Balance / History modals not opening from Dashboard tab (and History/Returns tabs)
- **Root cause**: `OutletPOS.jsx` had three early-return branches for `history`, `returns`, and `dashboard` tabs — none contained the modal JSX. All 9 modals (Product Config, Checkout Success, Print Options, Pay Remaining Balance, Balance History, Close Book, Auth, Payment Detail, Employee Detail) were placed only in the default (`pos`) return block. Even when `handlePayBalanceOpen`/`handleViewBalanceHistory` succeeded and set `showPayBalanceModal=true`, the modal never rendered because the JSX wasn't in the render tree for those tabs.
- **Fix**: Extracted all modals into a `const sharedModals` variable defined before the early returns. Wrapped each early return in a React Fragment (`<>...</>`) and appended `{sharedModals}` at the end. Replaced the inline modal section (lines 2473–3015) in the default `pos` return with `{sharedModals}`. The modals now render for all four tabs (pos, history, returns, dashboard).
- **Verification**: Build passes with 0 errors. Commit `d644db2`.

### Fixed This Session — Close Book Payment Summary Non-overlapping Rows
- **Root cause**: `getBookSummary` had `totalCashSales = paymentSummary.CASH + paymentSummary.CASH_ONLINE_CASH` and `totalOnlineSales = paymentSummary.ONLINE + paymentSummary.CASH_ONLINE_ONLINE` — CASH_ONLINE amounts were double-counted when Cash+Online row was also displayed. Payment Summary Cash+Card+Online+CashOnline summed to > GrandTotal.
- **Fix 1** (`getBookSummary` totals): Changed to pure method amounts — `totalCashSales = paymentSummary.CASH` (no CASH_ONLINE cash), `totalOnlineSales = paymentSummary.ONLINE` (no CASH_ONLINE online). Cash+Online row shows full CASH_ONLINE via `cashOnlineTotal`. Now Cash + Card + Online + CashOnline = GrandTotal exactly.
- **Fix 2** (return tracking): CASH_ONLINE returns no longer add an `onlineRatio` portion to `returnSummary.ONLINE` — prevents deducting CASH_ONLINE online returns from pure ONLINE net in `paymentBreakdown`. ONLINE returns now stay pure (only `refundPaymentMethod === 'ONLINE'` entries).
- **Fix 3** (`getBookHistory`): Existing stored summaries (from previous closes) are adjusted on-the-fly — `paymentSummary.cash` and `paymentSummary.online` have `cashOnlineCash`/`cashOnlineOnline` subtracted so old records render correctly.
- **Consistency**: Payment Summary rows are now non-overlapping (accounting view). Cash Summary section (below) still shows `cashCollected` (raw cash in till) for operational view — matching Dashboard.

### Fixed This Session — Urdu Dictionary Now Powers All POS/Warehouse/Job Sheet UI
- **urduDictionary.js expanded**: All 207 variant colors added (A–Z, 245 entries total) alongside existing 106 product names
- **toUrduName() export**: O(1) dictionary lookup, never crashes, falls back to original text
- **printReport.js**: `pu()` helper for product names and `vu()` helper for colors use dictionary first, `romanToUrdu()` as fallback; 4 product name sites + 3 color sites updated
- **OrderCard.jsx**: Changed `romanToUrdu` import → `toUrduName`; 6 product name + 5 color display spots now Urdu-aware
- **AllOrders.jsx**: Same pattern, 4 product name + 3 color spots updated
- **POSProducts.jsx**: Added `useLanguage` + `toUrduName`; product names and color labels now Urdu
- **POSCart.jsx**: Cart items show product name + color in Urdu
- **POSHistory.jsx**: History chips show product name + color in Urdu
- **POSReturns.jsx**: Product search, sale items, return cart, return history all Urdu-aware (9 display points)
- **OutletPOSDashboard.jsx**: Top products, Faisal Takes, CSV export, print HTML all use `toUrduName`
- **WarehousePOSProducts.jsx**: Product grid cards show names in Urdu
- **WarehousePOSCart.jsx**: Cart items show name + color in Urdu
- **WarehousePOSHistory.jsx**: History chips show name + color in Urdu
- **WarehousePOSReturns.jsx**: Sales items + return cart show name + color in Urdu
- Build passes with 0 errors, dictionary is ~19.92 kB (6.83 kB gzipped)

### Fixed This Session — `toUrduName()` Rewrite — Token-By-Token Always, No Exact-Match Shortcut
- **Root cause**: The original `toUrduName()` tried an exact‑match on the entire string first (e.g., `'3M N95 Face Mask'`). If that lookup failed, it fell through to token‑by‑token splitting. This violated the requirement “Do **not** translate as a single string” — and meant any new product name without a specific compound entry would render fully in English instead of translating known tokens.
- **Fix**: Removed the `if (urduDictionary[str])` exact‑match shortcut. `toUrduName()` now **always** splits on whitespace, iterates each token, strips leading/trailing non‑alphanumeric characters (parentheses `. , etc.) before dictionary lookup, preserves original formatting/punctuation around the translated core, and joins the result. Unknown tokens are returned as‑is.
- **Token stripping logic**: For each token, finds the span of contiguous alphanumeric/`'-` charaters at the core (via `match(/[a-zA-Z0-9'-]+/`), extracts the suffix/prefix of non‑alnum chars (e.g., `(Black)` → `(` + `Black` + `)`), looks up the core in dictionary, then reassembles as `prefix + translation + suffix`. This means `C.` → `C` + `.`, and `C` → `سی`, so `C.` → `سی.` **but only if** `'C.'` is not already in the dictionary. `'C.'` has now been added as `'سی'` to bypass the stripping path.
- **Added ~150 missing Urdu words** from the 330‑entry table (colors, medical terms, fabric names, size abbreviations, compound colors, pack/qty terms, misc).
- **Added 17 more Urdu words** from the second table (`2.0`, `And`, `Bird`, `Blurry`, `Bottom`, `Chetha`, `D.`, `Dusk`, `Games`, `Jagger`, `Prints`, `Ray`, `Sex`, `Sneakers`, `Uni`, `X`).
- **Dictionary now covers ≈360 unique English→Urdu entries** (individual words + single‑token compounds like `CT-Scan`, `V-Neck`, `Flexfit`, `2.0`). No multi‑word product‑name entries needed.
- **Verification**: Build passes with 0 errors, `npx vite build` succeeds both locally and on Vercel. Deployed commit `722fb60` to `https://smart-production-v3.vercel.app`.

### Fixed This Session — Reprint/Print Not Working (Popup Blocker)
- **Root cause**: `printReceipt` in `OutletPOS.jsx` and `OutletInvoiceHistory.jsx` used `window.open('', '_blank')` at the TOP of an `async` function — after `await` calls (logo fetch, QR code generation), the browser's popup blocker would prevent the window from opening because the user gesture was no longer in scope.
- **Fix**: Replaced `window.open()` with a hidden `<iframe>` appended to `document.body`. The iframe's `contentWindow.document` is used for all `doc.write()` calls, and `iframe.contentWindow.print()` triggers the print dialog. Updated all three functions: `OutletPOS.jsx:printReceipt`, `OutletInvoiceHistory.jsx:printReceipt`, and `OutletInvoiceHistory.jsx:printBalanceReceipt`. Added `console.log` to Reprint onClick.
- **Verification**: Build passes with 0 errors.

### Fixed This Session — Store Profile Duplicate Orders
- **Root cause**: `storeRouteOrder` and `requestStageCompletion` are NOT wrapped in Prisma `$transaction`. If a database error occurs between "mark stage COMPLETED" and "update `order.currentStage`", the order ends up with `currentStage: 'STORE'` but a COMPLETED STORE stage — still picked up by `getStoreDashboardOrders` and `getUnseenOrders` which only check `currentStage`, not stage status.
- **Fix 1** (`getStoreDashboardOrders`): Added `stages: { some: { stageName: 'STORE', status: { in: ['PENDING', 'IN_PROGRESS'] } } }` to the base query — only orders with a genuinely active STORE stage appear.
- **Fix 2** (`getUnseenOrders`): Same `stages: { some }` filter for the unseen-tasks endpoint.
- **Fix 3** (`storeRouteOrder`): Wrapped core routing (stage COMPLETED → create new stage → update currentStage) in `prisma.$transaction`. `RETURN_TO_SOURCE` path also atomized.
- **Fix 4** (`requestStageCompletion`): Moved stage completion from BEFORE validation to AFTER validation — previously, a validation failure would leave the stage COMPLETED but `currentStage` unchanged (order stuck).
- **Diagnostic script** (`backend/prisma/fix-stuck-store-orders.js`): Finds orders stuck at STORE with no active stage and auto-fixes them (advances to next pending stage, or creates a fresh PENDING STORE stage).

### Fixed This Session — Persistent ReferenceError "Cannot access 'z' before initialization" in Faisal Profile
- **Root cause**: Two different React versions existed in the npm workspace (`frontend/node_modules/react@19.2.5` vs root `node_modules/react@19.2.6`). `resolve.dedupe: ['react', 'react-dom']` in `vite.config.js` was added as a workaround but caused Vite's Rollup bundle to produce incorrect module execution order — `react-hot-toast`'s `toast` export was accessed before its module initialization completed (minified as `z`/`JA` in production).
- **Fix 1** (`ErrorBoundary.jsx`): Removed `(error?.name === 'ReferenceError' && error?.message?.includes('before initialization'))` condition from `componentDidCatch` auto-reload — this was not a stale chunk issue but a real TDZ error; infinite reload loop is now broken.
- **Fix 2** (`vite.config.js`): Removed `resolve.dedupe: ['react', 'react-dom']` — no longer needed since React versions are now unified.
- **Fix 3** (`vite.config.js`): Removed `'react-hot-toast'` from `optimizeDeps.include` (already auto-detected by Vite; pre-bundling it explicitly can interact badly with dedupe).
- **Fix 4** (`frontend/package.json`): Updated `"react": "19.2.5"` → `"react": "19.2.6"` and `"react-dom": "19.2.5"` → `"react-dom": "19.2.6"` to match the hoisted peer dependency version at root, eliminating the version mismatch.
- **Verification**: `npm install` removed 355 packages (including duplicate React), added 2; `npm run build` passes with 0 errors.

## Key Decisions
- Only one React version (19.2.6) must exist in the workspace — version mismatch caused dedupe workaround which triggered TDZ error in Vite production bundle.
- `resolve.dedupe` is no longer needed because React versions are now consistent across all workspaces.
- ErrorBoundary should NOT auto-reload on `ReferenceError` + "before initialization" — that pattern is a real TDZ error (not a stale chunk), and reloading would create an infinite loop if the error is deterministic.
- Store dashboard and unseen-tasks endpoints now require an active (PENDING/IN_PROGRESS) stage record matching the role's stage — prevents orders with completed/inactive stages from appearing.
- `requestStageCompletion` validates transitions BEFORE marking stage COMPLETED — eliminates inconsistent state from validation failures.
- `toUrduName()` exact-match shortcut removed — pure token-based lookup ensures new product names work automatically without compound entries
- Punctuation stripping added for tokens — parentheses `(Black)`, trailing periods `C.` preserve original formatting while translating the core word
- `C.` added as standalone dictionary key to bypass the stripping path for this common token
- Balance revenue uses payment-date-based methodology (advance on sale date, balance payments on their dates) for accurate daily tracking.
- **Employee Management uses `User` model** (not separate Employee model) — extends existing auth with `outletName`, `isActive`, `subRole` fields for multi-employee per department/outlet.
- **Employee Login Modal is reusable** — any module can import `EmployeeLoginModal` and pass `role`/`outletName` props to filter eligible employees.
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
- Latest commits: `124a8b0` — auto-reload stale chunk; `033af46` — Logo Design cart option; `76579d5` + `371b346` — Urdu labels; `3bad1ba` — Close Book sync + drill-down; `fcac5a7` — summary sync fix, employee auth for Open/Close, print register info; `d644db2` — Extract modals to sharedModals, fix Dashboard/History/Returns tabs missing modals; `757a6a0` — OrderEntry split context + 4 tab components; `722fb60` — toUrduName() rewrite (token-only, no exact-match, punctuation stripping, ~360 entries); `4ff235c` — per-product measurement notes fix; `ac50062` — complete order tracking timeline; `e0ec0be` — missing STAGE_LABELS; `36fe150` — employee management system (reverted); `6414717` — permanent unique invoice number + outlet order tracking by order/invoice; `c6431c0` — POS-Outlet integration (pre-fill, deliver, send to outlet, order number on receipt)
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
- **POSContext checkout flow**: `handleCheckout` → validates → optionally generates order number → builds payload → POST `/api/pos/sales?outlet=...` → sets `lastSale` → opens checkout success modal
- **POSContext `createOrderNumber` state**: Checkbox in POSCart, checked = generate order number on checkout
- **POSContext `lastSale.orderNumber`**: Set from generated order number; used by checkout success modal to show "Create Order" button
- **OUTLET_RECEIVE stage routing**: `storeRouteOrder` in backend already validates against `validAllStages` which includes `OUTLET_RECEIVE`; no backend change needed for Store→Outlet routing

- `sendTextMessage` now adds message to local state from API response — eliminates race with `chat:status-update`.
- `pendingStatusRef` (useRef) stores status updates for messages not yet in state; applied in `handleNewMessage`.
- Voice upload must NOT set `Content-Type: multipart/form-data` manually — Axios sets boundary automatically.
- React workspace unified to `react@19.2.6` / `react-dom@19.2.6` — `resolve.dedupe` removed from Vite config.
- **OrderCard.jsx:14 stage fallback**: When `order.stages` has no entry matching `order.currentStage`, creates synthetic `{ stageName: order.currentStage, status: 'PENDING', id: null }` to prevent wrong button rendering. Old cleanup script deleted ~142 stage records from DB — recreated via one-time script (since deleted).

## Relevant Files
- `backend/prisma/schema.prisma`: PosSale + PosBalancePayment models; Client model with `measurementChart`, `sizeDetails`, `standardSizes`; Order model with `invoiceNumber String? @unique`; InvoiceSequence model
- `backend/src/controllers/pos.controller.js`: `getSales` (now includes `balancePayments`, computes `_balanceRemaining`/`_balanceStatus`, filters by `statusFilter`), `getBalanceInvoices`, `getInvoiceBalance`, `payBalance`, `getBalanceCollections` (month range fixed), `getBalancePaymentHistory`, `getSalesDashboard` — all with fixes (TDZ, faisalTake NULL, revenue calc)
- `backend/src/routes/pos.routes.js`: 5 balance routes + existing POS routes
- `backend/src/controllers/outletOrder.controller.js`: `createOutletOrder` with optional `orderNumber`, auto-generate; write-back removed; `generateInvoiceNumberEndpoint` (GET /generate-invoice-number); `trackOrder` with orderNumber + invoiceNumber lookup; `generateOrderNumberEndpoint` (GET /generate-number)
- `backend/src/routes/outletOrder.routes.js`: Added `GET /generate-number` and `GET /generate-invoice-number` routes with auth; added `GET /track/:query` for outlet-specific order/invoice tracking
- `backend/src/controllers/order.controller.js`: `calculateAndRecordRevenue` at line 2482, `storeRouteOrder` transaction at line 2722, `requestStageCompletion` validation-before-complete at line 698
- `backend/prisma/fix-stuck-store-orders.js`: Diagnostic script to find and fix orders stuck at STORE with completed/inactive stage records
- `backend/src/controllers/route.controller.js`: `manualRouteOrder`, `requestStageCompletion`
- `frontend/src/pages/OutletPOS.jsx`: Dashboard, cart, checkout, receipt print (with print options), balance cards/modals/history, Balance Collection card with custom date inputs, `printReceipt`, `printBalanceReceipt`, `formatCurrency`
- `frontend/src/pages/OutletOrderEntry.jsx`: Order lookup, sizing mode toggles, client select with measurement normalization (`FIELD_NAME_MAP` fix), auto-populate on product add, Size Chart, auto-generated order number
- `frontend/src/pages/ClientRegistration.jsx`: Updated measurement fields — Shirt group (Shirt Length, Shoulder, Sleeves Length, Sleeves Hole, Chest, Bottom) and Trouser group (Waist, Length, Pancha, Thighs, Asan) with "Add More" extras
- `frontend/src/context/OrderEntryContext.jsx`: All OrderEntry state + handlers + derived data (new).
- `frontend/src/components/BasicInfoTab.jsx`: Basics tab UI (new).
- `frontend/src/components/ProductSelectionTab.jsx`: Product selection tab UI (new).
- `frontend/src/components/EngravingTab.jsx`: Engraving/branding tab UI (new).
- `frontend/src/components/SizeChartTab.jsx`: Sizes/measurements tab UI (new).
- `frontend/src/pages/OrderEntry.jsx`: Cap quantity, delivery charges, paymentStatus toggle, branding tab for CAPS — now thin shell importing context + 4 tab components
- `frontend/src/utils/urduDictionary.js`: `toUrduName()` — always token-by-token with punctuation stripping, ~360 entries; no exact-match shortcut; used by POS products/cart/history/returns, OrderCard, AllOrders, printReport, OutletPOSDashboard, WarehousePOS
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
- **Warehouse POS Context** (`WarehousePOSContext.jsx`): Central state via `useReducer` with `SET_STATE` pattern; `groupedProducts` with `colors`/`sizes`/`totalStock`/`minPrice`/`maxPrice` per group; `handleAddToCart(group)` opens config modal when multiple colors/sizes exist, adds directly for single-variant; `confirmConfig()` finds matching variant by selectedColor+selectedSize and adds to cart with quantity.
- **Warehouse POS Products** (`WarehousePOSProducts.jsx`): Clickable grouped product cards (no per-variant buttons); shows color swatches, size badges, total stock, price range; `handleAddToCart(group)` on click.
- **Warehouse POS Modals** (`WarehousePOSModals.jsx`): Config modal with color selector (when >1 color), size selector (when >1 size), qty +/- picker, and "Add to Cart" button.
- **Store Dashboard Analytics** (`StoreDashboardAnalytics.jsx` / `storeDashboard.controller.js`): 8-section analytics (sales, inventory, tasks, invoices/orders, products, returns, delay, performance) via single `/api/store-dashboard` endpoint.
- **Language/RTL** (`LanguageContext.jsx` / `index.css`): Urdu toggle sets `dir="rtl"` at document + wrapper level; `.font-urdu` class with `direction:rtl` + `text-align:right`; RTL overrides for tables/inputs/flex.
- **Employee Management** (`employee.controller.js` + `employee.routes.js` + `EmployeeManagement.jsx`): Full CRUD for User model with role/outlet/subRole filtering; `verify` endpoint for module-level login; `by-role` endpoint for dropdown population.
- **Employee Login Modal** (`EmployeeLoginModal.jsx`): Reusable modal — fetches employees by role/outlet, authenticates against User table, stores active employee in `EmployeeContext`.
- **Employee Context** (`EmployeeContext.jsx`): Provider storing `activeEmployee` in sessionStorage; exposes `login`, `logout`, `isLoggedIn`.

## Vercel Deployment Lessons
- **SSO Deployment Protection** must be **disabled** for the project (`vercel project protection disable <name> --sso`) — otherwise Vercel intercepts ALL requests (including API) and shows the Vercel Dashboard login page.
- The Vercel team `sameerbutt056-1019s-projects` has SSO protection enabled by default on new projects; you must disable it manually after creating a project.
- To verify a deployment serves your app (not the Vercel Dashboard), fetch the URL and check for `data-dpl-id` in the HTML — if present, SSO protection is intercepting.
- Deployment URL aliasing: the production domain (`smart-production-v2.vercel.app`) auto-assigns to the latest `target: production` deployment. If it shows old content, check the deployment's aliases and build logs.
