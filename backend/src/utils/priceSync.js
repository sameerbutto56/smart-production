const prisma = require('../prisma');

// Resolve the price that should apply to an outlet/store row that maps back to a
// warehouse `InventoryItem`. The warehouse (InventoryItem) is the SINGLE MASTER
// price source. If the product is variant-based, the matching variant's price
// wins; otherwise the item's top-level price. Returns a valid, positive price,
// or null when no trustworthy source exists (callers must NOT write null/0 over
// an already-valid price in that case).
const resolveMasterPrice = (invItem, color, size) => {
  if (!invItem) return null;
  const variants = Array.isArray(invItem.variants) ? invItem.variants : [];
  if (variants.length > 0) {
    const match = variants.find(v => {
      const mc = !color || !v.color || String(v.color).toLowerCase() === String(color).toLowerCase();
      const ms = !size || !v.size || String(v.size).toLowerCase() === String(size).toLowerCase();
      return mc && ms;
    });
    const price = match ? parseFloat(match.price) : NaN;
    if (!Number.isNaN(price) && price > 0) return price;
    // Fall back to top-level price if the specific variant has no price
  }
  const top = parseFloat(invItem.price);
  if (!Number.isNaN(top) && top > 0) return top;
  return null;
};

// Parse an OutletInventory.metadata JSON string into an object.
const parseMetadata = (row) => {
  if (!row || !row.metadata) return {};
  try {
    if (typeof row.metadata === 'object' && row.metadata !== null) return row.metadata;
    return JSON.parse(row.metadata);
  } catch (e) {
    return {};
  }
};

// Match an OutletInventory row (or accept item) back to its warehouse InventoryItem.
// Priority: metadata.sourceStoreItemId -> metadata.sourceInventoryItemId -> barcode
// (derived from the store item id) -> name+category+color+size fallback.
const findWarehouseMaster = async (tx, { name, category, color, size, metadata, barcode }) => {
  const meta = parseMetadata({ metadata: metadata || null });
  const storeId = meta?.sourceStoreItemId || meta?.sourceInventoryItemId;
  if (storeId) {
    const byId = await tx.inventoryItem.findUnique({ where: { id: storeId } });
    if (byId) return byId;
  }
  if (barcode) {
    // Barcodes are derived from the store item id with the same generateBarcode
    // algorithm; the id portion can't be reversed, so a barcode alone can't map
    // back reliably. Skip it here — name+category fallback is safer.
  }
  if (name) {
    const candidates = await tx.inventoryItem.findMany({
      where: { name: { equals: name, mode: 'insensitive' } }
    });
    if (category) {
      const byCat = candidates.find(c => c.category && String(c.category).toLowerCase() === String(category).toLowerCase());
      if (byCat) return byCat;
    }
    if (candidates.length > 0) return candidates[0];
  }
  return null;
};

// Sync ONE outlet/store row's price to its warehouse master — price ONLY, never
// quantity. Returns { synced, before, after }. Skips when no master found or no
// valid master price exists (never overwrites a valid row price with null/0).
const syncOnePrice = async (tx, outletRow) => {
  const master = await findWarehouseMaster(tx, {
    name: outletRow.name,
    category: outletRow.category,
    color: outletRow.color,
    size: outletRow.size,
    metadata: outletRow.metadata,
    barcode: outletRow.barcode
  });
  const target = resolveMasterPrice(master, outletRow.color, outletRow.size);
  if (target == null) return { synced: false, reason: 'NO_MASTER_PRICE' };
  const current = parseFloat(outletRow.price);
  if (current === target) return { synced: false, reason: 'UNCHANGED' };
  await tx.outletInventory.update({
    where: { id: outletRow.id },
    data: { price: target, updatedAt: new Date() }
  });
  return { synced: true, before: current, after: target };
};

// Sync the price of EVERY outlet store row (OutletInventory across all outlets)
// whose warehouse master is the given InventoryItem id. Uses a transaction client
// `tx` when provided (defaults to prisma). Returns summary counts.
//
// PERFORMANCE: saving a common warehouse item (e.g. "Sprinter Men" → 340 outlet
// rows) iterating rows ONE BY ONE with two sequential pooler round trips each
// (a master re-query + an update) exceeded the 30s request timeout. The master is
// already in scope here, so:
//   - the redundant per-row `findWarehouseMaster` re-query is gone (target prices
//     are resolved from the in-scope `master` with `resolveMasterPrice`), and
//   - the row updates run CONCURRENTLY (bounded chunk), not serially.
// The whole pass now completes in a handful of parallel round trips regardless of
// row count.
const syncPricesForWarehouseItem = async (inventoryItemId, tx) => {
  const db = tx || prisma;
  const master = await db.inventoryItem.findUnique({ where: { id: inventoryItemId } });
  if (!master) return { matched: 0, changed: 0 };

  // Metadata is stored as a JSON *string*, so a text `contains` search can't
  // reliably match it (the quotes are backslash-escaped in the stored text).
  // Instead pre-filter by the product NAME (the canonical identity), then narrow
  // in JS by strict metadata-id match — with a same-name fallback for legacy rows
  // that carry no metadata at all.
  const orgRows = await db.outletInventory.findMany({
    where: { name: { equals: master.name, mode: 'insensitive' } },
    select: { id: true, name: true, category: true, color: true, size: true, price: true, metadata: true, barcode: true }
  });

  const rows = orgRows.filter(r => {
    const meta = parseMetadata(r);
    const metaId = meta?.sourceStoreItemId || meta?.sourceInventoryItemId;
    if (metaId) return metaId === inventoryItemId;
    // No metadata on the row — same product name is treated as sourced from this
    // master (same-name rows are the same product). Rows with a DIFFERENT
    // metadata id are explicitly excluded so we never misprice them.
    return true;
  });

  // Compute every target price up front (pure JS, no extra queries).
  const targets = rows.map(row => ({
    ...row,
    target: resolveMasterPrice(master, row.color, row.size)
  }));

  let changed = 0;
  const CHUNK = 50;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async (row) => {
      if (row.target == null) return; // no trustworthy master price — leave row alone
      const current = parseFloat(row.price);
      if (current === row.target) return; // unchanged
      await db.outletInventory.update({
        where: { id: row.id },
        data: { price: row.target, updatedAt: new Date() }
      });
      changed++;
    }));
  }
  return { matched: rows.length, changed };
};

module.exports = {
  resolveMasterPrice,
  syncOnePrice,
  syncPricesForWarehouseItem,
  findWarehouseMaster,
  parseMetadata
};
