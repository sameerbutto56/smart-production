import React, { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Trash2, Search, Loader2, AlertTriangle, CheckCircle2, RefreshCw, X, ShieldAlert } from 'lucide-react';

const DeleteInvoicePanel = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleLookup = async (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      toast.error('Please enter an invoice number or order number');
      return;
    }
    setLoading(true);
    setInvoiceData(null);
    try {
      const res = await api.get(`/api/software-settings/delete-invoice/lookup?query=${encodeURIComponent(q)}`);
      setInvoiceData(res.data);
      toast.success('Invoice details loaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invoice or order not found');
      setInvoiceData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenConfirm = () => {
    setConfirmInput('');
    setShowModal(true);
  };

  const handlePermanentDelete = async () => {
    if (!invoiceData) return;
    const targetNo = String(invoiceData.invoiceNumber || invoiceData.orderNumber || '').trim().toUpperCase();
    const userTyped = confirmInput.trim().toUpperCase();

    if (userTyped !== targetNo) {
      toast.error(`Confirmation mismatch. Type "${targetNo}" to confirm deletion.`);
      return;
    }

    setDeleting(true);
    try {
      const res = await api.post('/api/software-settings/delete-invoice/permanent', {
        invoiceNumber: invoiceData.invoiceNumber,
        targetType: invoiceData.targetType,
        targetId: invoiceData.id
      });

      toast.success(res.data.message || 'Invoice permanently deleted');
      setInvoiceData(null);
      setSearchQuery('');
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete invoice');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Lookup Card */}
      <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-600/10 border border-red-600/30 rounded-2xl">
            <Trash2 className="text-red-500" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Permanent Invoice Deletion</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Find and permanently remove active invoices, sales, and all connected financial & register records.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Enter Invoice / Receipt Number (e.g. INV-2026-00125, POS-2026-00042, #51237)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white placeholder-gray-500 focus:border-red-500 outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-red-900/30"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            <span>Lookup Invoice</span>
          </button>
        </form>
      </div>

      {/* Invoice Preview Card */}
      {invoiceData && (
        <div className="bg-gray-900 border-2 border-red-500/40 rounded-2xl p-6 space-y-6 shadow-2xl animate-fade-in">
          {/* Header & Status */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-red-500/10 text-red-400 border border-red-500/30 uppercase tracking-widest">
                  {invoiceData.targetType} RECORD
                </span>
                <span className="text-xs font-bold text-gray-400">Created {new Date(invoiceData.createdAt).toLocaleDateString('en-GB')}</span>
              </div>
              <h3 className="text-2xl font-black text-white mt-1">
                {invoiceData.invoiceNumber || invoiceData.orderNumber}
              </h3>
              <p className="text-xs font-bold text-gray-400">Outlet: {invoiceData.outletName} | Placed By: {invoiceData.createdBy}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Invoice Amount</p>
              <p className="text-2xl font-black text-emerald-400">₨{Number(invoiceData.totalAmount || 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-800/40 p-4 rounded-xl border border-gray-800">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Customer</p>
              <p className="text-sm font-bold text-white truncate">{invoiceData.customerName}</p>
              <p className="text-xs text-gray-500">{invoiceData.customerPhone}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Payment Method</p>
              <p className="text-sm font-bold text-blue-400 uppercase">{invoiceData.paymentMethod || 'CASH'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Payment Status</p>
              <p className="text-sm font-bold text-emerald-400 uppercase">{invoiceData.paymentStatus || 'PAID'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Current Stage</p>
              <p className="text-sm font-bold text-purple-400 uppercase">{invoiceData.currentStage || invoiceData.status}</p>
            </div>
          </div>

          {/* Items Summary Table */}
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Order / Invoice Items</h4>
            <div className="bg-gray-800/30 rounded-xl overflow-hidden border border-gray-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-800/60 text-gray-400 font-black uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-gray-300 font-bold">
                  {invoiceData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 text-white">{item.name}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right font-black text-emerald-400">₨{Number(item.price || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Connected Database Records Warning */}
          <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-red-400 font-black text-xs uppercase tracking-wider">
              <AlertTriangle size={16} />
              <span>Records to be purged in Database Transaction</span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-red-300 font-bold">
              <span>• Items: {invoiceData.relatedRecords.itemsCount}</span>
              <span>• Payments: {invoiceData.relatedRecords.paymentsCount || 0}</span>
              <span>• Attempts/Acceptances: {(invoiceData.relatedRecords.attemptsCount || 0) + (invoiceData.relatedRecords.acceptancesCount || 0)}</span>
              <span>• Returns: {invoiceData.relatedRecords.returnsCount || invoiceData.relatedRecords.returnCasesCount || 0}</span>
            </div>
          </div>

          {/* Permanent Delete Action Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleOpenConfirm}
              className="px-6 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-red-950/60 active:scale-95"
            >
              <Trash2 size={16} />
              <span>Permanently Delete This Invoice</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && invoiceData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border-2 border-red-500 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600/20 text-red-400 rounded-xl">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Confirm Permanent Deletion</h3>
                  <p className="text-xs text-gray-400">This action CANNOT be undone!</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-300">
              <p>
                You are about to permanently delete invoice <span className="text-white font-black">{invoiceData.invoiceNumber || invoiceData.orderNumber}</span>.
              </p>
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 font-bold space-y-1">
                <p>• All sales, payment, register, and report references will be wiped.</p>
                <p>• Dashboard revenue and statistics will adjust immediately.</p>
              </div>
              <p className="font-bold text-gray-400 pt-2">
                To confirm, type <span className="text-white font-black underline select-all">{invoiceData.invoiceNumber || invoiceData.orderNumber}</span> below:
              </p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type invoice number to confirm..."
                className="w-full bg-gray-800 border-2 border-gray-700 focus:border-red-500 rounded-xl px-3 py-2.5 text-sm font-black text-white outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deleting || confirmInput.trim().toUpperCase() !== String(invoiceData.invoiceNumber || invoiceData.orderNumber).trim().toUpperCase()}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-900/40"
              >
                {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                <span>Confirm Permanent Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteInvoicePanel;
