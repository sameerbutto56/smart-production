import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, Package, Truck, TrendingUp, TrendingDown, AlertTriangle,
  Upload, FileSpreadsheet, Download, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Search, Calendar, FileText, Layers, Eye
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import useDateRange from '../hooks/useDateRange';
import AbbottabadAmountCard from './AbbottabadAmountCard';
import AbbottabadPercentageCalculator from './AbbottabadPercentageCalculator';

const fmt = (n) => {
  if (n === null || n === undefined) return '-';
  return `₨${Math.round(Number(n)).toLocaleString()}`;
};

const AbbottabadFinancialSection = () => {
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

  // Cost Excel Upload Modal
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

  const filteredRecords = records.filter(r => {
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
      {/* AMOUNT CONTROL CARD */}
      <AbbottabadAmountCard isAdmin={true} />

      {/* PERCENTAGE SHARE CALCULATOR */}
      <AbbottabadPercentageCalculator summary={summary} rangeLabel={rangeLabel} />

      {/* FINANCIAL & DEMAND HEADER CONTROLS */}
      <div className="glass rounded-2xl md:rounded-3xl border-2 border-gray-800 p-5 md:p-7 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-gray-800">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-400">
                <DollarSign size={24} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Abbottabad Financial & Demand Summary
                </h2>
                <p className="text-xs font-semibold text-gray-400">
                  Actual Selling Values, Fixed Bilty (₨1,500), and Confidential Internal Costs
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
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

        {/* 6 High-Impact Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {/* 1. Product Value */}
          <div className="p-4 rounded-2xl bg-gray-900/80 border border-gray-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1">
              Product Value
            </p>
            <p className="text-lg md:text-xl font-black text-white">
              {fmt(summary?.productValue)}
            </p>
            <p className="text-[9px] font-bold text-gray-500 mt-1">Actual selling value</p>
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
              Actual Amount + Bilty
            </p>
            <p className="text-lg md:text-xl font-black text-teal-300">
              {fmt(summary?.actualPlusBilty)}
            </p>
            <p className="text-[9px] font-bold text-teal-400/80 mt-1">Product Value + Bilty</p>
          </div>

          {/* 4. Cost Amount */}
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

          {/* 5. Cost Amount + Bilty */}
          <div className="p-4 rounded-2xl bg-purple-500/15 border border-purple-500/40">
            <p className="text-[10px] font-black uppercase tracking-wider text-purple-200 mb-1">
              Cost Amount + Bilty
            </p>
            <p className="text-lg md:text-xl font-black text-purple-200">
              {fmt(summary?.costPlusBilty)}
            </p>
            <p className="text-[9px] font-bold text-purple-300/80 mt-1">Cost Price + Bilty</p>
          </div>

          {/* 6. Total Demands */}
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

        {/* Missing Cost Banner */}
        {summary?.missingCostDemandsCount > 0 && (
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

      {/* DEMAND DRILLDOWN SECTION */}
      <div className="glass rounded-2xl md:rounded-3xl border-2 border-gray-800 p-5 md:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-800">
          <div>
            <h3 className="text-lg font-black text-white">Abbottabad Demand Drilldown</h3>
            <p className="text-xs text-gray-400">Click any demand row to expand itemized financial breakdown</p>
          </div>

          <div className="relative w-full sm:w-64">
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

        {recordsLoading ? (
          <div className="py-12 text-center text-gray-400 text-xs">Loading Abbottabad demands...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm font-semibold">
            No demands found in the selected date range.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredRecords.map((d) => {
              const isExpanded = expandedDemandId === d.id;
              const isBilty = d.biltyType === 'BILTY';

              return (
                <div
                  key={d.id}
                  className={`border-2 rounded-2xl transition-all overflow-hidden ${
                    isExpanded ? 'border-teal-500/50 bg-gray-900/80 shadow-lg' : 'border-gray-800/80 bg-gray-900/40 hover:border-gray-700'
                  }`}
                >
                  {/* Summary Bar */}
                  <div
                    onClick={() => setExpandedDemandId(isExpanded ? null : d.id)}
                    className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-800 rounded-xl text-gray-400">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-sm text-white">
                            #{d.transferNumber || d.id.slice(0, 8)}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-gray-800 text-gray-300">
                            {d.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isBilty ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-gray-800 text-gray-400'
                          }`}>
                            {d.biltyType} (₨{d.biltyAmount?.toLocaleString() || 0})
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Date: {new Date(d.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {d.deliveryChannel ? ` · Channel: ${d.deliveryChannel}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Right summary metrics */}
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-black text-gray-500">Product Value</p>
                        <p className="font-black text-white">{fmt(d.productValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-black text-teal-400">Actual + Bilty</p>
                        <p className="font-black text-teal-300">{fmt(d.actualPlusBilty)}</p>
                      </div>
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
                    </div>
                  </div>

                  {/* Expanded Itemized Drilldown */}
                  {isExpanded && (
                    <div className="p-4 bg-gray-950/70 border-t border-gray-800">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400 mb-2.5">
                        Product-Level Financial Breakdown
                      </h4>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-500">
                              <th className="py-2 px-2.5">Product</th>
                              <th className="py-2 px-2.5">Variant / Size / Color</th>
                              <th className="py-2 px-2.5 text-center">Req / Appr</th>
                              <th className="py-2 px-2.5 text-right">Actual Unit Price</th>
                              <th className="py-2 px-2.5 text-right">Actual Total</th>
                              <th className="py-2 px-2.5 text-right">Cost Price</th>
                              <th className="py-2 px-2.5 text-right">Total Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-900 font-semibold">
                            {(d.items || []).map((it, idx) => {
                              const qty = it.approvedQty > 0 ? it.approvedQty : (it.requestedQty || 1);
                              return (
                                <tr key={idx} className="hover:bg-gray-900/50">
                                  <td className="py-2 px-2.5 text-white font-bold">{it.productName}</td>
                                  <td className="py-2 px-2.5 text-gray-400">
                                    {[it.size, it.color].filter(Boolean).join(' / ') || '-'}
                                  </td>
                                  <td className="py-2 px-2.5 text-center text-gray-300">
                                    <span className="text-gray-500">{it.requestedQty}</span> → <span className="font-bold text-teal-400">{qty}</span>
                                  </td>
                                  <td className="py-2 px-2.5 text-right text-gray-300">
                                    {fmt(it.actualUnitPrice)}
                                  </td>
                                  <td className="py-2 px-2.5 text-right font-black text-white">
                                    {fmt(it.actualLineTotal)}
                                  </td>
                                  <td className="py-2 px-2.5 text-right">
                                    {it.costUnitPrice != null ? (
                                      <span className="text-purple-300 font-bold">{fmt(it.costUnitPrice)}</span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-[10px] font-black">
                                        Cost Missing
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2.5 text-right">
                                    {it.costLineTotal != null ? (
                                      <span className="text-purple-200 font-black">{fmt(it.costLineTotal)}</span>
                                    ) : (
                                      <span className="text-gray-600">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Table Footer Totals */}
                          <tfoot>
                            <tr className="border-t-2 border-gray-800 font-black text-xs bg-gray-900/40">
                              <td colSpan={4} className="py-2.5 px-2.5 text-gray-400 text-right uppercase tracking-wider">
                                Subtotals:
                              </td>
                              <td className="py-2.5 px-2.5 text-right text-white">
                                {fmt(d.productValue)}
                              </td>
                              <td className="py-2.5 px-2.5 text-right text-gray-400 uppercase tracking-wider">
                                Total Cost:
                              </td>
                              <td className="py-2.5 px-2.5 text-right text-purple-300">
                                {fmt(d.costAmount)}
                              </td>
                            </tr>
                            <tr className="border-t border-gray-800/60 font-black text-xs bg-teal-500/5">
                              <td colSpan={4} className="py-2 px-2.5 text-teal-400 text-right uppercase tracking-wider">
                                Delivery / Courier ({d.biltyType}):
                              </td>
                              <td className="py-2 px-2.5 text-right text-teal-300">
                                {fmt(d.biltyAmount)}
                              </td>
                              <td className="py-2 px-2.5 text-right text-purple-400 uppercase tracking-wider">
                                Cost + Bilty:
                              </td>
                              <td className="py-2 px-2.5 text-right text-purple-200">
                                {fmt(d.costPlusBilty)}
                              </td>
                            </tr>
                            <tr className="border-t border-teal-500/40 font-black text-xs bg-teal-500/10">
                              <td colSpan={4} className="py-2.5 px-2.5 text-teal-300 text-right uppercase tracking-wider">
                                Final Total (Actual + Bilty):
                              </td>
                              <td className="py-2.5 px-2.5 text-right text-teal-300 text-sm">
                                {fmt(d.actualPlusBilty)}
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COST PRICE EXCEL UPLOAD & AUDIT MODAL */}
      {uploadModalOpen && (
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
                Upload History & Audit ({uploadHistory.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {activeUploadTab === 'upload' ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-300 bg-gray-900/60 p-3.5 rounded-xl border border-gray-800">
                    Upload an Excel file (<code className="text-teal-400">.xlsx</code> or <code className="text-teal-400">.xls</code>) containing columns such as <span className="font-bold text-white">Product Name, Article, SKU, Variant, Size, Color, Cost Price</span>.
                    Products will be matched by SKU/Article/Name. Historical cost versions remain preserved.
                  </p>

                  <form onSubmit={handleFileUpload} className="space-y-4">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-700 hover:border-teal-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-gray-900/40 hover:bg-teal-500/5"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setUploadFile(e.target.files[0]);
                          }
                        }}
                      />
                      <Upload size={32} className="mx-auto text-teal-400 mb-2" />
                      <p className="text-xs font-black text-white">
                        {uploadFile ? uploadFile.name : 'Click or drag & drop to choose Excel file'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">
                        Supported formats: .xlsx, .xls, .csv (Max 20MB)
                      </p>
                    </div>

                    {uploadResult && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                        <div className="flex items-center space-x-2 text-emerald-400 font-black text-xs mb-2">
                          <CheckCircle size={16} />
                          <span>{uploadResult.message}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="p-2 bg-gray-900 rounded-xl">
                            <p className="text-[9px] text-gray-400 font-bold uppercase">Total Rows</p>
                            <p className="font-black text-white">{uploadResult.totalRows}</p>
                          </div>
                          <div className="p-2 bg-gray-900 rounded-xl">
                            <p className="text-[9px] text-emerald-400 font-bold uppercase">Matched</p>
                            <p className="font-black text-emerald-300">{uploadResult.matchedProducts}</p>
                          </div>
                          <div className="p-2 bg-gray-900 rounded-xl">
                            <p className="text-[9px] text-amber-400 font-bold uppercase">Missing</p>
                            <p className="font-black text-amber-300">{uploadResult.missingPrices}</p>
                          </div>
                          <div className="p-2 bg-gray-900 rounded-xl">
                            <p className="text-[9px] text-red-400 font-bold uppercase">Failed</p>
                            <p className="font-black text-red-300">{uploadResult.failedRows}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setUploadModalOpen(false)}
                        className="px-5 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-xs font-black uppercase"
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={uploading || !uploadFile}
                        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-teal-600/20"
                      >
                        {uploading ? 'Processing...' : 'Upload & Apply'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyLoading ? (
                    <div className="py-8 text-center text-gray-400 text-xs">Loading audit history...</div>
                  ) : uploadHistory.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-xs">No upload history found.</div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {uploadHistory.map((h) => (
                        <div key={h.id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-black text-xs text-white">{h.fileName}</p>
                            <p className="text-[10px] text-gray-400">
                              By {h.uploadedByName} on {new Date(h.createdAt).toLocaleString('en-GB')}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3 text-xs">
                            <span className="text-gray-400">Total: <strong className="text-white">{h.totalRows}</strong></span>
                            <span className="text-emerald-400">Matched: <strong>{h.matchedRows}</strong></span>
                            {h.missingRows > 0 && <span className="text-amber-400">Missing: {h.missingRows}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbbottabadFinancialSection;
