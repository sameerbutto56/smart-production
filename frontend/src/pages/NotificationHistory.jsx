import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Bell, ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { formatDateTime } from '../utils/dateTime';

export default function NotificationHistory() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async (p = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/notifications?page=${p}&limit=50`);
      setNotifications(res.data.notifications || []);
      setTotalPages(res.data.totalPages || 1);
      setPage(p);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  const formatTime = (dateStr) => {
    return formatDateTime(new Date(dateStr));
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
          <Bell className="text-blue-400" size={24} />
          Notification History
        </h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 font-bold">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500 font-bold">No notifications yet</div>
      ) : (
        <>
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className={`p-4 rounded-xl border transition-all ${n.isRead ? 'bg-gray-900/30 border-gray-800' : 'bg-gray-800/50 border-blue-500/30'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />}
                      <span className="text-xs font-black text-white uppercase tracking-wider">{n.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${n.isRead ? 'text-gray-500 bg-gray-800' : 'text-blue-300 bg-blue-500/10'}`}>
                        {n.isRead ? 'Read' : 'New'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 font-medium">{n.message}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500 font-bold">
                      {n.action && <span>Action: {n.action}</span>}
                      {n.employeeName && <span>By: {n.employeeName}</span>}
                      {n.moduleName && <span>Module: {n.moduleName}</span>}
                      <span>{formatTime(n.createdAt)}</span>
                    </div>
                  </div>
                  {n.orderNumber && (
                    <button
                      onClick={() => navigate(`/order-track?query=${n.orderNumber}`)}
                      className="shrink-0 p-2 text-gray-500 hover:text-blue-400 bg-gray-800 rounded-lg transition-colors"
                      title="View Order"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => fetchNotifications(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${p === page ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
