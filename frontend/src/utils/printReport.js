const PRINT_CSS = `
  @page { size: A4; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    font-size: 13pt;
    line-height: 1.6;
    padding: 0;
  }
  .report-header {
    text-align: center;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .report-header h1 { font-size: 22pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .report-header p { font-size: 10pt; color: #555; margin-top: 4px; }
  .report-meta {
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    color: #666;
    margin-bottom: 14px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 10pt;
  }
  th {
    background: #1a1a1a;
    color: #fff;
    padding: 8px 8px;
    text-align: left;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  td {
    padding: 7px 8px;
    border-bottom: 1px solid #ddd;
  }
  tr:nth-child(even) td { background: #f8f8f8; }
  .section-title {
    font-size: 13pt;
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
  .summary-card .label { font-size: 7pt; text-transform: uppercase; color: #888; letter-spacing: 0.3px; }
  .summary-card .value { font-size: 15pt; font-weight: 800; margin-top: 2px; }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px dashed #ddd;
    font-size: 10pt;
  }
  .summary-row:last-child { border-bottom: none; }
  .footer {
    text-align: center;
    font-size: 8pt;
    color: #999;
    border-top: 1px solid #ddd;
    padding-top: 8px;
    margin-top: 20px;
  }
  .status-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 2px;
    font-size: 8pt;
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

function parseJSON(data) {
  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return {}; }
}

export function printJobSheet(order, userRole) {
  const showPrice = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
  const priceDisplay = (v) => showPrice ? currency(v) : '★ ★ ★';

  const title = `Job Sheet — ${order.orderNumber || order.id?.slice(0, 8)}`;
  const win = openPrintWindow(title);

  const rawPd = parseJSON(order.productDetails);
  const allItems = Array.isArray(rawPd) ? rawPd : null;
  const isMultiItem = allItems && allItems.length > 0;
  const firstProduct = isMultiItem ? (allItems[0]?.productDetails || allItems[0] || {}) : (rawPd || {});
  const custom = parseJSON(order.customization);
  const rawSizes = parseJSON(order.sizeData);
  const sizes = (rawSizes && Object.keys(rawSizes).length > 0) ? rawSizes : ({});

  win.document.write('<div class="report-meta"><span>Enamels Industries</span><span>' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</span></div>');

  // Order info
  win.document.write('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:2px solid #1a1a1a;padding-bottom:10px">');
  win.document.write('<div><h1 style="font-size:22pt;font-weight:900;text-transform:uppercase;letter-spacing:-0.5px">Job Sheet</h1>');
  win.document.write('<p style="font-size:9pt;color:#555;margin-top:2px">Order #' + (order.orderNumber || order.id?.slice(0, 8)) + '</p></div>');
  win.document.write('<div style="text-align:right"><p style="font-size:11pt;font-weight:800">' + (order.customerName || '—') + '</p>');
  win.document.write('<p style="font-size:8pt;color:#666">' + (order.customerPhone || '') + '</p>');
  if (order.address) win.document.write('<p style="font-size:8pt;color:#666">' + order.address + '</p>');
  if (order.city) win.document.write('<p style="font-size:8pt;color:#666">' + order.city + '</p>');
  win.document.write('</div></div>');

  // Order meta badges
  win.document.write('<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">');
  [order.type, order.priority, order.outletName || order.source, order.paymentStatus === 'PAID' ? 'PAID' : (order.advancePaid ? 'ADVANCE' : 'PENDING')].filter(Boolean).forEach(label => {
    let color = '#6b7280';
    if (label === 'PAID' || label === 'FULL_CUSTOM') color = '#059669';
    else if (label === 'SUPER_URGENT') color = '#dc2626';
    else if (label === 'URGENT') color = '#d97706';
    else if (label === 'OUTLET') color = '#7c3aed';
    win.document.write('<span style="padding:2px 12px;border-radius:4px;font-size:7.5pt;font-weight:700;text-transform:uppercase;background:' + color + '20;color:' + color + ';border:1px solid ' + color + '40">' + label + '</span>');
  });
  win.document.write('</div>');

  // Instruction Notes
  if (order.instructionNotes) {
    win.document.write('<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:10px;margin-bottom:14px;page-break-inside:avoid">');
    win.document.write('<p style="font-size:7.5pt;font-weight:800;text-transform:uppercase;color:#d97706;margin-bottom:4px">📋 Instruction Notes</p>');
    win.document.write('<p style="font-size:9pt;font-weight:600;color:#92400e">' + order.instructionNotes + '</p></div>');
  }

  // Products table
  win.document.write('<div class="section-title">Products</div>');
  if (isMultiItem) {
    win.document.write('<table><thead><tr><th>#</th><th>Product</th><th>Fabric & Color</th><th>Size & Gender</th><th style="text-align:center">Qty</th><th style="text-align:center">Cap</th><th style="text-align:right">Price</th></tr></thead><tbody>');
    allItems.forEach((item, idx) => {
      const p = item.productDetails || {};
      const capQty = p.matchingCap ? (p.matchingCapQty || 0) : (item.capCharges > 0 ? (p.femaleOptions?.cap || 0) : 0);
      win.document.write('<tr>');
      win.document.write('<td style="font-weight:700">' + (idx + 1) + '</td>');
      win.document.write('<td style="font-weight:700">' + (p.productType || '—') + '</td>');
      win.document.write('<td>' + [p.fabricType, p.color].filter(Boolean).join(' • ') + '</td>');
      const extras = [p.sleeveLength ? 'Slv:' + p.sleeveLength : null, p.shirtLength ? 'Len:' + p.shirtLength : null].filter(Boolean).join(' | ');
      win.document.write('<td>' + (p.size || 'Custom') + ' • ' + (p.gender || 'MALE') + (extras ? '<br><span style="font-size:7pt;color:#db2777;font-weight:700">' + extras + '</span>' : '') + '</td>');
      win.document.write('<td style="text-align:center;font-weight:700">' + (item.quantity || 1) + '</td>');
      win.document.write('<td style="text-align:center;font-weight:700;color:#e11d48">' + (capQty || '—') + '</td>');
      win.document.write('<td style="text-align:right;font-weight:700">' + priceDisplay(item.totalPrice) + '</td>');
      win.document.write('</tr>');
    });
    win.document.write('</tbody></table>');
  } else {
    const capQty = firstProduct.matchingCap ? (firstProduct.matchingCapQty || 0) : 0;
    win.document.write('<table><thead><tr><th>Product</th><th>Fabric</th><th>Color</th><th>Size</th><th>Gender</th><th style="text-align:center">Qty</th><th style="text-align:center">Cap</th><th style="text-align:right">Price</th></tr></thead><tbody>');
    win.document.write('<tr>');
    win.document.write('<td style="font-weight:700">' + (firstProduct.productType || '—') + '</td>');
    win.document.write('<td>' + (firstProduct.fabricType || '—') + '</td>');
    win.document.write('<td>' + (firstProduct.color || '—') + '</td>');
    const extras = [firstProduct.sleeveLength ? 'Slv:' + firstProduct.sleeveLength : null, firstProduct.shirtLength ? 'Len:' + firstProduct.shirtLength : null].filter(Boolean).join(' | ');
    win.document.write('<td>' + (firstProduct.size || 'Custom') + '</td>');
    win.document.write('<td>' + (firstProduct.gender || 'MALE') + (extras ? '<br><span style="font-size:7pt;color:#db2777;font-weight:700">' + extras + '</span>' : '') + '</td>');
    win.document.write('<td style="text-align:center;font-weight:700">' + (order.quantity || 1) + '</td>');
    win.document.write('<td style="text-align:center;font-weight:700;color:#e11d48">' + (capQty || '—') + '</td>');
    win.document.write('<td style="text-align:right;font-weight:700">' + priceDisplay(order.totalPrice) + '</td>');
    win.document.write('</tr></tbody></table>');
  }

  // Per-product branding
  win.document.write('<div class="section-title">Branding & Customization</div>');
  const brandingItems = isMultiItem ? allItems : [{ productDetails: firstProduct, customization: custom }];
  brandingItems.forEach((item, idx) => {
    const p = item.productDetails || {};
    const c = item.customization ? parseJSON(item.customization) : custom;
    const hasNames = c?.articleNames?.length > 0 || c?.nameSpelling;
    const hasLogos = c?.logos?.length > 0;
    const hasSpecs = c?.stitchingStyle || c?.fitType || c?.nameColor || c?.logoPlacement;
    const hasNotes = c?.designNotes;

    if (!hasNames && !hasLogos && !hasSpecs && !hasNotes) return;

    win.document.write('<div style="border:1px solid #ddd;border-radius:4px;padding:10px;margin-bottom:10px;page-break-inside:avoid">');
    win.document.write('<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #eee">');
    win.document.write('<span style="background:#1a1a1a;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9pt;font-weight:800">' + (idx + 1) + '</span>');
    win.document.write('<span style="font-weight:800;font-size:10pt;text-transform:uppercase">' + (p.productType || 'Item ' + (idx + 1)) + '</span>');
    if (p.color) win.document.write('<span style="font-size:8pt;color:#888">(' + p.color + ')</span>');
    win.document.write('</div>');

    // Name lines
    if (hasNames) {
      win.document.write('<div style="margin-bottom:6px">');
      win.document.write('<p style="font-size:7.5pt;font-weight:800;text-transform:uppercase;color:#7c3aed;margin-bottom:3px">Name Lines</p>');
      if (c.articleNames?.length > 0) {
        c.articleNames.forEach((an, ai) => {
          win.document.write('<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="background:#7c3aed20;color:#7c3aed;font-size:7pt;font-weight:800;padding:0 6px;border-radius:2px">L' + (ai + 1) + '</span><span style="font-size:10pt;font-weight:700">' + an + '</span></div>');
        });
      } else {
        win.document.write('<div style="display:flex;align-items:center;gap:6px"><span style="background:#7c3aed20;color:#7c3aed;font-size:7pt;font-weight:800;padding:0 6px;border-radius:2px">L1</span><span style="font-size:10pt;font-weight:700">' + c.nameSpelling + '</span></div>');
      }
      win.document.write('</div>');
    }

    // Branding specs
    if (hasSpecs) {
      win.document.write('<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">');
      if (c.stitchingStyle) win.document.write('<span style="font-size:7.5pt;font-weight:700;padding:1px 8px;border-radius:2px;background:#dbeafe;color:#1e40af">' + (c.stitchingStyle === 'DBL' ? 'Double Stitch' : 'Single Stitch') + '</span>');
      if (c.fitType) win.document.write('<span style="font-size:7.5pt;font-weight:700;padding:1px 8px;border-radius:2px;background:#e0e7ff;color:#3730a3">' + c.fitType + ' Fit</span>');
      if (c.nameColor) win.document.write('<span style="font-size:7.5pt;font-weight:700;padding:1px 8px;border-radius:2px;background:#fce7f3;color:#9d174d">Color: ' + c.nameColor + '</span>');
      if (c.logoPlacement) win.document.write('<span style="font-size:7.5pt;font-weight:700;padding:1px 8px;border-radius:2px;background:#ccfbf1;color:#0f766e">Pos: ' + c.logoPlacement + '</span>');
      if (c.logoColor) win.document.write('<span style="font-size:7.5pt;font-weight:700;padding:1px 8px;border-radius:2px;background:#fef3c7;color:#92400e">Logo: ' + c.logoColor + '</span>');
      win.document.write('</div>');
    }

    // Logos
    if (hasLogos) {
      win.document.write('<div style="margin-bottom:6px">');
      win.document.write('<p style="font-size:7.5pt;font-weight:800;text-transform:uppercase;color:#d97706;margin-bottom:3px">Logos</p>');
      c.logos.forEach((l, li) => {
        win.document.write('<div style="font-size:9pt;font-weight:600;background:#fffbeb;padding:3px 8px;border-radius:2px;margin-bottom:2px;border:1px solid #fef3c7">' + (l.name || 'Logo ' + (li + 1)) + (l.design ? ' — ' + l.design : '') + '</div>');
      });
      win.document.write('</div>');
    }

    // Special notes
    if (hasNotes) {
      win.document.write('<div style="background:#fffbeb;border-left:3px solid #d97706;padding:6px 10px;border-radius:2px">');
      win.document.write('<p style="font-size:7.5pt;font-weight:800;text-transform:uppercase;color:#d97706;margin-bottom:2px">Special Note</p>');
      win.document.write('<p style="font-size:9pt;font-style:italic;color:#92400e">' + c.designNotes + '</p></div>');
    }

    // Sleeve / Shirt Length
    const slv = p.sleeveLength || (p.gender === 'Female' && p.femaleOptions?.sleeves ? p.femaleOptions.sleeves : null);
    const slen = p.shirtLength || (p.gender === 'Female' && p.femaleOptions?.shirtLength ? p.femaleOptions.shirtLength : null);
    const femaleOpts = [slv ? 'Sleeves: ' + slv : null, slen ? 'Length: ' + slen : null, (p.gender === 'Female' && p.femaleOptions?.dupatta) ? 'Dupatta' : null].filter(Boolean);
    if (femaleOpts.length > 0) {
      win.document.write('<p style="font-size:7.5pt;margin-top:4px;color:#db2777;font-weight:700">' + femaleOpts.join(' | ') + '</p>');
    }

    // Matching Cap
    const capQty = p.matchingCap ? (p.matchingCapQty || 0) : 0;
    if (capQty > 0) {
      win.document.write('<p style="font-size:7.5pt;margin-top:4px;color:#e11d48;font-weight:700">Matching Cap ×' + capQty + '</p>');
    }

    win.document.write('</div>');
  });

  // Measurements
  const measItems = isMultiItem ? allItems : [{ productDetails: firstProduct, sizeData: sizes }];
  const hasAnyMeas = measItems.some(item => {
    const s = item.sizeData || {};
    return Object.values(s).some(v => v);
  });
  if (hasAnyMeas) {
    win.document.write('<div class="section-title">Measurements (inches)</div>');
    measItems.forEach((item, idx) => {
      const p = item.productDetails || {};
      const s = item.sizeData || {};
      const meas = Object.entries(s).filter(([_, v]) => v);
      if (meas.length === 0) return;
      win.document.write('<div style="margin-bottom:8px;page-break-inside:avoid">');
      if (isMultiItem) {
        win.document.write('<p style="font-size:7.5pt;font-weight:800;text-transform:uppercase;color:#1e40af;margin-bottom:3px">#' + (idx + 1) + ' ' + (p.productType || '') + '</p>');
      }
      win.document.write('<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px">');
      meas.forEach(([k, v]) => {
        win.document.write('<div style="text-align:center;border:1px solid #ddd;border-radius:3px;padding:4px"><p style="font-size:6pt;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:1px">' + k.replace(/([A-Z])/g, ' $1') + '</p><p style="font-size:11pt;font-weight:800">' + v + '"</p></div>');
      });
      win.document.write('</div></div>');
    });
  }

  // Production timeline
  const pipelines = {
    'STANDARD': ['ORDER_ENTRY', 'STORE', 'DISPATCH', 'OUT_FOR_DELIVERY'],
    'READY_LOGO': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY'],
    'FULL_CUSTOM': ['ORDER_ENTRY', 'STORE', 'LOGO_DESIGN', 'PRODUCTION', 'STORE_RECEIVE', 'DISPATCH', 'OUT_FOR_DELIVERY']
  };
  const pipeline = pipelines[order.type] || pipelines['STANDARD'];
  win.document.write('<div class="section-title">Production Timeline (' + pipeline.length + ' Steps)</div>');
  win.document.write('<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-bottom:14px">');
  pipeline.forEach((stageName, i) => {
    const stageData = order.stages?.find(s => s.stageName === stageName);
    const isCompleted = stageData?.status === 'COMPLETED';
    const isCurrent = order.currentStage === stageName;
    const bgColor = isCompleted ? '#d1fae5' : isCurrent ? '#dbeafe' : '#f3f4f6';
    const textColor = isCompleted ? '#065f46' : isCurrent ? '#1e40af' : '#6b7280';
    const borderColor = isCompleted ? '#a7f3d0' : isCurrent ? '#93c5fd' : '#e5e7eb';
    win.document.write('<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:4px;background:' + bgColor + ';border:1px solid ' + borderColor + '">');
    win.document.write('<span style="width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8pt;font-weight:800;background:' + textColor + ';color:#fff">' + (i + 1) + '</span>');
    win.document.write('<span style="font-size:8pt;font-weight:' + (isCurrent ? '800' : '600') + ';color:' + textColor + ';text-transform:uppercase">' + stageName.replace(/_/g, ' ') + '</span>');
    if (isCompleted && stageData?.completedAt) {
      win.document.write('<span style="font-size:6.5pt;color:' + textColor + ';margin-left:auto;opacity:0.7">' + new Date(stageData.completedAt).toLocaleDateString() + '</span>');
    }
    win.document.write('</div>');
  });
  win.document.write('</div>');

  // Footer
  win.document.write('<div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#999;border-top:1px solid #ddd;padding-top:8px;margin-top:12px">');
  win.document.write('<span>Created: ' + new Date(order.createdAt).toLocaleDateString() + '</span>');
  win.document.write('<span>Stage: ' + order.currentStage + '</span>');
  win.document.write('</div>');

  closePrintWindow(win);
}
