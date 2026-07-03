import React, { useState, useEffect } from 'react';
import axios from 'axios';
import JsBarcode from 'jsbarcode';
import Button from '../components/Button';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Package,
  Palette,
  Layers,
  RefreshCcw,
  PlusCircle,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Upload,
  Image as ImageIcon,
  Hash,
  Minus,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { PageLoader, SkeletonLoader, CardSkeleton, TableSkeleton } from '../components/LoadingSpinner';
import { usePolling } from '../hooks/usePolling';
import { printInventoryReport } from '../utils/printReport';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);

const LOW_STOCK_LIMIT = 5;

const InventoryManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const { t, LanguageToggle, isUrdu } = useLanguage();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const VARIANTS_PREVIEW = 3;
  const [formData, setFormData] = useState({
    name: '',
    category: 'SCRUBS',
    fabric: '',
    imageUrl: '',
    variants: [{ color: '', size: '', stock: 0, price: 0 }]
  });

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchInventory();
    }
  }, [authLoading, user]);

  usePolling(async () => {
    if (authLoading || !user) return;
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(response.data);
    } catch (error) {}
  }, 15000);

  if (authLoading) {
    return null;
  }

  const userRole = String(user?.role || '').toUpperCase().trim();
  if (user && !['SUPER_ADMIN', 'ADMIN', 'FAISAL', 'STORE', 'INVENTORY_VIEW'].includes(userRole)) {
    return <Navigate to="/dashboard" replace={true} />;
  }

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('image', file);

    try {
      const response = await axios.post(`${API_URL}/api/upload`, formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, imageUrl: response.data.url }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Only images up to 5MB are allowed.');
    }
    setUploading(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
    setLoading(false);
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        category: item.category,
        fabric: item.fabric || '',
        imageUrl: item.imageUrl || '',
        variants: (item.variants && Array.isArray(item.variants) && item.variants.length > 0)
          ? item.variants.map(v => ({ ...v }))
          : [{ color: item.color || '', size: item.size || '', stock: item.stock || 0, price: item.price || 0 }]
      });
    } else {
      setEditingItem(null);
      setFormData({ name: '', category: 'SCRUBS', fabric: '', imageUrl: '', variants: [{ color: '', size: '', stock: 0, price: 0 }] });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        name: formData.name,
        category: formData.category,
        fabric: formData.fabric,
        imageUrl: formData.imageUrl,
        variants: formData.variants.filter(v => v.color || v.size || parseInt(v.stock) > 0)
      };
      if (editingItem) {
        await axios.put(`${API_URL}/api/inventory/${editingItem.id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/api/inventory`, payload, { headers });
      }
      fetchInventory();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving inventory item:', error);
    }
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { color: '', size: '', stock: 0, price: 0 }]
    }));
  };

  const removeVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariant = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const totalStock = formData.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

  const filteredItems = items
    .filter(item => {
      // Category filter
      if (categoryFilter !== 'ALL') {
        if (item.category?.toUpperCase() !== categoryFilter) return false;
      }

      // Text search filter
      const term = searchTerm.toLowerCase();
      if (term) {
        const matchesSearch =
          item.name?.toLowerCase().includes(term) ||
          item.category?.toLowerCase().includes(term) ||
          item.fabric?.toLowerCase().includes(term) ||
          item.color?.toLowerCase().includes(term) ||
          (item.variants && Array.isArray(item.variants) && item.variants.some(v => 
            (v.color && v.color.toLowerCase().includes(term)) ||
            (v.size && v.size.toLowerCase().includes(term))
          ));
        if (!matchesSearch) return false;
      }

      const variants = item.variants && Array.isArray(item.variants) && item.variants.length > 0
        ? item.variants
        : [{ stock: item.stock != null ? item.stock : 0 }];

      if (stockFilter === 'OUT') return variants.some(v => (v.stock || 0) === 0);
      if (stockFilter === 'LOW') return variants.some(v => (v.stock || 0) > 0 && (v.stock || 0) <= LOW_STOCK_LIMIT);
      return true;
    })
    .sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });

  const groupedItems = (() => {
    const groups = {};
    filteredItems.forEach(item => {
      const letter = (item.name?.[0] || '#').toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(item);
    });
    return Object.keys(groups).sort().map(letter => ({ letter, items: groups[letter] }));
  })();

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`${API_URL}/api/inventory/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchInventory();
    } catch (error) {
      console.error('Error deleting inventory item:', error);
    }
  };

  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/inventory/bulk-upload`, uploadData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert(`Success! Imported ${response.data.count} items.`);
      fetchInventory();
    } catch (error) {
      console.error('Bulk upload failed:', error);
      alert('Failed to upload Excel file: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ─── Barcode generation & printing (Store Inventory only) ─── */
  const djb2 = (s) => {
    if (!s) return 0;
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) + hash) + s.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  };
  const generateBarcode = (itemId, size, color, attempt = 0) => {
    const prefix = 'POS';
    const raw = itemId.replace(/-/g, '').slice(0, 8);
    const variantStr = `${size || ''}|${color || ''}|${attempt}`;
    const fullHash = djb2(variantStr);
    const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
    return `${prefix}${base}`;
  };

  const printBarcodeFromStore = (item, variant, productName) => {
    const qty = prompt(`How many barcode labels for "${productName}" ${[variant.color, variant.size].filter(Boolean).join(' / ')}?`, '1');
    const count = parseInt(qty);
    if (!count || count < 1) return;

    const barcode = generateBarcode(item.id, variant.size, variant.color);
    const formatCurr = (n) => `₨${(n || 0).toLocaleString()}`;
    const sizeInfo = [variant.color, variant.size].filter(Boolean).join(' / ');

    // Generate vector barcode SVG — perfect at any DPI, no pixelation
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, barcode, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });
    // Add viewBox for zero-loss scaling; remove fixed size so CSS controls dimensions
    const sw = svg.getAttribute('width');
    const sh = svg.getAttribute('height');
    svg.setAttribute('viewBox', `0 0 ${sw} ${sh}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    const svgString = new XMLSerializer().serializeToString(svg);

    // Label dimensions (per retail barcode spec):
    //   Width: 55mm, Height: 33mm
    //   Barcode area: ~21mm height (within 20-25mm spec)
    //   Quiet zone: 3mm on each side
    //   Barcode bars: pure black on white for max scanner contrast
    const pw = window.open('', '_blank');
    pw.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Barcode Labels</title>
<style>
  @page { margin: 0; size: 55mm 33mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .label {
    width: 55mm; height: 33mm;
    padding: 2mm 3mm 1.5mm;
    display: flex; flex-direction: column;
    align-items: center; text-align: center;
    page-break-after: always; page-break-inside: avoid;
    background: #fff; color: #000;
  }
  .label .name { width: 100%; font-size: 7.5pt; font-weight: bold; text-transform: uppercase; line-height: 1.2; word-break: break-word; overflow-wrap: break-word; }
  .label .sku  { width: 100%; font-size: 6pt; color: #555; font-family: monospace; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .label .bcwrap { width: 100%; height: 16mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .label .bcwrap svg { width: 100%; height: 100%; display: block; }

  .label .bottom { width: 100%; display: flex; justify-content: space-between; align-items: baseline; border-top: 0.5px solid #ccc; padding-top: 0.3mm; margin-top: auto; }
  .label .bctext { font-size: 7pt; font-family: 'Courier New', monospace; font-weight: bold; color: #000; letter-spacing: 0.3px; }
  .label .price  { font-size: 9pt; font-weight: 900; color: #000; }
</style>
</head>
<body>
  ${Array(count).fill(null).map(() => `
  <div class="label">
    <div class="name">${productName}</div>
    <div class="sku">${sizeInfo || 'STANDARD'}</div>
    <div class="bcwrap">${svgString}</div>
    <div class="bottom">
      <span class="bctext">${barcode}</span>
      <span class="price">${formatCurr(variant.price || item.price || 0)}</span>
    </div>
  </div>`).join('')}
</body>
</html>`);
    pw.document.close();
    pw.focus();
    setTimeout(() => { pw.print(); }, 500);
  };

  const uniqueCategories = [...new Set(items.map(item => item.category?.toUpperCase()).filter(Boolean))];
  const defaultCategories = ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'SHOES', 'CLOGS', 'LABCOAT'];
  const allCategories = [...new Set([...defaultCategories, ...uniqueCategories])];

  return user?.role === 'INVENTORY_VIEW' ? (
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, color, size..."
          className="w-full theme-input rounded-2xl py-3.5 pl-12 pr-10 text-sm font-bold border-2 border-gray-700 focus:border-emerald-500/50 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {(searchTerm || categoryFilter !== 'ALL') && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
          <Search size={12} />
          <span>{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
            {searchTerm && <> for "<span className="text-white">{searchTerm}</span>"</>}
          </span>
          <button onClick={() => { setSearchTerm(''); setCategoryFilter('ALL'); }} className="ml-2 text-xs md:text-sm text-gray-500 hover:text-white underline">clear</button>
        </div>
      )}
      {/* Catalog Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center"><RefreshCcw className="animate-spin text-blue-400" size={32} /></div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center space-y-3 text-center">
            <div className="p-4 bg-gray-800 rounded-2xl">
              <Search size={32} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-black text-sm">No items found{searchTerm && <> matching "<span className="text-white">{searchTerm}</span>"</>}</p>
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline">Clear search</button>}
          </div>
        ) : groupedItems.map(group => [
          <div key={`header-${group.letter}`} className="col-span-full">
            <div className="flex items-center gap-3 pt-2 pb-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/30">
                <span className="font-black text-white text-lg">{group.letter}</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent" />
              <span className="text-xs md:text-sm font-bold text-gray-600 uppercase tracking-widest">{group.items.length} items</span>
            </div>
          </div>,
          ...group.items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="glass p-4 rounded-2xl border-2 theme-border hover:border-gray-800 transition-all">
              <h3 className="font-black theme-text-primary text-sm mb-1">{item.name}</h3>
              <p className="text-[10px] font-bold theme-text-muted uppercase tracking-wider">{item.category}</p>
              {(() => {
                const v = item.variants || [];
                if (v.length) {
                  const hasColor = v.some(x => x.color);
                  const hasSize = v.some(x => x.size);
                  if (!hasColor && hasSize) {
                    const sizes = v.map(x => ({ size: x.size, stock: x.stock ?? 0 }));
                    return (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sizes.map(s => (
                          <span key={s.size} className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${s.stock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{s.size} {s.stock > 0 ? `(${s.stock})` : '(0)'}</span>
                        ))}
                      </div>
                    );
                  }
                  const grouped = {};
                  v.forEach(x => { const c = x.color || '-'; if (!grouped[c]) grouped[c] = []; grouped[c].push({ size: x.size, stock: x.stock ?? 0 }); });
                  return (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {Object.entries(grouped).map(([color, sizes]) => (
                        <div key={color}>
                          <p className="text-[10px] font-bold text-gray-400 mb-0.5">{color}</p>
                          <div className="flex flex-wrap gap-1">{sizes.map(s => <span key={s.size || 'x'} className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${s.stock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{s.size ? `${s.size} (${s.stock})` : `(${s.stock})`}</span>)}</div>
                        </div>
                      ))}
                    </div>
                  );
                }
                const hasColor = item.color || item.size;
                return hasColor ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {item.color && <span className="text-[10px] theme-text-muted bg-gray-800/50 px-2 py-0.5 rounded-lg">Color: {item.color}</span>}
                    {item.size && <span className="text-[10px] theme-text-muted bg-gray-800/50 px-2 py-0.5 rounded-lg">Size: {item.size}</span>}
                  </div>
                ) : null;
              })()}
              {/* Print barcode for first variant only (INVENTORY_VIEW) */}
              <div className="mt-3 flex justify-end">
                <button onClick={() => {
                  const v = item.variants?.[0] || item;
                  printBarcodeFromStore(item, v, item.name);
                }} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-all">
                  <Printer size={12} /> Print Barcode
                </button>
              </div>
            </motion.div>
          ))
        ]).flat()}
      </div>
    </div>
  ) : (
    <>
    <div className="space-y-4 md:space-y-8 pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center space-x-4">
          <div className="p-4 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-900/20 rotate-2">
            <Package className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black theme-text-primary tracking-tight">Inventory</h1>
            <p className="theme-text-secondary text-sm font-medium uppercase tracking-widest">{user?.role === 'INVENTORY_VIEW' ? 'View available product variants' : 'Master Product Management'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            className="hidden" 
          />
          {user?.role !== 'INVENTORY_VIEW' && ['SUPER_ADMIN', 'ADMIN'].includes(userRole) && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-emerald-500/30 font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center space-x-3 active:scale-95"
            >
              <Upload size={20} />
              <span className="hidden sm:inline">Bulk Import (Excel/CSV)</span>
            </button>
          )}
          {user?.role !== 'INVENTORY_VIEW' && (
          <button
            onClick={() => printInventoryReport(filteredItems, stockFilter)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-black py-4 px-4 rounded-2xl border border-gray-700 transition-all flex items-center gap-2 active:scale-95"
            title="Print Inventory Report"
          >
            <Printer size={18} />
            <span className="hidden sm:inline text-sm">Print</span>
          </button>
          )}
          {user?.role !== 'INVENTORY_VIEW' && (
          <button 
            onClick={() => handleOpenModal()}
            className="btn-solid-primary btn-xl"
          >
            <PlusCircle size={20} />
            <span>Add New</span>
          </button>
          )}
        </div>
      </div>

      {/* Filters Bar - Category Buttons */}
      <div className="flex overflow-x-auto bg-gray-900 border-2 border-gray-700 rounded-2xl p-1">
        {['ALL', ...allCategories].map(cat => (
          <button 
            key={cat} 
            onClick={() => setCategoryFilter(cat)}
            className={`px-5 py-2.5 text-xs md:text-sm font-black rounded-xl transition-all whitespace-nowrap ${
              categoryFilter === cat
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, color, size, fabric..."
          className="w-full theme-input rounded-2xl py-3.5 pl-12 pr-10 text-sm font-bold border-2 border-gray-700 focus:border-emerald-500/50 transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Stock Filter */}
      {user?.role !== 'INVENTORY_VIEW' && (
      <div className="flex gap-2">
        {[
          { key: 'ALL', label: 'All Stock' },
          { key: 'LOW', label: `⚠ Low Stock (<=${LOW_STOCK_LIMIT})` },
          { key: 'OUT', label: '✕ Out of Stock' }
        ].map(opt => (
          <button key={opt.key} onClick={() => setStockFilter(opt.key)}
            className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all whitespace-nowrap ${
              stockFilter === opt.key
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/30'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700'
            }`}
          >{opt.label}</button>
        ))}
      </div>
      )}

      {/* Search Status Bar */}
      {(searchTerm || categoryFilter !== 'ALL') && (
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
          <Search size={12} />
          <span>{filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
            {categoryFilter !== 'ALL' && <> in <span className="text-white">{categoryFilter}</span></>}
            {searchTerm && <> for "<span className="text-white">{searchTerm}</span>"</>}
          </span>
          <button onClick={() => { setSearchTerm(''); setCategoryFilter('ALL'); }} className="ml-2 text-xs md:text-sm text-gray-500 hover:text-white underline">clear all</button>
        </div>
      )}
        {loading ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center space-y-4">
            <PageLoader text="Accessing Secure Database..." />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-3 text-center">
            <div className="p-4 bg-gray-800 rounded-2xl">
              <Search size={32} className="text-gray-600" />
            </div>
            <p className="text-gray-400 font-black text-sm">No items found{searchTerm && <> matching "<span className="text-white">{searchTerm}</span>"</>}{categoryFilter !== 'ALL' && <> in <span className="text-white">{categoryFilter}</span></>}</p>
            <button onClick={() => { setSearchTerm(''); setCategoryFilter('ALL'); }} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline">Clear filters</button>
          </div>
        ) : groupedItems.map(group => [
          <div key={`header-${group.letter}`} className="col-span-full">
            <div className="flex items-center gap-3 pt-2 pb-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/30">
                <span className="font-black text-white text-lg">{group.letter}</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent" />
              <span className="text-xs md:text-sm font-bold text-gray-600 uppercase tracking-widest">{group.items.length} items</span>
            </div>
          </div>,
          ...group.items.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="glass p-4 md:p-8 rounded-xl md:rounded-[2.5rem] border-2 theme-border hover:border-emerald-500/40 transition-all group relative overflow-hidden"
            >
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl shadow-xl overflow-hidden ${
                  ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS'].includes(item.category || '') ? 'bg-blue-600/10 text-blue-400' :
                  item.category === 'FABRIC' ? 'bg-emerald-600/10 text-emerald-400' :
                  'bg-purple-600/10 text-purple-400'
                }`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-6 h-6 object-cover rounded-md" />
                  ) : (
                    ['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS'].includes(item.category || '') ? <Package size={20} /> : 
                    item.category === 'FABRIC' ? <Layers size={20} /> : <Palette size={20} />
                  )}
                </div>
                {user?.role !== 'INVENTORY_VIEW' && (
                <div className="flex space-x-2 relative z-10">
                  <button onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }} className="p-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="p-2.5 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="font-black text-xl theme-text-primary group-hover:text-emerald-400 transition-colors leading-tight">{item.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-xs md:text-sm font-black uppercase tracking-widest theme-text-muted">{item.category}</span>
                  {(item.fabric) && <><div className="w-1 h-1 rounded-full bg-gray-800" /><span className="text-xs md:text-sm font-bold theme-text-secondary uppercase italic">{item.fabric}</span></>}
                </div>
              </div>

              {/* Variants List */}
              {(item.variants && Array.isArray(item.variants) && item.variants.length > 0) ? (
                <div className="mt-6 space-y-2">
                  {item.variants.slice(0, expandedItems[item.id] ? item.variants.length : VARIANTS_PREVIEW).map((v, vi) => (
                    <div key={vi} className="flex items-center justify-between theme-bg-subtle rounded-xl px-4 py-2.5 theme-border">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full border-2 border-gray-700" style={{ backgroundColor: v.color ? undefined : 'transparent' }} />
                        <span className="text-xs font-bold theme-text-secondary">
                          {[v.color, v.size].filter(Boolean).join(' • ')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button onClick={(e) => { e.stopPropagation(); printBarcodeFromStore(item, v, item.name); }}
                          className="p-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 rounded-lg transition-all" title="Print barcode">
                          <Printer size={12} />
                        </button>
                        <span className="text-sm font-black theme-text-primary">{v.stock}</span>
                        {v.price > 0 && <span className="text-xs md:text-sm font-bold text-emerald-500">₨{v.price}</span>}
                      </div>
                    </div>
                  ))}
                  {item.variants.length > VARIANTS_PREVIEW && (
                    <button
                      onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className="w-full py-2 text-xs md:text-sm font-black uppercase tracking-widest theme-text-muted hover:text-emerald-400 transition-all"
                    >
                      {expandedItems[item.id] ? '▲ Show Less' : `▼ Show More (${item.variants.length - VARIANTS_PREVIEW} more)`}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-6 flex items-center justify-between theme-bg-subtle rounded-xl px-4 py-2.5 theme-border">
                    <span className="text-xs font-bold theme-text-secondary">
                      {[item.color, item.size].filter(Boolean).join(' • ') || 'Standard'}
                    </span>
                    <div className="flex items-center space-x-4">
                      <button onClick={(e) => { e.stopPropagation(); printBarcodeFromStore(item, item, item.name); }}
                        className="p-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 rounded-lg transition-all" title="Print barcode">
                        <Printer size={12} />
                      </button>
                      <span className="text-sm font-black theme-text-primary">{item.stock}</span>
                      {item.price > 0 && <span className="text-xs md:text-sm font-bold text-emerald-500">₨{item.price}</span>}
                    </div>
                  </div>
                  {user?.role === 'INVENTORY_VIEW' && (
                    <div className="mt-3 flex justify-end">
                      <button onClick={(e) => { e.stopPropagation(); printBarcodeFromStore(item, item, item.name); }}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1">
                        <Printer size={12} /> Print Barcode
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="mt-6 flex items-end justify-between">
                <div>
                  <span className="block text-2xl md:text-4xl font-black theme-text-primary tracking-tighter">
                    {item.stock != null ? item.stock
                      : (item.variants && Array.isArray(item.variants)
                          ? item.variants.reduce((s, v) => s + (v.stock || 0), 0)
                          : 0)}
                  </span>
                  <span className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-widest">Total Units</span>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-xs md:text-sm font-black uppercase border-2 ${
                  (item.stock || 0) > 50 ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' : 
                  (item.stock || 0) > 0 ? 'border-yellow-500/20 bg-yellow-500/5 text-yellow-500' : 
                  'border-red-500/20 bg-red-500/5 text-red-500'
                }`}>
                  {(item.stock || 0) > 50 ? 'STOCK SECURE' : (item.stock || 0) > 0 ? 'REPLENISH' : 'DEPLETED'}
                </div>
              </div>
            </motion.div>
          ))
        ]).flat()}
      </div>
    {/* Modal */}
    <AnimatePresence>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            className="glass max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-4 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 theme-border shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative"
          >
            <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 pointer-events-none">
              <Package size={200} />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                  <h2 className="text-xl md:text-3xl font-black theme-text-primary uppercase tracking-tighter">
                    {editingItem ? 'Update Prototype' : 'Initialize Product'}
                  </h2>
                  <p className="theme-text-muted text-xs font-bold uppercase tracking-widest">Universal Catalog Entry</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 bg-gray-900 text-gray-500 hover:text-white rounded-2xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 md:space-y-10">
                <div className="space-y-4">
                    <div className="flex items-center space-x-3 mb-1">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <ClipboardList size={16} className="text-blue-400" />
                      </div>
                      <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Product Specification</label>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full theme-input rounded-[1.5rem] py-5 px-8 shadow-inner font-bold text-lg"
                      placeholder="e.g. Ultra-Flex Scrub Top"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <Layers size={16} className="text-purple-400" />
                        </div>
                        <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Category</label>
                      </div>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full theme-input rounded-[1.25rem] py-4 px-6 font-bold uppercase appearance-none cursor-pointer"
                      >
                        <option value="">— Select Category —</option>
                        {['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'SHOES', 'CLOGS', 'LABCOAT', ...uniqueCategories.filter(c => !['SCRUBS', 'COAT', 'MASK', 'SOCKS', 'CAPS', 'FABRIC', 'SHOES', 'CLOGS', 'LABCOAT'].includes(c))].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 mb-1">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                          <Layers size={16} className="text-indigo-400" />
                        </div>
                        <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Material/Fabric</label>
                      </div>
                      <input
                        type="text"
                        value={formData.fabric}
                        onChange={(e) => setFormData({...formData, fabric: e.target.value})}
                        className="w-full theme-input rounded-[1.25rem] py-4 px-6 shadow-inner font-bold"
                        placeholder="e.g. Cotton Blend"
                      />
                    </div>
                  </div>

                  {/* Variants Builder */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-pink-500/10 rounded-lg">
                          <Hash size={16} className="text-pink-400" />
                        </div>
                        <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Variants (Color × Size × Stock × Price)</label>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-black text-emerald-400">Total: {totalStock}</span>
                        <button type="button" onClick={addVariant}
                          className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl transition-all">
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {formData.variants.map((v, vi) => (
                        <div key={vi} className="grid grid-cols-12 gap-2 items-center theme-bg-subtle rounded-xl p-3 theme-border">
                          <div className="col-span-3">
                            <input type="text" value={v.color} placeholder="Color"
                              onChange={(e) => updateVariant(vi, 'color', e.target.value)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-bold transition-all"
                            />
                          </div>
                          <div className="col-span-2">
                            <input type="text" value={v.size} placeholder="Size"
                              onChange={(e) => updateVariant(vi, 'size', e.target.value)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-bold transition-all"
                            />
                          </div>
                          <div className="col-span-2">
                            <input type="number" min="0" value={v.stock} placeholder="Qty"
                              onChange={(e) => updateVariant(vi, 'stock', parseInt(e.target.value) || 0)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-black transition-all"
                            />
                          </div>
                          <div className="col-span-3">
                            <input type="number" min="0" step="0.01" value={v.price} placeholder="Price"
                              onChange={(e) => updateVariant(vi, 'price', parseFloat(e.target.value) || 0)}
                              className="w-full theme-input rounded-lg py-2.5 px-3 text-xs font-black transition-all"
                            />
                          </div>
                          <div className="col-span-2 flex justify-end">
                            <button type="button" onClick={() => removeVariant(vi)}
                              className="p-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg transition-all disabled:opacity-20"
                              disabled={formData.variants.length <= 1}>
                              <Minus size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button type="button" onClick={addVariant}
                      className="w-full py-3 border-2 border-dashed border-gray-800 rounded-xl text-xs md:text-sm font-black text-gray-600 uppercase tracking-widest hover:border-emerald-500/40 hover:text-emerald-500 transition-all flex items-center justify-center space-x-2">
                      <Plus size={14} />
                      <span>Add Variant</span>
                    </button>
                  </div>

                  {/* Image Upload */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 mb-1">
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <ImageIcon size={16} className="text-yellow-400" />
                      </div>
                      <label className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Product Image</label>
                    </div>
                    
                    <div 
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`relative w-48 h-48 rounded-[1.25rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 overflow-hidden ${
                        dragActive ? 'border-yellow-500 bg-yellow-500/10' : 'border-gray-800 bg-gray-950/50'
                      } ${formData.imageUrl ? 'border-solid border-emerald-500/40' : ''}`}
                    >
                      {formData.imageUrl ? (
                        <>
                          <img src={formData.imageUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2 backdrop-blur-sm">
                            <Upload size={32} className="text-white" />
                            <span className="text-xs md:text-sm font-black text-white uppercase">Replace</span>
                          </div>
                        </>
                      ) : (
                        <>
                          {uploading ? (
                            <RefreshCcw size={32} className="text-yellow-500 animate-spin" />
                          ) : (
                            <Upload size={32} className="text-gray-700" />
                          )}
                          <div className="text-center">
                            <p className="text-xs md:text-sm font-black text-gray-400 uppercase tracking-widest">{uploading ? 'Processing...' : 'Drop image'}</p>
                            <p className="text-xs text-gray-600 font-bold mt-1 uppercase">or click</p>
                          </div>
                        </>
                      )}
                      <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => handleFileUpload(e.target.files[0])}
                        accept="image/*"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit"
                    variant="primary"
                    size="xl"
                    icon={CheckCircle2}
                    className="w-full justify-center"
                  >
                    {editingItem ? 'Finalize Master Update' : 'Initialize Stock Asset'}
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default InventoryManagement;
