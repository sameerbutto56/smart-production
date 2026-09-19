import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, Package, Truck, TrendingUp, TrendingDown, AlertTriangle,
  Upload, FileSpreadsheet, Download, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Search, Calendar, FileText, Layers, Eye, LogOut,
  ArrowLeft, Clock, ShieldCheck, Wallet, ArrowRightLeft, UserCheck
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import socket from '../socket';
import useDateRange from '../hooks/useDateRange';
import AbbottabadAmountCard from './AbbottabadAmountCard';
import AbbottabadPercentageCalculator from './AbbottabadPercentageCalculator';

const fmt = (n) => {
  if (n === null || n === undefined) return '-';
  const val = Number(n);
  const formatted = Math.abs(Math.round(val)).toLocaleString();
  return val < 0 ? `-₨${formatted}` : `₨${formatted}`;
};

const AbbottabadFinancialSection = ({ isOutlet = false, onBack, onLogout }) => {
  const {
    range, setRange, dateFrom, setDateFrom, dateTo, setDateTo,
    label: rangeLabel, queryParams, presets
  } = useDateRange({ initialRange: 'today' });

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [expandedDemandId, setExpandedDemandId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [demandTab, setDemandTab] = useState('all'); // 'all' | 'incoming' | 'history'
  const [acceptingId, setAcceptingId] = useState(null);

  // Cost Excel Upload Modal (Admin only)
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeUploadTab, setActiveUploadTab] = useState('upload'); // 'upload' | 'history'

  const fileInputRef = useRef(null);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/api/abbottabad/demand-summary', {
        params: queryParams
      });
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch Abbottabad summary:', err);
      toast.error('Failed to load financial summary');
    } finally {
      setSummaryLoading(false);
    }
  }, [queryParams]);

  const fetchRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await api.get('/api/abbottabad/demands', {
        params: { ...queryParams, limit: 100 }
      });
      setRecords(res.data?.records || []);
    } catch (err) {
      console.error('Failed to fetch Abbottabad demand records:', err);
    } finally {
      setRecordsLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    fetchSummary();
    fetchRecords();
  }, [fetchSummary, fetchRecords]);

  // Real-time synchronization
  useEffect(() => {
    if (!socket) return;
    const handleSync = () => {
      fetchSummary();
      fetchRecords();
    };

    socket.on('demand:new', handleSync);
    socket.on('demand:updated', handleSync);
    socket.on('demand:accepted', handleSync);
    socket.on('abbottabad:amount-updated', handleSync);
    socket.on('abbottabad:demand-accepted', handleSync);

    return () => {
      socket.off('demand:new', handleSync);
      socket.off('demand:updated', handleSync);
      socket.off('demand:accepted', handleSync);
      socket.off('abbottabad:amount-updated', handleSync);
      socket.off('abbottabad:demand-accepted', handleSync);
    };
  }, [fetchSummary, fetchRecords]);

  const fetchUploadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/api/abbottabad/cost-price/history');
      setUploadHistory(res.data || []);
    } catch (err) {
      console.error('Failed to fetch upload history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please select an Excel file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await api.post('/api/abbottabad/cost-price/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      toast.success('Cost price Excel successfully uploaded & processed');
      fetchSummary();
      fetchRecords();
      fetchUploadHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process Excel file');
    } finally {
      setUploading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      toast.loading('Generating Excel export...', { id: 'export-toast' });
      const res = await api.get('/api/abbottabad/export-excel', {
        params: queryParams,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Abbottabad_Financial_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel downloaded successfully', { id: 'export-toast' });
    } catch (err) {
      toast.error('Failed to export Excel', { id: 'export-toast' });
    }
  };

  // Demand Acceptance Handler
  const handleAcceptDemand = async (demandId, transferNum) => {
    if (acceptingId) return;
    const ok = window.confirm(
      `Accept incoming Demand #${transferNum || demandId.slice(0, 8)}?\n\nThis will verify stock received and add all approved quantities into your Abbottabad POS inventory.`
    );
    if (!ok) return;

    setAcceptingId(demandId);
    try {
      await api.put(`/api/demand/${demandId}/accept`);
      toast.success(`Demand #${transferNum || ''} accepted! Stock added to inventory.`);
      fetchSummary();
      fetchRecords();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept demand');
    } finally {
      setAcceptingId(null);
    }
  };

  const incomingDemands = records.filter(
    r => r.canAccept || (!r.acceptedAt && (r.dispatchedAt || r.status === 'DISPATCHED' || r.status === 'APPROVED' || r.status === 'PARTIALLY_APPROVED'))
  );
  const acceptedDemands = records.filter(
    r => r.acceptedAt != null || r.status === 'COMPLETED'
  );

  const filteredRecords = records.filter(r => {
    if (demandTab === 'incoming') {
      const isIncoming = r.canAccept || (!r.acceptedAt && (r.dispatchedAt || r.status === 'DISPATCHED' || r.status === 'APPROVED' || r.status === 'PARTIALLY_APPROVED'));
      if (!isIncoming) return false;
    } else if (demandTab === 'history') {
      const isHistory = r.acceptedAt != null || r.status === 'COMPLETED';
      if (!isHistory) return false;
    }

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.transferNumber && r.transferNumber.toLowerCase().includes(q)) ||
      (r.id && r.id.toLowerCase().includes(q)) ||
      (r.items && r.items.some(i => i.productName.toLowerCase().includes(q)))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Back Button (Outlet Profile View) */}
      {onBack && (
        <div className="flex items-center justify-between bg-gray-900/60 p-3.5 px-5 rounded-2xl border border-gray-800 backdrop-blur-sm">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md"
          >
            <ArrowLeft size={16} className="text-teal-400" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xs font-bold text-gray-400">Abbottabad System Connected</span>
          </div>
        </div>
      )}

      {/* AMOUNT CONTROL CARD (Shared backend model; isAdmin controls permissions) */}
      <AbbottabadAmountCard isAdmin={!isOutlet} />

      {/* PERCENTAGE SHARE CALCULATOR (Admin only) */}
      {!isOutlet && (
        <AbbottabadPercentageCalculator summary={summary} rangeLabel={rangeLabel} />
      )}

      {/* FINANCIAL & DEMAND HEADER CONTROLS */}
      <div className="glass rounded-2xl md:rounded-3xl border-2 border-gray-800 p-5 md:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-800">
          <div>
            <div className="flex items-center space-x-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-800/90 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 group mr-1"
                  title="Go Back"
                >
                  <ArrowLeft size={14} className="text-gray-400 group-hover:text-white transition-transform group-hover:-translate-x-0.5" />
                  <span>Back</span>
                </button>
              )}
              <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-400">
                <DollarSign size={24} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  {isOutlet ? 'Abbottabad Demands & Financial Summary' : 'Abbottabad Financial & Demand Summary'}
                </h2>
                <p className="text-xs font-semibold text-gray-400">
                  {isOutlet
                    ? 'Authoritative Demand Breakdown, Fixed Bilty (₨1,500), and Stock Acceptance'
                    : 'Actual Selling Values, Fixed Bilty (₨1,500), and Confidential Internal Costs'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!isOutlet && (
              <button
                onClick={() => {
                  setUploadModalOpen(true);
                  fetchUploadHistory();
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-teal-600/20 flex items-center space-x-2 active:scale-95"
              >
                <FileSpreadsheet size={15} />
                <span>Submit Excel Sheet of Cost Price</span>
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 active:scale-95"
            >
              <Download size={15} />
              <span>Export to Excel</span>
            </button>
            <button
              onClick={() => {
                fetchSummary();
                fetchRecords();
              }}
              disabled={summaryLoading || recordsLoading}
              title="Refresh data"
              className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl transition-all border border-gray-700"
            >
              <RefreshCw size={15} className={summaryLoading ? 'animate-spin' : ''} />
            </button>
            {!isOutlet && onLogout && (
              <button
                onClick={onLogout}
                title="Lock and logout from Abbottabad card"
                className="px-3.5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 active:scale-95"
              >
                <LogOut size={15} />
                <span>Lock &amp; Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map(p => (
              <button
                key={p.value}
                onClick={() => setRange(p.value)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  range === p.value
                    ? 'bg-teal-500 text-gray-950 font-black shadow-md shadow-teal-500/20'
                    : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-gray-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex items-center space-x-2 bg-gray-900/90 p-1.5 rounded-xl border border-gray-700">
              <Calendar size={14} className="text-teal-400 ml-1" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-xs text-white border-none focus:outline-none"
              />
              <span className="text-gray-500 text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-xs text-white border-none focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Summary Metric Cards */}
        {isOutlet ? (
          /* Abbottabad Profile Metrics (No cost leakage; includes ledger & demand counts) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
            {/* 1. Product Value */}
            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                Product Value
              </p>
              <p className="text-lg md:text-xl font-black text-white">
                {fmt(summary?.productValue)}
              </p>
              <p className="text-[9px] font-bold text-gray-500 mt-1">Selling value</p>
            </div>

            {/* 2. Bilty Amount */}
            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-teal-400 mb-1">
                Bilty Amount
              </p>
              <p className="text-lg md:text-xl font-black text-teal-300">
                {fmt(summary?.biltyAmount)}
              </p>
              <p className="text-[9px] font-bold text-gray-500 mt-1">Fixed ₨1,500 charges</p>
            </div>

            {/* 3. Actual Amount + Bilty */}
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-teal-300 mb-1">
                Total Demand Amount
              </p>
              <p className="text-lg md:text-xl font-black text-teal-300">
                {fmt(summary?.actualPlusBilty)}
              </p>
              <p className="text-[9px] font-bold text-teal-400/80 mt-1">Product Value + Bilty</p>
            </div>

            {/* 4. Total Demands */}
            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                Total Demands
              </p>
              <p className="text-lg md:text-xl font-black text-white">
                {summary?.totalDemands || 0}
              </p>
              <p className="text-[9px] font-bold text-gray-500 mt-1">In selected range</p>
            </div>

            {/* 5. Pending Incoming */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  Pending Incoming
                </p>
                {incomingDemands.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              <p className="text-lg md:text-xl font-black text-amber-300">
                {summary?.incomingDemands ?? incomingDemands.length}
              </p>
              <p className="text-[9px] font-bold text-amber-400/80 mt-1">Awaiting acceptance</p>
            </div>

            {/* 6. Accepted Demands */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300 mb-1">
                Accepted Demands
              </p>
              <p className="text-lg md:text-xl font-black text-emerald-300">
                {summary?.acceptedDemands ?? acceptedDemands.length}
              </p>
              <p className="text-[9px] font-bold text-emerald-400/80 mt-1">In POS inventory</p>
            </div>
          </div>
        ) : (
          /* Admin View (Includes internal cost prices) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                Product Value
              </p>
              <p className="text-lg md:text-xl font-black text-white">
                {fmt(summary?.productValue)}
              </p>
              <p className="text-[9px] font-bold text-gray-500 mt-1">Actual selling value</p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-teal-400 mb-1">
                Bilty Amount
              </p>
              <p className="text-lg md:text-xl font-black text-teal-300">
                {fmt(summary?.biltyAmount)}
              </p>
              <p className="text-[9px] font-bold text-gray-500 mt-1">Fixed ₨1,500 charges</p>
            </div>

            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-teal-300 mb-1">
                Actual Amount + Bilty
              </p>
              <p className="text-lg md:text-xl font-black text-teal-300">
                {fmt(summary?.actualPlusBilty)}
              </p>
              <p className="text-[9px] font-bold text-teal-400/80 mt-1">Product Value + Bilty</p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 relative overflow-hidden">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                  Cost Amount
                </p>
                {summary?.missingCostDemandsCount > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                    Missing
                  </span>
                )}
              </div>
              <p className="text-lg md:text-xl font-black text-purple-300">
                {fmt(summary?.costAmount)}
              </p>
              <p className="text-[9px] font-bold text-purple-400/80 mt-1">Internal product cost</p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-500/15 border border-purple-500/40">
              <p className="text-[10px] font-black uppercase tracking-wider text-purple-200 mb-1">
                Cost Amount + Bilty
              </p>
              <p className="text-lg md:text-xl font-black text-purple-200">
                {fmt(summary?.costPlusBilty)}
              </p>
              <p className="text-[9px] font-bold text-purple-300/80 mt-1">Cost Price + Bilty</p>
            </div>

            <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
                Total Demands
              </p>
              <p className="text-lg md:text-xl font-black text-white">
                {summary?.totalDemands || 0}
              </p>
              <p className="text-[9px] font-bold text-gray-500 mt-1">In selected range</p>
            </div>
          </div>
        )}

        {/* Missing Cost Banner (Admin only) */}
        {!isOutlet && summary?.missingCostDemandsCount > 0 && (
          <div className="mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start space-x-3">
            <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-black text-amber-300">
                Cost Price Missing for {summary.missingCostDemandsCount} Demand(s)
              </p>
              <p className="text-gray-300 mt-0.5">
                The following products lack an internal cost price: {summary.missingProducts?.slice(0, 5).join(', ')}
                {summary.missingProducts?.length > 5 ? ` and ${summary.missingProducts.length - 5} more.` : '.'}
              </p>
              <button
                onClick={() => {
                  setUploadModalOpen(true);
                  fetchUploadHistory();
                }}
                className="mt-2 text-xs font-black text-teal-400 hover:text-teal-300 underline"
              >
                Upload Cost Price Excel to complete calculation →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DEMAND DRILLDOWN & ACCEPTANCE SECTION */}
      <div className="glass rounded-2xl md:rounded-3xl border-2 border-gray-800 p-5 md:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-black text-white">
              {isOutlet ? 'Abbottabad Demand Acceptance & History' : 'Abbottabad Demand Drilldown'}
            </h3>
            <p className="text-xs text-gray-400">
              {isOutlet
                ? 'Review incoming demands sent by Store and accept them into your POS inventory'
                : 'Click any demand row to expand itemized financial breakdown'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Tabs */}
            <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-700/80">
              <button
                onClick={() => setDemandTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                  demandTab === 'all'
                    ? 'bg-teal-500 text-gray-950 shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All ({records.length})
              </button>
              <button
                onClick={() => setDemandTab('incoming')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1.5 ${
                  demandTab === 'incoming'
                    ? 'bg-amber-500 text-gray-950 shadow-md'
                    : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <span>Pending Incoming</span>
                {incomingDemands.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-950/80 text-amber-200 rounded-full text-[9px] font-black">
                    {incomingDemands.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setDemandTab('history')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                  demandTab === 'history'
                    ? 'bg-emerald-500 text-gray-950 shadow-md'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                Accepted History ({acceptedDemands.length})
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search demand # or product..."
                className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>

        {recordsLoading ? (
          <div className="py-12 text-center text-gray-400 text-xs">Loading Abbottabad demands...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm font-semibold">
            {demandTab === 'incoming'
              ? 'No incoming demands awaiting acceptance.'
              : demandTab === 'history'
              ? 'No accepted demand history found in this date range.'
              : 'No demands found in the selected date range.'}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredRecords.map((d) => {
              const isExpanded = expandedDemandId === d.id;
              const isBilty = d.biltyType === 'BILTY';
              const isAccepted = Boolean(d.acceptedAt || d.status === 'COMPLETED');
              const isIncoming = Boolean(!isAccepted && (d.canAccept || d.dispatchedAt || d.status === 'DISPATCHED' || d.status === 'APPROVED' || d.status === 'PARTIALLY_APPROVED'));

              return (
                <div
                  key={d.id}
                  className={`border-2 rounded-2xl transition-all overflow-hidden ${
                    isIncoming
                      ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
                      : isExpanded
                      ? 'border-teal-500/50 bg-gray-900/80 shadow-lg'
                      : 'border-gray-800/80 bg-gray-900/40 hover:border-gray-700'
                  }`}
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => setExpandedDemandId(isExpanded ? null : d.id)}
                    className="p-4 cursor-pointer flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-800 rounded-xl text-gray-400">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-sm text-white">
                            #{d.transferNumber || d.id.slice(0, 8)}
                          </span>

                          {/* Status Badge */}
                          {isAccepted ? (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle size={11} /> ACCEPTED
                            </span>
                          ) : isIncoming ? (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                              <Clock size={11} /> PENDING ACCEPTANCE
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {d.status}
                            </span>
                          )}

                          {/* Courier Type Badge */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isBilty ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-gray-800 text-gray-400'
                          }`}>
                            {d.biltyType} (₨{d.biltyAmount?.toLocaleString() || 0})
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                          <span>Date: {new Date(d.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {d.dispatchedAt && (
                            <span className="text-gray-400">
                              · Sent: {new Date(d.dispatchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              {d.dispatchedByName ? ` by ${d.dispatchedByName}` : ''}
                            </span>
                          )}
                          {d.acceptedAt && (
                            <span className="text-emerald-400">
                              · Accepted: {new Date(d.acceptedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                              {d.acceptedByName ? ` by ${d.acceptedByName}` : ''}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right Summary Metrics & Actions */}
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-black text-gray-500">Product Value</p>
                        <p className="font-black text-white">{fmt(d.productValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-black text-teal-400">Total (Actual + Bilty)</p>
                        <p className="font-black text-teal-300">{fmt(d.actualPlusBilty)}</p>
                      </div>

                      {!isOutlet && (
                        <div className="text-right">
                          <p className="text-[9px] uppercase font-black text-purple-400">Cost + Bilty</p>
                          <p className="font-black text-purple-300">
                            {d.costPriceMissing ? (
                              <span className="text-amber-400 text-[10px]">Missing Price</span>
                            ) : (
                              fmt(d.costPlusBilty)
                            )}
                          </p>
                        </div>
                      )}

                      {/* Explicit ACCEPT DEMAND button */}
                      {isOutlet && isIncoming && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptDemand(d.id, d.transferNumber);
                          }}
                          disabled={acceptingId === d.id}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 active:scale-95 ml-2"
                        >
                          {acceptingId === d.id ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle size={13} />
                          )}
                          <span>Accept Demand</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Itemized Drilldown */}
                  {isExpanded && (
                    <div className="p-4 bg-gray-950/70 border-t border-gray-800 space-y-4">
                      {/* Incoming Acceptance Action Banner */}
                      {isOutlet && isIncoming && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <Clock size={20} className="text-amber-400 shrink-0" />
                            <div>
                              <p className="text-xs font-black text-amber-300">
                                This demand has been dispatched and is ready for acceptance
                              </p>
                              <p className="text-[11px] text-gray-300 mt-0.5">
                                Verifying this demand will automatically add the approved product quantities to your POS inventory.
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAcceptDemand(d.id, d.transferNumber)}
                            disabled={acceptingId === d.id}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 shrink-0 active:scale-95"
                          >
                            {acceptingId === d.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} />
                            )}
                            <span>Confirm &amp; Accept Stock</span>
                          </button>
                        </div>
                      )}

                      {/* Authoritative Immutable Ledger Deduction Details */}
                      {d.deduction && (
                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
                          <div className="flex items-center space-x-2 mb-2">
                            <Wallet size={16} className="text-indigo-400" />
                            <h5 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                              Authoritative Financial Ledger Record
                            </h5>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                              <p className="text-[9px] uppercase font-black text-gray-500">Previous Balance</p>
                              <p className="font-black text-white">{fmt(d.deduction.previousBalance)}</p>
                            </div>
                            <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                              <p className="text-[9px] uppercase font-black text-red-400">Amount Deducted</p>
                              <p className="font-black text-red-300">-{fmt(d.deduction.consumedAmount)}</p>
                            </div>
                            <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                              <p className="text-[9px] uppercase font-black text-teal-400">New Running Balance</p>
                              <p className="font-black text-teal-300">{fmt(d.deduction.newBalance)}</p>
                            </div>
                            <div className="bg-gray-900/60 p-2.5 rounded-xl border border-gray-800">
                              <p className="text-[9px] uppercase font-black text-gray-500">Deduction Date</p>
                              <p className="font-bold text-gray-300">
                                {new Date(d.deduction.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          {d.deduction.details && (
                            <p className="text-[11px] text-gray-400 mt-2 italic">
                              Note: {d.deduction.details}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Product-Level Table */}
                      <div>
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2.5">
                          Product-Level Breakdown
                        </h4>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-500">
                                <th className="py-2 px-2.5">Product</th>
                                <th className="py-2 px-2.5">Variant / Size / Color</th>
                                <th className="py-2 px-2.5 text-center">Req Qty</th>
                                <th className="py-2 px-2.5 text-center">Approved / Sent</th>
                                <th className="py-2 px-2.5 text-center">Received Qty</th>
                                <th className="py-2 px-2.5 text-right">Selling Price</th>
                                <th className="py-2 px-2.5 text-right">Total Selling</th>
                                {!isOutlet && <th className="py-2 px-2.5 text-right">Cost Price</th>}
                                {!isOutlet && <th className="py-2 px-2.5 text-right">Total Cost</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-900 font-semibold">
                              {(d.items || []).map((it, idx) => {
                                const approvedQty = it.approvedQty > 0 ? it.approvedQty : 0;
                                const sentQty = approvedQty;
                                const receivedQty = isAccepted ? approvedQty : '-';

                                return (
                                  <tr key={idx} className="hover:bg-gray-900/50">
                                    <td className="py-2 px-2.5 text-white font-bold">{it.productName}</td>
                                    <td className="py-2 px-2.5 text-gray-400">
                                      {[it.size, it.color].filter(Boolean).join(' / ') || '-'}
                                    </td>
                                    <td className="py-2 px-2.5 text-center text-gray-400">
                                      {it.requestedQty || 1}
                                    </td>
                                    <td className="py-2 px-2.5 text-center font-bold text-teal-400">
                                      {sentQty}
                                    </td>
                                    <td className="py-2 px-2.5 text-center font-bold text-emerald-400">
                                      {receivedQty}
                                    </td>
                                    <td className="py-2 px-2.5 text-right text-gray-300">
                                      {fmt(it.actualUnitPrice)}
                                    </td>
                                    <td className="py-2 px-2.5 text-right font-black text-white">
                                      {fmt(it.actualLineTotal)}
                                    </td>
                                    {!isOutlet && (
                                      <td className="py-2 px-2.5 text-right">
                                        {it.costUnitPrice != null ? (
                                          <span className="text-purple-300 font-bold">{fmt(it.costUnitPrice)}</span>
                                        ) : (
                                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-black">
                                            Cost Missing
                                          </span>
                                        )}
                                      </td>
                                    )}
                                    {!isOutlet && (
                                      <td className="py-2 px-2.5 text-right">
                                        {it.costLineTotal != null ? (
                                          <span className="text-purple-200 font-black">{fmt(it.costLineTotal)}</span>
                                        ) : (
                                          <span className="text-gray-600">-</span>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                            {/* Table Footer Totals */}
                            <tfoot>
                              <tr className="border-t-2 border-gray-800 font-black text-xs bg-gray-900/40">
                                <td colSpan={6} className="py-2.5 px-2.5 text-gray-400 text-right uppercase tracking-wider">
                                  Subtotal (Products):
                                </td>
                                <td className="py-2.5 px-2.5 text-right text-white">
                                  {fmt(d.productValue)}
                                </td>
                                {!isOutlet && (
                                  <>
                                    <td className="py-2.5 px-2.5 text-right text-gray-400 uppercase tracking-wider">
                                      Total Cost:
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right text-purple-300">
                                      {fmt(d.costAmount)}
                                    </td>
                                  </>
                                )}
                              </tr>
                              <tr className="border-t border-gray-800/60 font-black text-xs bg-teal-500/5">
                                <td colSpan={6} className="py-2 px-2.5 text-teal-400 text-right uppercase tracking-wider">
                                  Delivery / Courier ({d.biltyType}):
                                </td>
                                <td className="py-2 px-2.5 text-right text-teal-300">
                                  {fmt(d.biltyAmount)}
                                </td>
                                {!isOutlet && (
                                  <>
                                    <td className="py-2 px-2.5 text-right text-purple-400 uppercase tracking-wider">
                                      Cost + Bilty:
                                    </td>
                                    <td className="py-2 px-2.5 text-right text-purple-200">
                                      {fmt(d.costPlusBilty)}
                                    </td>
                                  </>
                                )}
                              </tr>
                              <tr className="border-t border-teal-500/40 font-black text-xs bg-teal-500/10">
                                <td colSpan={6} className="py-2.5 px-2.5 text-teal-300 text-right uppercase tracking-wider">
                                  Final Demand Total (Product Value + Bilty):
                                </td>
                                <td className="py-2.5 px-2.5 text-right text-teal-300 text-sm">
                                  {fmt(d.actualPlusBilty)}
                                </td>
                                {!isOutlet && <td colSpan={2}></td>}
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Notes & Timestamps */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-gray-800">
                        <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800">
                          <p className="text-[9px] uppercase font-black text-gray-500">Store / Order Notes</p>
                          <p className="text-gray-300 mt-1">
                            {d.storeNotes || d.notes || 'No special notes entered.'}
                          </p>
                        </div>
                        <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-800 space-y-1">
                          <p className="text-[9px] uppercase font-black text-gray-500">Lifecycle Audit Timestamps</p>
                          <p className="text-gray-400 text-[11px]">
                            • Created: {new Date(d.createdAt).toLocaleString('en-GB')}
                          </p>
                          {d.dispatchedAt && (
                            <p className="text-gray-400 text-[11px]">
                              • Dispatched: {new Date(d.dispatchedAt).toLocaleString('en-GB')} {d.dispatchedByName ? `(${d.dispatchedByName})` : ''}
                            </p>
                          )}
                          {d.acceptedAt && (
                            <p className="text-emerald-400 text-[11px]">
                              • Accepted: {new Date(d.acceptedAt).toLocaleString('en-GB')} {d.acceptedByName ? `(${d.acceptedByName})` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COST PRICE EXCEL UPLOAD & AUDIT MODAL (Admin Only) */}
      {!isOutlet && uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setUploadModalOpen(false)}>
          <div className="glass max-w-2xl w-full max-h-[85vh] flex flex-col p-6 rounded-3xl border-2 border-teal-500/40 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Submit Excel Sheet of Cost Price</h3>
                  <p className="text-xs text-gray-400">Upload internal cost prices to match Abbottabad demand products</p>
                </div>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl bg-gray-800 hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex space-x-2 my-4 border-b border-gray-800 pb-2">
              <button
                onClick={() => setActiveUploadTab('upload')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  activeUploadTab === 'upload' ? 'bg-teal-500 text-gray-950 shadow-md shadow-teal-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                Upload Excel
              </button>
              <button
                onClick={() => {
                  setActiveUploadTab('history');
                  fetchUploadHistory();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                  activeUploadTab === 'history' ? 'bg-teal-500 text-gray-950 shadow-md shadow-teal-500/20' : 'text-gray-400 hover:text-white'
                }`}
              >
                Upload History &amp; Audit ({uploadHistory.length})
              </button>
            </div>

            {/* Tab: Upload */}
            {activeUploadTab === 'upload' && (
              <form onSubmit={handleFileUpload} className="space-y-4 flex-1 overflow-y-auto">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 hover:border-teal-500/60 rounded-2xl p-8 text-center cursor-pointer transition-all bg-gray-900/40 hover:bg-gray-900/70"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <div className="p-3 bg-teal-500/10 text-teal-400 rounded-2xl w-fit mx-auto mb-3">
                    <Upload size={28} />
                  </div>
                  {uploadFile ? (
                    <div>
                      <p className="text-sm font-black text-white">{uploadFile.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-black text-white">Click or drag Excel sheet here</p>
                      <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls with Product Name &amp; Cost Price</p>
                    </div>
                  )}
                </div>

                {uploadResult && (
                  <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center space-x-2 text-emerald-400 font-black">
                      <CheckCircle size={16} />
                      <span>{uploadResult.message}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-gray-300">
                      <div>Total Rows: <span className="font-black text-white">{uploadResult.totalRows}</span></div>
                      <div>Matched: <span className="font-black text-emerald-400">{uploadResult.matchedRows}</span></div>
                      <div>Missing: <span className="font-black text-amber-400">{uploadResult.missingRows}</span></div>
                      <div>Updated: <span className="font-black text-teal-400">{uploadResult.updatedRows}</span></div>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile}
                    className="px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-2"
                  >
                    {uploading && <RefreshCw size={14} className="animate-spin" />}
                    <span>{uploading ? 'Processing...' : 'Upload & Match Costs'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab: History */}
            {activeUploadTab === 'history' && (
              <div className="flex-1 overflow-y-auto space-y-3">
                {historyLoading ? (
                  <div className="py-12 text-center text-xs text-gray-400">Loading audit history...</div>
                ) : uploadHistory.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500 font-semibold">
                    No cost price uploads logged yet.
                  </div>
                ) : (
                  uploadHistory.map((h) => (
                    <div key={h.id} className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-white">{h.fileName}</span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(h.createdAt).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        By {h.uploadedByName} · {h.totalRows} rows ({h.matchedRows} matched, {h.missingRows} missing)
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AbbottabadFinancialSection;
