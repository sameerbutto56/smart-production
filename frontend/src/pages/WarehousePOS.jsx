import React from 'react';
import { ShoppingCart, RotateCcw, Clock, Barcode, RefreshCw, Search, Package } from 'lucide-react';
import { WarehousePOSProvider, useWarehousePOS } from '../context/WarehousePOSContext';
import WarehousePOSProducts from '../components/WarehousePOSProducts';
import WarehousePOSCart from '../components/WarehousePOSCart';
import WarehousePOSModals from '../components/WarehousePOSModals';
import WarehousePOSHistory from '../components/WarehousePOSHistory';
import WarehousePOSReturns from '../components/WarehousePOSReturns';

const WarehousePOSInner = () => {
  const {
    tab, set, barcodeInput, set: setBarcode, barcodeRef,
    search, set: setSearch, paymentMethod, set: setPaymentMethod,
    hideZeroStock, set: setHideZeroStock, productsLoading,
    refreshAll, formatCurrency,
  } = useWarehousePOS();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b-2 border-gray-800 flex-shrink-0">
        <button onClick={() => set('tab', 'pos')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'pos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          <ShoppingCart size={14} className="inline mr-1" />POS
        </button>
        <button onClick={() => set('tab', 'returns')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'returns' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          <RotateCcw size={14} className="inline mr-1" />Returns
        </button>
        <button onClick={() => set('tab', 'history')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'history' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          <Clock size={14} className="inline mr-1" />History
        </button>
        <button onClick={refreshAll} className="text-xs font-bold px-2 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white" title="Refresh data">
          <RefreshCw size={14} className={`inline ${productsLoading ? 'animate-spin' : ''}`} />
        </button>
        <div className="relative flex-1 max-w-md">
          <Barcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input ref={barcodeRef} value={barcodeInput} onChange={e => set('barcodeInput', e.target.value)}
            placeholder="Scan barcode..."
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
        </div>
        <input value={search} onChange={e => set('search', e.target.value)} placeholder="Search products..."
          className="flex-1 bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none max-w-xs" />
        <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={hideZeroStock} onChange={e => set('hideZeroStock', e.target.checked)} className="accent-blue-500" />
          Hide 0 stock
        </label>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-gray-500 mr-1">Pay via:</span>
          <div className="flex gap-1">
            {['CASH','CARD','ONLINE','CASH_ONLINE'].map(m => (
              <button key={m} onClick={() => set('paymentMethod', m)}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-black border-2 ${paymentMethod === m ? (m === 'CARD' ? 'border-purple-500 bg-purple-600/20 text-purple-300' : m === 'CASH_ONLINE' ? 'border-amber-500 bg-amber-600/20 text-amber-300' : m === 'ONLINE' ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-emerald-500 bg-emerald-600/20 text-emerald-300') : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                {m.replace('_', ' + ')}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">WH</span>
      </div>

      {/* Tab content */}
      {tab === 'pos' && (
        <div className="flex h-[calc(100vh-80px)]">
          <WarehousePOSProducts />
          <WarehousePOSCart />
        </div>
      )}
      {tab === 'returns' && <WarehousePOSReturns />}
      {tab === 'history' && <WarehousePOSHistory />}

      {/* Modals rendered for all tabs */}
      <WarehousePOSModals />
    </div>
  );
};

const WarehousePOS = () => (
  <WarehousePOSProvider>
    <WarehousePOSInner />
  </WarehousePOSProvider>
);

export default WarehousePOS;
