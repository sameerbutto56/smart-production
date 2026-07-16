import React from 'react';
import { ShoppingCart, BarChart3, RotateCcw, Clock, RefreshCw, Barcode, BookOpen, Book } from 'lucide-react';
import { POSProvider, usePOS } from '../context/POSContext';
import POSProducts from '../components/POSProducts';
import POSCart from '../components/POSCart';
import POSModals from '../components/POSModals';
import POSHistory from '../components/POSHistory';
import POSReturns from '../components/POSReturns';
import POSDashboard from '../components/POSDashboard';

const OutletPOSInner = () => {
  const {
    tab, setTab,
    selectedOutlet, setSelectedOutlet,
    barcodeInput, setBarcodeInput, barcodeRef,
    search, setSearch,
    paymentMethod, setPaymentMethod,
    user,
    currentBook, bookLoading, openBookLoading,
    showBookReminder, setShowBookReminder,
    productsLoading,
    setAuthMode, setShowAuthModal,
    handleBarcodeLookup, refreshAll,
    productsKey, dashboardKey, salesKey, returnsKey,
  } = usePOS();

  const posTabs = (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b-2 border-gray-800 flex-shrink-0">
        <button onClick={() => setTab('pos')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'pos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><ShoppingCart size={14} className="inline mr-1" />POS</button>
        <button onClick={() => setTab('dashboard')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><BarChart3 size={14} className="inline mr-1" />Dashboard</button>
        <button onClick={() => setTab('returns')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'returns' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><RotateCcw size={14} className="inline mr-1" />Returns</button>
        <button onClick={() => setTab('history')} className={`text-xs font-bold px-3 py-2 rounded-xl ${tab === 'history' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}><Clock size={14} className="inline mr-1" />History</button>
        <button onClick={refreshAll} className="text-xs font-bold px-2 py-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white" title="Refresh data"><RefreshCw size={14} className={`inline ${productsLoading ? 'animate-spin' : ''}`} /></button>
        <div className="relative flex-1 max-w-md">
          <Barcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input ref={barcodeRef} value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} placeholder="Scan barcode..."
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none" />
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
          className="flex-1 bg-gray-800 border-2 border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-gray-500 focus:border-blue-500 outline-none max-w-xs" />
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-gray-500 mr-1">Pay via:</span>
          <div className="flex gap-1">
            {['CASH','CARD','ONLINE','CASH_ONLINE'].map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-black border-2 ${paymentMethod === m ? (m === 'CARD' ? 'border-purple-500 bg-purple-600/20 text-purple-300' : m === 'CASH_ONLINE' ? 'border-amber-500 bg-amber-600/20 text-amber-300' : m === 'ONLINE' ? 'border-blue-500 bg-blue-600/20 text-blue-300' : 'border-emerald-500 bg-emerald-600/20 text-emerald-300') : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
                {m.replace('_', ' + ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* POS Branch Selector (Admin only) */}
      {user?.role !== 'OUTLET' && (
        <div className="flex gap-1.5 px-4 py-2 bg-gray-950 border-b border-gray-800 overflow-x-auto flex-shrink-0">
          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center mr-2">POS Branch:</span>
          {['Johar Town', 'Jail Road', 'Abbottabad'].map(outlet => (
            <button key={outlet} onClick={() => setSelectedOutlet(outlet)}
              className={`text-[9px] font-black px-3.5 py-1.5 rounded-lg uppercase tracking-wider transition-all ${
                outlet === selectedOutlet ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}>
              {outlet}
            </button>
          ))}
        </div>
      )}

      {/* Book Status Bar */}
      {tab === 'pos' && (
        <div className={`flex items-center justify-between px-4 py-1.5 flex-shrink-0 border-b ${currentBook ? 'bg-emerald-900/30 border-emerald-800/50' : 'bg-red-900/20 border-red-800/30'}`}>
          <div className="flex items-center gap-2">
            {currentBook ? (
              <><BookOpen size={14} className="text-emerald-400" /><span className="text-[11px] font-bold text-emerald-300">Register Open</span><span className="text-[10px] text-emerald-500/70">since {new Date(currentBook.openedAt).toLocaleString()}</span></>
            ) : (
              <><Book size={14} className="text-red-400" /><span className="text-[11px] font-bold text-red-300">No Open Register</span></>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentBook ? (
              <button onClick={() => { setAuthMode('close'); setShowAuthModal(true); }} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">Close Register</button>
            ) : (
              <button onClick={() => { setAuthMode('open'); setShowAuthModal(true); }} disabled={openBookLoading} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white">
                {openBookLoading ? 'Opening...' : 'Open Register'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 9 PM Reminder */}
      {showBookReminder && currentBook && (
        <div className="bg-amber-900/30 border-b border-amber-700/50 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-bold text-amber-300">Time to Close the Register</span>
          <button onClick={() => setShowBookReminder(false)} className="text-[10px] text-amber-400 hover:text-amber-300 underline">Dismiss</button>
        </div>
      )}

      {/* Locked state — no open book */}
      {tab === 'pos' && !currentBook && !bookLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm px-6">
            <div className="mx-auto w-20 h-20 bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-700/50">
              <BookOpen size={40} className="text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Open Register Required</h2>
            <p className="text-sm text-gray-400 mb-6">You must open the register before using the POS.</p>
            <button onClick={() => { setAuthMode('open'); setShowAuthModal(true); }} disabled={openBookLoading}
              className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-lg flex items-center gap-3 mx-auto transition-all active:scale-95">
              <BookOpen size={20} />
              {openBookLoading ? 'Opening...' : 'Open Register'}
            </button>
          </div>
        </div>
      )}

      {/* Normal POS content */}
      {(tab !== 'pos' || currentBook || bookLoading) && (
      <div className="flex flex-1 overflow-hidden">
        <POSProducts />
        <POSCart />
      </div>
      )}
      <POSModals />
    </div>
  );

  if (tab === 'dashboard') return <><div className="h-[calc(100vh-80px)] flex flex-col"><POSDashboard /></div><POSModals /></>;
  if (tab === 'returns') return <><div className="h-[calc(100vh-80px)] flex flex-col overflow-y-auto"><POSReturns /></div><POSModals /></>;
  if (tab === 'history') return <><div className="h-[calc(100vh-80px)] flex flex-col"><POSHistory /></div><POSModals /></>;

  return posTabs;
};

const OutletPOS = () => (
  <POSProvider>
    <OutletPOSInner />
  </POSProvider>
);

export default OutletPOS;
