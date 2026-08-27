import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, User, Ruler, Scissors, Star, AlertTriangle, MessageSquare, Plus, Trash2 } from 'lucide-react';

const Field = ({ label, oldVal, newVal, editable, type, options, onChange, placeholder }) => {
  const isChanged = String(oldVal || '').trim() !== String(newVal ?? oldVal ?? '').trim();
  const displayVal = (v) => {
    if (v === null || v === undefined || v === '') return <span className="italic opacity-40">—</span>;
    return String(v);
  };

  const inputClass = `w-full text-xs font-bold py-2 px-3 rounded-xl border transition-all ${
    isChanged ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-gray-700 bg-gray-800/40 theme-text-primary'
  } focus:outline-none focus:border-blue-500`;

  const readClass = `text-xs font-bold py-2 px-3 rounded-xl border ${
    isChanged ? 'border-amber-500/50 bg-amber-500/5 text-amber-400' : 'border-gray-800 bg-gray-900/40 theme-text-primary'
  }`;

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase tracking-widest theme-text-muted ml-1">{label}</label>
      <div className={editable ? inputClass : readClass}>
        {editable ? (
          type === 'select' ? (
            <select value={newVal ?? oldVal ?? ''} onChange={e => onChange(e.target.value)} className="w-full bg-transparent text-xs font-bold focus:outline-none">
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : type === 'textarea' ? (
            <textarea value={newVal ?? oldVal ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} rows={2} className="w-full bg-transparent text-xs font-bold focus:outline-none resize-none" />
          ) : type === 'checkbox' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!(newVal ?? oldVal)} onChange={e => onChange(e.target.checked)} className="accent-amber-500" />
              <span className="text-xs font-bold">{(newVal ?? oldVal) ? 'Yes' : 'No'}</span>
            </label>
          ) : (
            <input type={type || 'text'} value={newVal ?? oldVal ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''} className="w-full bg-transparent text-xs font-bold focus:outline-none" />
          )
        ) : (
          <span>{displayVal(oldVal)}</span>
        )}
      </div>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, color }) => (
  <div className={`flex items-center gap-2 mb-4 pb-2 border-b ${color || 'border-gray-700'}`}>
    {Icon && <Icon size={14} className={`${color?.includes('amber') ? 'text-amber-400' : color?.includes('blue') ? 'text-blue-400' : color?.includes('emerald') ? 'text-emerald-400' : color?.includes('purple') ? 'text-purple-400' : 'text-gray-400'}`} />}
    <span className="text-[11px] font-black uppercase tracking-widest theme-text-muted">{title}</span>
  </div>
);

const EditOrderComparison = ({ order, onSubmit, onCancel, isSubmitting, useUrdu }) => {
  const originalItems = useMemo(() => {
    let pd = [];
    try {
      pd = Array.isArray(order.productDetails) ? order.productDetails : (order.productDetails?.productType ? [order.productDetails] : []);
    } catch { pd = []; }
    return pd;
  }, [order]);

  const originalCustomization = useMemo(() => {
    try { return order.customization ? (typeof order.customization === 'string' ? JSON.parse(order.customization) : order.customization) : {}; } catch { return {}; }
  }, [order]);

  const originalSizeData = useMemo(() => {
    try { return order.sizeData ? (typeof order.sizeData === 'string' ? JSON.parse(order.sizeData) : order.sizeData) : {}; } catch { return {}; }
  }, [order]);

  const [edited, setEdited] = useState(() => ({
    customerName: order.customerName || '',
    customerPhone: order.customerPhone || '',
    address: order.address || '',
    city: order.city || '',
    type: order.type || 'STANDARD',
    priority: order.priority || 'NORMAL',
    advancePaid: !!order.advancePaid,
    advanceAmount: order.advanceAmount || '',
    deliveryCharges: order.deliveryCharges || '',
    instructionNotes: order.instructionNotes || '',
    shopifyOrderDate: order.shopifyOrderDate || '',
    engravingInstructions: order.engravingInstructions || '',
    engravingRequired: order.engravingRequired !== false,
    logoDesign: order.logoDesign || '',
    logoName: order.logoName || '',
    items: originalItems.map(item => {
      const pd = item.productDetails || item;
      const cust = item.customization || {};
      const sd = item.sizeData || {};
      return {
        productType: pd.productType || '',
        fabricType: pd.fabricType || '',
        color: pd.color || '',
        size: pd.size || '',
        gender: pd.gender || 'Male',
        quantity: item.quantity || 1,
        totalPrice: item.totalPrice || 0,
        sleeveLength: pd.sleeveLength || '',
        shirtLength: pd.shirtLength || '',
        matchingCap: pd.matchingCap || false,
        matchingCapQty: pd.matchingCapQty || 0,
        logoCharges: item.logoCharges || 0,
        namePrintingCharges: item.namePrintingCharges || 0,
        customizationPrice: item.customizationPrice || 0,
        capCharges: item.capCharges || 0,
        nameSpelling: cust.nameSpelling || '',
        nameColor: cust.nameColor || '',
        logoColor: cust.logoColor || '',
        logoPlacement: cust.logoPlacement || '',
        designNotes: cust.designNotes || '',
        designReference: cust.designReference || '',
        measurementSpecialNote: pd.measurementSpecialNote || '',
        sizeData: typeof sd === 'object' ? sd : {},
        femaleOptions: pd.femaleOptions || {}
      };
    })
  }));

  const [reason, setReason] = useState('');

  const updateItem = (idx, field, val) => {
    setEdited(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: val };
      return { ...prev, items };
    });
  };

  const updateSizeData = (idx, field, val) => {
    setEdited(prev => {
      const items = [...prev.items];
      const sd = { ...items[idx].sizeData, [field]: val };
      items[idx] = { ...items[idx], sizeData: sd };
      return { ...prev, items };
    });
  };

  const addNewItem = () => {
    setEdited(prev => ({
      ...prev,
      items: [...prev.items, {
        productType: '', fabricType: '', color: '', size: '', gender: 'Male',
        quantity: 1, totalPrice: 0, sleeveLength: '', shirtLength: '',
        matchingCap: false, matchingCapQty: 0,
        logoCharges: 0, namePrintingCharges: 0, customizationPrice: 0, capCharges: 0,
        nameSpelling: '', nameColor: '', logoColor: '', logoPlacement: '',
        designNotes: '', designReference: '', measurementSpecialNote: '', sizeData: {}, femaleOptions: {}
      }]
    }));
  };

  const removeItem = (idx) => {
    setEdited(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const diffCount = useMemo(() => {
    let count = 0;
    const custFields = ['customerName', 'customerPhone', 'address', 'city', 'type', 'priority', 'advanceAmount', 'deliveryCharges', 'instructionNotes', 'engravingInstructions', 'logoDesign', 'logoName'];
    custFields.forEach(f => {
      const ov = String(order[f] ?? '');
      const nv = String(edited[f] ?? '');
      if (ov !== nv) count++;
    });
    if (!!order.advancePaid !== !!edited.advancePaid) count++;
    if (order.engravingRequired !== edited.engravingRequired) count++;
    const maxLen = Math.max(originalItems.length, edited.items.length);
    for (let i = 0; i < maxLen; i++) {
      const orig = originalItems[i] || {};
      const origPd = orig.productDetails || orig;
      const origCust = orig.customization || {};
      const origSd = typeof (orig.sizeData || {}) === 'object' ? (orig.sizeData || {}) : {};
      const edit = edited.items[i] || {};
      const editSd = edit.sizeData || {};
      const itemFields = ['productType', 'fabricType', 'color', 'size', 'gender', 'quantity', 'totalPrice', 'sleeveLength', 'shirtLength', 'matchingCapQty', 'logoCharges', 'namePrintingCharges', 'customizationPrice', 'capCharges', 'nameSpelling', 'logoDesign', 'measurementSpecialNote'];
      itemFields.forEach(f => {
        let ov, nv;
        if (['nameSpelling', 'logoDesign'].includes(f)) { ov = origCust[f]; nv = edit[f]; }
        else { ov = origPd[f]; nv = edit[f]; }
        if (String(ov ?? '') !== String(nv ?? '')) count++;
      });
      const sdFields = ['chest', 'shoulder', 'shirtLength', 'trouserLength', 'sleevesLength', 'sleevesHole', 'bottom', 'waist', 'length', 'pancha', 'thighs', 'asan', 'mori', 'ganda', 'specialNote'];
      sdFields.forEach(f => { if (String(origSd[f] ?? '') !== String(editSd[f] ?? '')) count++; });
    }
    return count;
  }, [order, edited, originalItems]);

  const totalOldPrice = useMemo(() => originalItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0), [originalItems]);
  const totalNewPrice = useMemo(() => edited.items.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0), [edited.items]);

  const oldPricing = useMemo(() => {
    const productPrice = originalItems.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0);
    const customization = originalItems.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0);
    const logoCharges = originalItems.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0);
    const namePrint = originalItems.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0);
    const delivery = parseFloat(order.deliveryCharges) || 0;
    const advance = parseFloat(order.advanceAmount) || 0;
    const total = productPrice + delivery;
    return { productPrice, customization, logoCharges, namePrint, delivery, advance, total, remaining: Math.max(0, total - advance) };
  }, [originalItems, order]);

  const newPricing = useMemo(() => {
    const productPrice = edited.items.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0);
    const customization = edited.items.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0);
    const logoCharges = edited.items.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0);
    const namePrint = edited.items.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0);
    const delivery = parseFloat(edited.deliveryCharges) || 0;
    const advance = parseFloat(edited.advanceAmount) || 0;
    const total = productPrice + delivery;
    return { productPrice, customization, logoCharges, namePrint, delivery, advance, total, remaining: Math.max(0, total - advance) };
  }, [edited]);

  const buildPayload = () => {
    const items = edited.items.map(item => ({
      productDetails: {
        productType: item.productType, fabricType: item.fabricType, color: item.color, size: item.size,
        gender: item.gender, sleeveLength: item.sleeveLength, shirtLength: item.shirtLength,
        matchingCap: item.matchingCap, matchingCapQty: item.matchingCapQty,
        femaleOptions: item.femaleOptions,
        measurementSpecialNote: item.measurementSpecialNote || ''
      },
      customization: {
        nameSpelling: item.nameSpelling, nameColor: item.nameColor, logoColor: item.logoColor,
        logoPlacement: item.logoPlacement, designNotes: item.designNotes, designReference: item.designReference
      },
      sizeData: item.sizeData,
      quantity: parseInt(item.quantity) || 1,
      totalPrice: parseFloat(item.totalPrice) || 0,
      logoName: edited.logoName, logoDesign: edited.logoDesign,
      logoCharges: parseFloat(item.logoCharges) || 0,
      namePrintingCharges: parseFloat(item.namePrintingCharges) || 0,
      customizationPrice: parseFloat(item.customizationPrice) || 0,
      capCharges: parseInt(item.capCharges) || 0
    }));
    return { requestedChanges: {
      customerName: edited.customerName, customerPhone: edited.customerPhone, address: edited.address,
      city: edited.city, type: edited.type, priority: edited.priority,
      advancePaid: edited.advancePaid, advanceAmount: parseFloat(edited.advanceAmount) || 0,
      items, quantity: items.reduce((s, i) => s + (i.quantity || 1), 0),
      totalPrice: items.reduce((s, i) => s + (parseFloat(i.totalPrice) || 0), 0),
      logoDesign: edited.logoDesign, logoName: edited.logoName,
      logoCharges: items.reduce((s, i) => s + (parseFloat(i.logoCharges) || 0), 0),
      namePrintingCharges: items.reduce((s, i) => s + (parseFloat(i.namePrintingCharges) || 0), 0),
      customizationPrice: items.reduce((s, i) => s + (parseFloat(i.customizationPrice) || 0), 0),
      shopifyOrderDate: edited.shopifyOrderDate || null,
      deliveryCharges: parseFloat(edited.deliveryCharges) || 0,
      engravingInstructions: edited.engravingInstructions || null,
      engravingRequired: edited.engravingRequired,
      instructionNotes: edited.instructionNotes || null
    }, reason };
  };

  return (
    <div className="space-y-6">
      {diffCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
          <span className="text-xs font-black text-amber-400 uppercase tracking-wider">{diffCount} field{diffCount > 1 ? 's' : ''} changed from original</span>
          {totalOldPrice !== totalNewPrice && (
            <span className={`ml-auto text-xs font-black ${totalNewPrice > totalOldPrice ? 'text-red-400' : 'text-emerald-400'}`}>
              Price: ₨{totalOldPrice.toLocaleString()} → ₨{totalNewPrice.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Customer Info */}
      <div className="glass rounded-[2rem] border theme-border overflow-hidden">
        <div className="bg-blue-500/5 px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <User size={14} className="text-blue-400" />
            <span className="text-[11px] font-black uppercase tracking-widest text-blue-400">Customer Information</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <Field label="Name" oldVal={order.customerName} editable={false} />
            </div>
            <div>
              <Field label="Name (Edit)" oldVal={order.customerName} newVal={edited.customerName} editable onChange={v => setEdited(p => ({ ...p, customerName: v }))} />
            </div>
            <div><Field label="Phone" oldVal={order.customerPhone} editable={false} /></div>
            <div><Field label="Phone (Edit)" oldVal={order.customerPhone} newVal={edited.customerPhone} editable onChange={v => setEdited(p => ({ ...p, customerPhone: v }))} /></div>
            <div><Field label="Address" oldVal={order.address} editable={false} /></div>
            <div><Field label="Address (Edit)" oldVal={order.address} newVal={edited.address} editable onChange={v => setEdited(p => ({ ...p, address: v }))} /></div>
            <div><Field label="City" oldVal={order.city} editable={false} /></div>
            <div><Field label="City (Edit)" oldVal={order.city} newVal={edited.city} editable onChange={v => setEdited(p => ({ ...p, city: v }))} /></div>
            <div><Field label="Type" oldVal={order.type} editable={false} /></div>
            <div><Field label="Type (Edit)" oldVal={order.type} newVal={edited.type} editable type="select" options={[{ value: 'STANDARD', label: 'Standard' }, { value: 'FULL_CUSTOM', label: 'Full Custom' }]} onChange={v => setEdited(p => ({ ...p, type: v }))} /></div>
            <div><Field label="Priority" oldVal={order.priority} editable={false} /></div>
            <div><Field label="Priority (Edit)" oldVal={order.priority} newVal={edited.priority} editable type="select" options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'URGENT', label: 'Urgent' }, { value: 'SUPER_URGENT', label: 'Super Urgent' }]} onChange={v => setEdited(p => ({ ...p, priority: v }))} /></div>
            <div><Field label="Advance Amount" oldVal={order.advanceAmount} editable={false} /></div>
            <div><Field label="Advance Amount (Edit)" oldVal={order.advanceAmount} newVal={edited.advanceAmount} editable type="number" onChange={v => setEdited(p => ({ ...p, advanceAmount: v }))} /></div>
            <div><Field label="Delivery Charges" oldVal={order.deliveryCharges} editable={false} /></div>
            <div><Field label="Delivery Charges (Edit)" oldVal={order.deliveryCharges} newVal={edited.deliveryCharges} editable type="number" onChange={v => setEdited(p => ({ ...p, deliveryCharges: v }))} /></div>
          </div>
        </div>
      </div>

      {/* Products */}
      {edited.items.map((item, idx) => {
        const orig = originalItems[idx] || {};
        const origPd = orig.productDetails || orig;
        const origCust = orig.customization || {};
        const isAdded = idx >= originalItems.length;
        return (
          <div key={idx} className="glass rounded-[2rem] border theme-border overflow-hidden">
              <div className="bg-emerald-500/5 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
              <Package size={14} className="text-emerald-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                Product {idx + 1}{isAdded ? ' (New)' : ''} — {item.productType || 'Unnamed'}
              </span>
              {isAdded && (
                <button type="button" onClick={() => removeItem(idx)} className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black uppercase hover:bg-red-500/20 transition-all">
                  <Trash2 size={10} /> Remove
                </button>
              )}
            </div>
            <div className="p-6">
              {/* Product Details */}
              <SectionHeader title="Product Details" icon={Package} color="border-emerald-500/30" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
                <div><Field label="Product" oldVal={origPd.productType} editable={false} /></div>
                <div><Field label="Product (Edit)" oldVal={origPd.productType} newVal={item.productType} editable onChange={v => updateItem(idx, 'productType', v)} /></div>
                <div><Field label="Fabric" oldVal={origPd.fabricType} editable={false} /></div>
                <div><Field label="Fabric (Edit)" oldVal={origPd.fabricType} newVal={item.fabricType} editable onChange={v => updateItem(idx, 'fabricType', v)} /></div>
                <div><Field label="Color" oldVal={origPd.color} editable={false} /></div>
                <div><Field label="Color (Edit)" oldVal={origPd.color} newVal={item.color} editable onChange={v => updateItem(idx, 'color', v)} /></div>
                <div><Field label="Size" oldVal={origPd.size} editable={false} /></div>
                <div><Field label="Size (Edit)" oldVal={origPd.size} newVal={item.size} editable onChange={v => updateItem(idx, 'size', v)} /></div>
                <div><Field label="Gender" oldVal={origPd.gender} editable={false} /></div>
                <div><Field label="Gender (Edit)" oldVal={origPd.gender} newVal={item.gender} editable type="select" options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} onChange={v => updateItem(idx, 'gender', v)} /></div>
                <div><Field label="Quantity" oldVal={orig.quantity || item.quantity} editable={false} /></div>
                <div><Field label="Quantity (Edit)" oldVal={orig.quantity || item.quantity} newVal={item.quantity} editable type="number" onChange={v => updateItem(idx, 'quantity', v)} /></div>
                <div><Field label="Price" oldVal={`₨${parseFloat(orig.totalPrice || 0).toLocaleString()}`} editable={false} /></div>
                <div><Field label="Price (Edit)" oldVal={orig.totalPrice} newVal={item.totalPrice} editable type="number" onChange={v => updateItem(idx, 'totalPrice', v)} /></div>
                <div><Field label="Sleeve Length" oldVal={origPd.sleeveLength} editable={false} /></div>
                <div><Field label="Sleeve Length (Edit)" oldVal={origPd.sleeveLength} newVal={item.sleeveLength} editable onChange={v => updateItem(idx, 'sleeveLength', v)} /></div>
                <div><Field label="Shirt Length" oldVal={origPd.shirtLength} editable={false} /></div>
                <div><Field label="Shirt Length (Edit)" oldVal={origPd.shirtLength} newVal={item.shirtLength} editable onChange={v => updateItem(idx, 'shirtLength', v)} /></div>
                <div><Field label="Cap" oldVal={origPd.matchingCap ? 'Yes' : 'No'} editable={false} /></div>
                <div><Field label="Cap Qty" oldVal={origPd.matchingCapQty} newVal={item.matchingCapQty} editable type="number" onChange={v => updateItem(idx, 'matchingCapQty', parseInt(v) || 0)} /></div>
              </div>

              {/* Branding */}
              <SectionHeader title="Branding & Logo" icon={Star} color="border-purple-500/30" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
                <div><Field label="Logo Name" oldVal={origCust.nameSpelling || order.logoName} editable={false} /></div>
                <div><Field label="Logo Name (Edit)" oldVal={origCust.nameSpelling || order.logoName} newVal={item.nameSpelling} editable onChange={v => updateItem(idx, 'nameSpelling', v)} /></div>
                <div><Field label="Logo Design" oldVal={order.logoDesign} editable={false} /></div>
                <div><Field label="Logo Design (Edit)" oldVal={order.logoDesign} newVal={edited.logoDesign} editable onChange={v => setEdited(p => ({ ...p, logoDesign: v }))} /></div>
                <div><Field label="Name Color" oldVal={origCust.nameColor} editable={false} /></div>
                <div><Field label="Name Color (Edit)" oldVal={origCust.nameColor} newVal={item.nameColor} editable onChange={v => updateItem(idx, 'nameColor', v)} /></div>
                <div><Field label="Logo Color" oldVal={origCust.logoColor} editable={false} /></div>
                <div><Field label="Logo Color (Edit)" oldVal={origCust.logoColor} newVal={item.logoColor} editable onChange={v => updateItem(idx, 'logoColor', v)} /></div>
                <div><Field label="Placement" oldVal={origCust.logoPlacement} editable={false} /></div>
                <div><Field label="Placement (Edit)" oldVal={origCust.logoPlacement} newVal={item.logoPlacement} editable onChange={v => updateItem(idx, 'logoPlacement', v)} /></div>
                <div><Field label="Design Notes" oldVal={origCust.designNotes} editable={false} /></div>
                <div><Field label="Design Notes (Edit)" oldVal={origCust.designNotes} newVal={item.designNotes} editable type="textarea" onChange={v => updateItem(idx, 'designNotes', v)} /></div>
                <div><Field label="Logo Charges" oldVal={orig.logoCharges} editable={false} /></div>
                <div><Field label="Logo Charges (Edit)" oldVal={orig.logoCharges} newVal={item.logoCharges} editable type="number" onChange={v => updateItem(idx, 'logoCharges', v)} /></div>
                <div><Field label="Name Print Charges" oldVal={orig.namePrintingCharges} editable={false} /></div>
                <div><Field label="Name Print (Edit)" oldVal={orig.namePrintingCharges} newVal={item.namePrintingCharges} editable type="number" onChange={v => updateItem(idx, 'namePrintingCharges', v)} /></div>
                <div><Field label="Customization Charges" oldVal={orig.customizationPrice} editable={false} /></div>
                <div><Field label="Customization (Edit)" oldVal={orig.customizationPrice} newVal={item.customizationPrice} editable type="number" onChange={v => updateItem(idx, 'customizationPrice', v)} /></div>
              </div>

              {/* Measurements */}
              {item.gender === 'Female' || item.size === 'Custom' || Object.keys(item.sizeData).length > 0 ? (
                <>
                  <SectionHeader title="Measurements" icon={Ruler} color="border-blue-500/30" />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
                    {['chest', 'shoulder', 'shirtLength', 'sleevesLength', 'sleevesHole', 'bottom', 'waist', 'length', 'pancha', 'thighs', 'asan', 'mori', 'ganda', 'specialNote'].map(field => {
                      const origSd = typeof (orig.sizeData || {}) === 'object' ? (orig.sizeData || {}) : {};
                      const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                      return (
                        <React.Fragment key={field}>
                          <div><Field label={label} oldVal={origSd[field]} editable={false} /></div>
                          <div><Field label={`${label} (Edit)`} oldVal={origSd[field]} newVal={item.sizeData[field]} editable type={field === 'specialNote' ? 'textarea' : 'text'} onChange={v => updateSizeData(idx, field, v)} /></div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {/* Per-Product Special Note */}
              <SectionHeader title="Measurement Special Note" icon={MessageSquare} color="border-amber-500/30" />
              <div className="mb-6">
                <div><Field label="Special Note" oldVal={origPd.measurementSpecialNote} editable={false} /></div>
                <div className="mt-2"><Field label="Special Note (Edit)" oldVal={origPd.measurementSpecialNote} newVal={item.measurementSpecialNote} editable type="textarea" placeholder="Any special measurement instructions for this product..." onChange={v => updateItem(idx, 'measurementSpecialNote', v)} /></div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add Product Button */}
      <button type="button" onClick={addNewItem}
        className="w-full py-4 border-2 border-dashed border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-black uppercase tracking-widest hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all flex items-center justify-center gap-2">
        <Plus size={16} /> Add More Product
      </button>

      {/* Engraving */}
      <div className="glass rounded-[2rem] border theme-border overflow-hidden">
        <div className="bg-purple-500/5 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
          <Scissors size={14} className="text-purple-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">Engraving</span>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div><Field label="Engraving Required" oldVal={order.engravingRequired !== false ? 'Yes' : 'No'} editable={false} /></div>
            <div><Field label="Engraving Required (Edit)" oldVal={order.engravingRequired} newVal={edited.engravingRequired} editable type="checkbox" onChange={v => setEdited(p => ({ ...p, engravingRequired: v }))} /></div>
            <div><Field label="Engraving Instructions" oldVal={order.engravingInstructions} editable={false} /></div>
            <div><Field label="Engraving Instructions (Edit)" oldVal={order.engravingInstructions} newVal={edited.engravingInstructions} editable type="textarea" onChange={v => setEdited(p => ({ ...p, engravingInstructions: v }))} /></div>
            <div><Field label="Special Notes" oldVal={order.instructionNotes} editable={false} /></div>
            <div><Field label="Special Notes (Edit)" oldVal={order.instructionNotes} newVal={edited.instructionNotes} editable type="textarea" onChange={v => setEdited(p => ({ ...p, instructionNotes: v }))} /></div>
          </div>
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="glass rounded-[2rem] border theme-border overflow-hidden">
        <div className="bg-amber-500/5 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
          <Star size={14} className="text-amber-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Pricing Summary</span>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 pr-4 text-gray-500 font-black uppercase tracking-wider">Component</th>
                  <th className="text-right py-2 px-4 text-gray-500 font-black uppercase tracking-wider">Original</th>
                  <th className="text-right py-2 px-4 text-gray-500 font-black uppercase tracking-wider">Edited</th>
                  <th className="text-right py-2 pl-4 text-gray-500 font-black uppercase tracking-wider">Diff</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Product Price', old: oldPricing.productPrice, new: newPricing.productPrice },
                  { label: 'Customization Charges', old: oldPricing.customization, new: newPricing.customization },
                  { label: 'Logo Charges', old: oldPricing.logoCharges, new: newPricing.logoCharges },
                  { label: 'Name Printing Charges', old: oldPricing.namePrint, new: newPricing.namePrint },
                  { label: 'Delivery Charges', old: oldPricing.delivery, new: newPricing.delivery },
                ].map(row => {
                  const diff = (row.new || 0) - (row.old || 0);
                  return (
                    <tr key={row.label} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 text-gray-400">{row.label}</td>
                      <td className={`py-2 px-4 text-right font-bold ${row.old !== row.new ? 'text-red-400' : 'theme-text-primary'}`}>₨{(row.old || 0).toLocaleString()}</td>
                      <td className={`py-2 px-4 text-right font-bold ${row.old !== row.new ? 'text-amber-400' : 'theme-text-primary'}`}>₨{(row.new || 0).toLocaleString()}</td>
                      <td className={`py-2 pl-4 text-right font-bold ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-gray-600'}`}>{diff >= 0 ? '+' : ''}₨{diff.toLocaleString()}</td>
                    </tr>
                  );
                })}
                <tr className="border-b border-gray-600">
                  <td className="py-3 pr-4 text-white font-black text-sm">Total Order Amount</td>
                  <td className="py-3 px-4 text-right font-black text-lg text-red-400">₨{oldPricing.total.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-black text-lg text-amber-400">₨{newPricing.total.toLocaleString()}</td>
                  <td className={`py-3 pl-4 text-right font-black text-lg ${newPricing.total > oldPricing.total ? 'text-red-400' : newPricing.total < oldPricing.total ? 'text-emerald-400' : 'text-gray-600'}`}>{newPricing.total >= oldPricing.total ? '+' : ''}₨{(newPricing.total - oldPricing.total).toLocaleString()}</td>
                </tr>
                {[
                  { label: 'Advance Payment Received', old: oldPricing.advance, new: newPricing.advance },
                ].map(row => {
                  const diff = (row.new || 0) - (row.old || 0);
                  return (
                    <tr key={row.label} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4 text-gray-400">{row.label}</td>
                      <td className="py-2 px-4 text-right font-bold text-emerald-400">₨{(row.old || 0).toLocaleString()}</td>
                      <td className={`py-2 px-4 text-right font-bold ${row.old !== row.new ? 'text-amber-400' : 'text-emerald-400'}`}>₨{(row.new || 0).toLocaleString()}</td>
                      <td className={`py-2 pl-4 text-right font-bold text-gray-600`}>—</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-3 pr-4 text-amber-400 font-black text-sm">Remaining Balance</td>
                  <td className="py-3 px-4 text-right font-black text-lg text-orange-400">₨{oldPricing.remaining.toLocaleString()}</td>
                  <td className={`py-3 px-4 text-right font-black text-lg ${newPricing.remaining !== oldPricing.remaining ? 'text-amber-400' : 'text-orange-400'}`}>₨{newPricing.remaining.toLocaleString()}</td>
                  <td className={`py-3 pl-4 text-right font-black text-lg ${newPricing.remaining > oldPricing.remaining ? 'text-red-400' : newPricing.remaining < oldPricing.remaining ? 'text-emerald-400' : 'text-gray-600'}`}>{newPricing.remaining >= oldPricing.remaining ? '+' : ''}₨{(newPricing.remaining - oldPricing.remaining).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reason for Edit */}
      <div className="glass rounded-[2rem] border theme-border overflow-hidden">
        <div className="bg-amber-500/5 px-6 py-4 border-b border-gray-800 flex items-center gap-2">
          <MessageSquare size={14} className="text-amber-400" />
          <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">Reason for Edit Request *</span>
        </div>
        <div className="p-6">
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder={useUrdu ? 'تبدیلی کی وجہ بتائیں...' : 'Explain why these changes are needed...'}
            className="w-full text-xs font-bold py-3 px-4 rounded-xl border border-gray-700 bg-gray-800/40 theme-text-primary focus:outline-none focus:border-amber-500 resize-none transition-all placeholder-gray-600" />
          {!reason.trim() && <p className="text-[10px] font-bold text-red-400 mt-2 ml-1">Reason is required to submit the edit request.</p>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button type="button" onClick={onCancel} disabled={isSubmitting}
          className="flex-1 py-5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest transition-all active:scale-95 border border-gray-700 disabled:opacity-50">
          {useUrdu ? 'منسوخ کریں' : 'CANCEL'}
        </button>
        <button type="button" onClick={() => onSubmit(buildPayload())} disabled={isSubmitting || diffCount === 0 || !reason.trim()}
          className="flex-1 py-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:translate-y-[-2px] transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50">
          {isSubmitting ? <span className="animate-spin">⏳</span> : null}
          <span>{isSubmitting ? 'Submitting...' : diffCount === 0 ? 'No Changes Made' : !reason.trim() ? 'Enter Reason' : 'SUBMIT EDIT REQUEST'}</span>
        </button>
      </div>
    </div>
  );
};

export default EditOrderComparison;
