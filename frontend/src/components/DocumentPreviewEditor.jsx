import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Printer,
  Save,
  RotateCcw,
  X,
  Eye,
  FileText,
  Lock,
  History,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
  fetchLogoUrl,
  printIframe,
  DOCUMENT_CONFIG,
  resolveDocumentType,
  getDocumentPrintDetails,
} from '../utils/vendorDocumentPrint';

/**
 * Universal Pre-Print Preview & Editable Document System
 *
 * Enforces the workflow:
 * PRINT BUTTON -> PREVIEW & EDIT -> FINAL REVIEW -> PRINT
 *
 * Supported Documents:
 * - Delivery Sheet (Store / ASM)
 * - Quotation (Full A4 & 3in Data-Only)
 * - Invoice (Full A4 & 3in Data-Only)
 * - Job Sheet (Logo / Production)
 * - Future documents via DOCUMENT_CONFIG
 */
export default function DocumentPreviewEditor({
  isOpen,
  onClose,
  order,
  kind = 'delivery-sheet',
  targetDepartment = 'PRODUCTION',
  processingItems = [],
  onSaveSuccess,
}) {
  if (!isOpen || !order) return null;

  // Resolve standard document type key (DELIVERY_SHEET, QUOTATION, INVOICE, JOB_SHEET)
  const baseDocType = resolveDocumentType(kind);
  const config = DOCUMENT_CONFIG[baseDocType] || DOCUMENT_CONFIG.DELIVERY_SHEET;

  // Mode toggle for Quotation/Invoice: 'full' vs 'data-only'
  const isDataKind = String(kind).includes('data');
  const [useDataOnlyMode, setUseDataOnlyMode] = useState(isDataKind);

  // Logo state
  const [logoUrl, setLogoUrl] = useState('');
  useEffect(() => {
    let active = true;
    fetchLogoUrl().then((url) => {
      if (active) setLogoUrl(url);
    });
    return () => {
      active = false;
    };
  }, []);

  // Multi-page navigation state ('all' | page index)
  const [selectedPageIndex, setSelectedPageIndex] = useState('all');

  // Letterhead guide overlay toggle (visualizes 3-inch top and bottom margins)
  const [showLetterheadGuides, setShowLetterheadGuides] = useState(false);

  // Zoom scale for preview canvas
  const [previewScale, setPreviewScale] = useState(1);

  // Revision History Modal
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  // Saved / custom form fields state
  const savedData = order.savedDocumentCustomData?.[baseDocType] || {};
  const [customFields, setCustomFields] = useState(() => {
    return {
      notes: savedData.notes || order.notes || '',
      handoverNotes: savedData.handoverNotes || order.notes || '',
      quotationNotes: savedData.quotationNotes || order.notes || '',
      invoiceNotes: savedData.invoiceNotes || order.notes || '',
      productionNotes: savedData.productionNotes || '',
      logoInstructions: savedData.logoInstructions || '',
      specialInstructions: savedData.specialInstructions || '',
      tailoringRemarks: savedData.tailoringRemarks || '',
      termsAndConditions: savedData.termsAndConditions || (baseDocType === 'QUOTATION' ? '1. 50% advance required before production commencement.\n2. Goods delivery subject to final quality verification.\n3. Quotation valid for 15 days from issue date.' : ''),
      remarks: savedData.remarks || '',
      customerRemarks: savedData.customerRemarks || '',
      deliveryInstructions: savedData.deliveryInstructions || '',
      preparedBy: savedData.preparedBy || order.storeName || order.createdByName || '',
      issuedBy: savedData.issuedBy || order.approvedByName || '',
      receivedBy: savedData.receivedBy || order.asm?.name || '',
      acceptedBy: savedData.acceptedBy || order.asm?.name || '',
      completedBy: savedData.completedBy || '',
    };
  });

  const [changesSummary, setChangesSummary] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset custom fields back to order original values
  const handleReset = () => {
    setCustomFields({
      notes: order.notes || '',
      handoverNotes: order.notes || '',
      quotationNotes: order.notes || '',
      invoiceNotes: order.notes || '',
      productionNotes: '',
      logoInstructions: '',
      specialInstructions: '',
      tailoringRemarks: '',
      termsAndConditions: baseDocType === 'QUOTATION' ? '1. 50% advance required before production commencement.\n2. Goods delivery subject to final quality verification.\n3. Quotation valid for 15 days from issue date.' : '',
      remarks: '',
      customerRemarks: '',
      deliveryInstructions: '',
      preparedBy: order.storeName || order.createdByName || '',
      issuedBy: order.approvedByName || '',
      receivedBy: order.asm?.name || '',
      acceptedBy: order.asm?.name || '',
      completedBy: '',
    });
    setChangesSummary('');
    toast.success('Document fields reset to original defaults');
  };

  // Compile print details & pages using our shared helper
  const effectiveKind = useDataOnlyMode
    ? (baseDocType === 'QUOTATION' ? 'quotation-data' : 'invoice-data')
    : kind;

  const docDetails = useMemo(() => {
    return getDocumentPrintDetails({
      order,
      kind: effectiveKind,
      customFields,
      targetDepartment,
      processingItems,
      logoUrl,
      useDataOnlyMode,
    });
  }, [order, effectiveKind, customFields, targetDepartment, processingItems, logoUrl, useDataOnlyMode]);

  // Determine HTML to display in preview (single page vs all pages)
  const previewHtml = useMemo(() => {
    let pagesToRender = docDetails.pages;
    if (selectedPageIndex !== 'all' && docDetails.pages[selectedPageIndex]) {
      pagesToRender = [docDetails.pages[selectedPageIndex]];
    }

    const pagesJoined = pagesToRender.map((p, idx) => `
      <div class="a4-preview-page ${idx > 0 ? 'page-break' : ''}">
        ${p.html}
      </div>
    `).join('');

    const letterheadGuideStyles = showLetterheadGuides ? `
      .a4-preview-page {
        position: relative;
      }
      .a4-preview-page::before {
        content: "3.0 INCH LETTERHEAD HEADER MARGIN";
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3in;
        background: rgba(239, 68, 68, 0.08);
        border-bottom: 2px dashed #ef4444;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #dc2626;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 1px;
        pointer-events: none;
        z-index: 1000;
      }
      .a4-preview-page::after {
        content: "3.0 INCH LETTERHEAD FOOTER MARGIN";
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 3in;
        background: rgba(239, 68, 68, 0.08);
        border-top: 2px dashed #ef4444;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #dc2626;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 1px;
        pointer-events: none;
        z-index: 1000;
      }
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${docDetails.title}</title>
          <style>
            ${docDetails.css}
            body {
              background: #f1f5f9;
              padding: 24px;
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 24px;
            }
            .a4-preview-page {
              background: #ffffff;
              width: 210mm;
              min-height: 297mm;
              padding: 12mm 15mm;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
              box-sizing: border-box;
            }
            ${letterheadGuideStyles}
          </style>
        </head>
        <body>
          ${pagesJoined}
        </body>
      </html>
    `;
  }, [docDetails, selectedPageIndex, showLetterheadGuides]);

  // Fetch revisions history
  const loadRevisions = async () => {
    setRevisionsLoading(true);
    setShowRevisionsModal(true);
    try {
      const res = await api.get(`/api/vendors/orders/${order.id}/document-revisions?documentType=${baseDocType}`);
      setRevisions(res.data.revisions || []);
    } catch (err) {
      toast.error('Failed to load revision history');
    } finally {
      setRevisionsLoading(false);
    }
  };

  // 1. Direct Print (Print-Only Changes, does not alter database)
  const handlePrintOnly = () => {
    toast('Opening print dialog...', { icon: '🖨️' });
    printIframe(docDetails.fullHtml, docDetails.title, [], docDetails.css);
  };

  // 2. Save & Print (Saves document revision history, updates order, then prints)
  const handleSaveAndPrint = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/api/vendors/orders/${order.id}/document-revision`, {
        documentType: baseDocType,
        documentNumber: order.orderNumber,
        customFields,
        changesMade: changesSummary || `Customized ${config.label} for print`,
      });

      const updatedVersion = res.data.revision?.updatedVersion || 'v1';
      toast.success(`${config.label} saved as revision v${updatedVersion}! Opening print...`);

      if (onSaveSuccess) {
        onSaveSuccess(res.data.revision);
      }

      // Open print dialog with the exact reviewed version
      printIframe(docDetails.fullHtml, docDetails.title, [], docDetails.css);
    } catch (err) {
      console.error('Save & print error:', err);
      toast.error(err.response?.data?.message || 'Failed to save document revision');
    } finally {
      setSaving(false);
    }
  };

  // Field change handler
  const handleFieldChange = (key, val) => {
    setCustomFields((prev) => ({ ...prev, [key]: val }));
  };

  // Protected data summary metrics
  const totalUnits = (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
  const allocatedUnits = (order.items || []).reduce(
    (s, it) => s + ((it.allocatedQuantity !== undefined && it.allocatedQuantity !== null) ? it.allocatedQuantity : 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* ── TOP HEADER / CONTROLS ────────────────────────────────────────────── */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Document Pre-Print Preview &amp; Customization
              </h2>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-teal-900/60 border border-teal-500/40 text-teal-300">
                {config.label}
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Order: <strong className="text-slate-200">{order.orderNumber}</strong></span>
              <span>•</span>
              <span>Vendor: <strong className="text-slate-200">{order.vendor?.name}</strong></span>
              {order.asm?.name && (
                <>
                  <span>•</span>
                  <span>ASM: <strong className="text-slate-200">{order.asm.name}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center gap-2">
          {/* SubDocMode Toggle (for Quotation / Invoice) */}
          {config.supportsDataModeToggle && (
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setUseDataOnlyMode(false)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                  !useDataOnlyMode
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Full A4
              </button>
              <button
                onClick={() => setUseDataOnlyMode(true)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                  useDataOnlyMode
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Body only with 3-inch top and bottom letterhead margins"
              >
                Data-Only (Letterhead)
              </button>
            </div>
          )}

          {/* Letterhead Guides Toggle */}
          <button
            onClick={() => setShowLetterheadGuides(!showLetterheadGuides)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition ${
              showLetterheadGuides
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="Toggle 3-inch letterhead physical margin indicators"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>3″ Margin Guides</span>
          </button>

          {/* Revisions History Button */}
          <button
            onClick={loadRevisions}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
            title="View saved revision audit history"
          >
            <History className="w-3.5 h-3.5" />
            <span>Revisions</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition ml-2"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT (Split View: Preview Left | Editor Right) ───────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Live Document Preview Canvas */}
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          {/* Sub-toolbar for preview zoom & page selector */}
          <div className="h-10 bg-slate-900/80 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-400 shrink-0">
            {/* Multi-page Navigation */}
            {docDetails.pages.length > 1 ? (
              <div className="flex items-center gap-1">
                <span className="font-semibold text-slate-300 mr-2">Page View:</span>
                <button
                  onClick={() => setSelectedPageIndex('all')}
                  className={`px-2 py-0.5 rounded text-xs transition ${
                    selectedPageIndex === 'all'
                      ? 'bg-teal-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  All ({docDetails.pages.length} Pages)
                </button>
                {docDetails.pages.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedPageIndex(idx)}
                    className={`px-2 py-0.5 rounded text-xs transition ${
                      selectedPageIndex === idx
                        ? 'bg-teal-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-400">
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span>Single Page Document (A4 Portrait)</span>
              </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewScale((s) => Math.max(0.6, s - 0.1))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-slate-300 w-12 text-center">
                {Math.round(previewScale * 100)}%
              </span>
              <button
                onClick={() => setPreviewScale((s) => Math.min(1.4, s + 0.1))}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPreviewScale(1)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white ml-1"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Iframe Viewport */}
          <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-950">
            <div
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <iframe
                title="Pre-Print Live Preview"
                srcDoc={previewHtml}
                className="w-full h-full max-w-[230mm] min-h-[900px] border-0 rounded-lg shadow-2xl bg-white"
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Document Customization & Protected Data Panel */}
        <aside className="w-[440px] bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              <h3 className="font-bold text-sm text-white">Document Customization</h3>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1 transition"
              title="Reset fields to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
            {/* 1. Protected Business Data Notice */}
            <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-teal-400 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>Protected Business Data (Locked)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Order quantities, warehouse variants, pricing, and payments cannot be modified via document preview. They are populated directly from system records.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60 text-[11px]">
                <div>
                  <span className="text-slate-400">Order units:</span>{' '}
                  <strong className="text-white">{totalUnits} pcs</strong>
                </div>
                <div>
                  <span className="text-slate-400">Allocated:</span>{' '}
                  <strong className="text-teal-400">{allocatedUnits} pcs</strong>
                </div>
                <div>
                  <span className="text-slate-400">Total Value:</span>{' '}
                  <strong className="text-white">₨{parseFloat(order.grandTotal || 0).toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Items Count:</span>{' '}
                  <strong className="text-white">{(order.items || []).length} lines</strong>
                </div>
              </div>
            </div>

            {/* 2. Configured Editable Fields */}
            <div className="space-y-3.5">
              <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Permitted Document Fields</span>
              </div>

              {config.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label className="block text-slate-300 font-medium text-[11.5px]">
                    {f.label}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={customFields[f.key] || ''}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 placeholder-slate-500 resize-none transition"
                    />
                  ) : (
                    <input
                      type="text"
                      value={customFields[f.key] || ''}
                      onChange={(e) => handleFieldChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 placeholder-slate-500 transition"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 3. Revision Summary Note (Optional) */}
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <label className="block text-slate-400 text-[11px] font-medium">
                Revision / Changes Summary (for Save &amp; Print audit):
              </label>
              <input
                type="text"
                value={changesSummary}
                onChange={(e) => setChangesSummary(e.target.value)}
                placeholder="e.g. Added special production instructions"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300 text-xs focus:ring-1 focus:ring-teal-500 placeholder-slate-500"
              />
            </div>
          </div>

          {/* ── BOTTOM ACTION BUTTONS ────────────────────────────────────────── */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {/* PRINT ONLY (Temporary print without altering database) */}
              <button
                onClick={handlePrintOnly}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
                title="Print the customized preview without updating permanent records"
              >
                <Printer className="w-4 h-4 text-slate-300" />
                <span>Print Only</span>
              </button>

              {/* SAVE & PRINT (Saves revision history, then prints) */}
              <button
                onClick={handleSaveAndPrint}
                disabled={saving}
                className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-teal-900/30 active:scale-[0.98]"
                title="Save customized document revisions and print"
              >
                {saving ? (
                  <span className="inline-block animate-spin mr-1">⏳</span>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save &amp; Print</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-1.5 text-slate-400 hover:text-white text-xs transition text-center"
            >
              Cancel &amp; Close
            </button>
          </div>
        </aside>
      </div>

      {/* ── REVISION HISTORY MODAL ─────────────────────────────────────────── */}
      {showRevisionsModal && (
        <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-white text-sm">
                  Document Revision Audit History
                </h3>
              </div>
              <button
                onClick={() => setShowRevisionsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {revisionsLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Loading revisions...
              </div>
            ) : revisions.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                No saved revisions for this document yet. Edits made via "Save &amp; Print" will appear here.
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {revisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-200">
                      <span className="font-bold text-teal-400">
                        Version {rev.updatedVersion}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(rev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-300 text-[11.5px]">
                      {rev.changesMade || 'Document customization saved'}
                    </div>
                    <div className="text-[10.5px] text-slate-500">
                      Edited By: <span className="text-slate-400">{rev.editedByName || 'Authorized User'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowRevisionsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
