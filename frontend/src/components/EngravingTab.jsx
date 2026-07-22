import React from 'react';
import { motion } from 'framer-motion';
import { ImageIcon, Type, Trash2 } from 'lucide-react';
import { useOrderEntry } from '../context/OrderEntryContext';

const EngravingTab = () => {
  const {
    formData, setFormData, t, useUrdu, logoEntries, setLogoEntries,
    articleNameEntries, setArticleNameEntries, isCustomizableProduct, selectedProductCategory,
    preventEnterSubmit
  } = useOrderEntry();

  if (formData.type !== 'FULL_CUSTOM' && formData.type !== 'READY_LOGO') return null;
  if (!isCustomizableProduct(selectedProductCategory)) return null;

  return (
    <motion.div
      key="custom"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-10"
    >
      <div className={`glass p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border theme-border space-y-6 md:space-y-10 shadow-2xl ${useUrdu ? 'text-right' : ''}`}>
        <div className={`flex items-center ${useUrdu ? 'flex-row-reverse space-x-reverse' : 'space-x-5'}`}>
          <div className="p-4 bg-purple-600 rounded-[1.5rem] shadow-xl shadow-purple-900/30">
            <ImageIcon className="text-white" size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-black theme-text-primary">{t('branding')}</h3>
            <p className="theme-text-muted text-xs md:text-sm font-black uppercase tracking-widest mt-1">Engraving details</p>
          </div>
        </div>

        <div className="space-y-4 md:space-y-8">
          <div className="flex items-center justify-between p-4 theme-bg rounded-2xl border border-gray-700">
            <div>
              <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em]">Engraving</label>
              <p className="text-[10px] text-gray-500 font-bold mt-0.5">{formData.skipEngraving ? 'Engraving skipped for this item' : 'Add engraving details below'}</p>
            </div>
            <button type="button" onClick={() => setFormData({ ...formData, skipEngraving: !formData.skipEngraving })}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${formData.skipEngraving ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'}`}>
              {formData.skipEngraving ? 'Skipped' : 'Active'}
            </button>
          </div>

          {!formData.skipEngraving && (<>
            <div className="space-y-3">
              <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">Engraving Method</label>
              <div className="flex p-2 theme-bg rounded-[1.5rem] border-2 theme-border h-[72px]">
                {[{ value: 'direct', label: 'Direct Engraving' }, { value: 'patch', label: 'Patch Engraving' }].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setFormData({ ...formData, skipEngraving: false, engravingType: opt.value })}
                    className={`flex-1 rounded-xl text-xs md:text-sm font-black transition-all ${formData.engravingType === opt.value ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-600 hover:text-white'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{t('articleName')}</label>
                <button type="button" onClick={() => setArticleNameEntries([...articleNameEntries, ''])}
                  className="text-xs font-black text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full hover:bg-purple-500/20 transition-all">+ Add</button>
              </div>
              {(articleNameEntries || []).map((entry, ei) => (
                <div key={ei} className="relative group">
                  <div className="flex gap-2 items-center">
                    <Type className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-purple-500 transition-colors`} size={16} />
                    <input type="text" onKeyDown={preventEnterSubmit} value={entry}
                      onChange={(e) => { const next = [...articleNameEntries]; next[ei] = e.target.value; setArticleNameEntries(next); }}
                      className={`w-full theme-input rounded-[1.5rem] py-6 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all font-black text-xl`}
                      placeholder={useUrdu ? 'آرٹیکل کا نام درج کریں' : "DR. VALERIE KING"} />
                    {articleNameEntries.length > 1 && (
                      <button type="button" onClick={() => setArticleNameEntries(articleNameEntries.filter((_, i) => i !== ei))}
                        className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shrink-0">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{t('embroideryColor')}</label>
                <select value={formData.nameColor === 'Custom' ? 'Custom' : (formData.nameColor && !['','Gold','Silver','Navy','Wine'].includes(formData.nameColor) ? 'Custom' : formData.nameColor)}
                  onChange={(e) => setFormData({ ...formData, nameColor: e.target.value === 'Custom' ? 'Custom' : e.target.value, customColor: e.target.value === 'Custom' ? (formData.customColor || '') : formData.customColor })}
                  className={`w-full theme-input rounded-2xl py-5 px-8 font-bold appearance-none ${useUrdu ? 'text-right' : ''}`}>
                  <option value="">Standard White</option>
                  <option value="Gold">Metallic Gold</option>
                  <option value="Silver">Polished Silver</option>
                  <option value="Navy">Royal Navy</option>
                  <option value="Wine">Premium Wine</option>
                  <option value="Custom">Custom Color</option>
                </select>
                {formData.nameColor === 'Custom' && (
                  <input type="text" value={formData.customColor || ''} placeholder="Enter custom color"
                    onChange={(e) => setFormData({ ...formData, customColor: e.target.value })}
                    className={`w-full theme-input rounded-2xl py-4 px-5 text-sm font-bold ${useUrdu ? 'text-right' : ''}`} />
                )}
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{t('placement')}</label>
                <select value={formData.logoPlacement} onChange={(e) => setFormData({ ...formData, logoPlacement: e.target.value })}
                  className={`w-full theme-input rounded-2xl py-5 px-8 font-bold appearance-none ${useUrdu ? 'text-right' : ''}`}>
                  <option value="LeftChest">Left Chest</option>
                  <option value="RightChest">Right Chest</option>
                  <option value="Sleeve">Sleeve Cuff</option>
                  <option value="Back">Upper Back</option>
                  <option value="Cuff">Cuff</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{useUrdu ? 'لوگو ڈیزائن' : 'Logo Design'}</label>
                <button type="button" onClick={() => setLogoEntries([...logoEntries, { name: '', design: '' }])}
                  className="text-xs font-black text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-full hover:bg-purple-500/20 transition-all">+ Add</button>
              </div>
              {(logoEntries || []).map((entry, ei) => (
                <div key={ei} className="relative group">
                  <div className="flex gap-2 items-start mb-2">
                    <input type="text" value={entry.name}
                      onChange={(e) => { const next = [...logoEntries]; next[ei] = { ...next[ei], name: e.target.value }; setLogoEntries(next); }}
                      placeholder={useUrdu ? 'لوگو کا نام/لیبل' : 'Logo name/label'}
                      className={`flex-1 theme-input rounded-2xl py-3 px-4 text-sm font-bold ${useUrdu ? 'text-right' : ''}`} />
                    {logoEntries.length > 1 && (
                      <button type="button" onClick={() => setLogoEntries(logoEntries.filter((_, i) => i !== ei))}
                        className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all shrink-0">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <ImageIcon className={`absolute ${useUrdu ? 'right-5' : 'left-5'} top-[3.25rem] text-gray-600 group-focus-within:text-purple-500 transition-colors`} size={16} />
                  <textarea rows="3" value={entry.design}
                    onChange={(e) => { const next = [...logoEntries]; next[ei] = { ...next[ei], design: e.target.value }; setLogoEntries(next); }}
                    className={`w-full theme-input rounded-[1.5rem] py-5 ${useUrdu ? 'pr-16 pl-8 text-right' : 'pl-16 pr-8'} transition-all font-medium text-sm resize-none`}
                    placeholder={useUrdu ? 'لوگو کی تفصیلات، فائل ریفرنس، یا اپ لوڈ ہدایات...' : "Describe logo, file reference, or upload instructions..."} />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black theme-text-muted uppercase tracking-[0.3em] ml-2">{useUrdu ? 'اینگرونگ ہدایات' : 'Engraving Instructions'}</label>
              <textarea value={formData.engravingInstructions || ''}
                onChange={e => setFormData({ ...formData, engravingInstructions: e.target.value })}
                className="w-full theme-input rounded-2xl py-4 px-5 text-sm font-bold resize-none" rows={2}
                placeholder={useUrdu ? 'فونٹ، پوزیشن، سٹائل وغیرہ...' : 'Font, position, style, etc...'} />
            </div>
          </>)}
        </div>
      </div>

      <div className="lg:col-span-2 glass p-4 md:p-6 rounded-[2rem] border border-amber-500/20 bg-amber-500/5">
        <h4 className="text-xs md:text-sm font-black text-amber-400 uppercase tracking-[0.2em] mb-4">{useUrdu ? 'اختیاری برانڈنگ چارجز' : 'Optional Branding Charges'}</h4>
        <p className="text-xs md:text-sm text-gray-500 font-bold uppercase tracking-wider mb-4">{useUrdu ? 'اگر لاگو ہو تو چارجز درج کریں، ورنہ خالی چھوڑ دیں' : 'Enter charges if applicable, leave blank if none'}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black theme-text-muted uppercase tracking-widest">{useUrdu ? 'لوگو چارج' : 'Logo Charge (₨)'}</label>
            <input type="number" min="0" onKeyDown={preventEnterSubmit} value={formData.logoCharges}
              onChange={(e) => setFormData({ ...formData, logoCharges: e.target.value })}
              className="w-full theme-input rounded-xl py-3 px-4 text-sm font-bold" placeholder="0" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black theme-text-muted uppercase tracking-widest">{useUrdu ? 'نام پرنٹنگ چارج' : 'Name Printing Charge (₨)'}</label>
            <input type="number" min="0" onKeyDown={preventEnterSubmit} value={formData.namePrintingCharges}
              onChange={(e) => setFormData({ ...formData, namePrintingCharges: e.target.value })}
              className="w-full theme-input rounded-xl py-3 px-4 text-sm font-bold" placeholder="0" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black theme-text-muted uppercase tracking-widest">{useUrdu ? 'کسٹمائزیشن چارج' : 'Customization Charge (₨)'}</label>
            <input type="number" min="0" onKeyDown={preventEnterSubmit} value={formData.customizationPrice}
              onChange={(e) => setFormData({ ...formData, customizationPrice: e.target.value })}
              className="w-full theme-input rounded-xl py-3 px-4 text-sm font-bold" placeholder="0" />
          </div>
        </div>
        <div className="border-t border-amber-500/10 pt-3 mt-4 flex justify-between items-center">
          <span className="text-xs md:text-sm font-bold text-gray-400">{useUrdu ? 'برانڈنگ چارجز کل' : 'Total Branding Charges'}</span>
          <span className="font-black text-white">₨{(
            (parseFloat(formData.logoCharges) || 0) +
            (parseFloat(formData.namePrintingCharges) || 0) +
            (parseFloat(formData.customizationPrice) || 0)
          ).toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default EngravingTab;
