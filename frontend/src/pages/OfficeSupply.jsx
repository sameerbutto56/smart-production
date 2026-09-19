import React, { useState, useEffect, useCallback, useMemo } from 'react';
import BackButton from '../components/BackButton';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  Pencil,
  RefreshCw,
  PackagePlus,
  ArrowRightLeft,
  History,
  BellRing,
  CheckCircle2,
  XCircle,
  Truck,
  Minus,
  ChevronDown,
  ChevronUp,
  Building2,
  Droplet,
  CheckCircle,
  X,
  UserCheck,
} from 'lucide-react';

const ROLE_STORE = ['STORE', 'STORE_EMPLOYEE', 'SUPER_ADMIN', 'ADMIN'];
const ROLE_OUTLET = ['OUTLET', 'FAISAL'];
const ROLE_MANAGE = ['STORE', 'SUPER_ADMIN', 'ADMIN'];

const LOCATIONS = [
  { name: 'STORE', type: 'STORE' },
  { name: 'Johar Town', type: 'OUTLET' },
  { name: 'Jail Road', type: 'OUTLET' },
  { name: 'Faisal', type: 'OUTLET' },
];

const DEMAND_STATUS = {
  PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  PARTIALLY_APPROVED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  APPROVED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/30',
  FULFILLED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PARTIALLY_FULFILLED: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
};

const TRANSFER_STATUS = {
  PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  IN_TRANSIT: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  RECEIVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  CANCELLED: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const statusBadge = (map, status) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${map[status] || 'bg-gray-500/15 text-gray-300 border-gray-500/30'}`}>
    {(status || '').replace(/_/g, ' ')}
  </span>
);

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl border bg-[#111827] shadow-2xl`}
        style={{ borderColor: 'var(--glass-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
          <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

const Field = ({ label, children, required }) => (
  <label className="block">
    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
      {label} {required && <span className="text-red-400">*</span>}
    </span>
    {children}
  </label>
);

const inputCls = 'w-full mt-1 rounded-xl px-3 py-2 text-sm font-medium text-white bg-gray-800/80 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-black bg-blue-500 hover:bg-blue-400 transition-all duration-200 disabled:opacity-50';
const btnSuccess = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all duration-200 disabled:opacity-50';
const btnDanger = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-all duration-200 disabled:opacity-50';
const btnGhost = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all duration-200 disabled:opacity-50';

export default function OfficeSupply() {
  const { user } = useAuth();
  const role = String(user?.role || '').toUpperCase().trim();
  const isStore = ROLE_STORE.includes(user?.role);
  const isFaisal = role === 'FAISAL';
  const isOutlet = ROLE_OUTLET.includes(user?.role);
  const canManage = ROLE_MANAGE.includes(user?.role);

  const n = String(user?.name || '').toLowerCase();
  const isJoharTown = n.includes('johar') || user?.name?.includes('1');
  const isJailRoad = n.includes('jail') || user?.name?.includes('2');
  const isBlockedOutlet = role === 'OUTLET' && !isJoharTown && !isJailRoad;

  const defaultLoc = isStore ? 'STORE' : isFaisal ? 'Faisal' : 'Johar Town';

  const [tab, setTab] = useState('dashboard');

  // Products
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', sku: '', unit: '', description: '' });
  const [savingProduct, setSavingProduct] = useState(false);

  // Stock
  const [stockLocation, setStockLocation] = useState(defaultLoc);
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [addStockModal, setAddStockModal] = useState(false);
  const [adjustStockModal, setAdjustStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({});
  const [stockQtyMap, setStockQtyMap] = useState({});
  const [savingStock, setSavingStock] = useState(false);

  // Demands
  const [demands, setDemands] = useState([]);
  const [demandsLoading, setDemandsLoading] = useState(false);
  const [newDemandModal, setNewDemandModal] = useState(false);
  const [demandItems, setDemandItems] = useState([{ productId: '', productName: '', requestedQty: 1 }]);
  const [demandNotes, setDemandNotes] = useState('');
  const [savingDemand, setSavingDemand] = useState(false);
  const [approveModal, setApproveModal] = useState(null);
  const [approveQtyMap, setApproveQtyMap] = useState({});
  const [storeNotes, setStoreNotes] = useState('');
  const [actingDemand, setActingDemand] = useState(false);

  // Transfers
  const [transfers, setTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [newTransferModal, setNewTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ type: 'DEMAND', demandId: '', toLocation: 'Johar Town', items: [{ productId: '', productName: '', quantity: 1 }] });
  const [savingTransfer, setSavingTransfer] = useState(false);

  // Movements
  const [movements, setMovements] = useState([]);
  const [mvtLocation, setMvtLocation] = useState(defaultLoc);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Store Self-Use
  const [selfUseRecords, setSelfUseRecords] = useState([]);
  const [selfUseLoading, setSelfUseLoading] = useState(false);
  const [selfUseModal, setSelfUseModal] = useState(false);
  const [selfUseItems, setSelfUseItems] = useState([{ productId: '', productName: '', quantity: 1 }]);
  const [selfUseReason, setSelfUseReason] = useState('');
  const [savingSelfUse, setSavingSelfUse] = useState(false);

  const loadProducts = useCallback(async () => {
    if (isBlockedOutlet) return;
    setProductsLoading(true);
    try {
      const res = await api.get('/api/office-supply/products');
      setProducts(res.data?.products || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  }, [isBlockedOutlet]);

  const loadStock = useCallback(async (loc = stockLocation) => {
    if (isBlockedOutlet) return;
    setStockLoading(true);
    try {
      const res = await api.get('/api/office-supply/stock', { params: { location: loc } });
      setStockItems(res.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load stock');
    } finally {
      setStockLoading(false);
    }
  }, [stockLocation, isBlockedOutlet]);

  const loadDemands = useCallback(async () => {
    if (isBlockedOutlet) return;
    setDemandsLoading(true);
    try {
      const res = await api.get('/api/office-supply/demands');
      setDemands(res.data?.demands || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load demands');
    } finally {
      setDemandsLoading(false);
    }
  }, [isBlockedOutlet]);

  const loadTransfers = useCallback(async () => {
    if (isBlockedOutlet) return;
    setTransfersLoading(true);
    try {
      const res = await api.get('/api/office-supply/transfers');
      setTransfers(res.data?.transfers || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load transfers');
    } finally {
      setTransfersLoading(false);
    }
  }, [isBlockedOutlet]);

  const loadMovements = useCallback(async (loc = mvtLocation) => {
    if (isBlockedOutlet) return;
    setMovementsLoading(true);
    try {
      const res = await api.get('/api/office-supply/movements', { params: { location: loc } });
      setMovements(res.data?.movements || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load movements');
    } finally {
      setMovementsLoading(false);
    }
  }, [mvtLocation, isBlockedOutlet]);

  const loadSelfUseRecords = useCallback(async () => {
    if (isBlockedOutlet) return;
    setSelfUseLoading(true);
    try {
      const res = await api.get('/api/office-supply/self-use');
      setSelfUseRecords(res.data?.records || []);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load self-use records');
    } finally {
      setSelfUseLoading(false);
    }
  }, [isBlockedOutlet]);

  useEffect(() => {
    loadProducts();
    loadDemands();
    loadTransfers();
  }, [loadProducts, loadDemands, loadTransfers]);

  useEffect(() => {
    if (tab === 'stock') loadStock();
  }, [tab, loadStock]);

  useEffect(() => {
    if (tab === 'movements') loadMovements();
  }, [tab, loadMovements]);

  useEffect(() => {
    if (tab === 'self-use') loadSelfUseRecords();
  }, [tab, loadSelfUseRecords]);

  const stats = useMemo(() => {
    const totalProductQty = products.reduce((sum, p) => sum + (p.stock || []).length, 0);
    return {
      products: products.length,
      activeProducts: products.filter((p) => p.isActive).length,
      totalStockRows: totalProductQty,
      pendingDemands: demands.filter((d) => ['PENDING', 'PARTIALLY_APPROVED'].includes(d.status)).length,
      pendingTransfers: transfers.filter((t) => ['PENDING', 'IN_TRANSIT'].includes(t.status)).length,
      receivedTransfers: transfers.filter((t) => t.status === 'RECEIVED').length,
    };
  }, [products, demands, transfers]);

  // ----- Stock & Product Helpers -----
  const getProductLocationStock = useCallback((productId, loc = stockLocation) => {
    if (!productId) return 0;
    const stockRow = (stockItems || []).find((s) => s.productId === productId && s.location === loc);
    if (stockRow != null && stockRow.quantity != null) return stockRow.quantity;
    const prod = products.find((p) => p.id === productId);
    const pStock = (prod?.stock || []).find((s) => s.location === loc);
    return pStock ? (pStock.quantity || 0) : 0;
  }, [stockItems, products, stockLocation]);

  const getProductStoreStock = useCallback((productId) => {
    return getProductLocationStock(productId, 'STORE');
  }, [getProductLocationStock]);

  // ----- Product CRUD -----
  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', sku: '', unit: '', description: '', initialStock: '' });
    setProductModal(true);
  };
  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      sku: p.sku || '',
      unit: p.unit || '',
      description: p.description || '',
      initialStock: getProductStoreStock(p.id) ?? '',
    });
    setProductModal(true);
  };
  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    setSavingProduct(true);
    try {
      if (editingProduct) {
        const res = await api.patch(`/api/office-supply/products/${editingProduct.id}`, {
          name: productForm.name,
          sku: productForm.sku,
          unit: productForm.unit,
          description: productForm.description,
          quantity: productForm.initialStock !== '' && productForm.initialStock != null ? Number(productForm.initialStock) : undefined,
        });
        toast.success(res.data?.message || 'Product updated');
      } else {
        const payload = {
          ...productForm,
          initialStock: productForm.initialStock !== '' ? Number(productForm.initialStock) : 0,
        };
        const res = await api.post('/api/office-supply/products', payload);
        toast.success(res.data?.message || 'Product created');
      }
      setProductModal(false);
      loadProducts();
      loadStock();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to save product');
    } finally {
      setSavingProduct(false);
    }
  };
  const handleToggleProduct = async (p) => {
    try {
      const res = await api.patch(`/api/office-supply/products/${p.id}`, { isActive: !p.isActive });
      toast.success(res.data?.message || 'Product updated');
      loadProducts();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update product');
    }
  };

  // ----- Stock -----
  const availableForStock = products.filter((p) => p.isActive);
  const openAddStock = () => {
    setStockForm({});
    setAddStockModal(true);
  };
  const openAdjustStock = () => {
    const map = {};
    availableForStock.forEach((p) => {
      map[p.id] = getProductLocationStock(p.id, stockLocation);
    });
    setStockQtyMap(map);
    setAdjustStockModal(true);
  };
  const handleStockLocationChange = (loc) => {
    setStockLocation(loc);
    if (tab === 'stock') loadStock(loc);
  };
  const handleStockAdjustChange = (loc) => setMvtLocation(loc);
  const handleAddStock = async () => {
    const items = Object.entries(stockForm)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }));
    if (items.length === 0) {
      toast.error('Enter quantities for at least one product');
      return;
    }
    setSavingStock(true);
    try {
      const res = await api.post('/api/office-supply/stock/add', { items, location: stockLocation });
      toast.success(res.data?.message || 'Stock added');
      setAddStockModal(false);
      loadStock();
      loadProducts();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to add stock');
    } finally {
      setSavingStock(false);
    }
  };
  const handleAdjustStock = async () => {
    const items = Object.entries(stockQtyMap)
      .filter(([, q]) => q !== '' && q !== null)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }));
    if (items.length === 0) {
      toast.error('Set quantities for at least one product');
      return;
    }
    setSavingStock(true);
    try {
      const res = await api.post('/api/office-supply/stock/adjust', { location: stockLocation, items });
      toast.success(res.data?.message || 'Stock adjusted');
      setAdjustStockModal(false);
      loadStock();
      loadProducts();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setSavingStock(false);
    }
  };

  // ----- Demands -----
  const openNewDemand = () => {
    setDemandItems([{ productId: '', productName: '', requestedQty: 1 }]);
    setDemandNotes('');
    setNewDemandModal(true);
  };
  const handleDemandProductChange = (i, productId) => {
    const p = products.find((x) => x.id === productId);
    setDemandItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, productId, productName: p?.name || '' } : it)));
  };
  const handlePushDemandItem = () => setDemandItems((prev) => [...prev, { productId: '', productName: '', requestedQty: 1 }]);
  const handlePopDemandItem = (i) => setDemandItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const handleCreateDemand = async () => {
    const items = demandItems
      .filter((it) => it.productId && it.requestedQty > 0)
      .map((it) => ({ productId: it.productId, productName: it.productName, requestedQty: Number(it.requestedQty), unit: '' }));
    if (items.length === 0) {
      toast.error('Add at least one product with quantity');
      return;
    }
    setSavingDemand(true);
    try {
      const res = await api.post('/api/office-supply/demands', { items, notes: demandNotes });
      toast.success(res.data?.message || 'Demand created');
      setNewDemandModal(false);
      loadDemands();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to create demand');
    } finally {
      setSavingDemand(false);
    }
  };
  const openApprove = (d) => {
    const map = {};
    (d.items || []).forEach((it) => {
      map[it.id] = it.requestedQty ?? 1;
    });
    setApproveQtyMap(map);
    setStoreNotes('');
    setApproveModal(d);
  };
  const handleApproveDemand = async (d, action) => {
    setActingDemand(d.id);
    try {
      let res;
      if (action === 'approve') {
        const items = Object.entries(approveQtyMap)
          .filter(([, q]) => q > 0)
          .map(([id, approvedQty]) => ({ id, approvedQty: Number(approvedQty) }));
        res = await api.post(`/api/office-supply/demands/${d.id}/approve`, { items, storeNotes: storeNotes || undefined });
        toast.success(res.data?.message || 'Demand approved');
      } else {
        res = await api.post(`/api/office-supply/demands/${d.id}/reject`, { storeNotes: storeNotes || undefined });
        toast.success(res.data?.message || 'Demand rejected');
      }
      setApproveModal(null);
      loadDemands();
      loadTransfers();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Action failed');
    } finally {
      setActingDemand(null);
    }
  };

  // ----- Transfers -----
  const fulfilledDemands = demands.filter((d) => ['APPROVED', 'PARTIALLY_APPROVED'].includes(d.status) && !transfers.some((t) => t.demandId === d.id && !['CANCELLED'].includes(t.status)));
  const openNewTransfer = () => {
    setTransferForm({ type: 'DEMAND', demandId: '', toLocation: 'Johar Town', items: [{ productId: '', productName: '', quantity: 1 }] });
    setNewTransferModal(true);
    loadProducts();
    loadStock('STORE');
    loadDemands();
  };
  const handleTransferTypeChange = (type) => {
    setTransferForm((prev) => ({ ...prev, type, demandId: '', items: [{ productId: '', productName: '', quantity: 1 }] }));
  };
  const handleTransferDemandChange = (demandId) => {
    const d = demands.find((x) => x.id === demandId);
    const items = (d?.items || []).map((it) => ({ productId: it.productId, productName: it.productName, quantity: it.approvedQty ?? it.requestedQty ?? 1 }));
    setTransferForm((prev) => ({ ...prev, demandId, items }));
  };
  const handleTransferProductChange = (i, productId) => {
    const p = products.find((x) => x.id === productId);
    setTransferForm((prev) => ({ ...prev, items: prev.items.map((it, idx) => (idx === i ? { ...it, productId, productName: p?.name || '' } : it)) }));
  };
  const handlePushTransferItem = () => setTransferForm((prev) => ({ ...prev, items: [...prev.items, { productId: '', productName: '', quantity: 1 }] }));
  const handlePopTransferItem = (i) => setTransferForm((prev) => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter((_, idx) => idx !== i) : prev.items }));
  const handleCreateTransfer = async () => {
    let items;
    if (transferForm.type === 'DEMAND') {
      if (!transferForm.demandId) {
        toast.error('Select a demand');
        return;
      }
      items = transferForm.items.filter((it) => it.productId && it.quantity > 0);
    } else {
      if (!transferForm.toLocation) {
        toast.error('Select destination location');
        return;
      }
      items = transferForm.items.filter((it) => it.productId && it.quantity > 0);
      if (items.length === 0) {
        toast.error('Add at least one product with quantity');
        return;
      }
      // Check Store stock before sending
      for (const it of items) {
        const avail = getProductStoreStock(it.productId);
        const qty = Number(it.quantity);
        if (avail <= 0) {
          toast.error(`"${it.productName || 'Selected product'}" is out of stock in Store (0 available).`);
          return;
        }
        if (qty > avail) {
          toast.error(`Insufficient stock for "${it.productName}". Available: ${avail}, Requested: ${qty}.`);
          return;
        }
      }
    }
    setSavingTransfer(true);
    try {
      const body = transferForm.type === 'DEMAND'
        ? { type: 'DEMAND', demandId: transferForm.demandId, items }
        : { type: 'DIRECT', toLocation: transferForm.toLocation, items };
      const res = await api.post('/api/office-supply/transfers', body);
      toast.success(res.data?.message || 'Transfer created');
      setNewTransferModal(false);
      loadTransfers();
      loadDemands();
      loadStock();
      loadProducts();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to create transfer');
    } finally {
      setSavingTransfer(false);
    }
  };
  const handleAcceptTransfer = async (t) => {
    if (!window.confirm(`Accept & receive transfer ${t.transferNumber}? Stock will be added to ${t.toLocation}.`)) return;
    setActingDemand(t.id);
    try {
      const res = await api.post(`/api/office-supply/transfers/${t.id}/accept`);
      toast.success(res.data?.message || 'Transfer received');
      loadTransfers();
      loadDemands();
      loadStock();
      loadProducts();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to accept transfer');
    } finally {
      setActingDemand(null);
    }
  };
  const handleCancelTransfer = async (t) => {
    if (!window.confirm(`Cancel transfer ${t.transferNumber}?`)) return;
    setActingDemand(t.id);
    try {
      const res = await api.post(`/api/office-supply/transfers/${t.id}/cancel`);
      toast.success(res.data?.message || 'Transfer cancelled');
      loadTransfers();
      loadDemands();
      loadStock();
      loadProducts();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to cancel transfer');
    } finally {
      setActingDemand(null);
    }
  };

  // ----- Store Self-Use -----
  const openNewSelfUse = () => {
    setSelfUseItems([{ productId: '', productName: '', quantity: 1 }]);
    setSelfUseReason('');
    setSelfUseModal(true);
    loadProducts();
    loadStock('STORE');
  };
  const handleSelfUseProductChange = (i, productId) => {
    const p = products.find((x) => x.id === productId);
    setSelfUseItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, productId, productName: p?.name || '' } : it)));
  };
  const handlePushSelfUseItem = () => setSelfUseItems((prev) => [...prev, { productId: '', productName: '', quantity: 1 }]);
  const handlePopSelfUseItem = (i) => setSelfUseItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const handleRecordSelfUse = async () => {
    const validItems = selfUseItems
      .filter((it) => it.productId && Number(it.quantity) > 0)
      .map((it) => ({ productId: it.productId, productName: it.productName, quantity: Number(it.quantity) }));
    if (validItems.length === 0) {
      toast.error('Add at least one product with quantity');
      return;
    }
    // Check Store stock before sending
    for (const it of validItems) {
      const avail = getProductStoreStock(it.productId);
      const qty = Number(it.quantity);
      if (avail <= 0) {
        toast.error(`"${it.productName || 'Selected product'}" is out of stock in Store (0 available).`);
        return;
      }
      if (qty > avail) {
        toast.error(`Insufficient stock for "${it.productName}". Available: ${avail}, Requested: ${qty}.`);
        return;
      }
    }
    setSavingSelfUse(true);
    try {
      const res = await api.post('/api/office-supply/self-use', {
        items: validItems.map(it => ({ productId: it.productId, quantity: it.quantity })),
        reason: selfUseReason || 'Store internal use',
      });
      toast.success(res.data?.message || 'Self-use recorded successfully');
      setSelfUseModal(false);
      loadSelfUseRecords();
      loadStock();
      loadProducts();
      loadMovements();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to record self-use');
    } finally {
      setSavingSelfUse(false);
    }
  };

  const myOutlets = LOCATIONS.filter((l) => l.type === 'OUTLET');
  const incomingTransfers = transfers.filter((t) => {
    if (isOutlet) {
      if (isFaisal) return t.toLocation === 'Faisal';
      return t.toLocation === stockLocation || t.toLocation === 'Johar Town';
    }
    return true;
  });

  const TABS = [
    { key: 'dashboard', label: 'Dashboard', icon: Package },
    { key: 'products', label: 'Products', icon: PackagePlus, show: canManage },
    { key: 'stock', label: 'Stock', icon: Droplet },
    { key: 'demands', label: 'Demands', icon: BellRing },
    { key: 'transfers', label: 'Transfers', icon: ArrowRightLeft },
    { key: 'movements', label: 'Movements', icon: History },
    { key: 'self-use', label: 'Store Self-Use', icon: UserCheck, show: isStore },
  ];

  if (isBlockedOutlet) {
    return (
      <div className="p-8 text-center glass rounded-2xl border border-red-500/20 max-w-lg mx-auto my-12">
        <h2 className="text-xl font-black text-red-400 mb-2">Access Restricted</h2>
        <p className="text-sm text-gray-400">Office Supply is only available for Johar Town and Jail Road Outlets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Package className="text-blue-400" size={24} /> Office Supply
            </h1>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Isolated stationery &amp; office stock module</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'products' && canManage && (
            <button onClick={openNewProduct} className={btnPrimary}><Plus size={16} /> New Product</button>
          )}
          {tab === 'stock' && isStore && (
            <>
              <button onClick={openAddStock} className={btnPrimary}><Plus size={16} /> Add Stock</button>
              <button onClick={openAdjustStock} className={btnGhost}><Minus size={16} /> Adjust</button>
            </>
          )}
          {tab === 'demands' && isOutlet && (
            <button onClick={openNewDemand} className={btnPrimary}><Plus size={16} /> New Demand</button>
          )}
          {tab === 'transfers' && isStore && (
            <button onClick={openNewTransfer} className={btnPrimary}><Plus size={16} /> New Transfer</button>
          )}
          {tab === 'self-use' && isStore && (
            <button onClick={openNewSelfUse} className={btnPrimary}><Plus size={16} /> Record Self-Use</button>
          )}
          <button
            onClick={() => { loadProducts(); loadStock(); loadDemands(); loadTransfers(); loadMovements(); loadSelfUseRecords(); }}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all duration-200"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.filter((t) => t.show !== false).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-all duration-200 ${tab === t.key ? 'bg-blue-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== Dashboard ===== */}
      {tab === 'dashboard' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Products', value: stats.products, icon: Package, color: 'text-blue-400' },
              { label: 'Active', value: stats.activeProducts, icon: CheckCircle2, color: 'text-emerald-400' },
              { label: 'Stock Rows', value: stats.totalStockRows, icon: Droplet, color: 'text-cyan-400' },
              { label: 'Pending Demands', value: stats.pendingDemands, icon: BellRing, color: 'text-amber-400' },
              { label: 'Open Transfers', value: stats.pendingTransfers, icon: Truck, color: 'text-violet-400' },
              { label: 'Received Transfers', value: stats.receivedTransfers, icon: CheckCircle, color: 'text-teal-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border bg-[#111827] p-4" style={{ borderColor: 'var(--glass-border)' }}>
                <div className="flex items-center justify-between">
                  <s.icon size={20} className={s.color} />
                </div>
                <div className="text-2xl font-black text-white mt-2">{s.value}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Stock by location */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {LOCATIONS.map((loc) => {
              const active = products.filter((p) => (p.stock || []).some((s) => s.location === loc.name));
              const qty = products.reduce((sum, p) => sum + (p.stock || []).filter((s) => s.location === loc.name).reduce((q, s) => q + s.quantity, 0), 0);
              return (
                <div key={loc.name} className="rounded-2xl border bg-[#111827] p-4" style={{ borderColor: 'var(--glass-border)' }}>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-cyan-400" />
                    <span className="text-sm font-black uppercase tracking-widest text-white">{loc.name}</span>
                    <span className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${loc.type === 'STORE' ? 'bg-violet-500/15 text-violet-300' : 'bg-cyan-500/15 text-cyan-300'}`}>
                      {loc.type}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end gap-3">
                    <div className="text-2xl font-black text-white">{qty}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 pb-0.5">total qty · {active.length} products</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Products ===== */}
      {tab === 'products' && canManage && (
        <div className="rounded-2xl border bg-[#111827] overflow-hidden" style={{ borderColor: 'var(--glass-border)' }}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/60 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Stock Locations</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500 font-medium">No products found{productsLoading ? '…' : ''}</td></tr>
                )}
                {products.map((p) => {
                  const locs = p.stock || [];
                  return (
                    <tr key={p.id} className="border-t hover:bg-gray-800/30 transition-colors" style={{ borderColor: 'var(--glass-border)' }}>
                      <td className="px-4 py-3 font-bold text-white">{p.name}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{p.sku || '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{p.unit || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[220px] truncate">{p.description || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {locs.length === 0 && <span className="text-[10px] text-gray-500">No stock</span>}
                          {locs.map((s) => (
                            <span key={s.id} className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${s.quantity > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-600/20 text-gray-400'}`}>
                              {s.location}: {s.quantity}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">{statusBadge({ ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }, p.isActive ? 'ACTIVE' : 'INACTIVE')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEditProduct(p)} className="bg-gray-800 hover:bg-gray-700 rounded-lg p-1.5"><Pencil size={13} className="text-gray-300" /></button>
                          {canManage && (
                            <button
                              onClick={() => handleToggleProduct(p)}
                              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-1.5"
                            >
                              {p.isActive ? <XCircle size={13} className="text-red-400" /> : <CheckCircle size={13} className="text-emerald-400" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Stock ===== */}
      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-gray-400" />
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">Location:</span>
              <select value={stockLocation} onChange={(e) => handleStockLocationChange(e.target.value)} className={inputCls + ' w-auto'}>
                {LOCATIONS.map((l) => <option key={l.name} value={l.name}>{l.name} ({l.type})</option>)}
              </select>
            </div>
          </div>
          <div className="rounded-2xl border bg-[#111827] overflow-hidden" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800/60 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-medium">No stock at this location{stockLoading ? '…' : ''}</td></tr>
                  )}
                  {stockItems.map((s) => (
                    <tr key={s.stockId} className="border-t hover:bg-gray-800/30 transition-colors" style={{ borderColor: 'var(--glass-border)' }}>
                      <td className="px-4 py-3 font-bold text-white">{s.productName}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono text-xs">{s.sku || '—'}</td>
                      <td className="px-4 py-3 text-gray-300">{s.unit || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black ${s.quantity > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                          {s.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== Demands ===== */}
      {tab === 'demands' && (
        <div className="space-y-3">
          {demands.length === 0 && (
            <div className="rounded-2xl border bg-[#111827] p-8 text-center" style={{ borderColor: 'var(--glass-border)' }}>
              <BellRing className="mx-auto text-gray-500" size={32} />
              <div className="mt-2 text-sm font-bold text-gray-300">No demands yet</div>
              {isOutlet && <div className="text-xs text-gray-500">Create a demand from the button above to request stock from the store.</div>}
            </div>
          )}
          {demands.map((d) => (
            <div key={d.id} className="rounded-2xl border bg-[#111827] p-4" style={{ borderColor: 'var(--glass-border)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black text-blue-300">{d.demandNumber}</span>
                {statusBadge(DEMAND_STATUS, d.status)}
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{d.outletName}</span>
                <span className="ml-auto text-[10px] text-gray-400 font-bold">{fmtDate(d.createdAt)}</span>
              </div>
              {d.notes && <div className="mt-2 text-xs text-gray-400 italic">“{d.notes}”</div>}
              {d.storeNotes && <div className="mt-1 text-xs text-gray-400">Store: {d.storeNotes}</div>}
              <div className="mt-3 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <tr>
                      <th className="py-1.5 pr-2">Product</th>
                      <th className="py-1.5 px-2">Requested</th>
                      <th className="py-1.5 px-2">Approved</th>
                      <th className="py-1.5 px-2">Sent</th>
                      <th className="py-1.5 px-2">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(d.items || []).map((it) => (
                      <tr key={it.id} className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                        <td className="py-2 pr-2 font-bold text-white">{it.productName}</td>
                        <td className="py-2 px-2 text-gray-200">{it.requestedQty}</td>
                        <td className="py-2 px-2 text-blue-300">{it.approvedQty ?? '—'}</td>
                        <td className="py-2 px-2 text-violet-300">{it.sentQty ?? '—'}</td>
                        <td className="py-2 px-2 text-emerald-300">{it.receivedQty ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isStore && ['PENDING', 'PARTIALLY_APPROVED'].includes(d.status) && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => openApprove(d)} className={btnSuccess}><CheckCircle2 size={15} /> Approve</button>
                  <button onClick={() => handleApproveDemand(d, 'reject')} className={btnDanger}><XCircle size={15} /> Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Transfers ===== */}
      {tab === 'transfers' && (
        <div className="space-y-3">
          {transfers.length === 0 && (
            <div className="rounded-2xl border bg-[#111827] p-8 text-center" style={{ borderColor: 'var(--glass-border)' }}>
              <Truck className="mx-auto text-gray-500" size={32} />
              <div className="mt-2 text-sm font-bold text-gray-300">No transfers yet</div>
            </div>
          )}
          {transfers.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-[#111827] p-4" style={{ borderColor: 'var(--glass-border)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black text-violet-300">{t.transferNumber}</span>
                {statusBadge(TRANSFER_STATUS, t.status)}
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {t.fromLocation} → {t.toLocation}
                </span>
                <span className="ml-auto text-[10px] text-gray-400 font-bold">{fmtDate(t.createdAt)}</span>
              </div>
              {t.type === 'DEMAND' && <div className="mt-1 text-xs text-gray-400">Linked demand: <span className="font-mono text-blue-300">{t.demand?.demandNumber}</span></div>}
              <div className="mt-3 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <tr>
                      <th className="py-1.5 pr-2">Product</th>
                      <th className="py-1.5 px-2">Qty</th>
                      <th className="py-1.5 px-2">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(t.items || []).map((it) => (
                      <tr key={it.id} className="border-t" style={{ borderColor: 'var(--glass-border)' }}>
                        <td className="py-2 pr-2 font-bold text-white">{it.productName}</td>
                        <td className="py-2 px-2 text-gray-200">{it.quantity}</td>
                        <td className="py-2 px-2 text-emerald-300">{it.receivedQty ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(isStore || isOutlet) && t.status === 'IN_TRANSIT' && t.toLocation === 'STORE' ? null : null}
              {isOutlet && t.status === 'IN_TRANSIT' && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleAcceptTransfer(t)} className={btnSuccess} disabled={actingDemand === t.id}><CheckCircle2 size={15} /> Accept & Receive</button>
                </div>
              )}
              {isStore && ['PENDING'].includes(t.status) && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => handleCancelTransfer(t)} className={btnDanger} disabled={actingDemand === t.id}><XCircle size={15} /> Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Movements ===== */}
      {tab === 'movements' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History size={15} className="text-gray-400" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-400">Location:</span>
            <select value={mvtLocation} onChange={(e) => handleStockAdjustChange(e.target.value)} className={inputCls + ' w-auto'}>
              {LOCATIONS.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
            </select>
          </div>
          <div className="rounded-2xl border bg-[#111827] overflow-hidden" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800/60 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">From → To</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Performed By</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 font-medium">No movements at this location{movementsLoading ? '…' : ''}</td></tr>
                  )}
                  {movements.map((m) => (
                    <tr key={m.id} className="border-t hover:bg-gray-800/30 transition-colors" style={{ borderColor: 'var(--glass-border)' }}>
                      <td className="px-4 py-3 font-bold text-white">{m.productName}</td>
                      <td className="px-4 py-3">{statusBadge({ ADD: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', TRANSFER_OUT: 'bg-orange-500/15 text-orange-300 border-orange-500/30', TRANSFER_IN: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', RECEIVE: 'bg-teal-500/15 text-teal-300 border-teal-500/30', ADJUSTMENT: 'bg-amber-500/15 text-amber-300 border-amber-500/30', SELF_USE: 'bg-purple-500/15 text-purple-300 border-purple-500/30' }, m.movementType)}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{m.fromLocation || '—'} → {m.toLocation || '—'}</td>
                      <td className="px-4 py-3 font-black text-white">{m.quantity}</td>
                      <td className="px-4 py-3 text-gray-300 text-xs">{m.performedBy || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(m.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== Store Self-Use ===== */}
      {tab === 'self-use' && isStore && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck size={20} className="text-violet-400" /> Store Self-Use Records
              </h2>
              <p className="text-xs text-gray-400">Audited internal consumption of office supplies used by Store personnel</p>
            </div>
            <button onClick={openNewSelfUse} className={btnPrimary}>
              <Plus size={16} /> Record Self-Use
            </button>
          </div>

          <div className="rounded-2xl border bg-[#111827] overflow-hidden" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800/60 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Doc #</th>
                    <th className="px-4 py-3">Items Consumed &amp; Stock Audit</th>
                    <th className="px-4 py-3">Total Qty</th>
                    <th className="px-4 py-3">Reason / Purpose</th>
                    <th className="px-4 py-3">Recorded By</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {selfUseRecords.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 font-medium">
                        No self-use records found{selfUseLoading ? '…' : ''}
                      </td>
                    </tr>
                  )}
                  {selfUseRecords.map((r) => {
                    const totalQty = (r.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
                    return (
                      <tr key={r.id} className="border-t hover:bg-gray-800/30 transition-colors" style={{ borderColor: 'var(--glass-border)' }}>
                        <td className="px-4 py-3 font-mono text-xs font-black text-violet-300 whitespace-nowrap">
                          {r.transferNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1.5">
                            {(r.items || []).map((it, idx) => (
                              <div key={idx} className="text-xs text-gray-200 flex flex-wrap items-center gap-2">
                                <span className="font-bold text-white">{it.productName}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                  Used: {it.quantity}
                                </span>
                                {it.previousStock != null && (
                                  <span className="text-[10px] text-gray-400 font-mono bg-gray-900/80 px-2 py-0.5 rounded border border-gray-750">
                                    Prev: <span className="text-gray-300">{it.previousStock}</span> → Left: <span className="text-emerald-400 font-bold">{it.remainingStock}</span>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-black text-white">{totalQty}</td>
                        <td className="px-4 py-3 text-xs text-gray-300 italic max-w-xs truncate">
                          {r.notes || 'Store internal use'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-300 font-medium">
                          {r.sentByName || 'Store User'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                          {fmtDate(r.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modals ===== */}
      {/* Product modal */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title={editingProduct ? 'Edit Product' : 'New Product'} wide>
        <div className="space-y-4">
          <Field label="Name" required>
            <input className={inputCls} value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} placeholder="A4 Paper (80gsm)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <input className={inputCls} value={productForm.sku} onChange={(e) => setProductForm((p) => ({ ...p, sku: e.target.value }))} placeholder="OFF-A4-001" />
            </Field>
            <Field label="Unit">
              <input className={inputCls} value={productForm.unit} onChange={(e) => setProductForm((p) => ({ ...p, unit: e.target.value }))} placeholder="ream / pkt" />
            </Field>
          </div>
          <Field label={editingProduct ? 'Stock Quantity (Store)' : 'Initial Stock (Store)'}>
            <input
              type="number"
              min="0"
              className={inputCls}
              value={productForm.initialStock ?? ''}
              onChange={(e) => setProductForm((p) => ({ ...p, initialStock: e.target.value }))}
              placeholder="0"
            />
          </Field>
          <Field label="Description">
            <textarea className={inputCls} rows={2} value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setProductModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={handleSaveProduct} className={btnPrimary} disabled={savingProduct}>{savingProduct ? 'Saving…' : 'Save Product'}</button>
          </div>
        </div>
      </Modal>

      {/* Add stock modal */}
      <Modal open={addStockModal} onClose={() => setAddStockModal(false)} title={`Add Stock → ${stockLocation}`} wide>
        <div className="space-y-3">
          <div className="text-xs text-gray-400 mb-2">Enter quantities to add at <b className="text-white">{stockLocation}</b>. Leave blank (or 0) for products you are not restocking.</div>
          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2">
            {availableForStock.length === 0 && <div className="text-xs text-gray-500">No active products.</div>}
            {availableForStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-800/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{p.sku || ''}</div>
                </div>
                <input
                  type="number" min="0"
                  className="w-28 rounded-xl px-3 py-1.5 text-sm font-bold text-white bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  value={stockForm[p.id] ?? ''}
                  placeholder="0"
                  onChange={(e) => setStockForm((prev) => ({ ...prev, [p.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            <button onClick={() => setAddStockModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={handleAddStock} className={btnPrimary} disabled={savingStock}>{savingStock ? 'Adding…' : 'Add Stock'}</button>
          </div>
        </div>
      </Modal>

      {/* Adjust stock modal */}
      <Modal open={adjustStockModal} onClose={() => setAdjustStockModal(false)} title={`Adjust Stock → ${stockLocation}`} wide>
        <div className="space-y-3">
          <div className="text-xs text-gray-400 mb-2">Set the <b className="text-white">exact quantity</b> each product should have at <b className="text-white">{stockLocation}</b>. Adjustments are logged.</div>
          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar space-y-2">
            {availableForStock.length === 0 && <div className="text-xs text-gray-500">No active products.</div>}
            {availableForStock.map((p) => {
              const currentStock = getProductLocationStock(p.id, stockLocation);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-800/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {p.sku ? `${p.sku} • ` : ''}current: {currentStock} {p.unit || ''}
                    </div>
                  </div>
                  <input
                    type="number" min="0"
                    className="w-28 rounded-xl px-3 py-1.5 text-sm font-bold text-white bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={stockQtyMap[p.id] ?? currentStock}
                    onChange={(e) => setStockQtyMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            <button onClick={() => setAdjustStockModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={handleAdjustStock} className={btnPrimary} disabled={savingStock}>{savingStock ? 'Saving…' : 'Apply Adjustment'}</button>
          </div>
        </div>
      </Modal>

      {/* New demand modal */}
      <Modal open={newDemandModal} onClose={() => setNewDemandModal(false)} title="New Demand Request" wide>
        <div className="space-y-3">
          <div className="text-xs text-gray-400">Request stock from the store. Approved quantities are dispatched via a transfer.</div>
          {demandItems.map((it, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-800/40 p-2.5">
              <select className={inputCls + ' flex-1'} value={it.productId} onChange={(e) => handleDemandProductChange(i, e.target.value)}>
                <option value="">Select product…</option>
                {availableForStock.map((p) => <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>)}
              </select>
              <input
                type="number" min="1"
                className="w-20 rounded-xl px-2 py-2 text-sm font-bold text-white bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                value={it.requestedQty}
                onChange={(e) => setDemandItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, requestedQty: e.target.value } : x)))}
              />
              <button onClick={() => handlePopDemandItem(i)} className="bg-gray-700 hover:bg-red-600/60 rounded-lg p-1.5"><X size={13} /></button>
            </div>
          ))}
          <button onClick={handlePushDemandItem} className={btnGhost}><Plus size={14} /> Add Product</button>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={demandNotes} onChange={(e) => setDemandNotes(e.target.value)} placeholder="Optional notes for the store" />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            <button onClick={() => setNewDemandModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={handleCreateDemand} className={btnPrimary} disabled={savingDemand}>{savingDemand ? 'Submitting…' : 'Create Demand'}</button>
          </div>
        </div>
      </Modal>

      {/* Approve demand modal */}
      <Modal open={!!approveModal} onClose={() => setApproveModal(null)} title={`Approve ${approveModal?.demandNumber || ''}`} wide>
        {approveModal && (
          <div className="space-y-3">
            <div className="text-xs text-gray-400">Set the <b className="text-white">approved quantity</b> for each requested item (leave 0 to reject that line).</div>
            <div className="space-y-2">
              {(approveModal.items || []).map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-800/40 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{it.productName}</div>
                    <div className="text-[10px] text-gray-400">requested: {it.requestedQty}</div>
                  </div>
                  <input
                    type="number" min="0"
                    className="w-24 rounded-xl px-3 py-1.5 text-sm font-bold text-white bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    value={approveQtyMap[it.id] ?? ''}
                    onChange={(e) => setApproveQtyMap((prev) => ({ ...prev, [it.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <Field label="Store Notes">
              <input className={inputCls} value={storeNotes} onChange={(e) => setStoreNotes(e.target.value)} placeholder="Notes given to the outlet" />
            </Field>
            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
              <button onClick={() => handleApproveDemand(approveModal, 'reject')} className={btnDanger} disabled={actingDemand === approveModal.id}><XCircle size={15} /> Reject</button>
              <button onClick={() => handleApproveDemand(approveModal, 'approve')} className={btnSuccess} disabled={actingDemand === approveModal.id}><CheckCircle2 size={15} /> Approve</button>
            </div>
          </div>
        )}
      </Modal>

      {/* New transfer modal */}
      <Modal open={newTransferModal} onClose={() => setNewTransferModal(false)} title="New Transfer" wide>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => handleTransferTypeChange('DEMAND')}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all duration-200 ${transferForm.type === 'DEMAND' ? 'bg-blue-500 text-black' : 'bg-gray-800 text-gray-300'}`}
            >
              From Demand
            </button>
            <button
              onClick={() => handleTransferTypeChange('DIRECT')}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all duration-200 ${transferForm.type === 'DIRECT' ? 'bg-violet-500 text-black' : 'bg-gray-800 text-gray-300'}`}
            >
              Direct Transfer
            </button>
          </div>

          {transferForm.type === 'DEMAND' ? (
            <div className="space-y-3">
              <Field label="Approved Demand" required>
                <select
                  className={inputCls}
                  value={transferForm.demandId}
                  onChange={(e) => handleTransferDemandChange(e.target.value)}
                >
                  <option value="">Select an approved demand…</option>
                  {fulfilledDemands.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.demandNumber} — {d.outletName}
                    </option>
                  ))}
                </select>
              </Field>
              {transferForm.demandId && (
                <div className="rounded-xl bg-gray-800/40 p-3 space-y-1">
                  {(transferForm.items || []).map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-white font-bold">{it.productName}</span>
                      <span className="text-gray-300">qty: {it.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Destination Location" required>
                <select
                  className={inputCls}
                  value={transferForm.toLocation}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, toLocation: e.target.value }))}
                >
                  {LOCATIONS.filter((l) => l.type === 'OUTLET').map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
                </select>
              </Field>
              <div className="space-y-2">
                {transferForm.items.map((it, i) => {
                  const selProd = products.find((p) => p.id === it.productId);
                  const storeStock = getProductStoreStock(it.productId);
                  const reqQty = Number(it.quantity) || 0;
                  const isExceed = it.productId && reqQty > storeStock;
                  const isOutOfStock = it.productId && storeStock <= 0;

                  return (
                    <div key={i} className="space-y-1.5 rounded-xl bg-gray-800/40 p-2.5 border border-gray-750">
                      <div className="flex items-center gap-2">
                        <select
                          className={inputCls + ' flex-1'}
                          value={it.productId}
                          onChange={(e) => handleTransferProductChange(i, e.target.value)}
                        >
                          <option value="">Select product to transfer…</option>
                          {availableForStock.map((p) => {
                            const pStock = getProductStoreStock(p.id);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {pStock} {p.unit || ''}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="number"
                          min="1"
                          className="w-24 rounded-xl px-2 py-2 text-sm font-bold text-white bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          placeholder="Qty"
                          value={it.quantity}
                          onChange={(e) =>
                            setTransferForm((prev) => ({
                              ...prev,
                              items: prev.items.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x)),
                            }))
                          }
                        />
                        <button
                          onClick={() => handlePopTransferItem(i)}
                          className="bg-gray-700 hover:bg-red-600/60 rounded-lg p-1.5 text-gray-300 hover:text-white"
                          title="Remove item"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      {it.productId && (
                        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded-lg bg-gray-900/60 text-[11px]">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-400">
                              Available in Store: <b className="text-white">{storeStock} {selProd?.unit || ''}</b>
                            </span>
                            <span className="text-blue-300">
                              Sending: <b className="text-white">{reqQty}</b>
                            </span>
                            <span className="text-gray-400">
                              Remaining: <b className={isExceed ? 'text-red-400' : 'text-emerald-400'}>{Math.max(0, storeStock - reqQty)}</b>
                            </span>
                          </div>
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-black border border-red-500/30">
                              Out of Stock (0 available)
                            </span>
                          ) : isExceed ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black border border-amber-500/30">
                              Exceeds Store Stock ({storeStock})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/30">
                              ✓ Available
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={handlePushTransferItem} className={btnGhost}><Plus size={14} /> Add Product</button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            <button onClick={() => setNewTransferModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={handleCreateTransfer} className={btnPrimary} disabled={savingTransfer}>{savingTransfer ? 'Creating…' : 'Create Transfer'}</button>
          </div>
        </div>
      </Modal>

      {/* Store Self-Use Modal */}
      <Modal open={selfUseModal} onClose={() => setSelfUseModal(false)} title="Record Store Self-Use" wide>
        <div className="space-y-4">
          <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3 text-xs text-violet-300">
            <b className="text-white">Store Internal Consumption:</b> Items recorded here will be deducted directly from Store stock with an audited <b>SELF_USE</b> record and sequence number.
          </div>

          <Field label="Items Consumed" required>
            <div className="space-y-2 mt-1">
              {selfUseItems.map((it, i) => {
                const selProd = products.find((p) => p.id === it.productId);
                const storeStock = getProductStoreStock(it.productId);
                const reqQty = Number(it.quantity) || 0;
                const isExceed = it.productId && reqQty > storeStock;
                const isOutOfStock = it.productId && storeStock <= 0;

                return (
                  <div key={i} className="space-y-1.5 rounded-xl bg-gray-800/40 p-2.5 border border-gray-750">
                    <div className="flex items-center gap-2">
                      <select
                        className={inputCls + ' flex-1'}
                        value={it.productId}
                        onChange={(e) => handleSelfUseProductChange(i, e.target.value)}
                      >
                        <option value="">Select product to consume…</option>
                        {availableForStock.map((p) => {
                          const pStock = getProductStoreStock(p.id);
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {pStock} {p.unit || ''}
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="number"
                        min="1"
                        className="w-24 rounded-xl px-2 py-2 text-sm font-bold text-white bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) =>
                          setSelfUseItems((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, quantity: e.target.value } : x))
                          )
                        }
                      />
                      <button
                        onClick={() => handlePopSelfUseItem(i)}
                        className="bg-gray-700 hover:bg-red-600/60 rounded-lg p-2 text-gray-300 hover:text-white transition-colors"
                        title="Remove item"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {it.productId && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded-lg bg-gray-900/60 text-[11px]">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400">
                            Current Stock: <b className="text-white">{storeStock} {selProd?.unit || ''}</b>
                          </span>
                          <span className="text-violet-300">
                            Using: <b className="text-white">{reqQty}</b>
                          </span>
                          <span className="text-gray-400">
                            Remaining: <b className={isExceed ? 'text-red-400' : 'text-emerald-400'}>{Math.max(0, storeStock - reqQty)}</b>
                          </span>
                        </div>
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-black border border-red-500/30">
                            Out of Stock (0 available)
                          </span>
                        ) : isExceed ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black border border-amber-500/30">
                            Exceeds Store Stock ({storeStock})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/30">
                            ✓ Available
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button onClick={handlePushSelfUseItem} className={btnGhost}>
                <Plus size={14} /> Add Another Product
              </button>
            </div>
          </Field>

          <Field label="Purpose / Reason" required>
            <textarea
              rows={2}
              className={inputCls}
              placeholder="e.g. Packing cartons, barcode labels for dispatch, counter tape, office printer paper..."
              value={selfUseReason}
              onChange={(e) => setSelfUseReason(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            <button onClick={() => setSelfUseModal(false)} className={btnGhost}>
              Cancel
            </button>
            <button
              onClick={handleRecordSelfUse}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all duration-200 disabled:opacity-50"
              disabled={savingSelfUse}
            >
              <UserCheck size={16} /> {savingSelfUse ? 'Recording…' : 'Save Self-Use Record'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}