import React, { useState, useMemo } from 'react';
import {
  Percent, Calculator, TrendingUp, Wallet, CreditCard, Minus, RotateCcw,
  Package, DollarSign, BookOpen, Copy, Check, ChevronDown, ChevronUp,
  Sparkles, ArrowRight, ShieldCheck, Banknote
} from 'lucide-react';
import toast from 'react-hot-toast';

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '₨0';
  return `₨${Math.round(Number(n)).toLocaleString()}`;
};

const PRESET_PERCENTAGES = [5, 10, 15, 20, 25, 30, 40, 50, 70, 100];

const AbbottabadPercentageCalculator = ({ summary, rangeLabel = 'Selected Period' }) => {
  const [percentage, setPercentage] = useState(20);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeView, setActiveView] = useState('all'); // 'all' | 'sales' | 'demands'
  const [customBaseOverride, setCustomBaseOverride] = useState('');
  const [copied, setCopied] = useState(false);

  // Safe base values from summary and summary.posSales
  const posSales = summary?.posSales || {};

  const grossSales = Number(posSales.grossSales || posSales.totalSales || 0);
  const netRevenue = Number(posSales.netRevenue || 0);
  const netSales = Number(posSales.netSales || 0);
  const totalReceived = Number(posSales.totalReceived || 0);
  const totalDiscount = Number(posSales.totalDiscount || 0);
  const totalReturns = Number(posSales.totalReturns || 0);
  const totalExpenses = Number(posSales.totalJournalExpenses || 0);
  const cashTotal = Number(posSales.cash || 0);
  const cardTotal = Number(posSales.card || 0);
  const onlineTotal = Number(posSales.online || 0);

  const demandProductValue = Number(summary?.productValue || 0);
  const demandCostAmount = Number(summary?.costAmount || 0);
  const demandBilty = Number(summary?.biltyAmount || 0);
  const demandGrossMargin = Math.max(0, demandProductValue - demandCostAmount);

  // Numeric percentage ratio (0 to 1)
  const pctRatio = Math.max(0, Math.min(100, Number(percentage) || 0)) / 100;

  // Custom base calculation if entered
  const customBaseNum = customBaseOverride !== '' ? parseFloat(customBaseOverride) || 0 : null;
  const customShare = customBaseNum !== null ? customBaseNum * pctRatio : null;

  // Calculated shares
  const shares = useMemo(() => {
    return {
      grossSales: grossSales * pctRatio,
      netRevenue: netRevenue * pctRatio,
      netSales: netSales * pctRatio,
      totalReceived: totalReceived * pctRatio,
      totalDiscount: totalDiscount * pctRatio,
      totalReturns: totalReturns * pctRatio,
      totalExpenses: totalExpenses * pctRatio,
      cash: cashTotal * pctRatio,
      card: cardTotal * pctRatio,
      online: onlineTotal * pctRatio,
      demandProductValue: demandProductValue * pctRatio,
      demandCostAmount: demandCostAmount * pctRatio,
      demandGrossMargin: demandGrossMargin * pctRatio,
      demandBilty: demandBilty * pctRatio,
    };
  }, [
    grossSales, netRevenue, netSales, totalReceived, totalDiscount, totalReturns,
    totalExpenses, cashTotal, cardTotal, onlineTotal, demandProductValue,
    demandCostAmount, demandGrossMargin, demandBilty, pctRatio
  ]);

  const handleCopyBreakdown = () => {
    const text = `==============================
ABBOTTABAD ${percentage}% PERCENTAGE SHARE BREAKDOWN
Period: ${rangeLabel}
==============================

-- POS RETAIL SALES & REVENUE (${percentage}%) --
* Gross Sell / Sales : ${fmt(shares.grossSales)}  (of ${fmt(grossSales)})
* Net Revenue        : ${fmt(shares.netRevenue)}  (of ${fmt(netRevenue)})
* Net Sales          : ${fmt(shares.netSales)}  (of ${fmt(netSales)})
* Total Received     : ${fmt(shares.totalReceived)}  (of ${fmt(totalReceived)})
* Total Discounts    : ${fmt(shares.totalDiscount)}  (of ${fmt(totalDiscount)})
* Returns / Refunds  : ${fmt(shares.totalReturns)}  (of ${fmt(totalReturns)})
* Cash Collection    : ${fmt(shares.cash)}  (of ${fmt(cashTotal)})
* Card Collection    : ${fmt(shares.card)}  (of ${fmt(cardTotal)})
* Online Collection  : ${fmt(shares.online)}  (of ${fmt(onlineTotal)})
* Store Expenses     : ${fmt(shares.totalExpenses)}  (of ${fmt(totalExpenses)})

-- DEMAND & STOCK FINANCIALS (${percentage}%) --
* Demand Stock Value : ${fmt(shares.demandProductValue)}  (of ${fmt(demandProductValue)})
* Internal Cost Price: ${fmt(shares.demandCostAmount)}  (of ${fmt(demandCostAmount)})
* Gross Margin       : ${fmt(shares.demandGrossMargin)}  (of ${fmt(demandGrossMargin)})
* Bilty Courier      : ${fmt(shares.demandBilty)}  (of ${fmt(demandBilty)})

Generated via Smart Production ERP`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${percentage}% share breakdown copied to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="glass rounded-2xl md:rounded-3xl border-2 border-teal-500/30 p-5 md:p-7 shadow-2xl relative overflow-hidden">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-80 h-32 bg-teal-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-0 left-1/4 w-80 h-32 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-500/40 rounded-2xl text-teal-400 shadow-lg shadow-teal-500/10">
            <Percent size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg md:text-xl font-black text-white tracking-tight">
                Abbottabad Percentage Share Calculator
              </h2>
              <span className="px-2 py-0.5 bg-teal-500/15 border border-teal-500/30 text-teal-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={10} /> Live
              </span>
            </div>
            <p className="text-xs font-semibold text-gray-400 mt-0.5">
              Instantly compute any percentage share of Sell, Net Revenue, Received, Returns, and Demand Values for{' '}
              <span className="text-teal-300 font-bold">{rangeLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleCopyBreakdown}
            className="px-3.5 py-2 bg-gray-800/90 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 active:scale-95 shadow-md"
            title="Copy breakdown to clipboard"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-gray-800/90 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-all"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6 pt-5">
          {/* Interactive Percentage Input & Slider Controller */}
          <div className="p-4 md:p-5 rounded-2xl bg-gray-950/70 border border-teal-500/20 shadow-inner">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Main Percentage Number Input */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center bg-gray-900 border-2 border-teal-500/50 rounded-2xl p-1.5 px-3 shadow-lg focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-400/20 transition-all">
                  <span className="text-xs font-black uppercase tracking-wider text-teal-400 mr-2">
                    Enter Share:
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={percentage}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPercentage(val === '' ? '' : parseFloat(val));
                    }}
                    className="w-20 bg-transparent text-xl font-black text-white text-right focus:outline-none tracking-tight"
                    placeholder="20"
                  />
                  <span className="text-xl font-black text-teal-400 ml-1">%</span>
                </div>

                {/* Quick Step Buttons */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setPercentage((prev) => Math.max(0, (Number(prev) || 0) - 5))}
                    className="px-2.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-black transition-all"
                    title="Decrease by 5%"
                  >
                    -5%
                  </button>
                  <button
                    onClick={() => setPercentage((prev) => Math.min(100, (Number(prev) || 0) + 5))}
                    className="px-2.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-black transition-all"
                    title="Increase by 5%"
                  >
                    +5%
                  </button>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mr-1">
                  Presets:
                </span>
                {PRESET_PERCENTAGES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPercentage(p)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all ${
                      Number(percentage) === p
                        ? 'bg-teal-500 text-gray-950 font-black shadow-lg shadow-teal-500/25 scale-105'
                        : 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700/60'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            {/* Range Slider for tactile scrubbing */}
            <div className="mt-4 pt-3 border-t border-gray-800/80">
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-400 mb-1.5">
                <span>0%</span>
                <span className="text-teal-300 font-black">
                  Interactive Drag: {Number(percentage) || 0}%
                </span>
                <span>100%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={Number(percentage) || 0}
                onChange={(e) => setPercentage(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
            </div>
          </div>

          {/* Quick Summary Callout Banner */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-transparent border border-teal-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <p className="text-xs font-bold text-gray-300">
                At <span className="text-teal-300 font-black text-sm">{percentage}%</span> share:{' '}
                <span className="text-white font-black">Sell = {fmt(shares.grossSales)}</span>
                {' • '}
                <span className="text-emerald-300 font-black">Net Revenue = {fmt(shares.netRevenue)}</span>
                {' • '}
                <span className="text-purple-300 font-black">Demand Stock = {fmt(shares.demandProductValue)}</span>
              </p>
            </div>

            {/* View Selector Filter Tabs */}
            <div className="flex items-center gap-1 self-end md:self-auto bg-gray-900/90 p-1 rounded-xl border border-gray-800">
              <button
                onClick={() => setActiveView('all')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeView === 'all'
                    ? 'bg-teal-500 text-gray-950 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All Metrics
              </button>
              <button
                onClick={() => setActiveView('sales')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeView === 'sales'
                    ? 'bg-teal-500 text-gray-950 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                POS Sales
              </button>
              <button
                onClick={() => setActiveView('demands')}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  activeView === 'demands'
                    ? 'bg-teal-500 text-gray-950 shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Demands
              </button>
            </div>
          </div>

          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. SELL / TOTAL SALES (GROSS) */}
            {(activeView === 'all' || activeView === 'sales') && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-gray-900/90 to-gray-950 border border-teal-500/40 hover:border-teal-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400">
                      <TrendingUp size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-teal-300">
                      Sell (Gross Sales)
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-white tracking-tight">
                    {fmt(shares.grossSales)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Base Value</span>
                  <span className="text-gray-300 font-bold">{fmt(grossSales)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(grossSales)} × {percentage}%
                </p>
              </div>
            )}

            {/* 2. NET REVENUE */}
            {(activeView === 'all' || activeView === 'sales') && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/30 to-gray-950 border border-emerald-500/40 hover:border-emerald-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <Wallet size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                      Net Revenue
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-emerald-300 tracking-tight">
                    {fmt(shares.netRevenue)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Base Value</span>
                  <span className="text-emerald-400/80 font-bold">{fmt(netRevenue)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(netRevenue)} × {percentage}%
                </p>
              </div>
            )}

            {/* 3. TOTAL RECEIVED */}
            {(activeView === 'all' || activeView === 'sales') && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-cyan-950/20 to-gray-950 border border-cyan-500/30 hover:border-cyan-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400">
                      <CreditCard size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                      Total Received
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-cyan-200 tracking-tight">
                    {fmt(shares.totalReceived)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Base Value</span>
                  <span className="text-cyan-400/80 font-bold">{fmt(totalReceived)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(totalReceived)} × {percentage}%
                </p>
              </div>
            )}

            {/* 4. TOTAL DISCOUNTS */}
            {(activeView === 'all' || activeView === 'sales') && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-rose-950/20 to-gray-950 border border-rose-500/30 hover:border-rose-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-400">
                      <Minus size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-rose-300">
                      Total Discounts
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-rose-300 tracking-tight">
                    {fmt(shares.totalDiscount)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Base Value</span>
                  <span className="text-rose-400/80 font-bold">{fmt(totalDiscount)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(totalDiscount)} × {percentage}%
                </p>
              </div>
            )}

            {/* 5. RETURNS / REFUNDS */}
            {(activeView === 'all' || activeView === 'sales') && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-950/20 to-gray-950 border border-amber-500/30 hover:border-amber-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
                      <RotateCcw size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                      Returns / Refunds
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-amber-300 tracking-tight">
                    {fmt(shares.totalReturns)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Base Value</span>
                  <span className="text-amber-400/80 font-bold">{fmt(totalReturns)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(totalReturns)} × {percentage}%
                </p>
              </div>
            )}

            {/* 6. DEMAND PRODUCT VALUE */}
            {(activeView === 'all' || activeView === 'demands') && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-gray-900/90 to-gray-950 border border-teal-500/30 hover:border-teal-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400">
                      <Package size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-teal-300">
                      Demand Stock Value
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-white tracking-tight">
                    {fmt(shares.demandProductValue)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Demand Stock</span>
                  <span className="text-gray-300 font-bold">{fmt(demandProductValue)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(demandProductValue)} × {percentage}%
                </p>
              </div>
            )}

            {/* 7. DEMAND COST AMOUNT */}
            {(activeView === 'all' || activeView === 'demands') && summary?.costAmount !== null && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-950/30 to-gray-950 border border-purple-500/30 hover:border-purple-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
                      <ShieldCheck size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
                      Demand Cost Price
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-purple-300 tracking-tight">
                    {fmt(shares.demandCostAmount)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Internal Cost</span>
                  <span className="text-purple-400/80 font-bold">{fmt(demandCostAmount)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(demandCostAmount)} × {percentage}%
                </p>
              </div>
            )}

            {/* 8. DEMAND GROSS MARGIN */}
            {(activeView === 'all' || activeView === 'demands') && summary?.costAmount !== null && (
              <div className="p-4 rounded-2xl bg-gradient-to-b from-yellow-950/20 to-gray-950 border border-yellow-500/30 hover:border-yellow-400 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-400">
                      <DollarSign size={16} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-yellow-300">
                      Gross Demand Margin
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full">
                    {percentage}%
                  </span>
                </div>
                <div className="my-1">
                  <p className="text-xl md:text-2xl font-black text-yellow-300 tracking-tight">
                    {fmt(shares.demandGrossMargin)}
                  </p>
                </div>
                <div className="pt-2 mt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-gray-500 font-bold">100% Total Margin</span>
                  <span className="text-yellow-400/80 font-bold">{fmt(demandGrossMargin)}</span>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-1">
                  {fmt(demandGrossMargin)} × {percentage}%
                </p>
              </div>
            )}
          </div>

          {/* PAYMENT BREAKDOWN MINI CARDS & STORE EXPENSES */}
          {(activeView === 'all' || activeView === 'sales') && (
            <div className="p-4 rounded-2xl bg-gray-900/60 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Banknote size={14} className="text-teal-400" /> Payment Methods Share ({percentage}%)
                </span>
                <span className="text-[10px] text-gray-500">
                  Cash, Card & Online breakdowns at {percentage}%
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="p-3 bg-gray-950/60 rounded-xl border border-emerald-500/20">
                  <p className="text-[9px] font-black uppercase text-emerald-400">Cash Share</p>
                  <p className="text-sm font-black text-white mt-0.5">{fmt(shares.cash)}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">of {fmt(cashTotal)}</p>
                </div>
                <div className="p-3 bg-gray-950/60 rounded-xl border border-purple-500/20">
                  <p className="text-[9px] font-black uppercase text-purple-400">Card Share</p>
                  <p className="text-sm font-black text-white mt-0.5">{fmt(shares.card)}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">of {fmt(cardTotal)}</p>
                </div>
                <div className="p-3 bg-gray-950/60 rounded-xl border border-blue-500/20">
                  <p className="text-[9px] font-black uppercase text-blue-400">Online Share</p>
                  <p className="text-sm font-black text-white mt-0.5">{fmt(shares.online)}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">of {fmt(onlineTotal)}</p>
                </div>
                <div className="p-3 bg-gray-950/60 rounded-xl border border-pink-500/20">
                  <p className="text-[9px] font-black uppercase text-pink-400">Store Expenses</p>
                  <p className="text-sm font-black text-white mt-0.5">{fmt(shares.totalExpenses)}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">of {fmt(totalExpenses)}</p>
                </div>
              </div>
            </div>
          )}

          {/* CUSTOM BASE AMOUNT CALCULATOR */}
          <div className="p-4 rounded-2xl bg-gray-950/40 border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <Calculator size={18} className="text-teal-400 shrink-0" />
              <div>
                <p className="text-xs font-black text-white uppercase tracking-wider">
                  Test Any Custom Amount at {percentage}%
                </p>
                <p className="text-[10px] text-gray-400 font-semibold">
                  Type any custom figure to calculate its {percentage}% share instantly
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl px-2.5 py-1.5 focus-within:border-teal-400">
                <span className="text-xs font-black text-teal-400 mr-1.5">₨</span>
                <input
                  type="number"
                  min="0"
                  value={customBaseOverride}
                  onChange={(e) => setCustomBaseOverride(e.target.value)}
                  placeholder="e.g. 500000"
                  className="bg-transparent text-xs font-bold text-white w-28 focus:outline-none"
                />
              </div>

              {customShare !== null && customBaseOverride !== '' && (
                <div className="flex items-center space-x-2 bg-teal-500/15 border border-teal-500/40 px-3 py-1.5 rounded-xl">
                  <ArrowRight size={14} className="text-teal-400" />
                  <span className="text-xs font-black text-teal-300">
                    {fmt(customShare)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbbottabadPercentageCalculator;
