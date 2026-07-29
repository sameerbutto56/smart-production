import React from 'react';
import { motion } from 'framer-motion';
import { Package, CheckCircle2, Layers, Palette, Hash, Search, X, Plus, FileEdit, Trash2, ShoppingCart, Pencil } from 'lucide-react';
import { useOrderEntry } from '../context/OrderEntryContext';

const OptionCard = ({ label, value, current, onClick, icon: Icon, sublabel, color, disabled = false }) => (
  <button type="button" onClick={() => onClick(value)}
    className={`relative p-5 rounded-[1.5rem] border-2 transition-all flex flex-col items-start justify-between min-h-[9rem] h-auto w-full group ${disabled ? 'border-red-900/50 bg-gray-800/20 text-gray-600' : current === value ? 'border-blue-500 bg-blue-500/10 theme-text-primary shadow-xl shadow-blue-900/30' : 'theme-border theme-bg-subtle theme-text-secondary hover:border-gray-600 hover:bg-gray-800/60'}`}>
    <div className={`p-3 rounded-xl ${disabled ? 'bg-gray-700/50 text-gray-600' : current === value ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500 group-hover:text-gray-300'}`} style={color ? { backgroundColor: color } : {}}>
      {Icon ? <Icon size={16} /> : <Package size={16} />}
    </div>
    <div className="text-left w-full mt-2">
      <span className="block text-xs md:text-sm font-black uppercase tracking-wider whitespace-normal break-words leading-snug">{label}</span>
      {sublabel && <span className={`block text-xs md:text-sm mt-1 font-medium whitespace-normal break-words ${disabled ? 'text-red-400' : 'theme-text-muted'}`}>{sublabel}</span>}
    </div>
    {current === value && (
      <motion.div layoutId="activeMark" className="absolute top-4 right-4 bg-blue-500 rounded-full p-1 shadow-lg">
        <CheckCircle2 size={14} className="text-white" />
      </motion.div>
    )}
  </button>
);

const colorMap = {
  'white': '#ffffff', 'black': '#1a1a1a', 'navy': '#1e3a5f', 'royal blue': '#4169e1',
  'dark blue': '#0a2351', 'light blue': '#add8e6', 'sky blue': '#87ceeb',
  'red': '#dc2626', 'dark red': '#8b0000', 'maroon': '#800000', 'wine': '#722f37',
  'green': '#16a34a', 'dark green': '#064e3b', 'olive': '#808000', 'teal': '#008080',
  'grey': '#6b7280', 'gray': '#6b7280', 'dark grey': '#374151', 'dark gray': '#374151',
  'light grey': '#d1d5db', 'light gray': '#d1d5db', 'silver': '#c0c0c0', 'gold': '#d4af37',
  'purple': '#9333ea', 'indigo': '#4f46e5', 'pink': '#ec4899', 'brown': '#8b4513',
  'khaki': '#c3b091', 'beige': '#f5f5dc', 'cream': '#fffdd0', 'tan': '#d2b48c',
  'orange': '#f97316', 'yellow': '#eab308', 'coral': '#ff7f50', 'mint': '#98ff98',
  'peach': '#ffdab9', 'lavender': '#e6e6fa', 'turquoise': '#40e0d0', 'magenta': '#ff00ff',
  'burgundy': '#900020', 'charcoal': '#36454f', 'camel': '#c19a6b', 'rust': '#b7410e'
};
const darkColors = new Set(['black', 'navy', 'dark blue', 'dark red', 'maroon', 'wine', 'dark green', 'olive', 'teal', 'grey', 'gray', 'dark grey', 'dark gray', 'purple', 'indigo', 'brown', 'charcoal', 'burgundy', 'rust']);

const ProductSelectionTab = () => {
  const {
    formData, setFormData, t, useUrdu, isEditMode, inventory,
    selectedProductCategory, setSelectedProductCategory,
    productSearchTerm, setProductSearchTerm, colorSearchTerm, setColorSearchTerm,
    expandedProducts, setExpandedProducts,
    productCategories, isAccessory, isShoes, productsInCategory,
    selectedProduct, selectedProductVariants, fabrics, defaultSizes, colors, availableSizes,
    computedUnitPrice, computedTotalPrice, capUnitPrice, capCharges,
    memoCartTotalItems, memoCartTotalPrice,
    preventEnterSubmit, handleSizeSelect,
    cartItems, setCartItems, removeCartItem, editCartItem,
    fromVerification, originalOrder
  } = useOrderEntry();

  return (
    <motion.div
      key="product"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6 md:space-y-10"
    >
      {/* Show existing cart items when coming from verification return */}
      {fromVerification && originalOrder && cartItems.length > 0 && (
        <div className="glass p-4 md:p-6 rounded-[2rem] border-2 border-emerald-500/30 bg-emerald-500/5 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-emerald-400" />
              <h3 className="text-sm md:text-base font-black text-emerald-400 uppercase tracking-wider">Existing Products ({cartItems.length})</h3>
            </div>
            <span className="text-[10px] text-gray-500 font-bold">Already loaded from original order</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {cartItems.map((item, idx) => {
              const pd = item.productDetails || {};
              return (
                <div key={idx} className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-xl p-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white truncate">{pd.productType || 'Product'}</p>
                    <p className="text-[10px] text-gray-400 font-bold truncate">
                      {pd.color || ''}{pd.color && pd.size ? ' / ' : ''}{pd.size || ''} × {item.quantity || 1}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-black text-emerald-400">Rs{(parseFloat(item.totalPrice) || 0).toLocaleString()}</span>
                    <button type="button" onClick={() => editCartItem(idx, 'product')}
                      className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-all">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => removeCartItem(idx)}
                      className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500 font-bold border-t border-gray-800 pt-2">
            <Plus size={12} />
            <span>Add new products below or edit existing ones above</span>
          </div>
        </div>
      )}
      <div className="glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border shadow-2xl">
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between mb-6 md:mb-10 gap-4 md:gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
          <div className={`space-y-1 ${useUrdu ? 'text-right' : ''}`}>
            <h3 className={`text-xl md:text-3xl font-black theme-text-primary flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
              <Package className="text-blue-500" size={32} />
              <span>{t('productSelection')}</span>
            </h3>
            <p className={`theme-text-muted text-xs font-bold uppercase tracking-widest ${useUrdu ? 'mr-12' : 'ml-12'}`}>Step 1: Choose category & style</p>
          </div>
          <div className="flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border shadow-inner overflow-x-auto no-scrollbar max-w-full">
            {(productCategories || []).map(cat => (
              <button key={cat} type="button"
                onClick={() => { setSelectedProductCategory(cat); if (isAccessory(cat) && !isShoes(cat)) { setFormData(prev => ({ ...prev, size: 'Standard', measurements: { chest: '', shoulder: '', length: '', sleeve: '', waist: '', hips: '' } })); } else { setFormData(prev => ({ ...prev, size: '' })); } }}
                className={`px-8 py-3 rounded-xl text-xs font-black transition-all whitespace-nowrap ${selectedProductCategory === cat ? 'bg-blue-600 text-white shadow-xl' : 'text-gray-600 hover:text-white hover:bg-gray-800'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 theme-text-muted" size={18} />
          <input type="text" placeholder={useUrdu ? 'پروڈکٹ تلاش کریں...' : 'Search products by name...'}
            value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)}
            className={`w-full pl-14 pr-10 py-4 theme-input rounded-2xl text-sm font-bold transition-colors ${useUrdu ? 'text-right pr-14 pl-10' : ''}`} />
          {productSearchTerm && (
            <button type="button" onClick={() => setProductSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {formData.type === 'FULL_CUSTOM' && (
          <div className="mb-6 p-4 md:p-6 theme-bg-subtle rounded-2xl border border-blue-500/20 bg-blue-500/5">
            <h3 className="text-sm font-black text-blue-400 uppercase mb-1 flex items-center gap-2"><span>✏️</span> Manual Product Entry</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">Enter custom product details if not selecting from catalog</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Product Name</label>
                <input type="text" value={formData.customProductName} onChange={e => setFormData({ ...formData, customProductName: e.target.value })} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Custom Tunic" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Fabric</label>
                <input type="text" value={formData.customFabric} onChange={e => setFormData({ ...formData, customFabric: e.target.value })} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Cotton Twill" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Material Details</label>
                <input type="text" value={formData.customMaterial} onChange={e => setFormData({ ...formData, customMaterial: e.target.value })} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. 100% Cotton, 200 GSM" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Color</label>
                <input type="text" value={formData.customColor} onChange={e => setFormData({ ...formData, customColor: e.target.value })} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Navy Blue" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Design Details</label>
                <input type="text" value={formData.customDesign} onChange={e => setFormData({ ...formData, customDesign: e.target.value })} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="e.g. Mandarin collar, patch pockets" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Custom Requirements</label>
                <input type="text" value={formData.customRequirements} onChange={e => setFormData({ ...formData, customRequirements: e.target.value })} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold" placeholder="Any special requirements" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Product Specifications</label>
                <textarea value={formData.customSpecifications} onChange={e => setFormData({ ...formData, customSpecifications: e.target.value })} className="w-full theme-input rounded-xl py-2.5 px-3 text-xs font-bold resize-none" rows={2} placeholder="Any additional specifications or notes" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {Array.from(new Set((productsInCategory || []).map(i => i.name)))
            .map(name => productsInCategory.find(i => i.name === name))
            .filter(item => !productSearchTerm || item.name.toLowerCase().includes(productSearchTerm.toLowerCase()))
            .map(item => {
              const totalStock = item.variants && Array.isArray(item.variants) ? item.variants.reduce((sum, v) => sum + (v.stock || 0), 0) : (item.stock || 0);
              return (
                <button key={item.id} type="button"
                  onClick={() => { if (formData.productType === item.name) { setFormData({ ...formData, productType: '', fabricType: '', color: '', productImage: null }); } else { setFormData({ ...formData, productType: item.name, fabricType: item.fabric || formData.fabricType, color: item.color || formData.color, productImage: item.imageUrl || null }); } }}
                  className={`relative p-4 rounded-[1.5rem] border-2 transition-all flex flex-col items-center justify-between min-h-[10rem] w-full group ${formData.productType === item.name ? 'border-blue-500 bg-blue-500/10 theme-text-primary shadow-xl shadow-blue-900/30' : 'theme-border theme-bg-subtle theme-text-secondary hover:border-gray-600 hover:bg-gray-800/60'}`}>
                  {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-contain rounded-xl mb-2" onError={(e) => { e.target.style.display = 'none' }} />}
                  <div className={`p-3 rounded-xl ${formData.productType === item.name ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-500 group-hover:text-gray-300'}`}>
                    <Package size={22} />
                  </div>
                  <div className="text-center w-full mt-2 space-y-2">
                    <span className="block text-sm font-black uppercase tracking-wider leading-snug">{item.name}</span>
                    {!isEditMode && (
                      <span className="block text-lg font-black tracking-tight">
                        <span className={`${totalStock > 50 ? 'text-emerald-400' : totalStock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>{totalStock}</span>
                        <span className="text-xs md:text-sm theme-text-muted ml-1">in stock</span>
                      </span>
                    )}
                    {(item.price > 0 || (item.variants && Array.isArray(item.variants) && item.variants.some(v => v.price))) && (
                      <span className="block text-xs font-black text-emerald-400">
                        ₨{Number((item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? (item.variants.find(v => v.price)?.price || item.price) : item.price)).toLocaleString()}
                        <span className="text-xs theme-text-muted ml-0.5">/unit</span>
                      </span>
                    )}
                    {expandedProducts[item.id] && item.variants && Array.isArray(item.variants) && item.variants.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap justify-center gap-1">
                          {[...new Set(item.variants.filter(v => v.color).map(v => v.color))].map(c => (
                            <span key={c} className="text-xs font-bold theme-text-secondary bg-gray-800/60 px-2 py-0.5 rounded-full truncate max-w-[70px]">{c}</span>
                          ))}
                        </div>
                        <div className="flex flex-wrap justify-center gap-1">
                          {[...new Set(item.variants.filter(v => v.size).map(v => v.size))].map(s => (
                            <span key={s} className="text-xs font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-full">{s}</span>
                          ))}
                        </div>
                      </div>
                    ) : expandedProducts[item.id] && item.color ? (
                      <span className="block text-xs md:text-sm theme-text-muted font-bold truncate">{item.color}</span>
                    ) : null}
                    {item.variants && Array.isArray(item.variants) && item.variants.length > 0 && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedProducts(prev => ({ ...prev, [item.id]: !prev[item.id] })); }}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors mt-1">
                        {expandedProducts[item.id] ? 'Show Less' : 'View Details'}
                      </button>
                    )}
                  </div>
                  {formData.productType === item.name && (
                    <motion.div layoutId="activeProduct" className="absolute top-2 right-2 bg-blue-500 rounded-full p-1 shadow-lg">
                      <CheckCircle2 size={14} className="text-white" />
                    </motion.div>
                  )}
                </button>
              );
            })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
        <div className={`lg:col-span-5 glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
          <div className="space-y-1 mb-6 md:mb-10">
            <h3 className={`text-2xl font-black text-emerald-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
              <Layers size={28} />
              <span>{t('fabric')}</span>
            </h3>
            <p className={`theme-text-muted text-xs md:text-sm font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 2: Define fabric feel</p>
          </div>
          {(fabrics || []).length > 0 ? (
            <div className="grid grid-cols-2 gap-5">
              {(fabrics || []).map((f, fi) => {
                const fName = typeof f === 'string' ? f : (f.fabric || f.name);
                const fStock = typeof f === 'string' ? selectedProductVariants.reduce((s, v) => s + (v.stock || 0), 0) : (f.stock || 0);
                return (
                  <OptionCard key={fi} label={fName} value={fName} current={formData.fabricType}
                    onClick={(val) => setFormData({ ...formData, fabricType: val })} icon={Layers}
                    sublabel={isEditMode ? '' : (fStock > 0 ? `${fStock} units` : 'Out of stock')} />
                );
              })}
            </div>
          ) : (
            <div className="theme-bg-subtle p-6 rounded-2xl border theme-border text-center mt-4">
              <p className="theme-text-secondary font-bold text-base">Select a product first to see available fabrics</p>
            </div>
          )}
        </div>

        <div className={`lg:col-span-7 glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
          <div className={`flex flex-col sm:flex-row items-center justify-between mb-6 md:mb-10 gap-3 md:gap-6 ${useUrdu ? 'flex-row-reverse' : ''}`}>
            <div className="space-y-1">
              <h3 className={`text-2xl font-black text-purple-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                <Palette size={28} />
                <span>{t('color')} & {t('size')}</span>
              </h3>
              <p className={`theme-text-muted text-xs md:text-sm font-bold uppercase tracking-widest ${useUrdu ? 'mr-11' : 'ml-11'}`}>Step 3: Visual scaling</p>
            </div>
            {formData.productType && (
              <div className={`flex flex-wrap gap-1.5 p-1.5 theme-bg rounded-xl border-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
                {((availableSizes || []).length > 0 ? (availableSizes || []) : (defaultSizes || [])).map(s => (
                  <button key={s} type="button" onClick={() => handleSizeSelect(s)}
                    className={`font-black transition-all rounded-lg ${isShoes(selectedProductCategory) ? 'px-3 py-1.5 text-[10px] leading-tight' : 'w-14 h-14 text-xs'} ${formData.size === s ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(colors || []).length > 0 && (
            <>
              <div className="relative mb-3 mt-2">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 theme-text-muted" size={16} />
                <input type="text" placeholder={useUrdu ? 'رنگ تلاش کریں...' : 'Search colors...'}
                  value={colorSearchTerm} onChange={e => setColorSearchTerm(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2.5 theme-input rounded-xl text-sm font-bold transition-colors ${useUrdu ? 'text-right pr-10 pl-10' : ''}`} />
                {colorSearchTerm && (
                  <button type="button" onClick={() => setColorSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-muted hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 gap-4 mt-2">
                {colors.filter(c => !colorSearchTerm || c.toLowerCase().includes(colorSearchTerm.toLowerCase())).map(c => {
                  const stockForColor = selectedProductVariants.filter(v => v.color === c).reduce((s, v) => s + (v.stock || 0), 0);
                  const normalizedKey = c.toLowerCase().trim();
                  const bgHex = colorMap[normalizedKey] || normalizedKey;
                  const textClass = darkColors.has(normalizedKey) ? 'text-white' : 'text-gray-900';
                  return (
                    <button key={c} type="button" onClick={() => setFormData({ ...formData, color: c })}
                      className={`group relative w-full rounded-xl border-2 transition-all duration-200 flex flex-col items-center overflow-hidden ${formData.color === c ? 'border-white ring-2 ring-blue-500 scale-105 z-10' : 'border-gray-700/50 hover:border-gray-500'}`}>
                      <div className="w-full aspect-square flex items-center justify-center relative" style={{ backgroundColor: bgHex }}>
                        {formData.color === c && <div className={`${textClass} bg-black/20 backdrop-blur-sm p-1.5 rounded-full`}><CheckCircle2 size={16} className={textClass} /></div>}
                      </div>
                      <div className="w-full py-1.5 px-1 theme-bg text-center">
                        <p className={`text-xs md:text-sm font-black theme-text-primary ${formData.color === c ? 'whitespace-normal break-words' : 'truncate'}`}>{c}</p>
                        {!isEditMode && <p className="text-[9px] font-bold theme-text-muted">{stockForColor} in stock</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {formData.productType && colors.length === 0 && (
            <div className="mt-6 theme-bg-subtle p-6 rounded-2xl border theme-border text-center">
              <p className="theme-text-secondary text-sm font-bold">Colors: Available (Standard)</p>
            </div>
          )}

          {(formData.productType || formData.type === 'FULL_CUSTOM') && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="theme-bg-subtle p-4 md:p-5 rounded-2xl border theme-border">
                <h3 className="text-sm font-black text-cyan-400 uppercase mb-3">Sleeve Length</h3>
                <div className="flex gap-2">
                  {[{ value: 'full', label: 'Full' }, { value: 'three-quarter', label: '3 Quarter' }, { value: 'half', label: 'Half' }].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setFormData({ ...formData, sleeveLength: formData.sleeveLength === opt.value ? '' : opt.value })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${formData.sleeveLength === opt.value ? 'bg-cyan-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
              <div className="theme-bg-subtle p-4 md:p-5 rounded-2xl border theme-border">
                <h3 className="text-sm font-black text-indigo-400 uppercase mb-3">Shirt Length</h3>
                <div className="flex gap-2">
                  {[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }, { value: 'regular', label: 'Regular' }].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setFormData({ ...formData, shirtLength: formData.shirtLength === opt.value ? '' : opt.value })}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${formData.shirtLength === opt.value ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(formData.productType || formData.type === 'FULL_CUSTOM') && (formData.type === 'STANDARD' || formData.type === 'READY_LOGO') && (
            <div className={`mt-6 p-4 md:p-6 rounded-2xl border transition-all ${formData.alteration?.trouserLength || formData.alteration?.shirtLength || formData.alteration?.sleeveLength ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.15)]' : 'theme-bg-subtle theme-border'}`}>
              <h3 className={`text-lg font-black uppercase mb-4 ${formData.alteration?.trouserLength || formData.alteration?.shirtLength || formData.alteration?.sleeveLength ? 'text-amber-300' : 'text-amber-400'}`}>Alteration</h3>
              <div className="grid grid-cols-3 gap-3">
                {[{ key: 'trouserLength', label: 'Trouser Length' }, { key: 'shirtLength', label: 'Shirt Length' }, { key: 'sleeveLength', label: 'Sleeve Length' }].map(a => (
                  <div key={a.key}>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{a.label}</label>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setFormData({ ...formData, alteration: { ...formData.alteration, [a.key]: String(parseFloat(formData.alteration?.[a.key] || 0) - 0.5) } })}
                        className="w-8 h-8 rounded-lg bg-gray-800 text-white font-black text-sm hover:bg-gray-700">−</button>
                      <input type="text" value={formData.alteration?.[a.key] || ''}
                        onChange={(e) => setFormData({ ...formData, alteration: { ...formData.alteration, [a.key]: e.target.value } })}
                        className="w-full text-center bg-transparent border-b-2 border-gray-700 text-white font-black text-lg outline-none" placeholder="inches" />
                      <button type="button" onClick={() => setFormData({ ...formData, alteration: { ...formData.alteration, [a.key]: String(parseFloat(formData.alteration?.[a.key] || 0) + 0.5) } })}
                        className="w-8 h-8 rounded-lg bg-gray-800 text-white font-black text-sm hover:bg-gray-700">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(formData.productType || formData.type === 'FULL_CUSTOM') && !isAccessory(selectedProductCategory) && (
            <div className="mt-6 theme-bg-subtle p-4 md:p-6 rounded-2xl border theme-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-rose-400 uppercase">Matching Cap</h3>
                  <button type="button"
                    onClick={() => setFormData({ ...formData, matchingCap: !formData.matchingCap, matchingCapQty: formData.matchingCap ? 0 : 1 })}
                    className={`relative w-12 h-6 rounded-full transition-all ${formData.matchingCap ? 'bg-rose-600' : 'bg-gray-700'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${formData.matchingCap ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
                {formData.matchingCap && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-black">Qty:</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setFormData({ ...formData, matchingCapQty: Math.max(1, (formData.matchingCapQty || 1) - 1) })}
                        className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 font-black hover:bg-gray-700 transition-all">−</button>
                      <span className="w-8 text-center font-black text-white">{formData.matchingCapQty || 1}</span>
                      <button type="button" onClick={() => setFormData({ ...formData, matchingCapQty: (formData.matchingCapQty || 1) + 1 })}
                        className="w-8 h-8 rounded-lg bg-gray-800 text-gray-400 font-black hover:bg-gray-700 transition-all">+</button>
                    </div>
                    <span className="text-xs text-rose-400 font-black">₨{(((formData.matchingCapQty || 0) * capUnitPrice)).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {(formData.productType || formData.type === 'FULL_CUSTOM') && !isAccessory(selectedProductCategory) && (
            <div className="mt-6 theme-bg-subtle p-4 md:p-6 rounded-2xl border theme-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-purple-400 uppercase">{useUrdu ? 'صنف' : 'Gender'}</h3>
              </div>
              <div className="flex p-1 theme-bg rounded-xl border-2 theme-border">
                <button type="button" onClick={() => setFormData({ ...formData, gender: 'Male' })}
                  className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${formData.gender === 'Male' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}>{useUrdu ? 'مردانہ' : 'MALE'}</button>
                <button type="button" onClick={() => setFormData({ ...formData, gender: 'Female' })}
                  className={`flex-1 py-3 rounded-lg text-sm font-black transition-all ${formData.gender === 'Female' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}>{useUrdu ? 'زنانہ' : 'FEMALE'}</button>
              </div>
              {formData.gender === 'Female' && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <label className="flex items-center justify-between p-3 theme-bg rounded-xl border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg transition-all ${formData.femaleOptions.dupatta ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                        <Layers size={14} />
                      </div>
                      <p className="font-black text-xs uppercase">{t('dupatta')}</p>
                    </div>
                    <input type="checkbox" checked={formData.femaleOptions.dupatta}
                      onChange={(e) => setFormData({ ...formData, femaleOptions: { ...formData.femaleOptions, dupatta: e.target.checked } })}
                      className="w-4 h-4 rounded border-2 border-gray-700 checked:bg-pink-600 transition-all cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between p-3 theme-bg rounded-xl border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg transition-all ${formData.femaleOptions.zip ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                        <span className="font-black text-xs">ZIP</span>
                      </div>
                      <p className="font-black text-xs uppercase">{t('zip')}</p>
                    </div>
                    <input type="checkbox" checked={formData.femaleOptions.zip}
                      onChange={(e) => setFormData({ ...formData, femaleOptions: { ...formData.femaleOptions, zip: e.target.checked } })}
                      className="w-4 h-4 rounded border-2 border-gray-700 checked:bg-pink-600 transition-all cursor-pointer" />
                  </label>
                </div>
              )}
            </div>
          )}

          <div className={`mt-6 md:mt-10 pt-6 md:pt-10 border-t theme-border flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-8 ${useUrdu ? 'flex-row-reverse' : ''}`}>
            <div className="space-y-1">
              <h3 className={`text-xl font-black text-blue-400 flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-4'}`}>
                <Hash size={16} />
                <span>{useUrdu ? 'آرڈر کی تعداد' : 'Order Quantity'}</span>
              </h3>
              <p className="theme-text-muted text-xs md:text-sm font-bold uppercase tracking-widest">How many sets are needed?</p>
            </div>
            <div className="relative group w-full sm:w-64">
              <div className={`absolute ${useUrdu ? 'right-6' : 'left-6'} top-1/2 -translate-y-1/2 text-gray-600 font-black text-lg group-focus-within:text-blue-500 transition-colors`}>🔢</div>
              <input type="number" min="1" onKeyDown={preventEnterSubmit} value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className={`w-full theme-input rounded-[1.5rem] py-5 ${useUrdu ? 'pr-20 pl-8 text-right' : 'pl-20 pr-8'} transition-all text-2xl font-black shadow-inner`}
                placeholder="1" required />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductSelectionTab;
