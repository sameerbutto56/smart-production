import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import api from '../services/api';
import socket from '../socket';
import toast from 'react-hot-toast';
import {
  MessageSquare, Download, Trash2, X, Star, TrendingUp, Building2, BarChart3,
  Filter, Loader2, RefreshCcw, Printer, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, QrCode as QrIcon, Barcode as BarcodeIcon, CheckCircle2, ShieldCheck, Copy
} from 'lucide-react';

const RATING_LABELS = { 1: 'Excellent', 2: 'Good', 3: 'Average', 4: 'Poor', 5: 'Very Poor' };
const RATING_COLORS = { 1: '#10b981', 2: '#22d3ee', 3: '#fbbf24', 4: '#f97316', 5: '#ef4444' };
const QUESTIONS = [
  'How satisfied are you with the overall quality of our medical scrubs and products?',
  'How satisfied are you with the fitting and comfort of the products you purchased?',
  'How would you rate the behavior and professionalism of our staff?',
  'How satisfied are you with the assistance provided by our sales team?',
  'How would you rate the cleanliness and ambience of the outlet?',
  'How satisfied are you with the product variety available at the outlet?',
  'How would you rate the speed of our customer service?',
  'How satisfied are you with your overall shopping experience at ENAMELS?',
  'Would you recommend ENAMELS to your friends or colleagues?',
  'Overall, how satisfied are you with your visit to our outlet?',
];

const OUTLET_OPTIONS = [
  { id: '', label: 'All Outlets (JT, JR, AB)' },
  { id: 'Johar Town', label: 'Johar Town' },
  { id: 'Jail Road', label: 'Jail Road' },
  { id: 'Abbottabad', label: 'Abbottabad' },
];

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

const AdminFeedbackDashboard = () => {
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');

  // Filters
  const [outletFilter, setOutletFilter] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // QR & Barcode Modal
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrOutlets, setQrOutlets] = useState([]);
  const [selectedQROutlet, setSelectedQROutlet] = useState('Johar Town');
  const [activeQRDataUrl, setActiveQRDataUrl] = useState('');
  const [activeBarcodeDataUrl, setActiveBarcodeDataUrl] = useState('');

  // Row Expand & Delete
  const [expandedRow, setExpandedRow] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const barcodeCanvasRef = useRef(null);

  const fetchQueryParams = useMemo(() => {
    const params = {};
    if (outletFilter) params.outlet = outletFilter;
    if (dateRange && dateRange !== 'all') {
      params.range = dateRange;
    }
    if (dateRange === 'custom') {
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
    }
    return params;
  }, [outletFilter, dateRange, dateFrom, dateTo]);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [fbRes, stRes] = await Promise.all([
        api.get('/api/feedback', { params: fetchQueryParams }),
        api.get('/api/feedback/stats', { params: fetchQueryParams }),
      ]);
      setFeedback(fbRes.data || []);
      setStats(stRes.data || null);
      if (isManualRefresh) toast.success('Feedback data refreshed');
    } catch (err) {
      console.error('Failed to fetch feedback data:', err);
      if (isManualRefresh) toast.error('Failed to refresh feedback');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchQueryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time listener for incoming customer feedback
  useEffect(() => {
    const handleFeedbackSubmitted = (data) => {
      fetchData();
      toast.success(`New Feedback received from ${data?.outlet || 'customer'}!`, {
        icon: '🌟',
      });
    };
    socket.on('customer-feedback-submitted', handleFeedbackSubmitted);
    return () => {
      socket.off('customer-feedback-submitted', handleFeedbackSubmitted);
    };
  }, [fetchData]);

  // Fetch configured QR and Barcode data
  const fetchQRs = async () => {
    try {
      const res = await api.get('/api/feedback/qrs');
      const list = res.data || [];
      setQrOutlets(list);
      return list;
    } catch (err) {
      console.error('Failed to fetch outlet QRs:', err);
      return [];
    }
  };

  // Generate QR and Barcode for chosen outlet
  const updateQRDisplay = useCallback(async (targetOutlet, qrList = qrOutlets) => {
    const outletData = qrList.find(q => q.outlet === targetOutlet) || {
      outlet: targetOutlet,
      url: targetOutlet === 'Johar Town'
        ? `${window.location.origin}/feedback`
        : `${window.location.origin}/feedback?token=${targetOutlet.toLowerCase().replace(/\s+/g, '-')}-feedback`,
      barcode: targetOutlet === 'Johar Town' ? 'ENAMELS-FB-JT' : (targetOutlet === 'Jail Road' ? 'ENAMELS-FB-JR' : 'ENAMELS-FB-AB'),
      isExisting: targetOutlet === 'Johar Town',
    };

    try {
      const qrData = await QRCode.toDataURL(outletData.url, {
        width: 600,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setActiveQRDataUrl(qrData);

      // Generate Barcode on temporary canvas
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, outletData.barcode || 'ENAMELS-FEEDBACK', {
        format: 'CODE128',
        width: 2.2,
        height: 55,
        displayValue: true,
        font: 'monospace',
        fontSize: 14,
        textMargin: 4,
        lineColor: '#000000',
        background: '#ffffff',
      });
      setActiveBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('QR/Barcode rendering error:', err);
    }
  }, [qrOutlets]);

  const handleOpenQRModal = async () => {
    const list = await fetchQRs();
    const current = selectedQROutlet || 'Johar Town';
    setSelectedQROutlet(current);
    updateQRDisplay(current, list);
    setShowQRModal(true);
  };

  const handleSelectQROutlet = (outlet) => {
    setSelectedQROutlet(outlet);
    updateQRDisplay(outlet);
  };

  const printPoster = () => {
    const outletInfo = qrOutlets.find(q => q.outlet === selectedQROutlet);
    const outletName = selectedQROutlet || 'Johar Town';
    const isJohar = outletName === 'Johar Town';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>ENAMELS Customer Feedback — ${outletName}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        body {
          margin: 0;
          font-family: 'Segoe UI', Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #ffffff;
          color: #000000;
          padding: 40px;
          box-sizing: border-box;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .header img { height: 110px; margin-bottom: 12px; }
        .outlet-badge {
          display: inline-block;
          background: #000000;
          color: #ffffff;
          font-size: 26px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 3px;
          padding: 8px 24px;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .title {
          font-size: 32px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 3px;
          margin-bottom: 8px;
        }
        .subtitle {
          font-size: 15px;
          font-weight: 600;
          color: #555555;
          max-width: 500px;
          line-height: 1.5;
          text-align: center;
          margin-bottom: 24px;
        }
        .qr-card {
          border: 4px solid #000000;
          border-radius: 24px;
          padding: 24px;
          background: #ffffff;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          margin-bottom: 20px;
        }
        .qr-card img.qr { width: 340px; height: 340px; display: block; margin: 0 auto; }
        .barcode-container { margin-top: 14px; text-align: center; }
        .barcode-container img { max-width: 280px; height: 50px; }
        .footer { font-size: 13px; font-weight: 800; margin-top: 24px; text-transform: uppercase; letter-spacing: 2px; color: #111; }
        .tagline { font-size: 12px; color: #666666; margin-top: 6px; }
      </style>
    </head><body>
      <div class="header">
        <img src="${window.location.origin}/logo.png" alt="ENAMELS">
      </div>
      <div class="outlet-badge">${outletName} Outlet</div>
      <div class="title">Give Your Feedback</div>
      <div class="subtitle">Your feedback helps us improve our scrubs, products, and customer service. Scan the QR code below with your mobile camera.</div>
      <div class="qr-card">
        <img class="qr" src="${activeQRDataUrl}">
        <div class="barcode-container">
          <img src="${activeBarcodeDataUrl}">
        </div>
      </div>
      <div class="footer">ENAMELS Medical Apparel</div>
      <div class="tagline">Official Outlet Feedback Station • Scan to Review</div>
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); window.close(); }, 500);
        };
      <\/script></body></html>`);
    doc.close();
    setTimeout(() => { document.body.removeChild(iframe); }, 2000);
  };

  const copyUrlToClipboard = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Feedback URL copied to clipboard');
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/feedback/${id}`);
      setDeleteConfirm(null);
      toast.success('Feedback deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete feedback');
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      await api.delete('/api/feedback');
      setClearAllConfirm(false);
      toast.success('All feedback cleared');
      fetchData();
    } catch (err) {
      toast.error('Failed to clear feedback');
    } finally {
      setClearingAll(false);
    }
  };

  const navSections = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'records', label: 'All Records', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  const outletColors = { 'Johar Town': '#a78bfa', 'Jail Road': '#f472b6', 'Abbottabad': '#34d399' };

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <span className="ml-3 text-gray-400 font-bold">Loading customer feedback data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto">
        {navSections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap cursor-pointer ${
              activeSection === s.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}>
            <s.icon size={14} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Control Action Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
        {/* QR & Barcode Generator Modal Trigger */}
        <button onClick={handleOpenQRModal}
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-purple-900/30">
          <QrIcon size={14} /> Manage Outlet QRs & Barcodes
        </button>

        {/* Outlet Filter */}
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-1">
          <Building2 size={14} className="text-gray-400" />
          <select value={outletFilter} onChange={e => setOutletFilter(e.target.value)}
            className="bg-transparent py-2 text-white font-bold text-xs outline-none cursor-pointer">
            {OUTLET_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id} className="bg-gray-900">{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Date Filter Presets */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 overflow-x-auto">
          {DATE_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => setDateRange(preset.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                dateRange === preset.id
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs if Custom selected */}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-white text-xs font-bold outline-none px-2"
              title="From date (PKT)"
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-white text-xs font-bold outline-none px-2"
              title="To date (PKT)"
            />
          </div>
        )}

        {/* Refresh Button */}
        <button onClick={() => fetchData(true)} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50">
          <RefreshCcw size={14} className={refreshing ? 'animate-spin text-blue-400' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>

        {/* Clear All Button */}
        <div className="ml-auto">
          <button onClick={() => setClearAllConfirm(true)}
            className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer">
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && stats && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Total Feedback', value: stats.total, color: 'text-white', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
              { label: 'Average Rating', value: stats.averageRating?.toFixed(1) || '0', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
              { label: 'Excellent (1)', value: stats.excellent || 0, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
              { label: 'Good (2)', value: stats.good || 0, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
              { label: 'Average (3)', value: stats.average || 0, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
              { label: 'Poor (4)', value: stats.poor || 0, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
              { label: 'Very Poor (5)', value: stats.veryPoor || 0, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
            ].map((card, i) => (
              <div key={i} className={`${card.bg} border ${card.border} rounded-2xl p-4 text-center`}>
                <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Outlet Performance Breakdown */}
          {stats.outletStats?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-blue-400" />
                Configured Feedback Outlets
              </h3>
              <div className="space-y-4">
                {stats.outletStats.map(o => {
                  const pct = o.count > 0 ? ((5 - o.averageRating) / 4) * 100 : 0;
                  return (
                    <div key={o.outlet} className="flex items-center gap-4">
                      <div className="w-32 shrink-0">
                        <span className="text-xs font-black uppercase tracking-wider block" style={{ color: outletColors[o.outlet] || '#fff' }}>{o.outlet}</span>
                        <span className="text-[10px] font-bold text-gray-500 block">{o.count} responses</span>
                      </div>
                      <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, o.count > 0 ? 5 : 0)}%`, background: outletColors[o.outlet] || '#3b82f6' }} />
                      </div>
                      <span className="text-sm font-black text-white w-12 text-right">
                        {o.count > 0 ? o.averageRating?.toFixed(1) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Rating Distribution */}
          {stats.ratingDistribution?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Individual Question Ratings Distribution</h3>
              <div className="flex items-end gap-3 h-48">
                {stats.ratingDistribution.map(r => {
                  const totalRatings = stats.ratingDistribution.reduce((s, x) => s + x.count, 0) || 1;
                  const pct = (r.count / totalRatings) * 100;
                  return (
                    <div key={r.rating} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-black text-white">{r.count}</span>
                      <div className="w-full rounded-t-xl transition-all duration-500" style={{ height: `${Math.max(pct * 1.5, 4)}%`, background: RATING_COLORS[r.rating] }} />
                      <span className="text-[10px] font-black text-gray-400">{RATING_LABELS[r.rating]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Trend */}
          {stats.monthlyTrend?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Monthly Feedback Trend</h3>
              <div className="flex items-end gap-2 h-40">
                {stats.monthlyTrend.map(m => {
                  const maxCount = Math.max(...stats.monthlyTrend.map(x => x.count));
                  const h = (m.count / (maxCount || 1)) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-white">{m.count}</span>
                      <div className="w-full rounded-t-lg bg-blue-500 transition-all duration-500" style={{ height: `${Math.max(h, 5)}%` }} />
                      <span className="text-[9px] font-bold text-gray-500">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All Records Section */}
      {activeSection === 'records' && (
        <div className="space-y-4">
          {feedback.length === 0 ? (
            <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
              <MessageSquare className="mx-auto text-gray-600 mb-3" size={40} />
              <p className="text-gray-400 font-bold">No feedback records match the current filter.</p>
            </div>
          ) : (
            feedback.map(f => (
              <div key={f.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {/* Row Header */}
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedRow(expandedRow === f.id ? null : f.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{f.fullName}</span>
                      <span className="text-xs font-bold text-gray-400">{f.mobileNumber}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${outletColors[f.outlet] || '#3b82f6'}20`, color: outletColors[f.outlet] || '#3b82f6' }}>
                        {f.outlet}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-black px-2 py-0.5 rounded" style={{ background: `${RATING_COLORS[Math.round(f.averageRating)]}20`, color: RATING_COLORS[Math.round(f.averageRating)] }}>
                        Avg: {f.averageRating?.toFixed(1)} / 5.0
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">
                        {new Date(f.createdAt).toLocaleDateString()} {new Date(f.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(f.id); }}
                    className="p-2 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer">
                    <Trash2 size={14} />
                  </button>
                  {expandedRow === f.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                </div>

                {/* Expanded Details */}
                {expandedRow === f.id && (
                  <div className="px-4 pb-4 border-t border-white/5 space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {f.emailAddress && <div><span className="text-gray-500 font-bold">Email:</span> <span className="text-white font-black">{f.emailAddress}</span></div>}
                      {f.token && <div><span className="text-gray-500 font-bold">Token Ref:</span> <span className="text-gray-400 font-mono text-[10px]">{f.token}</span></div>}
                    </div>
                    <div className="space-y-2">
                      {QUESTIONS.map((q, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className="w-5 text-right font-black text-gray-500">{i + 1}</span>
                          <span className="flex-1 text-gray-400 font-bold truncate">{q}</span>
                          <span className="font-black px-2 py-0.5 rounded text-[10px] min-w-[70px] text-center"
                            style={{ background: `${RATING_COLORS[f[`q${i + 1}`]]}20`, color: RATING_COLORS[f[`q${i + 1}`]] }}>
                            {RATING_LABELS[f[`q${i + 1}`]]} ({f[`q${i + 1}`]})
                          </span>
                        </div>
                      ))}
                    </div>
                    {f.comments && (
                      <div className="bg-white/5 rounded-xl p-3">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Comments</span>
                        <p className="text-xs text-gray-300 font-bold mt-1">{f.comments}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirm === f.id && (
                  <div className="px-4 pb-4 flex items-center gap-3 bg-red-950/20 border-t border-red-500/20 pt-3">
                    <span className="text-xs text-red-400 font-bold">Delete this feedback record permanently?</span>
                    <button onClick={() => handleDelete(f.id)} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black cursor-pointer">Yes, Delete</button>
                    <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-white/5 text-gray-400 hover:text-white rounded-lg text-xs font-bold cursor-pointer">Cancel</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Analytics Section */}
      {activeSection === 'analytics' && stats && (
        <div className="space-y-6">
          {/* Question-wise Average Rating */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Question-wise Average Rating</h3>
            <div className="space-y-3">
              {QUESTIONS.map((q, i) => {
                const ratings = feedback.map(f => f[`q${i + 1}`]);
                const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
                const pct = ((5 - avg) / 4) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 text-right text-[10px] font-black text-gray-500 shrink-0">{i + 1}</span>
                    <span className="flex-1 text-[11px] font-bold text-gray-400 truncate shrink">{q}</span>
                    <div className="w-32 h-4 bg-white/5 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: RATING_COLORS[Math.round(avg)] || '#3b82f6' }} />
                    </div>
                    <span className="text-xs font-black text-white w-10 text-right shrink-0">{avg.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* QR Code & Barcode Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-8 md:pt-12 overflow-y-auto" onClick={() => setShowQRModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-3xl p-5 md:p-6 max-w-xl w-full my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <QrIcon size={18} className="text-purple-400" />
                  Customer Feedback QR & Barcode
                </h3>
                <p className="text-xs text-gray-400 font-bold">Select outlet to view or print official feedback materials</p>
              </div>
              <button onClick={() => setShowQRModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Outlet Selector Tabs inside Modal */}
            <div className="grid grid-cols-3 gap-2 mb-4 bg-black/40 p-1.5 rounded-2xl border border-white/10">
              {['Johar Town', 'Jail Road', 'Abbottabad'].map(outlet => {
                const isSelected = selectedQROutlet === outlet;
                const isJohar = outlet === 'Johar Town';
                return (
                  <button
                    key={outlet}
                    onClick={() => handleSelectQROutlet(outlet)}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex flex-col items-center justify-center ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{outlet}</span>
                    {isJohar && <span className="text-[9px] text-purple-200 uppercase tracking-widest mt-0.5 font-bold">Existing Official</span>}
                  </button>
                );
              })}
            </div>

            {/* Active Outlet Information Badge */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-400 block font-bold">Target Outlet</span>
                <span className="text-white font-black text-sm">{selectedQROutlet}</span>
              </div>
              {selectedQROutlet === 'Johar Town' ? (
                <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-lg font-black text-[10px] tracking-wider uppercase flex items-center gap-1">
                  <ShieldCheck size={12} /> Existing Preserved QR
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-blue-500/20 border border-blue-500/40 text-blue-400 rounded-lg font-black text-[10px] tracking-wider uppercase">
                  Dedicated Outlet QR
                </span>
              )}
            </div>

            {/* Printable Preview Card */}
            <div className="bg-white rounded-2xl p-6 text-center shadow-2xl text-black">
              <img src="/logo.png" alt="ENAMELS" className="h-14 mx-auto mb-3" />
              <span className="inline-block bg-black text-white font-black text-xs uppercase tracking-widest px-3 py-1 rounded-full mb-2">
                {selectedQROutlet} Outlet
              </span>
              <h4 className="text-xl font-black text-black mb-1 uppercase tracking-wider">Customer Feedback</h4>
              <p className="text-gray-600 text-xs font-bold mb-4 italic">Scan below to rate your visit and shopping experience</p>

              {/* QR Code Image */}
              {activeQRDataUrl && (
                <div className="bg-white p-2 border-2 border-black rounded-2xl inline-block mb-3">
                  <img src={activeQRDataUrl} alt="Feedback QR" className="w-48 h-48 sm:w-56 sm:h-56 mx-auto" />
                </div>
              )}

              {/* Barcode Image */}
              {activeBarcodeDataUrl && (
                <div className="mt-2">
                  <img src={activeBarcodeDataUrl} alt="Feedback Barcode" className="mx-auto max-h-12" />
                </div>
              )}

              <p className="text-[10px] font-black text-gray-500 mt-3 uppercase tracking-widest">
                Official Enamels Customer Feedback Station
              </p>
            </div>

            {/* URL Display & Copy */}
            <div className="mt-4 bg-black/40 border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-gray-400 font-mono truncate">
                {selectedQROutlet === 'Johar Town'
                  ? `${window.location.origin}/feedback`
                  : `${window.location.origin}/feedback?token=${qrOutlets.find(q => q.outlet === selectedQROutlet)?.token || ''}`}
              </span>
              <button
                onClick={() => copyUrlToClipboard(
                  selectedQROutlet === 'Johar Town'
                    ? `${window.location.origin}/feedback`
                    : `${window.location.origin}/feedback?token=${qrOutlets.find(q => q.outlet === selectedQROutlet)?.token || ''}`
                )}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Copy size={12} /> Copy Link
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button onClick={printPoster}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-purple-900/30">
                <Printer size={14} /> Print Standee / Poster
              </button>
              <a href={activeQRDataUrl} download={`enamels-feedback-qr-${selectedQROutlet.toLowerCase().replace(/\s+/g, '-')}.png`}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer">
                <Download size={14} /> Download QR PNG
              </a>
              <button onClick={() => setShowQRModal(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {clearAllConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setClearAllConfirm(false)}>
          <div className="bg-gray-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/10 rounded-2xl"><AlertTriangle className="text-red-400" size={24} /></div>
              <div>
                <h3 className="text-lg font-black text-white">Clear All Feedback?</h3>
                <p className="text-xs font-bold text-gray-400">All {stats?.total || 0} feedback records will be permanently deleted from the database.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleClearAll} disabled={clearingAll}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer">
                {clearingAll ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                {clearingAll ? 'Clearing…' : 'Yes, Clear All'}
              </button>
              <button onClick={() => setClearAllConfirm(false)}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-400 hover:text-white rounded-xl font-bold text-xs transition-all cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeedbackDashboard;
