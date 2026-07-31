import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Search, CalendarDays, User, Store, Package } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import toast from 'react-hot-toast';
import { PageLoader } from '../components/LoadingSpinner';
import useCache from '../hooks/useCache';
import api from '../services/api';
import { formatDateTime } from '../utils/dateTime';

const DeletedOrders = () => {
  const { isUrdu } = useLanguage();
  const [search, setSearch] = useState('');
  const { data: records = [], loading } = useCache('orders:deleted', {
    fetcher: () => api.get('/api/orders/deleted-orders', { params: { limit: 'all' } }).then(r => Array.isArray(r.data) ? r.data : []),
    ttl: 120 * 1000,
  });

  const filtered = records.filter(r =>
    !search || 
    (r.orderNumber && r.orderNumber.toLowerCase().includes(search.toLowerCase())) ||
    (r.customerName && r.customerName.toLowerCase().includes(search.toLowerCase())) ||
    (r.source && r.source.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-red-500/10 rounded-2xl">
            <Trash2 className="text-red-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black theme-text-primary uppercase tracking-tight">Deleted Orders</h1>
            <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-1">
              {records.length} record{records.length !== 1 ? 's' : ''} — Audit trail
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, customer, source..."
            className="w-full theme-input rounded-xl py-3 pl-12 pr-4 text-sm font-bold"
          />
        </div>
      </div>

      {loading ? (
        <PageLoader text="Loading Deleted Orders..." />
      ) : filtered.length === 0 ? (
        <div className="glass p-16 rounded-[3rem] border border-gray-800 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto border-2 border-gray-800">
            <Package className="text-gray-700" size={40} />
          </div>
          <h3 className="text-xl font-black text-gray-500 uppercase">No deleted orders</h3>
          <p className="text-gray-600 text-sm font-bold uppercase tracking-widest">
            {search ? 'No records match your search' : 'No orders have been deleted yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record, idx) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="group glass rounded-2xl p-4 md:p-6 border border-gray-800/50 hover:border-red-500/20 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-red-500/10 rounded-xl">
                    <Trash2 className="text-red-400" size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white">#{record.orderNumber || record.id.substring(0, 8)}</h3>
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-widest rounded-md border border-red-500/20">
                        Deleted
                      </span>
                    </div>
                    <p className="text-gray-400 font-bold text-sm mt-0.5">{record.customerName}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm font-bold text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Store size={14} className="text-gray-600" />
                    <span>{record.source}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-gray-600" />
                    <span>{record.deletedBy?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-gray-600" />
                    <span>{formatDateTime(record.deletedAt)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeletedOrders;
