import { get, set, del, keys, createStore } from 'idb-keyval';
import api from '../services/api';

const store = createStore('enamels-sync', 'sync-queue');
const MAX_RETRIES = 5;
const INITIAL_BACKOFF = 1000;

let processing = false;

export async function enqueue(entity, action, payload, options = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    entity,
    action,
    payload,
    options,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };
  const entries = await get('queue', store) || [];
  entries.push(entry);
  await set('queue', entries, store);
  processQueue();
  return entry.id;
}

export async function getQueueStatus() {
  const entries = await get('queue', store) || [];
  return {
    pending: entries.filter(e => e.status === 'pending').length,
    failed: entries.filter(e => e.status === 'failed').length,
    total: entries.length,
    entries,
  };
}

export async function clearFailed() {
  const entries = await get('queue', store) || [];
  await set('queue', entries.filter(e => e.status !== 'failed'), store);
}

export async function retryFailed() {
  const entries = await get('queue', store) || [];
  for (const entry of entries) {
    if (entry.status === 'failed') {
      entry.status = 'pending';
      entry.retries = 0;
    }
  }
  await set('queue', entries, store);
  processQueue();
}

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    const entries = await get('queue', store) || [];
    const pending = entries.filter(e => e.status === 'pending');
    if (pending.length === 0) { processing = false; return; }

    for (const entry of pending) {
      try {
        await executeSync(entry);
        entry.status = 'synced';
        entry.syncedAt = Date.now();
      } catch (err) {
        entry.retries++;
        entry.lastError = err.message;
        if (entry.retries >= MAX_RETRIES) {
          entry.status = 'failed';
          console.error(`Sync failed for ${entry.entity}:${entry.action} after ${MAX_RETRIES} retries`, err);
        } else {
          entry.status = 'pending';
          entry.nextRetry = Date.now() + INITIAL_BACKOFF * Math.pow(2, entry.retries - 1);
        }
      }
      await set('queue', entries, store);
    }
  } finally {
    processing = false;
    // Schedule next pass if items remain
    const remaining = await get('queue', store) || [];
    if (remaining.some(e => e.status === 'pending')) {
      const nextPending = remaining.filter(e => e.status === 'pending' && (!e.nextRetry || e.nextRetry <= Date.now()));
      if (nextPending.length > 0) {
        setTimeout(processQueue, 500);
      } else {
        const soonest = Math.min(...remaining.filter(e => e.status === 'pending' && e.nextRetry).map(e => e.nextRetry));
        if (soonest && soonest > Date.now()) {
          setTimeout(processQueue, Math.min(soonest - Date.now(), 30000));
        }
      }
    }
  }
}

async function executeSync(entry) {
  const { entity, action, payload, options } = entry;
  const method = action === 'create' ? 'post' : action === 'update' ? 'put' : action === 'delete' ? 'delete' : 'patch';
  const url = options.url || buildUrl(entity, payload);
  await api[method](url, action !== 'delete' ? payload : undefined);
}

function buildUrl(entity, payload) {
  const id = payload?.id || payload?._id;
  const base = entity === 'order' ? '/api/orders'
    : entity === 'inventory' ? '/api/inventory'
    : entity === 'product' ? '/api/pos/products'
    : entity === 'variant' ? '/api/pos/variants'
    : entity === 'sale' ? '/api/pos/sales'
    : entity === 'return' ? '/api/pos/returns'
    : entity === 'transfer' ? '/api/transfers'
    : entity === 'demand' ? '/api/demand'
    : entity === 'client' ? '/api/clients'
    : `/api/${entity}`;
  return id ? `${base}/${id}` : base;
}
