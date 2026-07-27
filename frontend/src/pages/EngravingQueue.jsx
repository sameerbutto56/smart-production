import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Scissors, CheckCircle, RefreshCcw, Printer, Play, Clock } from 'lucide-react';
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
    win.document.write('<style>');
    win.document.write('@page { size: 80mm auto; margin: 2mm; }');
    win.document.write('body { font-family: "Courier New", monospace; font-size: 12px; margin: 0; padding: 4px; color: #000; }');
    win.document.write('.header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }');
    win.document.write('.header h2 { font-size: 14px; margin: 0; text-transform: uppercase; }');
    win.document.write('.row { display: flex; justify-content: space-between; margin: 2px 0; }');
    win.document.write('.label { font-weight: bold; }');
    win.document.write('.product { border: 1px solid #000; padding: 4px; margin: 4px 0; }');
    win.document.write('.product-name { font-weight: bold; font-size: 12px; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 2px; }');
    win.document.write('.detail { font-size: 11px; margin: 1px 0; }');
    win.document.write('.footer { text-align: center; border-top: 2px solid #000; padding-top: 4px; margin-top: 6px; font-size: 10px; }');
    win.document.write('</style>');

    win.document.write('<div class="header"><h2>ENGRAVING SLIP</h2></div>');
    win.document.write(`<div class="row"><span class="label">Engraving #:</span><span>${eng.engravingNumber}</span></div>`);
    if (eng.orderNumber) win.document.write(`<div class="row"><span class="label">Order #:</span><span>${eng.orderNumber}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Customer:</span><span>${eng.customerName || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Source:</span><span>${eng.outletName || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Date:</span><span>${new Date().toLocaleDateString('en-GB')}</span></div>`);
    win.document.write('<div style="border-top: 1px dashed #000; margin: 6px 0;"></div>');

    prods.forEach((p, i) => {
      win.document.write('<div class="product">');
      win.document.write(`<div class="product-name">${i + 1}. ${p.productName}${p.color ? ' — ' + p.color : ''}${p.size ? ' (' + p.size + ')' : ''} × ${p.quantity}</div>`);
      if (p.position) win.document.write(`<div class="detail">Position: ${p.position}</div>`);
      if (p.engravingText) win.document.write(`<div class="detail">Text: ${p.engravingText}</div>`);
      if (p.threadColor) win.document.write(`<div class="detail">Thread Color: ${p.threadColor}</div>`);
      if (p.instructions) win.document.write(`<div class="detail">Instructions: ${p.instructions}</div>`);
      win.document.write('</div>');
    });

    win.document.write('<div class="footer">');
    win.document.write(`<p>Generated: ${new Date().toLocaleString()}</p>`);
    win.document.write('</div>');
    closePrintWindow(win);
  };

  const renderCard = (eng, type) => {
    let prods = [];
    try { prods = typeof eng.products === 'string' ? JSON.parse(eng.products) : (eng.products || []); } catch {}
    return (
      <motion.div key={eng.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-6 space-y-3 border ${type === 'pending' ? 'bg-gray-900/80 border-cyan-500/20' : 'bg-gray-800/80 border-emerald-500/20'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-black text-white">{eng.engravingNumber}</p>
            {eng.orderNumber && <p className="text-xs text-gray-400">Order: {eng.orderNumber}</p>}
            <p className="text-sm text-gray-400">{eng.customerName || 'N/A'} {eng.customerPhone ? `— ${eng.customerPhone}` : ''}</p>
            <p className="text-xs text-gray-500">Outlet: {eng.outletName || 'N/A'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${type === 'pending' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {type === 'pending' ? 'NEW' : 'IN PROGRESS'}
            </span>
          </div>
        </div>

        {prods.map((p, i) => (
          <div key={i} className="bg-gray-900 rounded-lg px-3 py-2 border border-gray-800">
            <p className="text-xs font-bold text-white">{p.productName} {p.color ? `(${p.color})` : ''} {p.size ? `(${p.size})` : ''} × {p.quantity}</p>
            {p.position && <p className="text-[11px] text-cyan-300 mt-1">Position: {p.position}</p>}
            {p.engravingText && <p className="text-[11px] text-cyan-300">Text: {p.engravingText}</p>}
            {p.threadColor && <p className="text-[11px] text-gray-400">Thread: {p.threadColor}</p>}
            {p.instructions && <p className="text-[11px] text-gray-400 italic">{p.instructions}</p>}
          </div>
        ))}

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock size={12} />
          {eng.createdAt && new Date(eng.createdAt).toLocaleDateString('en-PK')}
        </div>

        <div className="flex gap-2">
          <button onClick={() => printEngravingSlip(eng)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl">
            <Printer size={14} />Print Slip
          </button>
          {type === 'pending' ? (
            <button onClick={() => handleAccept(eng.id)} disabled={actionLoading === eng.id + 'accept'}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
              {actionLoading === eng.id + 'accept' ? <RefreshCcw className="animate-spin" size={14} /> : <Play size={14} />} Accept & Start
            </button>
          ) : (
            <button onClick={() => handleComplete(eng.id)} disabled={actionLoading === eng.id + 'complete'}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
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
                <h2 className="text-lg font-black text-white">Pending ({pendingEngravings.length})</h2>
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
