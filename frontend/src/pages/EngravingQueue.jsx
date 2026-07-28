import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Scissors, CheckCircle, RefreshCcw, Printer, Play, Clock, User, Phone, MapPin } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { openPrintWindow, closePrintWindow } from '../utils/printReport';

export default function EngravingQueue() {
  const [pendingEngravings, setPendingEngravings] = useState([]);
  const [inProgressEngravings, setInProgressEngravings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchEngravings = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, inProgressRes] = await Promise.all([
        api.get('/api/engravings/logo-dept'),
        api.get('/api/engravings/logo-dept-completed')
      ]);
      setPendingEngravings(pendingRes.data);
      setInProgressEngravings(inProgressRes.data);
    } catch (e) {
      console.error('Fetch engravings error:', e);
      toast.error('Failed to load engravings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEngravings(); }, [fetchEngravings]);

  const handleAccept = async (id) => {
    setActionLoading(id + 'accept');
    try {
      await api.patch(`/api/engravings/${id}/accept`);
      toast.success('Engraving accepted');
      fetchEngravings();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to accept');
    } finally { setActionLoading(null); }
  };

  const handleComplete = async (id) => {
    setActionLoading(id + 'complete');
    try {
      await api.patch(`/api/engravings/${id}/complete`);
      toast.success('Engraving completed & sent back');
      fetchEngravings();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to complete');
    } finally { setActionLoading(null); }
  };

  const printEngravingSlip = (eng) => {
    let prods = [];
    try { prods = typeof eng.products === 'string' ? JSON.parse(eng.products) : (eng.products || []); } catch {}
    const win = openPrintWindow('Engraving Slip', false);
    win.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Engraving Slip</title><style>');
    win.document.write('@page{size:A4;margin:10mm}');
    win.document.write('body{font-family:"Courier New",monospace;font-size:14px;color:#000;margin:0;padding:0}');
    win.document.write('.header{text-align:center;border-bottom:3px solid #000;padding-bottom:10px;margin-bottom:12px}');
    win.document.write('.header h1{font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0}');
    win.document.write('.header .sub{font-size:16px;color:#555;margin-top:4px}');
    win.document.write('.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;border:2px solid #000;border-radius:8px;padding:12px;margin-bottom:12px}');
    win.document.write('.meta-grid .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dotted #ccc;font-size:14px}');
    win.document.write('.meta-grid .row:last-child{border-bottom:none}');
    win.document.write('.meta-grid .label{font-weight:700;color:#333;text-transform:uppercase;font-size:13px}');
    win.document.write('.meta-grid .value{font-weight:900;font-size:15px}');
    win.document.write('.products-section{margin:12px 0}');
    win.document.write('.products-section h2{font-size:18px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:10px}');
    win.document.write('.product-card{border:2px solid #000;border-radius:8px;padding:14px;margin-bottom:10px;page-break-inside:avoid}');
    win.document.write('.product-card h3{font-size:16px;font-weight:900;margin:0 0 8px 0;border-bottom:1px dashed #999;padding-bottom:4px}');
    win.document.write('.product-detail{display:flex;justify-content:space-between;font-size:14px;margin:3px 0;padding:2px 0}');
    win.document.write('.engraving-box{background:#fef8e7;border:2px solid #000;border-left:6px solid #e6a817;padding:10px 14px;margin-top:8px;border-radius:0 8px 8px 0}');
    win.document.write('.engraving-box .line{font-size:18px;font-weight:900;margin:4px 0;line-height:1.6}');
    win.document.write('.engraving-box .line-label{font-size:12px;color:#666;text-transform:uppercase;font-weight:700;margin-right:8px}');
    win.document.write('.logo-badge{display:inline-block;background:#1a5276;color:#fff;font-size:13px;font-weight:900;padding:4px 12px;border-radius:6px;margin-top:6px;text-transform:uppercase}');
    win.document.write('.footer{text-align:center;border-top:2px solid #000;padding-top:10px;margin-top:16px;font-size:12px;color:#666}');
    win.document.write('.footer p{margin:2px 0}');
    win.document.write('</style></head><body>');

    win.document.write('<div class="header">');
    win.document.write('<h1>ENGRAVING SLIP</h1>');
    win.document.write(`<p class="sub">#${eng.engravingNumber}${eng.orderNumber ? ' | Order #' + eng.orderNumber : ''}</p>`);
    win.document.write(`<p class="sub">Generated: ${new Date().toLocaleString()}</p>`);
    win.document.write('</div>');

    win.document.write('<div class="meta-grid">');
    win.document.write(`<div class="row"><span class="label">Engraving #</span><span class="value">${eng.engravingNumber}</span></div>`);
    if (eng.orderNumber) win.document.write(`<div class="row"><span class="label">Order #</span><span class="value">${eng.orderNumber}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Customer</span><span class="value">${eng.customerName || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Phone</span><span class="value">${eng.customerPhone || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Source</span><span class="value">${eng.outletName || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Status</span><span class="value">${eng.status === 'PENDING' ? 'PENDING' : 'IN PROGRESS'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Date</span><span class="value">${new Date().toLocaleDateString('en-GB')}</span></div>`);
    if (eng.acceptedBy?.name) win.document.write(`<div class="row"><span class="label">Accepted By</span><span class="value">${eng.acceptedBy.name}</span></div>`);
    win.document.write('</div>');

    win.document.write('<div class="products-section">');
    win.document.write(`<h2>Products (${prods.length})</h2>`);
    prods.forEach((p, i) => {
      win.document.write('<div class="product-card">');
      win.document.write(`<h3>${i + 1}. ${p.productName || 'N/A'}</h3>`);
      win.document.write(`<div class="product-detail"><span>Gender</span><span>${p.gender || 'N/A'}</span></div>`);
      win.document.write(`<div class="product-detail"><span>Quantity</span><span>${p.quantity || 1}</span></div>`);

      const hasEngraving = p.line1 || p.line2 || p.line3;
      if (hasEngraving) {
        win.document.write('<div class="engraving-box">');
        if (p.line1) win.document.write(`<div class="line"><span class="line-label">Line 1:</span>${p.line1}</div>`);
        if (p.line2) win.document.write(`<div class="line"><span class="line-label">Line 2:</span>${p.line2}</div>`);
        if (p.line3) win.document.write(`<div class="line"><span class="line-label">Line 3:</span>${p.line3}</div>`);
        win.document.write('</div>');
      }
      if (p.logoRequired) {
        win.document.write('<div class="logo-badge">★ LOGO REQUIRED</div>');
      }
      if (p.position) win.document.write(`<div class="product-detail"><span>Position</span><span>${p.position}</span></div>`);
      if (p.instructions) win.document.write(`<div class="product-detail"><span>Notes</span><span>${p.instructions}</span></div>`);
      win.document.write('</div>');
    });
    win.document.write('</div>');

    win.document.write(`<div class="footer"><p>Engraving #${eng.engravingNumber}</p><p>Printed: ${new Date().toLocaleString()}</p></div>`);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const renderCard = (eng, type) => {
    let prods = [];
    try { prods = typeof eng.products === 'string' ? JSON.parse(eng.products) : (eng.products || []); } catch {}
    return (
      <motion.div key={eng.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-6 space-y-4 border ${type === 'pending' ? 'bg-gray-900/80 border-cyan-500/20' : 'bg-gray-800/80 border-emerald-500/20'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-black text-white">{eng.engravingNumber}</p>
            {eng.orderNumber && <p className="text-xs text-gray-400 font-bold">Order: {eng.orderNumber}</p>}
            <p className="text-sm font-bold text-white flex items-center gap-1 mt-1">
              <User size={12} className="text-gray-500" /> {eng.customerName || 'N/A'}
              {eng.customerPhone && <span className="text-gray-400 font-normal flex items-center gap-1 ml-2"><Phone size={10} />{eng.customerPhone}</span>}
            </p>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {eng.outletName || 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${type === 'pending' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {type === 'pending' ? 'NEW' : 'IN PROGRESS'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {prods.map((p, i) => (
            <div key={i} className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-black text-white">{p.productName || 'N/A'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {p.gender || '—'} · Qty: {p.quantity || 1}
                  </p>
                </div>
                {p.logoRequired && (
                  <span className="text-[10px] font-black bg-cyan-600/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30 uppercase">★ Logo</span>
                )}
              </div>
              {p.line1 && <p className="text-xs font-bold text-cyan-300 mt-1.5"><span className="text-gray-500 font-normal">1:</span> {p.line1}</p>}
              {p.line2 && <p className="text-xs font-bold text-cyan-300 mt-0.5"><span className="text-gray-500 font-normal">2:</span> {p.line2}</p>}
              {p.line3 && <p className="text-xs font-bold text-cyan-300 mt-0.5"><span className="text-gray-500 font-normal">3:</span> {p.line3}</p>}
              {p.position && <p className="text-[11px] text-gray-400 mt-1">Position: {p.position}</p>}
              {p.instructions && <p className="text-[11px] text-gray-400 italic mt-0.5">{p.instructions}</p>}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock size={12} />
          {eng.createdAt && new Date(eng.createdAt).toLocaleDateString('en-PK')}
        </div>

        <div className="flex gap-2">
          <button onClick={() => printEngravingSlip(eng)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all">
            <Printer size={14} />Print Slip
          </button>
          {type === 'pending' ? (
            <button onClick={() => handleAccept(eng.id)} disabled={actionLoading === eng.id + 'accept'}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
              {actionLoading === eng.id + 'accept' ? <RefreshCcw className="animate-spin" size={14} /> : <Play size={14} />} Accept & Start
            </button>
          ) : (
            <button onClick={() => handleComplete(eng.id)} disabled={actionLoading === eng.id + 'complete'}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
              {actionLoading === eng.id + 'complete' ? <RefreshCcw className="animate-spin" size={14} /> : <CheckCircle size={14} />} Complete & Return
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/10 rounded-xl"><Scissors size={24} className="text-cyan-400" /></div>
            <div>
              <h1 className="text-2xl font-black text-white">Outlet Engraving</h1>
              <p className="text-sm text-gray-400">Engraving tasks from outlets</p>
            </div>
          </div>
          <button onClick={fetchEngravings} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700">
            <RefreshCcw size={16} className="text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-40" />)}
          </div>
        ) : (
          <>
            {/* Pending Engravings */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                <h2 className="text-lg font-black text-white">New ({pendingEngravings.length})</h2>
              </div>
              {pendingEngravings.length === 0 ? (
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
                  <CheckCircle className="mx-auto text-gray-600 mb-3" size={40} />
                  <p className="text-gray-500 font-bold text-sm">No pending engravings</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingEngravings.map(eng => renderCard(eng, 'pending'))}
                </div>
              )}
            </div>

            {/* In Progress */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-amber-400 rounded-full"></div>
                <h2 className="text-lg font-black text-white">In Progress ({inProgressEngravings.length})</h2>
              </div>
              {inProgressEngravings.length === 0 ? (
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-8 text-center">
                  <Clock className="mx-auto text-gray-600 mb-3" size={40} />
                  <p className="text-gray-500 font-bold text-sm">No in-progress engravings</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {inProgressEngravings.map(eng => renderCard(eng, 'inProgress'))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
