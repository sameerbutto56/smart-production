import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Printer,
  Search,
  CheckCircle2,
  Lock,
  Edit3,
  Building2,
  DollarSign,
  User,
  Phone,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Landmark,
  ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  A4_PRINT_CSS,
  buildOutletDocumentHTML,
  printOutletDocument,
  getLogoSrc
} from '../utils/outletInvoiceQuotationPrint';

export default function OutletInvoiceQuotation() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const outletRaw = String(user?.name || '').toLowerCase();
  const isJoharTown = outletRaw.includes('johar') || user?.name?.includes('1');

  // Document state
  const [docType, setDocType] = useState('INVOICE'); // 'INVOICE' | 'QUOTATION'
  const [orderQuery, setOrderQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState(null);
  const [logoUrl, setLogoUrl] = useState('/logo.png');

  // Permitted editable fields
  const [customFields, setCustomFields] = useState({
    customerRemarks: '',
    specialInstructions: '',
    termsAndConditions: '',
    preparedBy: user?.name || 'Johar Town Outlet'
  });

  // Preview zoom & iframe ref
  const [zoomLevel, setZoomLevel] = useState(85);
  const iframeRef = useRef(null);

  // Load logo
  useEffect(() => {
    getLogoSrc().then((url) => setLogoUrl(url));
  }, []);

  // Parse query params (e.g. from Order Lookup page)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderNum = params.get('orderNumber');
    const typeParam = params.get('type');
    if (typeParam && (typeParam.toUpperCase() === 'INVOICE' || typeParam.toUpperCase() === 'QUOTATION')) {
      setDocType(typeParam.toUpperCase());
    }
    if (orderNum) {
      setOrderQuery(orderNum);
      handleLoadOrder(orderNum);
    }
  }, [location.search]);

  // Load order data
  const handleLoadOrder = async (orderNum) => {
    const q = (orderNum || orderQuery).trim();
    if (!q) {
      toast.error('Please enter an order number');
      return;
    }

    setSearching(true);
    try {
      const res = await api.get(`/api/outlet-orders/order-lookup/${q}`);
      if (res.data?.order) {
        setOrder(res.data.order);
        toast.success(`Loaded order ${res.data.order.orderNumber || ''}`);
      } else {
        toast.error('Order not found');
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      toast.error(err.response?.data?.message || 'Order lookup failed');
    } finally {
      setSearching(false);
    }
  };

  // Update iframe document preview whenever order, docType, customFields, or logoUrl changes
  useEffect(() => {
    if (!iframeRef.current) return;
    const doc = iframeRef.current.contentWindow?.document;
    if (!doc) return;

    // If no order loaded, generate a dummy/placeholder order for preview
    const sampleOrder = order || {
      orderNumber: 'JT-SAMPLE',
      invoiceNumber: 'INV-JT-00001',
      customerName: 'VALUED CUSTOMER',
      customerPhone: '0300-1234567',
      address: '375A-2 Johar Town',
      city: 'Lahore',
      outletName: 'Johar Town Outlet',
      createdAt: new Date().toISOString(),
      totalPrice: 4500,
      advanceAmount: 2000,
      balanceAmount: 2500,
      paymentStatus: 'BALANCE',
      deliveryMethod: 'Store Pickup',
      productDetails: [
        {
          name: 'Medical Scrub Set - Navy Blue',
          quantity: 1,
          unitPrice: 4500,
          totalPrice: 4500,
          color: 'Navy Blue',
          size: 'M',
          fabric: 'Sprinter',
          engravingRequired: true,
          engravingText: 'Dr. Sameer'
        }
      ]
    };

    const htmlContent = buildOutletDocumentHTML({
      order: sampleOrder,
      docType,
      customFields,
      logoUrl
    });

    doc.open();
    doc.write(`<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>${A4_PRINT_CSS}</style>
          <style>
            body { padding: 12px; background: #ffffff; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>`);
    doc.close();
  }, [order, docType, customFields, logoUrl]);

  // Trigger print
  const handlePrint = () => {
    if (!order) {
      toast.error('Please load an order first before printing');
      return;
    }
    printOutletDocument({
      order,
      docType,
      customFields
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/outlet-orders')}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
            title="Back to Orders"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Invoice &amp; Quotation Generator
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Johar Town
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate and print standard A4 customer documents with Enamels branding &amp; Meezan Bank deposit details
            </p>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={!order}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-950/40 border border-emerald-500/30 transition-all active:scale-95"
          >
            <Printer size={16} />
            Print A4 {docType}
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Preview, Right Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: A4 DOCUMENT PREVIEW (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col items-center">
          {/* Preview Toolbar */}
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-xs text-slate-400">
            <span className="font-semibold flex items-center gap-1.5 text-slate-300">
              <FileText size={14} className="text-emerald-400" />
              Live A4 Print Preview
              {!order && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">(Sample Preview)</span>}
            </span>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 10))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="font-mono text-[11px] w-10 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          </div>

          {/* Realistic A4 Paper Simulation Container */}
          <div
            className="w-full overflow-auto flex justify-center p-2 rounded-xl bg-slate-950/70 border border-slate-800/80"
            style={{ maxHeight: 'calc(100vh - 220px)' }}
          >
            <div
              style={{
                width: `${(210 * 3.7795 * zoomLevel) / 100}px`,
                minHeight: `${(297 * 3.7795 * zoomLevel) / 100}px`,
                transformOrigin: 'top center',
                transition: 'all 0.15s ease'
              }}
              className="bg-white shadow-2xl rounded-sm overflow-hidden"
            >
              <iframe
                ref={iframeRef}
                title="A4 Document Preview"
                className="w-full border-none"
                style={{
                  height: `${(297 * 3.7795 * zoomLevel) / 100}px`,
                  minHeight: '750px'
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CONTROLS & EDITABLE FIELDS (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Document Type Selector Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Document Type
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDocType('INVOICE')}
                className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  docType === 'INVOICE'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${docType === 'INVOICE' ? 'border-white bg-white' : 'border-slate-500'}`}>
                  {docType === 'INVOICE' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </div>
                INVOICE
              </button>

              <button
                type="button"
                onClick={() => setDocType('QUOTATION')}
                className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  docType === 'QUOTATION'
                    ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-900/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${docType === 'QUOTATION' ? 'border-white bg-white' : 'border-slate-500'}`}>
                  {docType === 'QUOTATION' && <div className="w-1.5 h-1.5 rounded-full bg-teal-600" />}
                </div>
                QUOTATION
              </button>
            </div>
          </div>

          {/* Order Search & Selector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>2. Select Order / Quote</span>
              {order && (
                <span className="text-emerald-400 font-bold font-mono text-[11px]">
                  ✓ {order.orderNumber}
                </span>
              )}
            </h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadOrder()}
                placeholder="Enter Order # (e.g. JT-132222, 50335)..."
                className="flex-1 px-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleLoadOrder()}
                disabled={searching}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5"
              >
                <Search size={14} className={searching ? 'animate-spin' : ''} />
                Load
              </button>
            </div>

            {order && (
              <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-bold text-white">{order.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono text-slate-200">{order.customerPhone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span className="font-bold text-emerald-400">Rs. {parseFloat(order.totalPrice || 0).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Permitted Custom Fields */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 size={14} className="text-blue-400" />
              3. Custom Remarks &amp; Terms
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Customer Remarks / Notes:
                </label>
                <input
                  type="text"
                  value={customFields.customerRemarks}
                  onChange={(e) => setCustomFields({ ...customFields, customerRemarks: e.target.value })}
                  placeholder="e.g. Urgent handover requested, Special packaging..."
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Special Instructions:
                </label>
                <input
                  type="text"
                  value={customFields.specialInstructions}
                  onChange={(e) => setCustomFields({ ...customFields, specialInstructions: e.target.value })}
                  placeholder="e.g. Fit check required on collection..."
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Terms &amp; Conditions (Optional Override):
                </label>
                <textarea
                  rows={3}
                  value={customFields.termsAndConditions}
                  onChange={(e) => setCustomFields({ ...customFields, termsAndConditions: e.target.value })}
                  placeholder="Leave empty to use official standard terms..."
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Prepared By (Signature Line):
                </label>
                <input
                  type="text"
                  value={customFields.preparedBy}
                  onChange={(e) => setCustomFields({ ...customFields, preparedBy: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Official Bank Account Information Badge */}
          <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-2xl p-4 shadow-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
              <Landmark size={15} />
              Included Meezan Bank Details
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-emerald-900/30 text-[11px] space-y-1 font-mono">
              <p className="text-white font-bold">ENAMELS</p>
              <p className="text-slate-300">Meezan Bank - College Road Lahore</p>
              <p className="text-emerald-400 font-bold">A/C: 02220105077642</p>
              <p className="text-slate-300">IBAN: PK78MEZN0002220105077642</p>
              <p className="text-amber-400 italic text-[10px] mt-1">
                "Please deposit here. Do send a screenshot when you're done."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
