// Read-only convergence check: chip row counts (deliveryStatus) == summary card counts.
// Calls getDispatchDashboard with a mock req/res against the real Supabase DB, then
// re-classifies every trackingData row and asserts it matches the server's summary.

process.on('exit', () => { const open = process._getActiveHandles().filter(h => h.constructor && h.constructor.name === 'Socket'); if (open.length) console.log(`\n(socket handles left open: ${open.length} - prisma pool, not an error)`); });

(async () => {
  const ctrl = require('../src/controllers/dispatch-profile.controller.js');
  const { getDispatchDashboard } = ctrl;

  const buckets = ['pending', 'active', 'delivered', 'returned', 'rejected'];
  let failures = 0;
  let total = 0;

  // Mirror the exact classifyDelivery precedence from the controller.
  const classify = (o) => {
    if (o.status === 'REJECTED') return 'rejected';
    if (o.dispatchStatus === 'DELIVERED') return 'delivered';
    if (o.dispatchStatus === 'RETURNED') return 'returned';
    if (o.currentStage === 'OUT_FOR_DELIVERY') return 'active';
    if (o.currentStage === 'DISPATCH' && !o.dispatchStatus) return 'pending';
    if (o.dispatchStatus === 'PENDING' || o.dispatchStatus === 'COURIER_REQUIRED') return 'pending';
    return 'other';
  };

  const mkRes = () => {
    const responder = {
      json: (body) => { responder._body = body; },
      status: (code) => ({ json: (body) => { responder._body = body; responder._statusCode = code; } }),
      _body: null,
      _statusCode: 200
    };
    return responder;
  };

  const res = mkRes();
  await getDispatchDashboard({ query: {} }, res);

  const data = res._body;
  if (!data || !data.summary || !Array.isArray(data.trackingData)) {
    console.log(`FAIL: unexpected response shape (status=${res._statusCode})`);
    console.log(JSON.stringify(data));
    process.exit(2);
  }

  const summary = data.summary;
  const rows = data.trackingData;
  total = rows.length;

  // Reclassify rows using their own fields (proves deliveryStatus is consistent).
  const rowCounts = {};
  for (const r of rows) rowCounts[classify(r)] = (rowCounts[classify(r)] || 0) + 1;

  const otherInRows = rows.filter(r => r.deliveryStatus === 'other').length;
  const otherInSummary = summary.totalOrders - buckets.reduce((acc, b) => acc + summary[b], 0);

  console.log('=== order-level matcher ===');
  let rowsConsistent = 0, rowsMismatch = 0;
  for (const r of rows) {
    if (r.deliveryStatus === classify(r)) rowsConsistent++;
    else { rowsMismatch++; failures++; console.log(`  Mismatch: ${r.orderNumber} deliveryStatus=${r.deliveryStatus} expected=${classify(r)}`); }
  }
  console.log(`consistent rows: ${rowsConsistent}, mismatched: ${rowsMismatch}`);

  console.log('\n=== summary vs chip-row counts ===');
  for (const b of buckets) {
    const actual = rowCounts[b] || 0;
    const fromSummary = summary[b];
    const ok = actual === fromSummary;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${b.padEnd(9)} chipRows=${actual}  summary=${fromSummary}`);
  }
  const otherOk = otherInRows === otherInSummary;
  if (!otherOk) { failures++; console.log(`FAIL  other     chipRows=${otherInRows}  summary(other) = totalOther=${otherInSummary}`); }
  else console.log(`PASS  other     chipRows=${otherInRows}  summary(other) = totalOther=${otherInSummary}`);

  const totalsOk = summary.totalOrders === total;
  if (!totalsOk) { failures++; console.log(`FAIL  totalOrders=${summary.totalOrders} != trackingData rows=${total}`); }
  else console.log(`PASS  totalOrders=${summary.totalOrders} == trackingData rows=${total}`);

  // Disjointness: no row counted twice.
  const bucketSum = buckets.reduce((acc, b) => acc + (rowCounts[b] || 0), 0) + otherInRows;
  if (bucketSum !== total) { failures++; console.log(`FAIL  disjointness: buckets sum ${bucketSum} != ${total}`); }
  else console.log(`PASS  disjoint buckets sum to total (${bucketSum})`);

  console.log('\n=== sample rows (one per class) ===');
  for (const b of [...buckets, 'other']) {
    const sample = rows.find(r => r.deliveryStatus === b);
    console.log(`  ${b.padEnd(9)} ${sample ? `${sample.orderNumber} | stage=${sample.currentStage} | dStatus=${sample.dispatchStatus || '—'} | status=${sample.status}` : '(none)'}`);
  }

  console.log(`\nRESULT: ${failures === 0 ? 'ALL CONVERGED' : failures + ' FAILURES'} (${total} rows)`);
  process.exitCode = failures === 0 ? 0 : 1;
})();