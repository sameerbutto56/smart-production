const PRINT_CSS = `
  @page { size: A4; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    font-size: 11pt;
    line-height: 1.5;
    padding: 0;
  }
  .report-header {
    text-align: center;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .report-header h1 { font-size: 18pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .report-header p { font-size: 9pt; color: #555; margin-top: 4px; }
  .report-meta {
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #666;
    margin-bottom: 14px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 8.5pt;
  }
  th {
    background: #1a1a1a;
    color: #fff;
    padding: 7px 6px;
    text-align: left;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  td {
    padding: 5px 6px;
    border-bottom: 1px solid #ddd;
  }
  tr:nth-child(even) td { background: #f8f8f8; }
  .section-title {
    font-size: 11pt;
    font-weight: 800;
    margin: 18px 0 8px;
    text-transform: uppercase;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .summary-card {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
    text-align: center;
  }
  .summary-card .label { font-size: 6.5pt; text-transform: uppercase; color: #888; letter-spacing: 0.3px; }
  .summary-card .value { font-size: 13pt; font-weight: 800; margin-top: 2px; }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px dashed #ddd;
    font-size: 9pt;
  }
  .summary-row:last-child { border-bottom: none; }
  .footer {
    text-align: center;
    font-size: 7pt;
    color: #999;
    border-top: 1px solid #ddd;
    padding-top: 8px;
    margin-top: 20px;
  }
  .status-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 2px;
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
  }
  .status-ok { background: #d1fae5; color: #065f46; }
  .status-warn { background: #fef3c7; color: #92400e; }
  .status-bad { background: #fee2e2; color: #991b1b; }
  .status-info { background: #dbeafe; color: #1e40af; }
`;

export function openPrintWindow(title) {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body>`);
  win.document.write('<div class="report-header">');
  win.document.write(`<h1>${title}</h1>`);
  win.document.write(`<p>Enamels — Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>`);
  win.document.write('</div>');
  return win;
}

export function closePrintWindow(win) {
  win.document.write('<div class="footer">Enamels — This is a computer-generated report.</div>');
  win.document.write('</body></html>');
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

export function printAnalyticsReport(data, branch) {
  const branchLabel = branch === 'all' ? 'All Branches' : branch.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const title = `Analytics Report - ${branchLabel}`;
  const win = openPrintWindow(title);
  const s = data?.summary || {};
  const prod = data?.production || {};

  win.document.write('<div class="report-meta"><span>Enamels Industries</span><span>Branch: ' + branchLabel + '</span></div>');

  // Summary cards
  win.document.write('<div class="summary-grid">');
  win.document.write(kpiCard('Total Orders', s.totalOrders || 0));
  win.document.write(kpiCard('Total Revenue', currency(s.totalRevenue)));
  win.document.write(kpiCard('Gross Profit', currency(s.totalGrossProfit)));
  win.document.write(kpiCard('Net Profit', currency(s.totalNetProfit)));
  win.document.write(kpiCard('Items Produced', s.totalProduced || 0));
  win.document.write(kpiCard('Inventory Items', s.totalInventoryItems || 0));
  win.document.write(kpiCard('Dispatch Pending', s.dispatchPending || 0));
  win.document.write(kpiCard('Completed Orders', s.completedOrders || 0));
  win.document.write('</div>');

  // Stage counts table
  win.document.write('<div class="section-title">Orders by Stage</div>');
  win.document.write('<table><thead><tr><th>Stage</th><th style="text-align:right">Count</th></tr></thead><tbody>');
  Object.entries(data?.stageCounts || {}).forEach(([name, count]) => {
    win.document.write(`<tr><td>${name.replace(/_/g, ' ')}</td><td style="text-align:right;font-weight:700">${count}</td></tr>`);
  });
  win.document.write('</tbody></table>');

  // Production breakdown
  if (prod.byProduct?.length > 0) {
    win.document.write('<div class="section-title">Production by Product</div>');
    win.document.write('<table><thead><tr><th>Product</th><th style="text-align:right">Quantity</th><th style="text-align:right">Profit</th></tr></thead><tbody>');
    prod.byProduct.forEach(p => {
      win.document.write(`<tr><td>${p.productName || '—'}</td><td style="text-align:right">${p.quantity || 0} units</td><td style="text-align:right;font-weight:700">${currency(p.profit)}</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  // Profit summary
  win.document.write('<div class="section-title">Financial Summary</div>');
  win.document.write('<div style="max-width:400px">');
  win.document.write(summaryRow('Total Revenue', currency(s.totalRevenue)));
  win.document.write(summaryRow('Total Production Cost', currency(s.totalProductionCost)));
  win.document.write(summaryRow('Gross Profit', currency(s.totalGrossProfit)));
  win.document.write(summaryRow('Net Profit', currency(s.totalNetProfit)));
  win.document.write(summaryRow('Online Revenue', currency(s.onlineRevenue)));
  win.document.write(summaryRow('Outlet Revenue', currency(s.outletRevenue)));
  win.document.write('</div>');

  closePrintWindow(win);
}

export function printInventoryReport(items) {
  const title = 'Inventory Report';
  const win = openPrintWindow(title);

  win.document.write('<div class="report-meta"><span>Enamels Industries</span><span>Stock as of ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span></div>');

  const totalValue = items.reduce((s, i) => s + ((i.variants || []).reduce((sv, v) => sv + ((v.stock || 0) * (v.price || 0)), 0)), 0);
  const totalStock = items.reduce((s, i) => s + ((i.variants || []).reduce((sv, v) => sv + (v.stock || 0), 0)), 0);

  win.document.write('<div class="summary-grid">');
  win.document.write(kpiCard('Total Items', items.length));
  win.document.write(kpiCard('Total Stock Units', totalStock));
  win.document.write(kpiCard('Total Value', currency(totalValue)));
  win.document.write(kpiCard('Categories', [...new Set(items.map(i => i.category))].length));
  win.document.write('</div>');

  // Group by category
  const categories = [...new Set(items.map(i => i.category))].sort();
  categories.forEach(cat => {
    const catItems = items.filter(i => i.category === cat);
    win.document.write(`<div class="section-title">${cat} (${catItems.length} items)</div>`);
    win.document.write('<table><thead><tr><th>Product</th><th>Color</th><th>Size</th><th style="text-align:right">Stock</th><th style="text-align:right">Price</th><th style="text-align:right">Value</th><th>Status</th></tr></thead><tbody>');
    catItems.forEach(item => {
      const variants = item.variants && item.variants.length > 0 ? item.variants : [{ color: '—', size: '—', stock: 0, price: item.price || 0 }];
      variants.forEach(v => {
        const stock = v.stock || 0;
        const price = v.price || 0;
        const val = stock * price;
        let statusClass = 'status-ok';
        let statusText = 'In Stock';
        if (stock === 0) { statusClass = 'status-bad'; statusText = 'Out of Stock'; }
        else if (stock <= 5) { statusClass = 'status-warn'; statusText = 'Low Stock'; }
        win.document.write(`<tr><td style="font-weight:700">${item.name}</td><td>${v.color || '—'}</td><td>${v.size || '—'}</td><td style="text-align:right;font-weight:700">${stock}</td><td style="text-align:right">${currency(price)}</td><td style="text-align:right;font-weight:700">${currency(val)}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td></tr>`);
      });
    });
    win.document.write('</tbody></table>');
  });

  closePrintWindow(win);
}

export function printDeliveryReport(orders) {
  const title = 'Delivery Report';
  const win = openPrintWindow(title);

  const now = new Date();
  win.document.write('<div class="report-meta"><span>Enamels Industries</span><span>Report Date: ' + now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span></div>');

  const active = orders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && o.status !== 'COMPLETED');
  const completed = orders.filter(o => o.currentStage === 'DELIVERED' || o.status === 'COMPLETED');
  const pending = orders.filter(o => o.currentStage === 'OUT_FOR_DELIVERY' && o.status !== 'COMPLETED' && !o.riderAcceptedAt);

  win.document.write('<div class="summary-grid">');
  win.document.write(kpiCard('Total Orders', orders.length));
  win.document.write(kpiCard('Active', active.length));
  win.document.write(kpiCard('Completed', completed.length));
  win.document.write(kpiCard('Pending Accept', pending.length));
  win.document.write('</div>');

  // Active deliveries
  if (active.length > 0) {
    win.document.write('<div class="section-title">Active Deliveries</div>');
    win.document.write('<table><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Area</th><th>Method</th><th>Attempts</th></tr></thead><tbody>');
    active.forEach(o => {
      const attemptStr = o.noResponseCount ? `${o.noResponseCount}/3` : '0';
      const method = o.deliveryMethod || o.deliveryType || '—';
      win.document.write(`<tr><td style="font-weight:700">${o.orderNumber || o.id?.slice(0, 8)}</td><td>${o.customerName || '—'}</td><td>${o.customerPhone || '—'}</td><td style="text-align:right;font-weight:700">${currency(o.totalPrice)}</td><td>${o.outletName || '—'}</td><td>${method}</td><td style="text-align:center;font-weight:700">${attemptStr}</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  // Completed deliveries
  if (completed.length > 0) {
    win.document.write('<div class="section-title">Completed Deliveries</div>');
    win.document.write('<table><thead><tr><th>Order ID</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Delivered At</th><th>Method</th></tr></thead><tbody>');
    completed.forEach(o => {
      win.document.write(`<tr><td style="font-weight:700">${o.orderNumber || o.id?.slice(0, 8)}</td><td>${o.customerName || '—'}</td><td>${o.customerPhone || '—'}</td><td style="text-align:right;font-weight:700">${currency(o.totalPrice)}</td><td>${o.deliveredAt ? new Date(o.deliveredAt).toLocaleString() : '—'}</td><td>${o.deliveryMethod || o.deliveryType || '—'}</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  // Rider-wise summary
  const riderMap = {};
  (orders || []).forEach(o => {
    const attempts = o.deliveryAttempts || [];
    attempts.forEach(a => {
      if (a.riderName) {
        if (!riderMap[a.riderName]) riderMap[a.riderName] = { delivered: 0, noResponse: 0, total: 0 };
        riderMap[a.riderName].total++;
        if (a.status === 'DELIVERED') riderMap[a.riderName].delivered++;
        else if (a.status === 'NO_RESPONSE') riderMap[a.riderName].noResponse++;
      }
    });
  });

  if (Object.keys(riderMap).length > 0) {
    win.document.write('<div class="section-title">Rider Performance Summary</div>');
    win.document.write('<table><thead><tr><th>Rider</th><th style="text-align:right">Total Attempts</th><th style="text-align:right">Delivered</th><th style="text-align:right">No Response</th><th style="text-align:right">Success Rate</th></tr></thead><tbody>');
    Object.entries(riderMap).forEach(([name, stats]) => {
      const rate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
      win.document.write(`<tr><td style="font-weight:700">${name}</td><td style="text-align:right">${stats.total}</td><td style="text-align:right;color:#065f46;font-weight:700">${stats.delivered}</td><td style="text-align:right;color:#92400e">${stats.noResponse}</td><td style="text-align:right;font-weight:700">${rate}%</td></tr>`);
    });
    win.document.write('</tbody></table>');
  }

  closePrintWindow(win);
}

function kpiCard(label, value) {
  return `<div class="summary-card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function summaryRow(label, value) {
  return `<div class="summary-row"><span style="font-weight:600">${label}</span><span style="font-weight:800">${value}</span></div>`;
}

function currency(v) {
  return `₨${(v || 0).toLocaleString()}`;
}
