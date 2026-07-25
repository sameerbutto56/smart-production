import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Send, RefreshCcw, Calendar, Package, Clock, ArrowRight } from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const AlterationProduction = () => {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const defaultTab = userRole === 'PRODUCTION_OUT' ? 'out' : 'in';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [pendingAlterations, setPendingAlterations] = useState([]);
  const [acceptedAlterations, setAcceptedAlterations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/alterations/production');
      setPendingAlterations(res.data);
    } catch (e) {
      console.error('Error fetching pending alterations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccepted = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/alterations/production-out');
      setAcceptedAlterations(res.data);
    } catch (e) {
      console.error('Error fetching accepted alterations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'in') fetchPending();
    else fetchAccepted();
  }, [activeTab, fetchPending, fetchAccepted]);

  const handleAccept = async (id) => {
    setActionLoading(id + 'accept');
    try {
      await api.patch(`/api/alterations/${id}/accept`);
      toast.success('Alteration accepted');
      fetchPending();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to accept');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id) => {
    setActionLoading(id + 'complete');
    try {
      await api.patch(`/api/alterations/${id}/complete`);
      toast.success('Alteration completed — returned to source');
      fetchAccepted();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to complete');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(id + 'reject');
    try {
      await api.patch(`/api/alterations/${id}/reject`, { reason: 'Rejected by production' });
      toast.success('Alteration rejected');
      fetchPending();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const renderAlterationCard = (alt, mode) => {
    let products = [];
    try {
      products = typeof alt.products === 'string' ? JSON.parse(alt.products) : (alt.products || []);
    } catch { products = []; }

    return (
      <motion.div key={alt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`bg-gray-900/80 backdrop-blur-sm border rounded-2xl p-6 space-y-3 shadow-lg ${
          mode === 'in' ? 'border-amber-500/20' : 'border-emerald-500/20'
        }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-black text-white">{alt.alterationNumber}</p>
            {alt.orderNumber && <p className="text-xs text-gray-400">Order: {alt.orderNumber}</p>}
            <p className="text-sm text-gray-400">{alt.customerName}</p>
            {alt.sourceOutlet && <p className="text-xs text-gray-500">From: {alt.sourceOutlet}</p>}
          </div>
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
            mode === 'in' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
          }`}>
            {mode === 'in' ? 'PENDING' : 'IN PROGRESS'}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Products & Instructions</p>
          {products.map((p, i) => (
            <div key={i} className="bg-gray-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{p.productName}</span>
                {p.color && <span className="text-[10px] text-gray-400">({p.color})</span>}
                {p.size && <span className="text-[10px] text-gray-400">({p.size})</span>}
                {p.quantity > 1 && <span className="text-[10px] text-gray-400">×{p.quantity}</span>}
              </div>
              <p className="text-[11px] text-purple-300 mt-1 italic">{p.alterationNote}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Calendar size={12} />
          {new Date(alt.createdAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
          {alt.acceptedAt && (
            <span className="ml-2 text-emerald-400">Accepted: {new Date(alt.acceptedAt).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>

        {mode === 'in' ? (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
            <button onClick={() => handleAccept(alt.id)} disabled={actionLoading === alt.id + 'accept'}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
              {actionLoading === alt.id + 'accept' ? <RefreshCcw className="animate-spin" size={14} /> : <CheckCircle size={14} />} Accept
            </button>
            <button onClick={() => handleReject(alt.id)} disabled={actionLoading === alt.id + 'reject'}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
              {actionLoading === alt.id + 'reject' ? <RefreshCcw className="animate-spin" size={14} /> : 'Reject'}
            </button>
          </div>
        ) : (
          <button onClick={() => handleComplete(alt.id)} disabled={actionLoading === alt.id + 'complete'}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all pt-2 border-t border-gray-800">
            {actionLoading === alt.id + 'complete' ? <RefreshCcw className="animate-spin" size={14} /> : <ArrowRight size={14} />} Complete & Return
          </button>
        )}
      </motion.div>
    );
  };

  const currentList = activeTab === 'in' ? pendingAlterations : acceptedAlterations;

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">Alteration Management</h1>
            <p className="text-sm text-gray-400">Production workflow</p>
          </div>
          <button onClick={() => activeTab === 'in' ? fetchPending() : fetchAccepted()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-gray-400 rounded-xl text-xs font-bold hover:bg-gray-700 border border-gray-700/50">
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('in')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
              activeTab === 'in' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            Alteration In ({pendingAlterations.length})
          </button>
          <button onClick={() => setActiveTab('out')}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${
              activeTab === 'out' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}>
            Alteration Out ({acceptedAlterations.length})
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-40" />)}
          </div>
        ) : currentList.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-12 text-center shadow-lg">
            <Package className="mx-auto text-gray-600 mb-3" size={48} />
            <p className="text-gray-500 font-bold">
              {activeTab === 'in' ? 'No pending alterations' : 'No accepted alterations'}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {activeTab === 'in' ? 'New alteration requests will appear here' : 'Accepted alterations ready for work'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentList.map(alt => renderAlterationCard(alt, activeTab))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlterationProduction;
