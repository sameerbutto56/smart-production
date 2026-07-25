import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import api from '../services/api';
import {
  MessageSquare, Download, Trash2, X, Star, TrendingUp, Building2, BarChart3,
  Filter, Loader2, RefreshCcw, Printer, AlertTriangle, ChevronDown, ChevronUp,
  Calendar, ThumbsUp, ThumbsDown, Minus, ArrowUpRight, CheckCircle2
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

const AdminFeedbackDashboard = () => {
  const [feedback, setFeedback] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [outletFilter, setOutletFilter] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const feedbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/feedback` : '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fbRes, stRes] = await Promise.all([
        api.get('/api/feedback', { params: outletFilter ? { outlet: outletFilter } : {} }),
        api.get('/api/feedback/stats'),
      ]);
      setFeedback(fbRes.data);
      setStats(stRes.data);
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [outletFilter]);

  const generateQR = async () => {
    try {
      const url = await QRCode.toDataURL(feedbackUrl, { width: 600, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
      setQrDataUrl(url);
      setShowQRModal(true);
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  };

  const printQR = () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>ENAMELS Customer Feedback QR</title>
      <style>@page{size:A4 portrait;margin:0}body{margin:0;font-family:'Segoe UI',Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#fff;color:#000}
      .header{text-align:center;margin-bottom:20px}.header img{height:120px;margin-bottom:12px}
      .title{font-size:36px;font-weight:900;text-transform:uppercase;letter-spacing:4px;margin-bottom:12px}
      .subtitle{font-size:16px;font-weight:600;font-style:italic;color:#555;max-width:500px;line-height:1.5}
      .qr-container{margin:30px 0;text-align:center}.qr-container img{width:350px;height:350px}
      .footer{font-size:14px;font-weight:900;margin-top:30px;text-transform:uppercase;letter-spacing:2px}
      .tagline{font-size:12px;color:#888;margin-top:8px}</style></head><body>
      <div class="header"><img src="${window.location.origin}/logo.png" alt="ENAMELS"></div>
      <div class="title">Give Your Feedback</div>
      <div class="subtitle">Your feedback helps us improve our products and services. Scan the QR code below to share your experience.</div>
      <div class="qr-container"><img src="${qrDataUrl}"></div>
      <div class="footer">This software is developed by Ismail Bhatt</div>
      <div class="tagline">Scan the QR code to provide your valuable feedback</div>
      <script>window.onload=function(){setTimeout(function(){window.print();window.close()},500)}<\/script></body></html>`);
    win.document.close();
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/feedback/${id}`);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      await api.delete('/api/feedback');
      setClearAllConfirm(false);
      fetchData();
    } catch (err) {
      console.error('Clear all failed:', err);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={32} />
        <span className="ml-3 text-gray-400 font-bold">Loading feedback data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nav */}
      <div className="flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto">
        {navSections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeSection === s.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'
            }`}>
            <s.icon size={14} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={generateQR}
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
          <Download size={14} /> Generate QR Code
        </button>
        <select value={outletFilter} onChange={e => setOutletFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-blue-500">
          <option value="" className="bg-gray-900">All Outlets</option>
          <option value="Johar Town" className="bg-gray-900">Johar Town</option>
          <option value="Jail Road" className="bg-gray-900">Jail Road</option>
          <option value="Abbottabad" className="bg-gray-900">Abbottabad</option>
        </select>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 text-gray-400 hover:text-white rounded-xl font-bold text-xs transition-all">
          <RefreshCcw size={14} /> Refresh
        </button>
        <div className="ml-auto">
          <button onClick={() => setClearAllConfirm(true)}
            className="flex items-center gap-2 px-5 py-3 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      {/* Overview Section */}
      {activeSection === 'overview' && stats && (
        <div className="space-y-6">
          {/* Summary Cards */}
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

          {/* Outlet Performance */}
          {stats.outletStats?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Outlet Performance</h3>
              <div className="space-y-4">
                {stats.outletStats.map(o => {
                  const pct = ((5 - o.averageRating) / 4) * 100;
                  return (
                    <div key={o.outlet} className="flex items-center gap-4">
                      <div className="w-28 shrink-0">
                        <span className="text-xs font-black uppercase tracking-wider" style={{ color: outletColors[o.outlet] || '#fff' }}>{o.outlet}</span>
                        <span className="text-[10px] font-bold text-gray-500 block">{o.count} responses</span>
                      </div>
                      <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: outletColors[o.outlet] || '#3b82f6' }} />
                      </div>
                      <span className="text-sm font-black text-white w-12 text-right">{o.averageRating?.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rating Distribution Bar Chart */}
          {stats.ratingDistribution?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Rating Distribution (Individual Ratings)</h3>
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

          {/* Daily Trend (last 30 days) */}
          {stats.dailyTrend?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Daily Feedback Trend (Last 30 Days)</h3>
              <div className="flex items-end gap-1 h-32 overflow-x-auto">
                {stats.dailyTrend.map(d => {
                  const maxCount = Math.max(...stats.dailyTrend.map(x => x.count));
                  const h = (d.count / (maxCount || 1)) * 100;
                  return (
                    <div key={d.day} className="min-w-[8px] flex-1 flex flex-col items-center gap-0.5" title={`${d.day}: ${d.count} feedback (avg ${d.averageRating})`}>
                      <div className="w-full rounded-t bg-cyan-500 transition-all duration-300" style={{ height: `${Math.max(h, 3)}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[9px] font-bold text-gray-500">{stats.dailyTrend[0]?.day?.slice(5)}</span>
                <span className="text-[9px] font-bold text-gray-500">{stats.dailyTrend[stats.dailyTrend.length - 1]?.day?.slice(5)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Records Section */}
      {activeSection === 'records' && (
        <div className="space-y-4">
          {feedback.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="mx-auto text-gray-600 mb-3" size={40} />
              <p className="text-gray-500 font-bold">No feedback records found.</p>
            </div>
          ) : (
            feedback.map(f => (
              <div key={f.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                {/* Row Header */}
                <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedRow(expandedRow === f.id ? null : f.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">{f.fullName}</span>
                      <span className="text-xs font-bold text-gray-500">{f.mobileNumber}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${outletColors[f.outlet]}20`, color: outletColors[f.outlet] }}>{f.outlet}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-black px-2 py-0.5 rounded" style={{ background: `${RATING_COLORS[Math.round(f.averageRating)]}20`, color: RATING_COLORS[Math.round(f.averageRating)] }}>
                        Avg: {f.averageRating?.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500">
                        {new Date(f.createdAt).toLocaleDateString()} {new Date(f.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(f.id); }}
                    className="p-2 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
                  {expandedRow === f.id ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                </div>

                {/* Expanded Details */}
                {expandedRow === f.id && (
                  <div className="px-4 pb-4 border-t border-white/5 space-y-3 pt-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {f.emailAddress && <div><span className="text-gray-500 font-bold">Email:</span> <span className="text-white font-black">{f.emailAddress}</span></div>}
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

                {/* Delete Confirm */}
                {deleteConfirm === f.id && (
                  <div className="px-4 pb-4 flex items-center gap-3">
                    <span className="text-xs text-red-400 font-bold">Delete this feedback?</span>
                    <button onClick={() => handleDelete(f.id)} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-black">Yes</button>
                    <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-white/5 text-gray-400 hover:text-white rounded-lg text-xs font-bold">Cancel</button>
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
          {/* Outlet Comparison */}
          {stats.outletStats?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Outlet Comparison</h3>
              <div className="space-y-6">
                {stats.outletStats.map(o => (
                  <div key={o.outlet}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black uppercase tracking-wider" style={{ color: outletColors[o.outlet] }}>{o.outlet}</span>
                      <span className="text-xs font-bold text-gray-400">{o.count} responses — Avg {o.averageRating?.toFixed(1)}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map(r => {
                        const key = ['excellent', 'good', 'average', 'poor', 'veryPoor'][r - 1];
                        const count = o[key] || 0;
                        const pct = o.count > 0 ? (count / (o.count * 10)) * 100 : 0;
                        return (
                          <div key={r} className="text-center">
                            <div className="h-24 bg-white/5 rounded-xl overflow-hidden flex flex-col justify-end">
                              <div className="rounded-b-xl transition-all duration-500" style={{ height: `${Math.max(pct, 2)}%`, background: RATING_COLORS[r] }} />
                            </div>
                            <span className="text-[9px] font-bold text-gray-500 mt-1 block">{RATING_LABELS[r]}</span>
                            <span className="text-[10px] font-black text-white">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question-wise Average */}
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

          {/* Feedback Trend Line */}
          {stats.monthlyTrend?.length > 1 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4">Monthly Rating Trend</h3>
              <div className="flex items-end gap-3 h-40">
                {stats.monthlyTrend.map(m => {
                  const h = (m.averageRating / 5) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-white">{m.averageRating?.toFixed(1)}</span>
                      <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${Math.max(h, 5)}%`, background: `linear-gradient(to top, ${RATING_COLORS[Math.round(m.averageRating)]}, ${RATING_COLORS[Math.round(m.averageRating)]}80)` }} />
                      <span className="text-[9px] font-bold text-gray-500">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white">QR Code — Customer Feedback</h3>
              <button onClick={() => setShowQRModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>
            <div className="bg-white rounded-2xl p-8 text-center">
              <img src="/logo.png" alt="ENAMELS" className="h-16 mx-auto mb-4" />
              <h4 className="text-xl font-black text-black mb-1">Give Your Feedback</h4>
              <p className="text-gray-500 text-xs font-bold mb-4 italic">Your feedback helps us improve our products and services.</p>
              {qrDataUrl && <img src={qrDataUrl} alt="Feedback QR Code" className="w-64 h-64 mx-auto" />}
              <p className="text-[10px] font-black text-gray-400 mt-4 uppercase tracking-wider">This software is developed by Ismail Bhatt</p>
            </div>
            <div className="flex gap-3 mt-4">
              <a href={qrDataUrl} download="enamels-feedback-qr.png"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                <Download size={14} /> Download PNG
              </a>
              <button onClick={printQR}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                <Printer size={14} /> Print A4 Poster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirm */}
      {clearAllConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setClearAllConfirm(false)}>
          <div className="bg-gray-900 border border-red-500/30 rounded-3xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/10 rounded-2xl"><AlertTriangle className="text-red-400" size={24} /></div>
              <div>
                <h3 className="text-lg font-black text-white">Clear All Feedback?</h3>
                <p className="text-xs font-bold text-gray-400">This action cannot be undone. All {stats?.total || 0} feedback records will be permanently deleted.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleClearAll} disabled={clearingAll}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                {clearingAll ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                {clearingAll ? 'Clearing...' : 'Yes, Clear All'}
              </button>
              <button onClick={() => setClearAllConfirm(false)}
                className="flex-1 px-4 py-3 bg-white/5 text-gray-400 hover:text-white rounded-xl font-bold text-xs transition-all">
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
