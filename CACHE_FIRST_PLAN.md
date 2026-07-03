# Cache-First Architecture — Full Migration Plan

## Current State Summary
- **125 API endpoints**, 16 route files, 7 WebSocket events (all stubbed in production)
- **20+ pages** — 6 use centralized `api` service, 17 use raw `axios` with duplicate token extraction
- **Zero caching** outside POS localStorage (2 pages)
- **Heavy polling** on 7 pages (15s–120s intervals) as socket fallback
- **Socket stubbed in production** — all real-time events are no-ops

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer                          │
│  Pages → custom hooks → cache → optimistic update   │
├─────────────────────────────────────────────────────┤
│                  Data Access Layer                   │
│  useCache('orders')   useCache('inventory')         │
│  → IndexedDB (persist) → memory (hot)               │
├─────────────────────────────────────────────────────┤
│               Sync Engine (background)               │
│  Write Queue (IndexedDB) → Retry → Backend          │
│  WebSocket → Invalidate → Re-fetch delta            │
├─────────────────────────────────────────────────────┤
│                   Backend API                        │
│  125 endpoints + WebSocket broadcasts               │
└─────────────────────────────────────────────────────┘
```

---

## Phase 1 — Foundation (Estimated: 3–4 days)

### 1.1 Centralize API client
**Files affected:** `frontend/src/services/api.js`
**Changes:**
- Convert all 17 pages from raw `axios` to use the centralized `api` service
- Remove repeated `sessionStorage.getItem('token')` and `Authorization` header construction
- **Pages to migrate:** AllOrders, AdminDashboard, DeliveryDashboard, DeliverySheet, MyTasks, WarehouseDashboard, ProductionDashboard, UnifiedAnalytics, OutletStockRequest, History, ProgressChart, EditRequestDashboard, RefundManagement, InventoryManagement, DeletedOrders, ClientRegistration, AdminSettings

**Effort:** ~2 hours (find-and-replace pattern per page)

### 1.2 Fix WebSocket in production
**Files affected:** `frontend/src/socket.js`
**Changes:**
- Remove the stub that disables sockets on non-localhost
- Add proper production WebSocket connection (WSS)
- Add reconnection logic with exponential backoff
- **This is critical** — without it, real-time cache invalidation cannot work

**Effort:** ~1 hour

### 1.3 Standardize socket event payloads
**Files affected:** Backend controllers (all `io.emit` calls)
**Changes:**
- Every `order-updated` emit must include the full order object (not just `orderId`)
- Add event versioning: `event: 'order-updated', version: 2` so frontend can handle different shapes
- Document in a single source of truth (e.g., `backend/src/constants/socketEvents.js`)

**Effort:** ~2 hours (requires scanning all emit calls)

### 1.4 Create IndexedDB wrapper
**New file:** `frontend/src/utils/db.js`
**Changes:**
- Wrap `idb-keyval` or native IndexedDB in a Promise-based store
- Export `getItem(key)`, `setItem(key, value)`, `delItem(key)`, `keys()`
- Support TTL expiration per key

**Effort:** ~1 hour

### 1.5 Create cache hook (`useCache`)
**New file:** `frontend/src/hooks/useCache.js`
**Changes:**
```
useCache(key, { fetcher, ttl, staleWhileRevalidate })
  → returns { data, loading, error, refresh, mutate }
```
- Check memory cache first (instant)
- Fall back to IndexedDB (async, ~5ms)
- If stale or missing, call `fetcher` (API)
- Expose `mutate()` for optimistic updates
- Support `invalidate(key)` for cache busting

**Effort:** ~3 hours

### 1.6 Create sync queue
**New file:** `frontend/src/utils/syncQueue.js`
**Changes:**
- Persistent queue in IndexedDB: `{ id, entity, action, payload, timestamp, retries, status }`
- `enqueue(entity, action, payload)` → adds to queue, triggers process
- `processQueue()` → dequeue items, POST/PUT/DELETE to backend, mark synced
- Exponential backoff on failure (max 5 retries)
- Expose `useQueueStatus()` hook for UI (pending count, failed items)

**Effort:** ~3 hours

---

## Phase 2 — POS Module (First Cache-First Module) (Estimated: 2–3 days)

### 2.1 Barcode map preload
**New file:** `frontend/src/hooks/useBarcodeMap.js`
**Changes:**
- On login, fetch all barcode → product variant mappings
- Store in IndexedDB as `barcode_map: { [barcode]: variant }`
- `lookupBarcode(barcode)` → O(1) from IndexedDB, no API call
- Refresh in background (triggered by WebSocket `inventory-updated`)
- Remove existing barcode API lookup in OutletPOS.jsx

**Effort:** ~2 hours

### 2.2 Rewrite OutletPOS.jsx data layer
**Files affected:** `frontend/src/pages/OutletPOS.jsx`
**Changes:**
- All reads (`products`, `dashboard`, `sales`, `returns`) via `useCache`
- All writes (create sale, create return) via `syncQueue.enqueue()`
- Remove all ad-hoc `localStorage` management (7 keys)
- Cart state remains in-memory (hot), persisted to IndexedDB as draft
- Product catalog seeded from IndexedDB on mount, refreshed in background

**Effort:** ~4 hours

### 2.3 POS socket listener
**Files affected:** `frontend/src/pages/OutletPOS.jsx`
**Changes:**
- Listen for `inventory-updated` → invalidate `pos_products` cache
- Listen for `order-updated` → invalidate `pos_sales` cache if relevant
- No polling needed after this

**Effort:** ~1 hour

---

## Phase 3 — Order Module (Estimated: 3–4 days)

### 3.1 Cache order list
**Files affected:** `AllOrders.jsx`, `AdminDashboard.jsx`, `DeliveryDashboard.jsx`, `MyTasks.jsx`
**Changes:**
- Fetch order list once → store in IndexedDB as `orders:list`
- Filter/sort client-side from cache
- Background refresh on socket event
- Polling as last resort (60s, only if socket disconnected)

**Effort:** ~3 hours

### 3.2 Optimistic order mutations
**Files affected:** All pages with order mutations
**Changes:**
- Stage transitions: update cache immediately, enqueue to sync queue
- On socket confirmation, update cache with server response
- On failure, rollback cache entry to previous state
- **Key:** Mutations must be idempotent (retry-safe)

**Effort:** ~4 hours

### 3.3 Order detail cache
**Files affected:** `OrderCard.jsx` (155 kB), `OrderEntry.jsx` (148 kB)
**Changes:**
- Cache individual order details by ID: `orders:{id}`
- Cache inventory for OrderEntry: `inventory:list`
- Only re-fetch when socket indicates change

**Effort:** ~3 hours

---

## Phase 4 — Inventory + Production (Estimated: 2–3 days)

### 4.1 Inventory cache
**Files affected:** `InventoryManagement.jsx`, `WarehouseDashboard.jsx`, `OrderEntry.jsx`
**Changes:**
- `inventory:list` → cached in IndexedDB
- `inventory:search:{query}` → cached per query, TTL 60s
- Invalidate on `inventory-updated` socket event
- Remove 15s polling from InventoryManagement

**Effort:** ~2 hours

### 4.2 Production cache
**Files affected:** `ProductionDashboard.jsx`, `MyTasks.jsx`
**Changes:**
- `production:dashboard`, `production:records`, `production:inventory`
- All through `useCache` with 30s TTL (production data changes slower)
- Invalidate on stage transitions

**Effort:** ~2 hours

### 4.3 Allocation cache
**Files affected:** `WarehouseDashboard.jsx`
**Changes:**
- Cache allocations/carts
- Optimistic update on allocate → enqueue
- Invalidate on socket

**Effort:** ~1 hour

---

## Phase 5 — Transfers + Demand + Dispatch (Estimated: 2 days)

### 5.1 Transfer cache
**Files affected:** `OutletTransfers.jsx`
**Changes:**
- Replace ad-hoc localStorage with `useCache`
- `transfers:list` → IndexedDB, 60s TTL
- Products already cached from POS phase

**Effort:** ~1 hour

### 5.2 Demand request cache
**Files affected:** `OutletStockRequest.jsx`
**Changes:**
- `demand:requests`, `demand:inventory`
- Write demand requests optimistically (appear immediately in Store dashboard)
- Invalidate on `order-updated` / `inventory-updated`

**Effort:** ~1 hour

### 5.3 Dispatch cache
**Files affected:** `DispatchDashboard.jsx`
**Changes:**
- `dispatch:dashboard` → 30s TTL
- Optimistic status updates → enqueue

**Effort:** ~1 hour

---

## Phase 6 — Analytics + Admin (Estimated: 1–2 days)

### 6.1 Analytics cache
**Files affected:** `UnifiedAnalytics.jsx`, `AdminDashboard.jsx`
**Changes:**
- Analytics data is read-heavy, write-rare → cache with longer TTL (5 min)
- `analytics:source:{sourceId}` → cached per source
- On filter change, serve from cache if data covers filter range
- Only re-fetch when cache misses or explicitly refreshed

**Effort:** ~2 hours

### 6.2 Admin settings cache
**Files affected:** `AdminDashboard.jsx`, `AdminSettings.jsx`
**Changes:**
- `admin:pause-status`, `admin:deadline-config` → cache with 60s TTL
- These change via admin panel → invalidate on successful update

**Effort:** ~1 hour

---

## Phase 7 — Offline Support + Conflict Resolution (Estimated: 3–4 days)

### 7.1 Service worker
**New file:** `frontend/public/sw.js` (or use `vite-plugin-pwa`)
**Changes:**
- Cache API responses for offline read access
- Serve cached HTML/CSS/JS for app shell
- Network-first for API writes, cache-first for API reads

**Effort:** ~4 hours

### 7.2 Conflict resolution
**Files affected:** `frontend/src/utils/syncQueue.js`
**Changes:**
- Add `version` field to all cache entries
- On sync, send `expectedVersion` with request
- Backend returns `409 Conflict` if version mismatch
- On conflict: fetch fresh data, re-apply local change, retry
- Display conflict badge in UI for manual resolution

**Effort:** ~4 hours

### 7.3 Retry UI
**New component:** `frontend/src/components/SyncStatus.jsx`
**Changes:**
- Show pending sync count in footer
- Show failed items with retry button
- Network status indicator (online/offline/reconnecting)

**Effort:** ~2 hours

---

## Phase 8 — Migration of All Remaining Pages (Estimated: 3–4 days)

### 8.1 Remaining pages
**Pages to migrate:**
- DeliverySheet.jsx — cache order list, filter client-side
- History.jsx — cache completed orders, paginate from cache
- EditRequestDashboard.jsx — cache edit requests, optimistic approve/reject
- RefundManagement.jsx — cache refund queue
- ClientRegistration.jsx — cache clients, optimistic CRUD
- DeletedOrders.jsx — cache deleted list
- Login.jsx — no change needed
- ProgressChart.jsx — cache order data for chart

**Effort:** ~3 hours per 2 pages = ~12 hours

### 8.2 Remove polling
- After all pages use cache + socket, remove all `setInterval` polling
- Keep only a single health-check ping (30s) to detect reconnect

**Effort:** ~1 hour

---

## Total Effort Estimate

| Phase | Days | Key Deliverable |
|-------|------|-----------------|
| P1 Foundation | 3–4 | `useCache`, `syncQueue`, IndexedDB, fixed WebSocket |
| P2 POS | 2–3 | First cache-first module (POC) |
| P3 Orders | 3–4 | Orders, cards, stages |
| P4 Inventory+Prod | 2–3 | Inventory, production, allocations |
| P5 Transfers+Demand | 2 | Transfers, demand, dispatch |
| P6 Analytics+Admin | 1–2 | Analytics, settings |
| P7 Offline+Conflicts | 3–4 | Service worker, conflict resolution |
| P8 Remaining pages | 3–4 | All other pages, remove polling |
| **Total** | **19–26** | |

---

## Backend Changes Required

### B1. Batch endpoints
Add new endpoints for delta sync (fetch only records changed since timestamp):
```
GET /api/orders/sync?since=2026-07-01T00:00:00Z
GET /api/inventory/sync?since=...
GET /api/pos/products/sync?since=...
```
These return only records with `updatedAt > since`, dramatically reducing payloads.

### B2. Resource versioning
Add `version Int @default(1)` to Order, InventoryItem, Product models.
Increment on every update via Prisma middleware hook.
Return `ETag` / `version` in response headers.

### B3. Batch write endpoint
```
POST /api/sync/batch
```
Accepts array of operations `[{ entity, action, payload, clientTimestamp }]`, processes atomically, returns results. Reduces connection pool pressure by batching.

### B4. Socket room isolation
Scope socket broadcasts by outlet:
```
socket.join(`outlet:${user.outletName}`)
io.to(`outlet:Jail Road`).emit('order-updated', ...)
```
Prevents outlets from receiving irrelevant events.

### B5. Rate-limit write queue
Backend should reject excessive writes per user with `429 Too Many Requests` to prevent sync queue flooding.

---

## Dependency Graph

```
P1 Foundation
├── P2 POS (depends on useCache, syncQueue, fixed socket)
├── P3 Orders (depends on useCache, syncQueue, fixed socket)
├── P4 Inventory (depends on useCache, fixed socket)
├── P5 Transfers (depends on useCache)
│
P3 Orders
└── P4 Inventory (shares cache invalidation pattern)
│
P4 Inventory
└── P5 Transfers (depends on inventory cache)
│
P2 POS (independent, can run in parallel with P3–P5)
P6 Analytics (independent, can run in parallel)
P7 Offline (depends on P1 foundation)
P8 Migration (depends on P1–P6)
```

**Optimistic parallel track:**
- Track A: P2 POS (2–3 days)
- Track B: P3 Orders + P4 Inventory (5–7 days)
- Track C: P5 Transfers + P6 Analytics (3–4 days)
- All three can start after P1 Foundation

**Sequential track:**
- P7 Offline → P8 Migration (7–8 days, after Tracks A–C)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| IndexedDB size limit (5–10MB per origin) | Low | Medium | Use LRU eviction, separate stores per entity |
| Sync queue conflicts (two users edit same order) | Medium | High | Version stamps + conflict resolution UI |
| Socket disconnection in production | Medium | Medium | Polling fallback with exponential backoff |
| Migration regressions in 20+ pages | High | High | Beta flag to toggle cache on/off per module |
| Vercel 60s function timeout | Medium | Low | Batch endpoints process in <30s by design |
| IndexedDB not available (private browsing) | Low | Medium | Fall back to in-memory cache only |

---

## Migration Strategy

**Do not rewrite everything at once.** The migration uses a **side-by-side strategy:**

1. Add `useCache` hook — existing pages still use raw fetch
2. One page at a time: wrap its data layer with `useCache`
3. Keep old fetch code as fallback (guarded by `if (!cache.has(key))`)
4. Remove old fetch code once cache is verified stable
5. Each page has a toggle: `localStorage.setItem('cache:pos', 'off')` for rollback

**This means at any point, you can flip a page back to direct API calls without a deploy.**

---

## Recommended First Step

Start with **P1.1 (centralize API client)** + **P1.2 (fix WebSocket)** — these are quick wins that unblock everything else. Estimated 3 hours total, immediate benefit (17 pages stop duplicating token code, real-time events work in production).

Then **P2 POS** as the first cache-first POC — it has the most to gain (barcode scanning latency) and the narrowest scope (single page).
