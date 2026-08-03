## Goals
1. Add **POS Inventory** option to **Faisal Profile** (view-only access) with POS Inventory nav item.
2. Add **Variant Search** inside each product's variant list (per-product, filtering by color/size/barcode).
3. Display **Warehouse stock** column alongside outlet stocks (JT/JR/AB/WH) in unified inventory view.
4. Implement **POS Open Book / Close Book** workflow for daily cashier shift management and end-of-day reconciliation.
5. Implement **Inventory Audit** module (Warehouse + Outlet): read-only snapshot on start, barcode scanning with live progress, Admin-only approve/reject, automatic inventory updates + adjustment logs on approval.

## Constraints & Preferences
- QR code on receipt must encode per-outlet Google Maps review URL (not receipt data)
- QR must print at the very bottom of the receipt (after all text)
- Receipt must show column headings: ITEM, QTY×PRICE, TOTAL
- Audit (in-progress or submitted) must never touch live inventory — sales, transfers, production, dispatch, and scanning continue unaffected
- Inventory updates happen only on Admin approval of a submitted audit, automatically, without manual stock entry
- Approval must also auto-create inventory adjustment log records (previous/new qty, difference, approved by)
- Barcode integrity: never regenerate, modify, or replace barcodes/SKUs/variant IDs/product IDs during an audit — only quantities change
- Warehouse variant barcodes are non-persisted computed `WRH...` strings — the audit resolves them with the same djb2/generateBarcode algorithm as Warehouse POS so scanned codes match
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
- **Fix 15 – Socket blocked in production** (`socket.js`): Removed `canWebSocket` gatekeeper that only allowed connections on localhost — now always connects when token is present. **SUPERSEDED by the `/socket.io/` 404 fix (`e4ef852`)**: production now uses the stub unless `VITE_WS_URL` is configured (Vercel cannot host socket.io); see "Fixed This Session — `/socket.io/` 404 Spam in Production".
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
- **Edit Request admin nav item** (committed `65d468f`): Added `SUPER_ADMIN` and `ADMIN` roles to Edit Request nav item in `Layout.jsx`; added "Edit Request" to OUTLET whitelist for `/edit-requests` route.
- **approveEditRequest workflow restart** (committed `65d468f`): When Admin approves edit request, backend marks active stages COMPLETED, creates new PENDING STORE stage, resets `currentStage` to STORE, clears routingHistory/productionRecords/allocations/logoPhaseSummary. Includes `getStoreDeadline` helper.
- **OrderEntry edit mode rework** (committed `5ed1240`): Removed empty comparison view (two cards with no content); edit mode now shows normal form tabs pre-filled with loaded order data; reason textarea in edit mode banner; all buttons updated for edit mode (UPDATE CART, SUBMIT EDIT REQUEST).
- **Full order details in edit mode** (committed `2103a33`): 3-column summary grid (Customer, Order Info, Dates), product items list, branding/customization summary, engraving instructions displayed in edit mode banner.
- **EditOrderComparison component** (`EditOrderComparison.jsx`): Comprehensive side-by-side Job Sheet comparison — left=read-only original fields, right=editable fields, changed fields highlighted in amber; sections: Customer Info, Product Details (per item), Branding & Logo (per item), Measurements (per item), Engraving, Pricing Summary (original vs new with difference); reason input field required; diff count badge; builds payload from changed fields only via `buildPayload()`.
- **OrderEntry wiring for EditOrderComparison**: When `isEditMode && originalOrder`, renders `EditOrderComparison` instead of form tabs; `submitOrderEditRequest` now accepts optional `externalPayload` parameter — when called from comparison component, posts payload directly; when called from normal flow, builds from cartItems as before.
- **EditRequestDashboard full comparison**: Enhanced admin review with full Job Sheet field comparison — expanded `parseItems` to include sleeveLength, shirtLength, matchingCap, nameColor, logoColor, logoPlacement, designNotes, logoName, logoCharges, namePrintingCharges, customizationPrice; expanded customer fields to include deliveryCharges, engravingRequired, engravingInstructions, instructionNotes, logoName, logoDesign, logoCharges, namePrintingCharges, customizationPrice, shopifyOrderDate.
- **Dedicated In Dispatch module (JOHAR TOWN outlet only)**: New standalone module completely isolated from the existing Dispatch (dispatch officer) workflow — `InDispatch.jsx` page at `/in-dispatch`, dedicated `/api/in-dispatch/*` backend, `InDispatchRoute` delivery-route model. Only orders at the `IN_DISPATCH` stage (sent via "Send to In Dispatch") appear. Nav item gated to JOHAR TOWN outlet users only.

### Implemented This Session — Order Tracking Shows Real Workflow Status (Verification / Returned / Resubmit)
- **Root cause**: `createOrder` hardcodes `currentStage: 'ORDER_ENTRY'` and skips auto-advance to STORE when `goForVerification` is true — so orders sitting in the Verification queue (or returned to Faisal) were still displayed as **Order Entry** on the tracking page. The pipeline had no VERIFICATION stage, and `resubmitFromVerification` bypassed verification entirely (straight to STORE).
- **Backend** (`order.controller.js`):
  - New `getTrackingStatus(order)` helper — derives the real workflow location for display: `goForVerification && !verifiedAt && !verificationReturnedAt` → `'VERIFICATION'`; `verificationReturnedAt` set → `'RETURNED_FROM_VERIFICATION'`; otherwise `currentStage`.
  - `trackOrder` response now includes `trackingStatus` (computed at L3481); `getOrderTimeline` also fetches the order and returns `trackingStatus`.
  - `STAGE_LABELS_MAP` gained `VERIFICATION: 'Verification'`; `ACTION_LABELS` gained `RETURNED_FOR_CORRECTION: 'Returned from Verification'` and `RESUBMITTED_AFTER_VERIFICATION: 'Resubmitted after Verification'` (previously fell back to raw title-case).
- **Backend** (`verification.controller.js` `resubmitFromVerification`): Now routes back to **Verification** instead of Store — keeps `currentStage: 'ORDER_ENTRY'` (tracking derives VERIFICATION), removes the STORE stage creation + STORE seen-task clearing, records routing history `ORDER_ENTRY → VERIFICATION`, writes `RESUBMITTED_AFTER_VERIFICATION` audit, notifies `INVENTORY_VIEW` at `/verification`. The order reappears in the pending-verification queue; after the second verification pass, `verifyOrder` moves it to STORE as usual.
- **Frontend** (`OrderTrack.jsx`):
  - `STAGE_LABELS`/`STAGE_ORDER`/`STAGE_ICONS` gained `VERIFICATION` (ShieldCheck, pipeline position after ORDER_ENTRY) and `RETURNED_FROM_VERIFICATION` label.
  - Current Stage card + pipeline now use `order.trackingStatus` (falls back to `currentStage`); VERIFICATION shows as active pulsing chip; RETURNED_FROM_VERIFICATION shows ORDER_ENTRY active + red "Verification (Returned)" chip.
  - Red "Returned from Verification" banner with return time + reason; PENDING/VERIFIED/RETURNED badge now red for returned orders.
  - Timeline already rendered verification audit entries chronologically (SENT_FOR_VERIFICATION → VERIFICATION_PENDING → ORDER_VERIFIED → RETURNED_FOR_CORRECTION / RESUBMITTED_AFTER_VERIFICATION) with date/time/actor.
- **Frontend** (`OrderEntryContext.jsx`): Resubmit success message now reads "Order updated and sent back for verification!".
- **Verification**: `node -e require` OK on both controllers; `npm run build` 0 errors (new `OrderTrack-*.js` chunk).

### Fixed This Session — Dispatch Accept → Seen Task (orders stuck in Unseen queue)
- **Symptom**: Dispatch profile orders JT-350879 and JT-138140 appeared in the Dispatch queue; clicking Accept showed "Accepted", but the order never moved to **Seen Tasks** — it disappeared from Unseen and could not be marked as dispatched.
- **Root cause (confirmed with live production data)**: Both orders had gone through DISPATCH more than once, leaving **two DISPATCH stage records** — an old `COMPLETED` one (startedAt=null) and a fresh `PENDING`/`IN_PROGRESS` one. `getDispatchProfileOrders` and `getDispatchQueue` both classified acceptance via `order.stages.find(s => s.stageName === 'DISPATCH')`, which returns the **OLDEST** record — the COMPLETED stage with `startedAt=null` — so `isAccepted` was always false and accepted orders stayed in Unseen. `acceptDispatchOrder` had the same flaw: it targeted `order.stages?.[0]` (the old COMPLETED stage), so the `status === 'PENDING'` branch never fired and the fresh stage was never flipped to `IN_PROGRESS`; only `dispatchOfficer` was set. Live check: `dispatchOfficer='Faisal'` + a genuine `IN_PROGRESS` DISPATCH stage, yet the order showed **UNSEEN** (Faisal unseen=78/seen=71).
- **Fix 1 — classification** (`dispatch-profile.controller.js` Khawar L94 + Faisal L138): replaced `stages.find(...)` with `(order.stages || []).filter(s => s.stageName === 'DISPATCH')` and take the **last** entry (stages are `createdAt: 'asc'`), and treat a set `order.dispatchOfficer` as an accepted signal: `isAccepted = (latestStage?.startedAt != null) || order.dispatchOfficer != null`.
- **Fix 2 — accept handler** (`acceptDispatchOrder`): `include.stages` now ordered `createdAt: 'asc'`; targets the **latest** DISPATCH stage. If the latest stage is missing or terminal (`COMPLETED`/`REJECTED`/`CANCELLED`) → creates a fresh `IN_PROGRESS` stage with `startedAt` + deadline; if `PENDING` → flips to `IN_PROGRESS` + `startedAt`; else (already IN_PROGRESS/WAITING_APPROVAL) → ensures `startedAt` is present. Idempotent for re-accepts.
- **Fix 3 — dashboard** (`getDispatchDashboard` `trackingData`): `assignedAt` now uses the latest DISPATCH stage.
- **Fix 4 — generic Dispatch Center** (`dispatch.controller.js` `getDispatchQueue`): same latest-stage + `dispatchOfficer` accepted-signal fix so the Dispatch Center page is consistent with the profile.
- **Verification**: `node -e require` OK on both controllers. Commit `d41a7d7` deployed (`dpl_7KBcREthdfH64Utues41rg13H4fL`) + re-aliased `smart-production-v2.vercel.app`. Live check post-fix: Faisal counts unseen=78→59, seen=71→90 (19 previously-misclassified orders corrected); JT-350879 and JT-138140 both now in **SEEN** for Faisal.

### Implemented This Session — Stage-Based Delay Orders Analysis (Admin Dashboard + AllOrders)
- **Requirement**: Admin Dashboard gets a Delay Orders breakdown card with per-stage filters; clicking a stage shows only delayed orders stuck in that stage (Order Entry, Verification, Store, Production, Logo Design, Dispatch, Store Receive, Out for Delivery + any stage where an order can stay pending). Per delayed order show order number, customer name, current workflow stage, assigned user, stage entry date/time, total delay duration, current status.
- **Shared utility** (`frontend/src/utils/delayUtils.js`, new): single source of truth moved out of AllOrders — `STAGE_DEPARTMENTS`, `DELAY_REASONS` (incl. `Verification`), `STAGE_LABELS`, `STAGE_ORDER` (canonical chip order), `FALLBACK_STAGE_HOURS` (incl. `VERIFICATION: 24`), `stageLabel`, `fmtDuration` (<24h → Hours, ≥24h → Days), `getEffectiveStage` (derives `'VERIFICATION'` from `goForVerification && !verifiedAt && !verificationReturnedAt`, same as backend `getTrackingStatus`), `getDelayInfo` (deadline-based; for verification falls back to ORDER_ENTRY stage `completedAt` as phase start), `getStageDelays` (per-stage breakdown sorted by STAGE_ORDER then count desc).
- **AllOrders.jsx**: imported `getDelayInfo`, `getStageDelays`, `fmtDuration`, `stageLabel`; removed local duplicate maps/helpers; added `filterDelayStage` state (read from `location.state.filterDelayStage` in the existing state useEffect); `stageDelays` memo; `filteredOrders` gains `matchesDelayStage` (`delayMap[order.id]?.stage === filterDelayStage`); new "Delayed by Stage:" chip row (clicking sets stage + `filterCategory='delayed'` + clears department, active chip red, ✕ Clear); delayed rows now show `delay.stageLabel · department`, stage entry date/time (`formatDateOnly`/`formatTimeOnly` on `delay.phaseStart`), and `⏳ {fmtDuration(delay.delayDuration)} overdue`.
- **AdminDashboard.jsx**: `delayBreakdown = useMemo(() => getStageDelays(allOrders))`; `stats.delayedOrders` is now real (`delayBreakdown.reduce(...)`); landing page gets a dedicated **Delay Orders** card (red border, Clock icon, "View All Delayed (N)" → `/orders` with `filterCategory: 'delayed'`) containing a per-stage chip grid (label + count, each chip → `/orders` with `{ filterCategory: 'delayed', filterDelayStage: <stage> }`); empty state "No delayed orders right now"; old "Delayed Stages" stat card renamed "Delayed Orders" and now navigates with `{ filterCategory: 'delayed' }` instead of `{ filterUrgent: true }`.
- **Verification**: `npm run build` 0 errors (new `delayUtils-BJOObKu2.js` chunk; only pre-existing POSPrint dynamic-import warning). Commit `ed16524`.

### In Progress
- Deploy `ed16524` (`vercel --prod --yes` from repo root) → `vercel alias set <deployment-url> smart-production-v2.vercel.app`; live-verify admin dashboard Delay card + AllOrders stage filter; update this log with deploy refs.

### Blocked
- (none)

### Fixed This Session — Checkout 500 on Large Carts (Prisma 5s Transaction Timeout)
- **Symptom**: Checkout worked for a few items but returned 500 "Failed to create sale" when many products were in the cart.
- **Root cause**: `createSale` in `pos.controller.js` used a bare `prisma.$transaction(async (tx) => …)` — Prisma's default interactive-transaction timeout is **5000ms**. Each cart item = one stock `UPDATE` inside the transaction, and through the Supabase pooler every query carries ~400–800ms latency, so a 15-item cart already ran ~9s live. Reproduction: live `POST /api/pos/sales` with 15 items → 500 with error `"Transaction API error: Transaction already closed: The timeout for this transaction was 5000 ms, however 5186 ms passed"`.
- **Fix**: Raised the timeout to **`{ timeout: 30000 }`** (same pattern already used by the audit module for identical pooler latency) on all four POS transaction sites: `pos.controller.js` `createSale` + `createReturn`, `warehouse.controller.js` `createSale` + `createReturn`. `vercel.json` already sets `functions.maxDuration: 30`, so 30s is within the function limit.
- **Verification**: local 8/15/25-item carts all 201; live 15-item checkout now **201 in 12s** (was 500); live 25-item checkout **201 in 16.8s**; test sales deleted + stock restored after each run; `node -e require` syntax OK; commit `9eb4d3f` deployed + re-aliased `smart-production-v2.vercel.app` (deployment `npggpg0zw`).
- **Note**: 14 of 17 interactive `$transaction` calls across controllers still use the 5s default (outlet order, verification, order, returnExchange, inventory) — they haven't caused issues yet but could hit the same wall if their per-call work grows; audit + inventory ones already have explicit timeouts.

### Fixed This Session — Enamels Delivery Boy Analytics Empty (backend 500s) + Jail Road Orders Option
- **Symptom**: Admin Dashboard → Enamels Delivery tab showed all-zero stats even though 88 Enamels-related orders exist. The card's `safeGet` swallowed errors silently.
- **Root cause**: `Order` model has **no `riderName` field**. `getDeliveryEmployeeStats` (~L612) and `getActivityTimeline` (~L803) selected `Order.riderName` → Prisma threw `Unknown field 'riderName' for select statement on model 'Order'` → both endpoints returned 500 on every call. Verified at runtime, not inferred.
- **Fix 1 — `getDeliveryOrders`** (`delivery.controller.js`): where clause now also matches `currentStage: 'ENAMELS_DELIVERY'` and statuses `RETURNED`/`CANCELLED`; added includes `orderAcceptances`, `deliveryChargeRecords`, `returnExchangeCases`.
- **Fix 2 — rider derivation**: `getDeliveryEmployeeStats` and `getActivityTimeline` no longer select `Order.riderName`; rider name is derived from `orderAcceptances[0].riderName` → `deliveryAttempts` last `riderName` → `deliveryPayments[0].collectedBy` → `deliveryChargeRecords[0].riderName` (all real fields). Both endpoints no longer 500.
- **Fix 3 — `getDeliveryAnalytics`** (new, `GET /api/delivery/analytics`, auth): single authoritative endpoint replacing the card's 6-endpoint aggregator. Response `{ orders, stats, earnings, riders }`:
  - Order identity = 8-criteria OR (`deliveryType='ENAMELS'`, `deliveryMethod='Enamels Delivery'`, `currentStage='ENAMELS_DELIVERY'`, or existence of `deliveryAttempts`/`deliveryPayments`/`deliveryChargeRecords`/`orderAcceptances`/`noResponseLogs`) — needed because `outletRouteOrder.sendToEnamelsDelivery` sets `currentStage='ENAMELS_DELIVERY'` without `deliveryType`.
  - Per-order enrichment: derived `riderName`, `primaryStatus` (delivered/returned/cancelled/failed/noResponse/inTransit/pending from attempts + `deliveredAt`/`returnedAt`/`noResponseCount`/`status`/`currentStage`), `timeline` (assignedAt, acceptedAt, pickedUpAt, deliveredAt, returnedAt, noResponseAt, durationMinutes), `payments[]`, `deliveryCharge`, `attempts[]`, `cashCollected`/`onlineCollected`/`outstanding`/`isPaid` (COD = `totalPrice − advanceAmount − collected`).
  - `stats`: totalAssigned, accepted, pickedUp, delivered, pending, inTransit, returned, noResponse, cancelled, failed + totalOrderValue, codOrderCount, paidOrderCount, totalCOD, totalPaidAmount, outstandingCollection, cashCollected, onlinePrepaid.
  - `earnings`: totalEarnings, totalPaid, outstandingEarnings, completedDeliveries, perRider (per-order charge breakdown). Amounts from actual `DeliveryCharge` records (`amount || 200` fallback), paid vs outstanding via `isPaid`.
  - Filters: `dateFrom/dateTo` (OR across createdAt/deliveredAt/riderAcceptedAt/returnedAt/lastDeliveryAttempt), `riderName` (contains, applied AFTER riders list is built so dropdown stays populated), `status` (orderStatus OR orderStage), `deliveryStatus` (primaryStatus), `paymentType`, `outlet` ('jail road' → only Jail Road outlet orders).
- **Frontend** (`EnamelsDeliveryCard.jsx`): full rewrite — single analytics fetch (30s polling + socket `order-updated`/`delivery-updated` refresh), date presets incl. custom range, rider/order-status/delivery-status/payment filter selects, **Jail Road toggle** (`outlet=jail road`), clickable stat chips with inline order lists, payment breakdown + outstanding lists, per-rider earnings cards with Pay/Payment-History modals, timeline table (cap 100 rows) + order detail modal.
- **Live verification** (mock req/res against Supabase, read-only): All Time = 88 assigned / 78 delivered / 4 in transit / 6 returned, ₨359,049 order value, ₨40,050 COD (13 orders), ₨237,299 cash, ₨58,850 online, earnings ₨14,800 (74 × ₨200); Jail Road Only = exactly 3 JL orders (JL-188352, JL-805573, JL-631580), ₨600 earnings; Delivered Only / Cash Only consistent subsets. `npm run build` 0 errors; `node -e require` OK (17 exports).

### Implemented This Session — POS History Multi-Search (Invoice # / Customer Name / Phone, Whole DB)
- **Requirement**: The POS → History search bar must find any invoice in the entire POS database by invoice number, customer name (partial), or customer phone number (partial), instantly and regardless of age (today → 365+ days old). Existing receipt/invoice-number search must keep working.
- **Backend** (`pos.controller.js` `getSales`):
  - When a `search` query param is present, the date/range filter is **skipped entirely** — the query searches the whole `PosSale` table (not just the selected date window).
  - `where.OR` matches: `receiptNumber` (insensitive), `customerName` (insensitive), `customerPhone` (contains), `orderNumber` (insensitive), plus `orderId IN (...)` for order-linked sales whose `Order.invoiceNumber`/`Order.orderNumber` match (INV-…, JT-…).
  - **Search priority ordering**: exact invoice/receipt/order/phone number match (score 0) → prefix match of a number (score 1) → customer-name match (score 2), then by `createdAt` desc within each score.
  - Cache key normalized for search mode (drops redundant date/range segments).
- **Frontend** (`POSContext.jsx`):
  - New state `historySearchResults`/`historySearchLoading` (reducer keys + exports).
  - Debounced (350ms) server search effect: on `receiptSearch` change → `GET /api/pos/sales?outlet=X&search=Q` (no range), race-guarded with `historySearchRef` so only the latest query updates results; clears results when input is empty.
  - `filteredSales` reworked: empty search → range-filtered `sales`; non-empty search → instant client-side multi-field filter over the loaded list (receipt/invoice/order number + name + phone) while the whole-DB server results are pending, then swaps to authoritative server results once they land.
  - `downloadExcel` now exports the search-filtered list (`filteredSales`) so a search + Excel export is consistent.
- **Frontend** (`POSHistory.jsx`): placeholder updated to "Search invoice #, customer name, or phone..."; pulsing "Searching…" indicator while the debounced query is in flight; empty state "No invoices match your search"; customer phone now shown next to the name on each card.
- **Verification**: `node -e require` OK on `pos.controller.js`; `npm run build` exit 0.

### Implemented This Session — Inventory Audit High-Speed Barcode Scanning (POS-level performance)
- **Requirement**: The Audit scanner must feel as fast as the POS barcode scanner — instant per-scan feedback, continuous scan-→+1-→scan flow with no waiting, no full-page/table reloads, keyboard-free operation, and practical for thousands of products.
- **Frontend** (`frontend/src/components/WarehouseAudit.jsx`):
  - **In-memory barcode lookup**: `barcodeMapRef` (`Map<barcode→itemId>`) built once per audit open (`buildBarcodeMap` in `openAudit`/`startAudit`) — scanning is now a pure `Map.get()`, no server round-trip for recognition. Barcodes never change during an audit, so the map stays valid.
  - **Instant local increment**: `handleScan` is now synchronous — on match it `+1`s the item inside a functional `setActiveAudit` (correct even for rapid same-barcode scans), recomputes the summary locally (`computeLocalSummary`, mirrors backend), captures `lastScannedRef` inside the updater, clears the barcode field, and refocuses `scanRef`. Only that item's row is patched (React reconciliation); the full audit is never re-fetched per scan.
  - **Background batched sync**: scans accumulate in `pendingScanRef` and flush to a new `/api/audit/:id/batch-scan` endpoint — debounced 350ms, or immediately at 20 scans. `flushScans` drains in a self-rescheduling loop (no stranded events), requeues on failure, and the UI never awaits a DB write. `pendingCount` shows an amber "Syncing N scan(s)…" indicator.
  - **Invalid barcode**: `beep(false)` (WebAudio buzz) + toast "Barcode not found." + immediate clear + refocus — scanning continues uninterrupted. Matched scans get a subtle `beep(true)` tick.
  - **Focus recovery**: window `keydown` Enter handler refocuses the barcode field when focus is lost to a non-interactive element — no mouse/keyboard needed between scans.
  - **Submit integrity**: `submitAudit` calls `forceFlush()` (retry loop) to drain the queue, then posts authoritative absolute `finalCounts` so the exact scanned state lands in the DB even if a background batch was dropped. `goBack` flushes + guards the in-flight-flush edge.
- **Backend** (`backend/src/controllers/audit.controller.js`):
  - **`batchScan`** (`POST /api/audit/:id/batch-scan`, STORE/STORE_EMPLOYEE): accepts `{ scans: [{ itemId }] }` (≤200), maps itemIds/barcodes, increments each variant once in a single `$transaction`, recomputes + persists the summary once per batch (via tx-aware `persistSummary`), returns a small payload (`processed`, `notFound`, `summary`, `synced`, last `item`) — never the full item list.
  - **`submitAudit`**: accepts optional `{ finalCounts }` — sets absolute physical quantities inside a transaction before computing the final summary, guaranteeing exact end-state.
  - Route added in `audit.routes.js`; `persistSummary` refactored to accept a transaction client (existing `/scan` and `/items/:itemId` callers unchanged).
- **Verification**: `node -e require` OK on controller/routes; `npm run build` 0 errors (new `WarehouseAudit-DQ3JUZk7.js` chunk).

### Implemented This Session — Delivery vs Self Collection Option in Outlet Order Entry (highlighted on Job Sheet)
- **Requirement**: Outlet Order Entry wizard gets a **Delivery / Self Collection** picker, and the chosen method must be **highlighted** on the Job Sheet.
- **Frontend** (`frontend/src/pages/OutletOrderEntry.jsx`):
  - New `deliveryType` state, default `'DELIVERY'`.
  - **Delivery Method picker** added in Step 1 (Customer) before the Order Number box — two toggle cards: **🚚 Delivery** (blue, "Home delivery to customer address") and **🏪 Self Collection** (purple, "Customer will pick up from shop"), active card gets a colored border/tint.
  - Sent in the submit payload as `deliveryType`.
  - Review step (Step 5) shows `Delivery: 🚚 Delivery` (blue) / `🏪 Self Collection` (purple).
  - Job Sheet preview modal gets a full-width highlighted banner (`bg-blue-100 border-blue-300` for Delivery, `bg-purple-100 border-purple-300` for Self Collection).
  - `resetAll` resets `deliveryType` to `'DELIVERY'`.
- **Backend** (`backend/src/controllers/outletOrder.controller.js`): `createOutletOrder` now destructures `deliveryType` and stores `deliveryType: deliveryType || 'DELIVERY'` on the Order (previously outlet orders saved `deliveryType: null`, so no badge ever appeared). No schema change needed — `deliveryType String?` already exists (line 79).
- **Job Sheet print** (`frontend/src/utils/printReport.js`): Added a prominent **Delivery Method highlight banner** right after the order meta badges — 3px bordered box, `DELIVERY` in blue (#2563eb) / `SELF COLLECTION` in purple (#8b5cf6), with Urdu labels (`ہوم ڈیلیوری` / `سیلف کلیکشن — خود لینا`) when RTL/Urdu is active. The pre-existing badge loop already colored `DELIVERY`/`SELF_COLLECTION`, but outlet orders never set the field so it never rendered — now it does.
- **Verification**: `node -e require` OK on controller; `npm run build` 0 errors (new `printReport-BOXQgY9Q.js` chunk).

### Implemented This Session — Admin Order Priority & Delay Tracking (AllOrders.jsx)
- **Requirement**: Admin Dashboard → Orders page (`AllOrders.jsx` at `/orders`) gets order priority & delay tracking — filter buttons (All/Standard/Custom/Urgent/Super Urgent/Delayed), auto delay detection with phase/department/time info, department-wise delay summary, smart Hours/Days formatting, color-coded priority indicators (🟢 Standard green, 🟡 Urgent yellow, 🟠 Super Urgent orange, 🔴 Delayed red), blinking delayed rows/badges, delay reasons, delayed-phase-highlighted timeline, date-filtered summary cards, and live auto-updating counters/badges.
- **Client-side-only approach** (no backend/schema changes): `getOrders` already returns `stages` with `deadlineAt`/`startedAt`/`createdAt`/`status`/`stageName`; delay is detected using the **same machinery as the backend escalation scan** — the order is delayed when its active stage (status PENDING/IN_PROGRESS/WAITING_APPROVAL matching `currentStage`) has `deadlineAt < now` (working-hours deadline already computed by `calculateDeadline`). Legacy stages without `deadlineAt` fall back to a static `FALLBACK_STAGE_HOURS` table (mirrors `DEADLINE_CONFIG` defaults).
- **Delay helpers** (`AllOrders.jsx` top): `STAGE_DEPARTMENTS` (stage→department: Store/Production/Logo/Dispatch/Inventory Verification), `DELAY_REASONS` ("Delayed in Store", "Delayed in Production", "Delayed in Logo Department", "Delayed in Dispatch", "Delayed in Inventory Verification"), `fmtDuration` (<24h → "X Hours", ≥24h → "X Day(s)", never "48 Hours"), `getDelayInfo` (returns department, stage, reason, phaseElapsed, totalElapsed, delayDuration), `getDateRange` (Today/Yesterday/Last 7 Days/This Month).
- **Derived data**: `delayMap` (orderId → delay info), `departmentDelays` (dept → delayed count), `dateRange`, `summaryCounts` (Total/Standard/Custom/Urgent/Super Urgent/Delayed — all respecting the selected date filter).
- **Filters** (`filterCategory` all/standard/custom/urgent/super_urgent/delayed + `dateFilter` + `filterDepartment`): Standard = `type === 'STANDARD'`, Custom = READY_LOGO/FULL_CUSTOM, Urgent/Super Urgent = priority match, Delayed = `delayMap[order.id]` present. Department chips set `filterCategory='delayed'` + `filterDepartment=dept`. Date filter applies to both summary cards and the table (default All Time preserves existing behavior).
- **UI**: 6 clickable summary cards (respect date filter), category filter chips (Delayed chip shows live `(N)` badge), date filter select, "Delayed by Department" chips (click to filter, red active state), delayed table rows get `.animate-delayed-row` full-row red blink + red left border, stage cell shows blinking 🔴 DELAYED badge + department + "⏳ X overdue", priority cell recolored 🟢/🟡/🟠/🔴, modal gets a red delay banner (reason, department, overdue-by, in-phase, total-time) and the Production Timeline now also renders for delayed orders with the delayed phase highlighted red (blinking badge + red card), CSV export gained Type/Priority/Delay columns.
- **Live updates**: no new socket code needed — the existing `order-updated`/`new-order`/`stage-accepted`/`stage-rejected` listeners call the debounced `refresh()`, which re-fetches orders and recomputes `delayMap`/`summaryCounts`, so delayed counters, badges, and lists auto-update as orders advance phase/change priority.
- **Verification**: `npm run build` 0 errors; new chunk `AllOrders-dbqwhuR8.js` + updated `index-uL56VYeJ.css` (delayed-blink keyframes).

### Fixed This Session — Outlet POS Barcode Scanner: Auto-Clear + Refocus for Continuous Scanning
- **Root cause**: `handleBarcodeLookup` in `POSContext.jsx` added the scanned product to the cart (or incremented quantity) but never cleared the barcode input value nor refocused it — the cashier had to manually delete the previous barcode before each scan.
- **Fix 1** (`POSContext.jsx` `handleBarcodeLookup`): Every exit path now clears the input and refocuses `barcodeRef` — success ("added via barcode"), invalid barcode (`Barcode not found` error), and not-logged-in (`Please login employee first`). Empty code path just refocuses.
- **Fix 2** (`POSContext.jsx` Enter handler): Window keydown Enter handler now only triggers when `document.activeElement === barcodeRef.current` — Enter pressed in the Search (or any other) field no longer fires a barcode lookup.
- **Fix 3** (`OutletPOS.jsx` barcode input): Added `autoFocus` so the cursor lands in the barcode field when the POS tab mounts, and returns there after every scan.
- **Result**: Cashier workflow is now **Scan → Add to Cart/Increase Qty → Input Clears → Cursor Ready** with no keyboard/mouse interaction; duplicate scans increment quantity via the existing `existing.qty + 1` path.
- **Verification**: `npm run build` 0 errors (only pre-existing POSPrint dynamic-import warning); new chunk `OutletPOS-lnOza70H.js`.

### Implemented This Session — Dedicated "In Dispatch" Module (JOHAR TOWN Outlet Only)
- **Requirement**: New standalone module called **In Dispatch**, added to the **JOHAR TOWN Outlet navbar only** (no new role/profile), receiving ONLY orders explicitly sent via **Send to In Dispatch** (JOHAR TOWN Outlet → My Tasks → Send to In Dispatch → In Dispatch Module). Must be completely isolated from the existing Dispatch (dispatch officer) module — no shared queues, routes, or data; existing Dispatch workflow unchanged.
- **Backend** (`inDispatch.controller.js` + `inDispatch.routes.js` mounted at `/api/in-dispatch` in `app.js`):
  - `requireJoharTown` guard on every endpoint — user must be `OUTLET` role with a Johar Town user name.
  - `GET /orders` — returns ONLY orders with `currentStage: 'IN_DISPATCH'` and an active (PENDING/IN_PROGRESS) `IN_DISPATCH` stage record (i.e., orders explicitly routed via `sendToInDispatch`); annotates `_assignedToRoute`.
  - `GET /routes`, `POST /routes`, `POST /routes/:id/complete`, `POST /routes/:id/cancel` — delivery-route CRUD scoped to `outletName: 'Johar Town'`.
  - `POST /orders/:id/route` — self-contained routing out of In Dispatch: `sendToEnamelsDelivery` (→ ENAMELS_DELIVERY), `sendToOutlet` (→ OUTLET_RECEIVE, target Jail Road), `customerTakeDeliver` (→ DELIVERED). Mirrors `outletRouteOrder`'s IN_DISPATCH handling (stage complete → create dest stage → routingHistory → seenTask reset → audit log → notification) without depending on it.
- **Schema**: New `InDispatchRoute` model (`outletName`, `routeName`, `area`, `deliveryPerson`, `notes`, `orderIds` JSON string, `status` ACTIVE/COMPLETED/CANCELLED, `createdBy`, `createdAt`, `completedAt`, `completedBy`). Pushed to DB via `prisma db push`.
- **Frontend** (`frontend/src/pages/InDispatch.jsx` at `/in-dispatch`): Header with JOHAR TOWN badge, stats cards (In Dispatch orders / Active routes / Completed routes), Delivery Routes section (route cards with area/person/orders, Complete/Cancel for ACTIVE), In Dispatch Queue (order cards with products/date/total, "Add to Route" multi-select, Delivery Boy / To Jail Road / Customer Take actions), Create Delivery Route modal (name/area/person/notes + selected orders list). Non-JT users see an Access Restricted screen.
- **Nav** (`Layout.jsx`): `{ name: 'In Dispatch', path: '/in-dispatch', icon: RouteIcon, roles: ['OUTLET'] }`; the OUTLET whitelist filter returns `false` for `In Dispatch` unless the user name contains `johar` or `1` — visible to JOHAR TOWN outlet users only.
- **Isolation**: The module talks exclusively to `/api/in-dispatch/*`. It never touches `/api/dispatch/*`, `DispatchLog`, `DispatchPage`, `DispatchDashboard`, or the dispatch-officer `DISPATCH` stage. Existing Dispatch workflow is byte-for-byte unchanged.
- **Verification**: `npx prisma validate` OK; `prisma db push` synced DB; `node -e require` on controller/routes/app OK; `npm run build` 0 errors (only pre-existing POSPrint dynamic-import warning); new chunk `InDispatch-DZDfJsJu.js`.

### Implemented This Session — Inventory Audit Module (Warehouse + Outlet)
- **Requirement**: New **Inventory Audit** module. Only the **Warehouse profile** performs audits (STORE/STORE_EMPLOYEE — no Outlet users). Admin dashboard gets an **Inventory Audit** card linking to an Admin-only review page with pending/approved/rejected counts, totals, last audit, and highest-difference products. Full lifecycle: read-only snapshot on start → barcode scanning with live progress → submit → Admin approve/reject → automatic inventory updates + adjustment logs on approval.
- **Schema** (`backend/prisma/schema.prisma`): `InventoryAudit` (AUD-#### numbering, WAREHOUSE/OUTLET scope, status IN_PROGRESS→SUBMITTED→APPROVED/REJECTED, summary JSON, auditor/approver/rejection fields), `InventoryAuditItem` (read-only snapshot rows: kind, productId, productName, color, size, barcode, systemQty, physicalQty, scanned, price, status), `InventoryAdjustmentLog` (auditId, productId, productName, color, size, previousQty, newQty, difference, approvedBy). Tables pushed via `prisma db push`.
- **Backend** (`audit.controller.js` + `audit.routes.js` mounted at `/api/audit` in `app.js`):
  - `GET /api/audit/stats` — dashboard cards (pending/approved/rejected/in-progress, totalAdjustments, lossValue, extraValue, lastAudit, highestDifferenceProducts top 5, last warehouse/outlet status).
  - `POST /api/audit` — start audit; one IN_PROGRESS/SUBMITTED audit per scope at a time; warehouse snapshot iterates `InventoryItem.variants` JSON (one row per color/size with **computed `WRH` barcode** reusing the exact djb2/generateBarcode algorithm from `warehouse.controller.js`, fallback to a single row per item when no variants); outlet snapshot reads `OutletInventory` rows (their persisted barcodes). Interactive `$transaction` with `{ timeout: 30000 }` (Supabase pooler latency exceeded Prisma's 5s default).
  - `POST /api/audit/:id/scan` — case-insensitive barcode (or `itemId`) → physicalQty +1, marks scanned, recomputes summary; `POST /api/audit/:id/items/:itemId` — manual physical qty override (clamped ≥0) for unscannable barcodes.
  - `POST /api/audit/:id/submit` — read-only hand-off to Admin.
  - `POST /api/audit/:id/approve` (SUPER_ADMIN/ADMIN only) — applies quantity changes to live inventory (outlet `stock`; warehouse top-level `InventoryItem.stock` or matching variant stock in `variants` JSON, recomputing top-level total from variants), writes `InventoryAdjustmentLog` rows, invalidates `warehouse:`/`products:` cache families, emits `audit-updated` + `inventory-updated` socket events. `POST /api/audit/:id/reject` — Admin only, optional reason.
  - Role gating: start/scan/items/submit = STORE/STORE_EMPLOYEE; stats/list/get = STORE/STORE_EMPLOYEE/SUPER_ADMIN/ADMIN; approve/reject = SUPER_ADMIN/ADMIN only. OUTLET users blocked from all audit endpoints.
- **Frontend** (`frontend/src/components/WarehouseAudit.jsx` wired as an **Audit tab** in `WarehouseDashboard.jsx`): history view (stats cards + audit table), Start New Audit wizard (Warehouse/Outlet + outlet picker + notes), live active-audit view (snapshot totals, progress bar, matched/missing/extra/diff-value chips, barcode scan form with last-scanned feedback, searchable variant-level comparison table with system/physical/diff + manual −/+/qty inputs), Submit confirmation, read-only detail view, A4 print report, approved-audit adjustments table. New `/audit` route (lazy) + nav item `Inventory Audit` for STORE/STORE_EMPLOYEE.
- **Admin side** (`frontend/src/pages/AuditReview.jsx` at `/audit-review`): stats cards, status-filterable audit list, review modal (scanned items grid with system/physical/diff), Approve (auto-applies adjustments) / Reject (with optional reason). `AdminDashboard.jsx` module-card grid gained an `Inventory Audit` card (`path: '/audit-review'` → navigates instead of switching tabs). Nav item `Audit Review` for SUPER_ADMIN/ADMIN.
- **No-live-impact guarantee**: audit items persist as their own snapshot rows; scanning/qty/submit never read or write live `InventoryItem`/`OutletInventory` stock. Inventory mutates only inside the approval `$transaction`. Barcodes/product IDs/variant IDs are never modified — only quantities.
- **Verification**: `npx prisma generate` required (db push alone does NOT regenerate the client — `prisma.inventoryAudit` was undefined until regenerate). Live smoke test (start OUTLET Johar Town → scan barcode ×2 → detail → submit → outlet/store blocked 403 → admin reject) all passed; the test audit was REJECTED so no inventory changed. `npm run build` 0 errors; new chunks `WarehouseAudit-CEgXt2Xu.js` + `AuditReview-CYrwP5Zy.js`.
- **Known behavior**: differenceValue on a fresh audit shows total loss value because physicalQty starts at 0 for all unscanned rows (every unscanned variant counts as missing) — it converges to the real figure as items are scanned; users are expected to scan every variant before submitting.

### Fixed This Session — Outlet Routing Buttons Not Showing After Acceptance
- **Root cause**: `OrderCard.jsx` line 1864 had `['ORDER_ENTRY', 'OUTLET'].includes(currentStage?.stageName) ? (dispatch UI) : (OUT_FOR_DELIVERY / ORDER_ENTRY+OUTLET / OUTLET_RECEIVE / fallback)`. The outlet routing buttons were in the **ELSE** branch of this ternary, meaning when `currentStage.stageName === 'ORDER_ENTRY'` the TRUE branch (dispatch UI) would render and the ELSE branch (containing the outlet routing buttons at line 2022) was never reached.
- **Fix**: Restructured condition at line 1864 to `['ORDER_ENTRY', 'OUTLET'].includes(stageName) ? userRole === 'OUTLET' ? (outlet routing) : (dispatch UI) : (OUT_FOR_DELIVERY / OUTLET_RECEIVE / fallback)`. Now when outlet users see an ORDER_ENTRY stage order, routing buttons render directly instead of the dispatch UI.
- **IsJoharTown guards removed**: `{isJoharTown &&}` removed from Send to Logo, Send to Production, and Delivery Boy buttons — all outlets now see the full set of routing options (Send to Logo, Send to Production, Delivery Boy, Send to JT/Outlet, Customer Take). This was originally only shown for Johar Town but should work for all outlets since `outletRouteOrder` backend doesn't restrict by outlet for these actions.
- Build passes with 0 errors.

### Fixed This Session — Notification System Redesign (Accurate Counts, Real-Time, Module Grouping, Indicators)
- **Root cause 1 — `handleReadNotification` replaces entire state**: Socket `notification:read` did `setUnreadCounts(data.counts)` — if `notification:new` events arrived between the read and the server response, their increments were overwritten by the server's stale counts.
- **Fix 1 (`NotificationContext.jsx`)**: `handleReadNotification` now *merges* server counts into local state — the specific `path` from the read event is set to 0, other paths use `Math.max(local, server)`, preventing lost increments from cross-tab races.
- **Root cause 2 — `fetchUnreadCounts` polling replaces state**: Polling did `setUnreadCounts(counts)` — overwriting any socket-driven increments that occurred between polls.
- **Fix 2 (`NotificationContext.jsx`)**: Polling now merges with functional updater: `setUnreadCounts(prev => { merged[p] = Math.max(prev[p]||0, count); })`.
- **Root cause 3 — Rapid-fire socket events batched incorrectly**: When 10 `notification:new` events fired in quick succession, React's state batching could squash them to a single increment.
- **Fix 3 (`NotificationContext.jsx`)**: Added `queueIncrement()` — coalesces rapid events with a 50ms debounce, then applies all increments in a single `setUnreadCounts` call.
- **Root cause 4 — Bell dropdown not real-time**: `bellNotifs` only fetched when dropdown opened — notifications arriving while open were invisible.
- **Fix 4 (`NotificationContext.jsx` + `Layout.jsx`)**: Added `setBellNotifCallback` — socket handler forwards new notifications to Layout's `bellNotifs` state in real-time via registered callback.
- **Root cause 5 — No module grouping in bell dropdown**: All notifications shown flat without module context.
- **Fix 5 (`Layout.jsx`)**: Bell dropdown now groups notifications by `moduleName` with colored module header labels — users can instantly see which modules have new notifications.
- **Root cause 6 — Blinking indicator not noticeable enough**: CSS keyframe only changed opacity; no glow or scale effect.
- **Fix 6 (`index.css`)**: Enhanced `nav-blink` keyframe with `scale(1.15)` + `box-shadow` glow. Added `pulse-dot` keyframe for a pulsing red dot indicator on unread nav items.
- **Root cause 7 — No collapsed nav indicator**: When sidebar was collapsed, users couldn't see unread at a glance.
- **Fix 7 (`Layout.jsx`)**: Added `animate-pulse-dot` red dot on each nav item with unread, visible alongside the badge even in collapsed mode.
- **Verification**: Build passes with 0 errors. All race conditions eliminated — batched increments, merge-on-read, real-time bell updates.

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

### Fixed This Session — QR Code /feedback Redirects to Login (ThemeProvider Auth Redirect)
- **Root cause**: `ThemeProvider` called `api.get('/api/users/me/theme')` on mount for ALL users — including unauthenticated visitors scanning the QR code. The server returned 401 → `api.js` interceptor caught it → `window.location.href = '/login'`. Since `ThemeProvider` wraps the entire app (including the `/feedback` route which is outside `ProtectedRoute`), every unauthenticated page load triggered a 401 redirect.
- **Fix**: Added `const token = sessionStorage.getItem('token'); if (!token) return;` at the start of the theme-loading `useEffect` in `ThemeContext.jsx:33` — skips the API call entirely when there's no auth token.
- **Verification**: Build passes with 0 errors.

### Fixed This Session — Edit & Resubmit Shows Stale Order Values in Review Summary (and drops paymentStatus/deliveryType)
- **Goal**: Edit & Resubmit from the Verification tab must make every edited field immediately update app state; Order Summary, Job Sheet, and the saved order must use latest form values, never the originally fetched snapshot.
- **Root cause 1**: `OrderEntry.jsx` Order Review & Summary modal read `cartItems[0]?.type || formData.type` (and `priority`, `customerName`, `customerPhone`, `city`, `orderNumber`) — the cart-item snapshot is frozen at load time (`found.type`), so changing Order Type to **Full Custom** still displayed the old type in Review.
- **Fix 1** (`OrderEntry.jsx`): Swapped preference order so live `formData` wins for all 6 order-level fields: `formData.orderNumber || cartItems[0]?.orderNumber`, `formData.customerName || ...`, `formData.customerPhone || ...`, `formData.city || ...`, `formData.type || ...`, `formData.priority || ...`.
- **Root cause 2**: `submitOrderEditRequest` (fromVerification path) never sent `paymentStatus`, and the backend `resubmitFromVerification` `updatableFields` list dropped `deliveryType` — so Basics-tab edits to "Order Already Paid" toggle / delivery type never persisted to DB (Job Sheet stayed stale).
- **Fix 2** (`OrderEntryContext.jsx`): Added `paymentStatus: formData.paymentStatus || 'PENDING'` to `requestedChanges`.
- **Fix 3** (`verification.controller.js`): Added `'paymentStatus'` and `'deliveryType'` to `updatableFields`.
- **Job Sheet / DB**: After resubmit the order is saved to DB via `/api/verification/:id/resubmit` and routed to STORE; Job Sheet (AllOrders/OrderCard `printJobSheet`) reads from the DB order, so it automatically reflects the resubmitted values. Acceptance case (Ready Logo → Full Custom): Review shows Full Custom, resubmit payload sends `type: 'FULL_CUSTOM'`, DB + Job Sheet show Full Custom.
- **Verification**: `npm run build` passes with 0 errors; `node -e require` syntax check OK for `verification.controller.js`.

### Fixed This Session — Resubmit After Verification Returns 500
- **Root cause**: `resubmitFromVerification` included `'items'` in the `updatableFields` array. The loop `updatableFields.forEach(f => { if (updateData[f] !== undefined) payload[f] = updateData[f]; })` added `items: [...]` to the payload, but `items` is NOT a valid Prisma field on the Order model. Prisma threw `Unknown argument 'items'` on `tx.order.update()`.
- **Fix**: Removed `'items'` from `updatableFields`. The `items` data is still processed in the `if (updateData.items)` block to build `payload.productDetails` (a valid Json field), but the raw `items` array no longer leaks into the Prisma update payload.
- **Note**: This was a pre-existing bug introduced when `resubmitFromVerification` was created. It only manifests when items are included in the request body (the normal resubmit flow). My advance payment changes to `returnToFaisal` didn't cause it.

### Fixed This Session — Advance Payment Support in Return to Faisal
- **Problem**: The "Return to Faisal" modal (VerificationPage.jsx) had no advance payment input — verifier could not enter or update advance amount before returning, unlike the "Verify" modal which had full advance payment support.
- **Fix 1 – Frontend** (`VerificationPage.jsx`): Added `returnAdvanceReceived` state, pre-filled with `order.advanceAmount` when opening return modal. Added advance amount input + remaining balance display matching the Verify modal. Passes `advanceAmountReceived` in the POST body.
- **Fix 2 – Backend** (`verification.controller.js:returnToFaisal`): Accepts `advanceAmountReceived` from request body, saves to `advanceAmount` and `advancePaid` fields on the order. Updated audit log to include advance amount.
- **Data Sync**: Advance payment saved upon return → automatically appears pre-filled when Faisal opens via Return from Verification → Add Order & Resubmit (the OrderEntryContext already loads `advanceAmount` from the order). Remaining balance recalculates automatically.
- **Verification**: Frontend build passes with 0 errors. Backend requires no syntax errors (verified via `node -e require`).

### Fixed This Session — Return from Verification Complete Auto-Populate
- **Root cause**: `OrderEntryContext.jsx:154-168` pre-filled only ~12 formData fields when loading an order from verification return. Dozens of fields were missing: `orderNumber`, `paymentStatus`, `deliveryCharges`, `engravingInstructions`, `skipEngraving`, `instructionNotes`, `shopifyOrderDate`, `matchingCap`, `sleeveLength`, `shirtLength`, `gender`, `femaleOptions`, `fabricType`, `color`, `size`, `productType`. The `logoEntries` and `articleNameEntries` were never initialized from the original order's customization data.
- **Fix 1 – Complete formData pre-fill** (`OrderEntryContext.jsx`): Rewrote the `fromVerification` pre-fill block (lines 150-260) to populate ALL order-level fields including `orderNumber`, `paymentStatus`, `deliveryCharges`, `engravingInstructions`, `skipEngraving` (derived from `engravingRequired`), `instructionNotes`, `shopifyOrderDate` (ISO-converted), `matchingCap`/`matchingCapQty`, `sleeveLength`/`shirtLength`, `gender`, `femaleOptions`, `fabricType`, `color`, `size`, and `productType` (first product's details as defaults).
- **Fix 2 – logoEntries & articleNameEntries pre-fill** (`OrderEntryContext.jsx`): Added logic to parse `found.customization` (handling both string and object) and set `logoEntries` from `custData.logos` or fallback to `{ name: found.logoName, design: found.logoDesign }`. Sets `articleNameEntries` from `custData.articleNames` or `[custData.nameSpelling]`.
- **Fix 3 – Expanded cart items** (`OrderEntryContext.jsx`): Mapped ALL fields per cart item including `alteration`, `capCharges`, additional customization fields (`designReference`, `additionalFeatures`, `articleNames`, `logos`), plus order-level context fields (`type`, `priority`, `advancePaid`, `advanceAmount`).
- **Fix 4 – Existing products display in Product tab** (`ProductSelectionTab.jsx`): Added inline cart items section at top of the tab when `fromVerification && originalOrder` — shows all existing products with product name/color/size/quantity/price, Edit (pencil) and Remove (trash) buttons per item, and a helpful hint "Add new products below or edit existing ones above".
- **Fix 5 – Error/fallback handling**: ID fetch fallback chain (`/api/orders/:editOrderId` → `/api/orders/track/:orderNumber`) with error state in loading screen (`editOrderError` displays AlertCircle message instead of spinning forever).
- **Verification**: Build passes with 0 errors.

### Fixed This Session — CEO Dashboard 500 Error (No Data)
- **Root cause**: `ceo.controller.js` `getEmployees` used `prisma.auditLog.findMany({ where: { performedBy: { not: null } } })`. `AuditLog.performedBy` is a **non-nullable `String`** in the schema, so Prisma rejects `{ not: null }` with "Argument `not` must not be null" → `/api/ceo/employees` returned 500 → the whole CEO dashboard failed because `CEODashboard.jsx` fetches all 11 `/api/ceo/*` endpoints in a single `Promise.all` (one rejection breaks all).
- **Fix**: Removed the invalid `where: { performedBy: { not: null } }` filter entirely (filter is redundant since the field is non-nullable).
- **Verification**: Ran all 30 CEO controller DB queries against Supabase — every endpoint passes (auditLog now returns 1000 rows). `node -e require` syntax check OK.

### Fixed This Session — POS Sales Report & Excel Export (Advance / General Entry)
- **`OutletInvoiceHistory.jsx`** (`downloadExcel`): Made async; fetches journal entries via `/api/pos/journal-entries` with the same date range; per-row `Grand Total` now shows `_amountReceived` (actual cash collected) with new `Invoice Total` column for full `grandTotal`; summary shows **Grand Total Sales (Received)**, **Total Advance Payments**, **Outstanding Balance**, **General Entries (Expenses)**, **Net Cash** (= Cash Payments − General Entries), **Returned Amount**, **Net Sales**; journal entries inserted as detail rows between sales and summary.
- **`POSContext.jsx`** (`downloadExcel`): Same pattern — async journal fetch using `salesRange`/`salesDateFrom`/`salesDateTo`, `Grand Total` → `_amountReceived`, added `Invoice Total` + `Balance` columns, `BALANCE` status text, new summary fields, journal rows; `useCallback` deps updated.
- No backend changes needed — `getSales` already returns `_amountReceived`/`_outstandingBalance`; `/api/pos/journal-entries` endpoint already exists with date filtering.

### Fixed This Session — Return from Verification "Blank Form" (orderNumber `#` splits the URL query)
- **Root cause**: `ReturnedFromVerification.jsx:33` built `navigate('/order-entry?editOrderId=...&orderNumber=${order.orderNumber}&fromVerification=true')` with the **raw** order number. Order numbers start with `#` (e.g. `#49821`), and `#` is the URL **fragment separator** — so the query became `?editOrderId=...&orderNumber=` and `fromVerification=true` (plus the tail of the order number) landed in the hash fragment. `window.location.search` had no `fromVerification`, the pre-fill effect never activated, and the user saw the normal **blank** order-entry form. Confirmed empirically: `https://x.com/order-entry?editOrderId=9&orderNumber=#49821&fromVerification=true` → search `?editOrderId=9&orderNumber=`, fragment `#49821&fromVerification=true`; with `%23` → query stays intact.
- **Fix 1** (`ReturnedFromVerification.jsx`): `encodeURIComponent(order.orderNumber || '')` when building the navigate URL → `orderNumber=%2349821`, keeps `fromVerification=true` in the query.
- **Fix 2** (`OrderEntryContext.jsx`): Defensive hash-fragment merge — when the effect parses params, if `fromVerification`/`editOrderId`/`orderNumber` are missing from `window.location.search` (and the `searchParams` fallback), it also parses `window.location.hash.replace(/^#/,'')` and merges those keys in. This makes legacy URLs (old notifications/bookmarks built with a raw `#`) still work.
- **Fix 3** (`OrderEntryContext.jsx`): Added `verificationLoadRef` in-flight guard — `if (verificationLoadRef.current === editId) return; verificationLoadRef.current = editId;` set synchronously before the async load. This fixes the reload-guard's real gap: under React StrictMode (dev), the effect double-invokes synchronously, so the `originalOrder` state check alone cannot prevent duplicate loads (state is still null during both invocations).
- **Verification**: `node` URL-parse test confirms `%23` keeps `fromVerification=true`/`editOrderId`/`orderNumber` (decoded to `#49821`) in the query; `npm run build` passes with 0 errors; deployed `f8f96fd` and re-aliased `smart-production-v2.vercel.app` (deployed `OrderEntry-dZnimgAo.js` + `ReturnedFromVerification-D__DNHsN.js` confirmed to contain the fix).

### Fixed This Session — POS Sales Report Payment Summary All Zeros
- **Root cause**: Backend `getSales` computed `_amountReceived = advanceAmount + sum(balancePayments)`. For a **fully-paid-at-checkout** invoice (Cash/Online/Card/Cash+Online, advance=0, no balance payments) that equals **0** — so every Excel summary line (Grand Total Sales, Cash, Online, Card, Cash+Online, Net Cash, Net Sales) showed 0 even though the invoice rows carried real Cash/Online/Card payments.
- **Fix 1 — Backend** (`pos.controller.js` `getSales`): When `advanceAmount === 0 && balancePayments.length === 0`, `_amountReceived` now equals the full `grandTotal` (the amount actually received at checkout). Advance/balance-linked invoices still count `advance + balancePayments` received so far. `_outstandingBalance` clamped with `Math.max(0, …)`. This mirrors the established `saleRevenue(s)` convention in `getSalesDashboard`/`getBookSummary`.
- **Fix 2 — Frontend summary** (`OutletInvoiceHistory.jsx` + `POSContext.jsx` `downloadExcel`): Rebuilt payment summary to iterate non-refunded sales by actual received amount (`_amountReceived`):
  - `CASH` → Cash Payments, `ONLINE` → Online Payments, `CARD` → Card Payments.
  - `CASH_ONLINE` → full amount added to Cash+Online Payments **and** split proportionally by `cashAmount`/`onlineAmount` ratio (falls back to 50/50 if split totals are 0) into Cash Payments and Online Payments.
  - `Grand Total Sales (Received)` = Cash + Online + Card + Cash+Online (same presentation as the POS Dashboard payment breakdown).
  - `Net Cash` = Cash Payments − General Entries; `Net Sales` = Grand Total − Returned Amount; `Outstanding Balance` = sum of `_outstandingBalance` (tracked separately, never in sales).
- **Verification**: `node -e require` syntax check OK; `npm run build` passes with 0 errors; committed `e3a3fd7` and pushed (`f8f96fd..e3a3fd7`).

### Fixed This Session — `/socket.io/` 404 Spam in Production (Vercel cannot host socket.io)
- **Root cause**: `backend/server.js` only creates the real socket.io server when `process.env.VERCEL !== '1'`; on Vercel `app.js` installs a `safeIo` stub, so the deployed function has **no** `/socket.io/` endpoint at all. But `frontend/src/socket.js` (after "Fix 15" removed the localhost-only gatekeeper) always called `io(WS_URL)` when a token existed — and on Vercel `WS_URL = window.location.origin`. Result: every staff browser fired `/socket.io/?EIO=4&transport=polling` every ~25s and got 404, forever (infinite reconnect storm). Vercel serverless cannot host socket.io: no WebSocket upgrade passthrough, and the polling transport loses sessions because consecutive requests can hit different stateless function instances (`socket.io/discussions/4628`, Vercel docs confirm "Functions do not support acting as a WebSocket server").
- **Fix 1 — `socket.js`**: `connectSocket(token)` now only opens a real socket when `socketAvailable()` — localhost/127.0.0.1/::1 OR an explicit `VITE_WS_URL` (self-hosted socket server) is configured. Production returns the safe stub (all `.on()`/`.emit()` are no-ops), eliminating the 404/reconnect storm. Localhost dev keeps full real-time socket.
- **Fix 2 — `ChatPage.jsx`**: Added a 12s `setInterval` polling fallback — `if (socket?.connected) return; fetchMessages();` — so incoming chat messages still appear in production without a socket (poll skips itself when a real socket is connected). Notifications already poll unread counts every 15s (`NotificationContext`), so notification badges were already covered.
- **Design note**: If a persistent socket is later required in production, the backend must be self-hosted (VPS/Railway/Fly.io) and `VITE_WS_URL` set to its WS address — Vercel will never serve `/socket.io/`.
- **Verification**: `npm run build` 0 errors; committed `e4ef852` and pushed (`54efb25..e4ef852`); deployed and re-aliased `smart-production-v2.vercel.app` (serves `index-HZtWptVn.js`, contains the `socketAvailable` fix marker).

### Fixed This Session — Enamels Delivery Boy Dashboard Showed No Data (timeout on `/api/orders`)
- **Root cause**: The DeliveryDashboard (DELIVERY_BOY user "Enamels Delivery" → `/delivery`) fetched `/api/orders?status=delivery&deliveryType=ENAMELS` with a **15s timeout**, but that endpoint took **16–25s** on Vercel. Every fetch timed out → `useCache` caught the error (never displayed) → the page rendered "No orders here". The slowness was the **escalation check** at the top of `getOrders`: up to 10 sequential `auditLog.findFirst({ details: { contains: stageName } })` full-text scans (~500ms each → ~6s locally, ×2 latency on Vercel = 12–20s), running before every `/api/orders` call regardless of filter (even `limit=1` was 18s). Live timings: `/api/orders?status=delivery&deliveryType=ENAMELS` 16–25s vs the dedicated `/api/delivery/orders?deliveryType=ENAMELS` **4.7s** (no escalation check, same where + includes).
- **Fix 1 — Frontend** (`DeliveryDashboard.jsx` fetcher): Switched to the dedicated `/api/delivery/orders?deliveryType=ENAMELS` endpoint (already used by `DispatchDashboard.jsx` and `EnamelsDeliveryCard.jsx`); removed the `{ timeout: 15000 }` override (falls back to api default 30s). It also returns `noResponseLogs` (which the dashboard uses) that the generic endpoint lacked. The client-side `currentStage`/`status` filter is unchanged.
- **Fix 2 — Backend** (`order.controller.js` `getOrders`): Throttled the escalation scan to run **at most once per 5 minutes per instance** (`lastEscalationCheckAt` + `ESCALATION_CHECK_INTERVAL` module state) and **skipped entirely for `status=delivery`** queries. Escalation audit logs still get written (best-effort, up to 5 min delayed); the hot path for every `/api/orders` call is now ~4s instead of 16–25s.
- **Verification**: `node -e require` syntax check OK; `npm run build` 0 errors; deployed and re-aliased `smart-production-v2.vercel.app`; deployed `DeliveryDashboard-BSEr4Bor.js` confirmed to contain `/api/delivery/orders` and no `status=delivery`; live timings after deploy — `/api/delivery/orders?deliveryType=ENAMELS` 4.7s, `/api/orders?status=delivery&deliveryType=ENAMELS` 4.3s (was 16–25s). Backend returns 63 ENAMELS orders → dashboard tabs: Pending 6, Active 18, Completed 39.

### Fixed This Session — OUTLET My Tasks "Orders" Tab No Longer Shows Accepted Orders
- **Complaint**: On the OUTLET My Tasks page, the **Orders** tab showed a duplicate "Accepted Orders" section listing the same seen orders that already live in the **Assigned/Accepted** tab.
- **Root cause**: `MyTasks.jsx` OUTLET `taskFilter === 'orders'` block rendered both `unseenData.unseen` ("New Orders") and `unseenData.seen` ("Accepted Orders"). `seenTask` records only mark an order as reviewed (eye button) — they do NOT advance the stage, so accepted orders at `ORDER_ENTRY` (IN_PROGRESS) stayed listed under "Accepted Orders" indefinitely until routed onward.
- **Fix** (`frontend/src/pages/MyTasks.jsx`): The Orders tab now renders **only** the unseen list (`New Orders (n)`). Accepted/reviewed orders are reached via the **Assigned/Accepted** tab only. Empty state updated: "No New Orders — All new orders have been reviewed. Check Assigned/Accepted for ongoing tasks."
- **Data notes**: For OUTLET, `getRolesForStageBasedOnRole` returns `['ORDER_ENTRY', 'OUTLET_RECEIVE', 'IN_DISPATCH']` (line 2389 of `order.controller.js`). The card's "COMPLETED" badge is `deadlineStatus` — it shows COMPLETED whenever a stage has no `deadlineAt` (not the actual stage status). Accepted orders are legitimately still at `ORDER_ENTRY`/`OUTLET_RECEIVE` until the outlet completes and routes them.
- **Verification**: `npm run build` 0 errors (new chunk `MyTasks-DfZzJKqW.js`); deployed `smart-production-v2-8uhwh3bxd-…` and re-aliased `smart-production-v2.vercel.app`; live `index-B_ZbJrAs.js` confirmed to reference `MyTasks-DfZzJKqW.js`.

### Fixed This Session — Outlet Routing Jail Road Orders + Dispatch Nav for Johar Town
- **Issue 1 — "This order belongs to Jail Road" when sending to production**: `outletRouteOrder` (`outletOrder.controller.js`) blocked routing whenever the acting outlet didn't match `order.outletName` — so Johar Town staff routing a Jail Road order (which appears in their tasks via the Johar Town→Jail Road visibility rule) got a 403. **Fix**: added `joharTownRoutsJailRoad` allowance (`outletName === 'Johar Town' && order.outletName === 'Jail Road'`) so JT can route JR orders to production/logo/delivery; also guards `order.outletName` null. Delivery-boy bypass preserved.
- **Issue 2 — No Dispatch nav for Johar Town outlet**: `Layout.jsx` had no Dispatch item for `OUTLET`. **Fix**: added `{ name: 'Dispatch', path: '/dispatch', icon: Truck, roles: ['OUTLET'] }` and added `'Dispatch'` to the OUTLET nav whitelist (line 145). `DispatchPage.jsx` already has an `isOutlet` branch ("Outlet Dispatch" + Request Courier button) — no page changes needed.
- **Verification**: `node -e require` syntax check OK for `outletOrder.controller.js`; `npm run build` 0 errors; deployed `smart-production-v2-nh7o9baka-…` and re-aliased `smart-production-v2.vercel.app`; live `index-BViDRfp4.js` confirmed to contain `Notifications…Dispatch` whitelist; live `MyTasks-DxIXoD_u.js` confirmed no "Accepted Orders" section + new empty-state text.

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
- In Dispatch module uses its own dedicated `/api/in-dispatch/*` endpoints (never `/api/outlet-orders/in-dispatch` nor `/api/dispatch/*`) — full backend/frontend isolation from the dispatch-officer workflow while still reading the shared `IN_DISPATCH` order stage (the only queue it is allowed to show).
- "In Dispatch" nav visibility: JT-only via the OUTLET whitelist filter checking `user.name` for `johar`/`1` (same convention as the JOHAR TOWN BRANCH label in the sidebar footer).

## Next Steps
- (none — all current work is complete)

## Critical Context
- Latest commits: `ed16524` — stage-based Delay Orders filters (delayUtils, AllOrders stage chips + row details, Admin Dashboard delay card); `d41a7d7` — dispatch Accept→Seen Task fix (latest DISPATCH stage); `80c94f3` — order tracking shows real workflow status (VERIFICATION / RETURNED_FROM_VERIFICATION); `124a8b0` — auto-reload stale chunk; `033af46` — Logo Design cart option; `76579d5` + `371b346` — Urdu labels; `3bad1ba` — Close Book sync + drill-down; `fcac5a7` — summary sync fix, employee auth for Open/Close, print register info; `d644db2` — Extract modals to sharedModals, fix Dashboard/History/Returns tabs missing modals; `757a6a0` — OrderEntry split context + 4 tab components; `722fb60` — toUrduName() rewrite (token-only, no exact-match, punctuation stripping, ~360 entries); `4ff235c` — per-product measurement notes fix; `ac50062` — complete order tracking timeline; `e0ec0be` — missing STAGE_LABELS; `36fe150` — employee management system (reverted); `6414717` — permanent unique invoice number + outlet order tracking by order/invoice; `c6431c0` — POS-Outlet integration (pre-fill, deliver, send to outlet, order number on receipt)
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
- **OrderCard.jsx:1864 routing fix**: `['ORDER_ENTRY', 'OUTLET'].includes(stageName) ? userRole === 'OUTLET' ? routingButtons : dispatchUI : OUT_FOR_DELIVERY/OUTLET_RECEIVE/fallback` — previously the OUTLET routing section at line 2022 was in the ELSE branch (unreachable when stage === ORDER_ENTRY).
- **All outlets see routing buttons**: `{isJoharTown &&}` guards removed from Send to Logo, Send to Production, Delivery Boy — all outlets now see full routing options.

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
- `frontend/src/context/OrderEntryContext.jsx`: All OrderEntry state + handlers + derived data; `submitOrderEditRequest` accepts optional `externalPayload` from EditOrderComparison
- `frontend/src/components/BasicInfoTab.jsx`: Basics tab UI (new).
- `frontend/src/components/ProductSelectionTab.jsx`: Product selection tab UI (new).
- `frontend/src/components/EngravingTab.jsx`: Engraving/branding tab UI (new).
- `frontend/src/components/SizeChartTab.jsx`: Sizes/measurements tab UI (new).
- `frontend/src/components/EditOrderComparison.jsx`: Side-by-side Job Sheet comparison — read-only original left, editable right, amber diff highlights, reason input, pricing summary, payload builder
- `frontend/src/pages/OrderEntry.jsx`: Cap quantity, delivery charges, paymentStatus toggle, branding tab for CAPS — now thin shell importing context + 4 tab components; edit mode renders EditOrderComparison when order loaded
- `frontend/src/pages/EditRequestDashboard.jsx`: Admin edit request review with full Job Sheet field comparison (17 order-level + 20 per-item), lifecycle timeline, inventory impact, approve/reject
- `frontend/src/utils/urduDictionary.js`: `toUrduName()` — always token-by-token with punctuation stripping, ~360 entries; no exact-match shortcut; used by POS products/cart/history/returns, OrderCard, AllOrders, printReport, OutletPOSDashboard, WarehousePOS
- `frontend/src/hooks/useCache.js`: Race condition guard (`reqRef`), hot cache revalidation when `staleWhileRevalidate=true`
- `frontend/src/components/ErrorBoundary.jsx`: Error message visible in production
- `frontend/src/utils/printReport.js`: `printJobSheet` — now flattens Outlet per-product sizeData and displays measurement values grid
- `frontend/src/pages/AllOrders.jsx`: Job Sheet modal — Outlet per-product sizeData flattening, clean filter, per-product name lookup for multi-item inline
- `frontend/src/components/OrderCard.jsx`: Full Sheet modal + PRODUCTION card — Outlet per-product flattening, dynamic measurement table (replaced hardcoded 6-field). Stage fallback at line 14 creates synthetic stage when DB has no entry matching `order.currentStage`. Outlet routing condition at line 1864 fixed — `isOutlet ? routingButtons : dispatchUI` replaces broken `['ORDER_ENTRY','OUTLET'] ? dispatchUI ELSE {routing in unreachable branch}`.
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

## Notification System
- **`NotificationContext.jsx`**: Batched increment with 50ms debounce (`queueIncrement`) prevents rapid-fire socket events from squashing; `handleReadNotification` merges server counts into local state (doesn't replace); `fetchUnreadCounts` polling uses `Math.max(prev, server)` to preserve socket-driven increments; `setBellNotifCallback` enables real-time bell dropdown updates from socket.
- **`Layout.jsx` bell dropdown**: Registers `setBellNotifCallback` on mount — new notifications appear in real-time while dropdown is open. Grouped by `moduleName` with header labels for instant module identification. Pulsing red dot (`animate-pulse-dot`) on each unread nav item alongside the blinking badge.
- **`index.css` animations**: `nav-blink` enhanced with `scale(1.15)` + `box-shadow` glow for visible attention. New `pulse-dot` keyframe for a persistent pulsing indicator.

## Vercel Deployment Lessons
- **SSO Deployment Protection** must be **disabled** for the project (`vercel project protection disable <name> --sso`) — otherwise Vercel intercepts ALL requests (including API) and shows the Vercel Dashboard login page.
- The Vercel team `sameerbutt056-1019s-projects` has SSO protection enabled by default on new projects; you must disable it manually after creating a project.
- To verify a deployment serves your app (not the Vercel Dashboard), fetch the URL and check for `data-dpl-id` in the HTML — if present, SSO protection is intercepting.
- Deployment URL aliasing: the production domain (`smart-production-v2.vercel.app`) auto-assigns to the latest `target: production` deployment. If it shows old content, check the deployment's aliases and build logs.
- **Stale custom-domain alias can break BOTH frontend and API**: `vercel --prod --yes` auto-aliases only the project-scoped domain (`smart-production-v2-sameerbutt056-1019s-projects.vercel.app`), NOT the custom domain `smart-production-v2.vercel.app`. If the custom domain keeps pointing at an older/partially-built deployment, it can serve 404ing immutable chunks (frontend) AND 500 errors on `/api/*` functions (e.g., "Failed to create sale" on `POST /api/pos/sales`). After EVERY `vercel --prod`, run `vercel alias set <new-deployment-url> smart-production-v2.vercel.app` and verify with an authenticated call to a real endpoint (GET + POST), not just the HTML. Symptom checklist: checkout 500, sales-list 500, chunk 404s — all usually resolve after re-aliasing to the latest READY production deployment.
- **Vercel cannot host socket.io**: Vercel serverless Functions have no WebSocket upgrade passthrough and no instance affinity, so both the `websocket` and `polling` transports fail (session state is lost when consecutive requests hit different stateless instances). The frontend must NOT attempt `io()` against a Vercel origin — use HTTP polling fallbacks instead. A real socket requires self-hosting the backend (VPS/Railway/Fly.io) with `VITE_WS_URL` set to its WS address.

## Relevant Files
- `frontend/src/context/ThemeContext.jsx`: ThemeProvider — added `sessionStorage.getItem('token')` guard to skip `/api/users/me/theme` API call for unauthenticated users (QR code visitors)
- `backend/src/controllers/inDispatch.controller.js`: Dedicated In Dispatch controller — `getInDispatchOrders`, `getRoutes`, `createRoute`, `completeRoute`, `cancelRoute`, `routeOrder` (sendToEnamelsDelivery / sendToOutlet / customerTakeDeliver); every endpoint guarded by `requireJoharTown`.
- `backend/src/routes/inDispatch.routes.js`: All `/api/in-dispatch` routes with auth middleware.
- `backend/prisma/schema.prisma`: `InDispatchRoute` model (delivery-route records scoped to Johar Town).
- `frontend/src/pages/InDispatch.jsx`: Dedicated In Dispatch module page — stats, Delivery Routes CRUD, In Dispatch queue with Add-to-Route multi-select and Delivery Boy / To Jail Road / Customer Take actions; Access Restricted screen for non-JT users.
- `frontend/src/components/Layout.jsx`: `In Dispatch` nav item (RouteIcon) for OUTLET, gated to Johar Town users in the OUTLET whitelist filter.
- `frontend/src/App.jsx`: `/in-dispatch` lazy-loaded route.
- `backend/src/controllers/audit.controller.js`: Full audit backend — `getAuditStats`, `startAudit` (read-only snapshot, WRH barcode reuse), `listAudits`, `getAudit`, `scanBarcode`, `setPhysicalQty`, `submitAudit`, `approveAudit` (applies qty changes + adjustment logs + cache invalidation + socket events), `rejectAudit`.
- `backend/src/routes/audit.routes.js`: All `/api/audit` routes with role guards (start/scan/items/submit = STORE/STORE_EMPLOYEE; stats/list/get = STORE/STORE_EMPLOYEE/SUPER_ADMIN/ADMIN; approve/reject = SUPER_ADMIN/ADMIN).
- `backend/prisma/schema.prisma`: `InventoryAudit`, `InventoryAuditItem`, `InventoryAdjustmentLog` models.
- `frontend/src/components/WarehouseAudit.jsx`: Warehouse audit UI (history/stats, start wizard, live scanning with progress, variant comparison grid, submit, print report, approved adjustments) — wired as the `audit` tab in `WarehouseDashboard.jsx`.
- `frontend/src/pages/AuditReview.jsx`: Admin audit review page at `/audit-review` (stats, filterable list, review modal, Approve/Reject).
- `frontend/src/App.jsx`: `/audit` (WarehouseAudit) and `/audit-review` (AuditReview) lazy routes.
- `frontend/src/components/Layout.jsx`: `Inventory Audit` nav item (ClipboardCheck, STORE/STORE_EMPLOYEE) + `Audit Review` nav item (ClipboardCheck, SUPER_ADMIN/ADMIN).
- `frontend/src/pages/AdminDashboard.jsx`: `Inventory Audit` module card (`path: '/audit-review'` → navigate) in the module-card grid.
