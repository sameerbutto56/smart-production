import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Route as RouteIcon, Truck, Send, UserCheck, RefreshCcw,
  Calendar, Phone, Package, CheckCircle2, XCircle, Plus,
  MapPin, User, FileText, CheckSquare, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateOnly } from '../utils/dateTime';

// Dedicated In Dispatch module — JOHAR TOWN outlet only.
// Isolated from the existing Dispatch (dispatch officer) workflow.
// Only orders explicitly routed via "Send to In Dispatch" appear here.

const getOutletName = (user) => {
  const n = String(user?.name || '').toLowerCase();
  if (n.includes('johar')) return 'Johar Town';
  if (n.includes('jail')) return 'Jail Road';
  if (n.includes('abbottabad')) return 'Abbottabad';
  return user?.name || 'Outlet';
};

const InDispatch = () => {
  const { user } = useAuth();
  const outletName = getOutletName(user);
  const isJoharTown = outletName === 'Johar Town';

  const [orders, setOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedForRoute, setSelectedForRoute] = useState(new Set());
  const [routeForm, setRouteForm] = useState({ routeName: '', area: '', deliveryPerson: '', notes: '' });
  const [creating, setCreating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/in-dispatch/orders');
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('In Dispatch orders error:', e);
      toast.error(e.response?.data?.message || 'Failed to load In Dispatch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoutes = useCallback(async () => {
    setRoutesLoading(true);
    try {
      const res = await api.get('/api/in-dispatch/routes');
      setRoutes(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('In Dispatch routes error:', e);
      toast.error(e.response?.data?.message || 'Failed to load delivery routes');
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchOrders();
    fetchRoutes();
  }, [fetchOrders, fetchRoutes]);

  useEffect(() => {
    if (isJoharTown) refreshAll();
  }, [isJoharTown, refreshAll]);

  const activeRoutes = routes.filter(r => r.status === 'ACTIVE');
  const completedRoutes = routes.filter(r => r.status === 'COMPLETED');
  const assignedIds = new Set(
    activeRoutes.flatMap(r => { try { return JSON.parse(r.orderIds || '[]'); } catch (_) { return []; } })
  );

  const toggleSelect = (orderId) => {
    setSelectedForRoute(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const handleRouteOrder = async (orderId, action, targetOutlet) => {
    setActionLoading(orderId + action);
    try {
      await api.post(`/api/in-dispatch/orders/${orderId}/route`, { action, targetOutlet });
      toast.success(action === 'customerTakeDeliver' ? 'Order completed' : 'Order routed');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Route failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateRoute = async () => {
    if (!routeForm.routeName.trim()) {
      toast.error('Route name is required');
      return;
    }
    if (selectedForRoute.size === 0) {
      toast.error('Select at least one order');
      return;
    }
    setCreating(true);
    try {
      await api.post('/api/in-dispatch/routes', {
        routeName: routeForm.routeName,
        area: routeForm.area,
        deliveryPerson: routeForm.deliveryPerson,
        notes: routeForm.notes,
        orderIds: Array.from(selectedForRoute)
      });
      toast.success('Delivery route created');
      setShowCreateModal(false);
      setSelectedForRoute(new Set());
      setRouteForm({ routeName: '', area: '', deliveryPerson: '', notes: '' });
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create route');
    } finally {
      setCreating(false);
    }
  };

  const handleCompleteRoute = async (routeId) => {
    if (!window.confirm('Mark this delivery route as completed?')) return;
    setActionLoading('complete' + routeId);
    try {
      await api.post(`/api/in-dispatch/routes/${routeId}/complete`);
      toast.success('Delivery route completed');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to complete route');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRoute = async (routeId) => {
    if (!window.confirm('Cancel this delivery route? Orders will return to the queue.')) return;
    setActionLoading('cancel' + routeId);
    try {
      await api.post(`/api/in-dispatch/routes/${routeId}/cancel`);
      toast.success('Delivery route cancelled');
      refreshAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to cancel route');
    } finally {
      setActionLoading(null);
    }
  };

  const productsSummary = (order) => {
    const items = order.productDetails || [];
    if (items.length === 0) return null;
    return items.map((p, i) => (
      <span key={i} className="inline-flex items-center gap-1 text-[11px] text-gray-300 bg-gray-800/60 border border-gray-700/50 rounded-lg px-2 py-0.5">
        <Package size={10} className="text-violet-400 shrink-0" />
        {p.name}{p.color ? ` (${p.color}` : ''}{p.size ? ` / ${p.size}` : ''}{p.color || p.size ? ')' : ''} × {p.quantity || 1}
      </span>
    ));
  };

  const selectedOrders = orders.filter(o => selectedForRoute.has(o.id));

  if (!isJoharTown) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900/70 border border-red-500/30 rounded-2xl p-10 text-center max-w-md shadow-2xl">
          <XCircle className="mx-auto text-red-500 mb-3" size={48} />
          <p className="text-white font-black text-lg">Access Restricted</p>
          <p className="text-sm text-gray-400 mt-2">The In Dispatch module is only available to the <span className="text-white font-bold">JOHAR TOWN</span> outlet.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-white">In Dispatch</h1>
            <span className="px-2.5 py-1 bg-violet-500/20 text-violet-300 text-[10px] font-black tracking-widest rounded-full border border-violet-500/30">JOHAR TOWN</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Dedicated outlet dispatch queue — only orders sent via "Send to In Dispatch"</p>
        </div>
        <button onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-700 transition-all border border-gray-700/50">
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-900/80 border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-violet-500/20 rounded-xl text-violet-400"><Layers size={18} /></div>
          <div>
            <p className="text-2xl font-black text-white">{orders.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">In Dispatch Orders</p>
          </div>
        </div>
        <div className="bg-gray-900/80 border border-cyan-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400"><RouteIcon size={18} /></div>
          <div>
            <p className="text-2xl font-black text-white">{activeRoutes.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Active Routes</p>
          </div>
        </div>
        <div className="bg-gray-900/80 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3 shadow-lg">
          <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400"><CheckCircle2 size={18} /></div>
          <div>
            <p className="text-2xl font-black text-white">{completedRoutes.length}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Completed Routes</p>
          </div>
        </div>
      </div>

      {/* Delivery Routes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RouteIcon size={16} className="text-cyan-400" />
            <p className="text-sm font-black text-white uppercase tracking-widest">Delivery Routes</p>
          </div>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-cyan-900/30 active:scale-95">
            <Plus size={14} /> Create Delivery Route
          </button>
        </div>

        {routesLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-28" />)}
          </div>
        ) : routes.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-10 text-center">
            <RouteIcon className="mx-auto text-gray-600 mb-3" size={40} />
            <p className="text-gray-500 font-bold">No delivery routes yet</p>
            <p className="text-xs text-gray-600 mt-1">Group In Dispatch orders into routes for the delivery run</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {routes.map(route => {
              const isActive = route.status === 'ACTIVE';
              return (
                <motion.div key={route.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-gray-900/80 backdrop-blur-sm border rounded-2xl p-5 space-y-3 shadow-lg ${isActive ? 'border-cyan-500/25' : 'border-emerald-500/20'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-white">{route.routeName}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Created {formatDateOnly(route.createdAt)}</p>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${isActive ? 'bg-cyan-500/20 text-cyan-300' : route.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-600/20 text-gray-400'}`}>
                      {route.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] text-gray-300">
                    {route.area && <span className="flex items-center gap-1"><MapPin size={11} className="text-blue-400" /> {route.area}</span>}
                    {route.deliveryPerson && <span className="flex items-center gap-1"><User size={11} className="text-cyan-400" /> {route.deliveryPerson}</span>}
                    <span className="flex items-center gap-1"><Package size={11} className="text-violet-400" /> {route.orders.length} order{route.orders.length !== 1 ? 's' : ''}</span>
                  </div>

                  {route.orders.length > 0 && (
                    <div className="space-y-1.5">
                      {route.orders.map(o => (
                        <div key={o.id} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-xs font-bold text-white">{o.orderNumber}</p>
                            <p className="text-[11px] text-gray-400">{o.customerName}</p>
                          </div>
                          <span className="text-[10px] text-gray-500">{o.currentStage === 'IN_DISPATCH' ? 'IN DISPATCH' : o.currentStage}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {route.notes && (
                    <p className="flex items-start gap-1.5 text-[11px] text-gray-400 bg-gray-800/40 rounded-xl px-3 py-2">
                      <FileText size={11} className="text-amber-400 shrink-0 mt-0.5" /> {route.notes}
                    </p>
                  )}

                  {isActive && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={() => handleCompleteRoute(route.id)} disabled={actionLoading === 'complete' + route.id}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all">
                        {actionLoading === 'complete' + route.id ? <RefreshCcw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Complete Route
                      </button>
                      <button onClick={() => handleCancelRoute(route.id)} disabled={actionLoading === 'cancel' + route.id}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-red-600/20 disabled:opacity-50 text-gray-400 hover:text-red-400 text-xs font-bold rounded-xl transition-all border border-gray-700/50">
                        {actionLoading === 'cancel' + route.id ? <RefreshCcw className="animate-spin" size={14} /> : <XCircle size={14} />} Cancel
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* In Dispatch Queue */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-violet-400" />
            <p className="text-sm font-black text-white uppercase tracking-widest">In Dispatch Queue</p>
            {selectedForRoute.size > 0 && (
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-black rounded-full">{selectedForRoute.size} selected for route</span>
            )}
          </div>
          {selectedForRoute.size > 0 && (
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[11px] font-black transition-all active:scale-95">
              <RouteIcon size={13} /> Create Route ({selectedForRoute.size})
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="bg-gray-800/60 rounded-2xl p-6 animate-pulse h-32" />)}
          </div>
        ) : orders.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-12 text-center">
            <Truck className="mx-auto text-gray-600 mb-3" size={44} />
            <p className="text-gray-500 font-bold">No orders in dispatch</p>
            <p className="text-xs text-gray-600 mt-1">Orders will appear here after they are sent via "Send to In Dispatch" from My Tasks</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.map(order => {
              const inRoute = assignedIds.has(order.id);
              const isSelected = selectedForRoute.has(order.id);
              return (
                <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`bg-gray-900/80 backdrop-blur-sm border rounded-2xl p-5 space-y-3 shadow-lg ${inRoute ? 'border-cyan-500/30' : isSelected ? 'border-blue-500/40' : 'border-violet-500/20'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-black text-white">{order.orderNumber}</p>
                      <p className="text-sm text-gray-400">{order.customerName}</p>
                      {order.customerPhone && <p className="flex items-center gap-1 text-xs text-gray-500"><Phone size={10} /> {order.customerPhone}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {inRoute
                        ? <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 text-[10px] font-black rounded-full">IN ROUTE</span>
                        : <span className="px-2.5 py-1 bg-violet-500/20 text-violet-300 text-[10px] font-black rounded-full">IN DISPATCH</span>}
                      <button onClick={() => toggleSelect(order.id)} disabled={inRoute}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-500' : inRoute ? 'bg-gray-800/50 text-gray-600 border-gray-700/40 cursor-not-allowed' : 'bg-gray-800/80 text-gray-300 border-gray-700/60 hover:border-blue-500/50 hover:text-blue-300'}`}>
                        <CheckSquare size={11} /> {isSelected ? 'Selected' : 'Add to Route'}
                      </button>
                    </div>
                  </div>

                  {productsSummary(order) && (
                    <div className="flex flex-wrap gap-1.5">{productsSummary(order)}</div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar size={12} />
                    {formatDateOnly(order.createdAt)}
                    {order.totalPrice > 0 && <span className="ml-auto font-bold text-white">₨{order.totalPrice.toLocaleString()}</span>}
                  </div>

                  {!inRoute && (
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-800">
                      <button onClick={() => handleRouteOrder(order.id, 'sendToEnamelsDelivery')} disabled={actionLoading === order.id + 'sendToEnamelsDelivery'}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-[10px] font-bold rounded-xl transition-all">
                        {actionLoading === order.id + 'sendToEnamelsDelivery' ? <RefreshCcw className="animate-spin" size={13} /> : <Truck size={13} />} Delivery Boy
                      </button>
                      <button onClick={() => handleRouteOrder(order.id, 'sendToOutlet', 'Jail Road Outlet')} disabled={actionLoading === order.id + 'sendToOutlet'}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-[10px] font-bold rounded-xl transition-all">
                        {actionLoading === order.id + 'sendToOutlet' ? <RefreshCcw className="animate-spin" size={13} /> : <Send size={13} />} To Jail Road
                      </button>
                      <button onClick={() => handleRouteOrder(order.id, 'customerTakeDeliver')} disabled={actionLoading === order.id + 'customerTakeDeliver'}
                        className="flex flex-col items-center justify-center gap-1 px-2 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-bold rounded-xl transition-all">
                        {actionLoading === order.id + 'customerTakeDeliver' ? <RefreshCcw className="animate-spin" size={13} /> : <UserCheck size={13} />} Customer Take
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Delivery Route Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="relative w-full max-w-lg bg-gray-900 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <RouteIcon size={18} className="text-cyan-400" />
                  <p className="text-white font-black">Create Delivery Route</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white"><XCircle size={20} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Route Name *</label>
                  <input value={routeForm.routeName} onChange={e => setRouteForm({ ...routeForm, routeName: e.target.value })}
                    placeholder="e.g. Gulberg Morning Run" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Area</label>
                    <input value={routeForm.area} onChange={e => setRouteForm({ ...routeForm, area: e.target.value })}
                      placeholder="e.g. DHA Phase 5" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Delivery Person</label>
                    <input value={routeForm.deliveryPerson} onChange={e => setRouteForm({ ...routeForm, deliveryPerson: e.target.value })}
                      placeholder="e.g. Enamels Delivery" className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Notes</label>
                  <textarea value={routeForm.notes} onChange={e => setRouteForm({ ...routeForm, notes: e.target.value })}
                    placeholder="Optional notes for this delivery run" rows={2}
                    className="w-full mt-1 px-3 py-2.5 bg-gray-800/70 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:border-cyan-500/60 outline-none resize-none" />
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-2">Selected Orders ({selectedOrders.length})</p>
                {selectedOrders.length === 0 ? (
                  <p className="text-xs text-gray-600 bg-gray-800/40 rounded-xl px-3 py-3">No orders selected. Use "Add to Route" on the queue cards.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                    {selectedOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between bg-gray-800/50 border border-gray-700/40 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-xs font-bold text-white">{o.orderNumber}</p>
                          <p className="text-[11px] text-gray-400">{o.customerName}</p>
                        </div>
                        <button onClick={() => toggleSelect(o.id)} className="text-[10px] text-red-400 hover:text-red-300 font-black">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleCreateRoute} disabled={creating || selectedForRoute.size === 0}
                className="w-full mt-5 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                {creating ? <RefreshCcw className="animate-spin" size={16} /> : <RouteIcon size={16} />}
                Create Delivery Route
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InDispatch;
