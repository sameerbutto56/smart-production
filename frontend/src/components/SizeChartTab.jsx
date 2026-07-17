import React from 'react';
import { motion } from 'framer-motion';
import { Ruler, CheckCircle2, Layers } from 'lucide-react';
import { useOrderEntry } from '../context/OrderEntryContext';
import silhouetteMale from '../assets/silhouette.png';
import silhouetteFemale from '../assets/silhouette-female.png';

const SizeChartTab = () => {
  const {
    formData, setFormData, t, useUrdu,
    getSizeChart, handleSizeSelect, isAccessory, selectedProductCategory,
    availableSizes, defaultSizes, preventEnterSubmit
  } = useOrderEntry();

  return (
    <motion.div
      key="sizes"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="glass p-6 md:p-16 rounded-2xl md:rounded-[4rem] border theme-border shadow-2xl relative overflow-hidden"
    >
      <div className="absolute -top-20 -right-20 opacity-5 select-none pointer-events-none">
        <Ruler size={500} />
      </div>
      <div className="relative z-10 space-y-8 md:space-y-16">
        <div className="space-y-2 text-center mb-8 md:mb-16">
          <h3 className="text-2xl md:text-4xl font-black text-emerald-400 flex justify-center items-center space-x-6 uppercase tracking-tighter">
            <Ruler size={42} />
            <span>{formData.type === 'FULL_CUSTOM' ? 'Anatomical Precision Chart' : 'Standard Size Selection'}</span>
          </h3>
          <p className="theme-text-muted font-bold uppercase tracking-[0.4em]">All measurements in standard inches</p>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Gender</label>
              <p className="text-lg font-black text-emerald-400">{formData.gender}</p>
            </div>
            {formData.size && (
              <div className="text-center">
                <label className="text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Size</label>
                <p className="text-lg font-black text-emerald-400">{formData.size}</p>
              </div>
            )}
          </div>
          <div className={`flex p-1.5 theme-bg rounded-xl border-2 theme-border ${useUrdu ? 'flex-row-reverse' : ''}`}>
            {((availableSizes || []).length > 0 ? (availableSizes || []) : (defaultSizes || [])).map(s => (
              <button key={s} type="button" onClick={() => handleSizeSelect(s)}
                className={`w-14 h-14 rounded-lg font-black text-xs transition-all ${formData.size === s ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {false && (
          <>
            <div className="relative flex flex-col md:flex-row items-center justify-center max-w-6xl mx-auto gap-4 lg:gap-12">
              <div className="flex flex-row flex-wrap justify-center md:flex-col space-y-0 md:space-y-16 gap-4 md:gap-0 w-full md:w-1/3 z-20 items-center md:items-end">
                <div className="group relative flex flex-col items-center md:items-end w-full max-w-[220px] md:max-w-none">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Shoulder</label>
                  <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                    <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.shoulder || ''}
                      onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, shoulder: e.target.value } })}
                      className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right"
                      placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].shoulder : '00'} />
                    <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                  </div>
                </div>
                <div className="group relative flex flex-col items-center md:items-end">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Chest / Bust</label>
                  <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                    <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.chest || ''}
                      onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, chest: e.target.value } })}
                      className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right"
                      placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].chest : '00'} />
                    <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                  </div>
                </div>
                {formData.gender === 'Female' ? (
                  <div className="group relative flex flex-col items-center md:items-end">
                    <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Waist</label>
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.waist || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, waist: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].waist : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                ) : (
                  <div className="group relative flex flex-col items-center md:items-end">
                    <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Bottom Width</label>
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.bottom || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, bottom: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-right"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].bottom : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden md:flex relative w-1/3 justify-center items-center min-h-[500px]">
                <img src={formData.gender === 'Female' ? silhouetteFemale : silhouetteMale} alt="Tailor Silhouette"
                  className="h-[550px] object-contain opacity-60 filter drop-shadow-[0_0_30px_rgba(16,185,129,0.2)]" loading="lazy" />
                <div className="absolute top-[20%] left-[10%] w-[40%] border-t border-dashed border-emerald-500/40"></div>
                <div className="absolute top-[35%] left-[5%] w-[45%] border-t border-dashed border-emerald-500/40"></div>
                <div className="absolute top-[50%] left-[-5%] w-[55%] border-t border-dashed border-emerald-500/40"></div>
                <div className="absolute top-[45%] right-[5%] w-[45%] border-t border-dashed border-emerald-500/40"></div>
                <div className="absolute top-[60%] right-[10%] w-[40%] border-t border-dashed border-emerald-500/40"></div>
                <div className="absolute top-[80%] right-[15%] w-[35%] border-t border-dashed border-emerald-500/40"></div>
              </div>

              <div className="flex flex-col space-y-8 md:space-y-16 w-full md:w-1/3 z-20 items-center md:items-start">
                {formData.gender === 'Female' ? (
                  <div className="group relative flex flex-col items-center md:items-start">
                    <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Bottom</label>
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.bottom || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, bottom: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].bottom : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                ) : null}
                <div className="group relative flex flex-col items-center md:items-start">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Shirt Length</label>
                  <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                    <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.shirtLength || ''}
                      onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, shirtLength: e.target.value } })}
                      className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left"
                      placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].shirtLength : '00'} />
                    <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                  </div>
                </div>
                {formData.gender === 'Female' ? (
                  <div className="group relative flex flex-col items-center md:items-start">
                    <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Hip</label>
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hip || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, hip: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].hip : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                ) : (
                  <div className="group relative flex flex-col items-center md:items-start">
                    <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Sleeves Length</label>
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.sleeve || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, sleeve: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].sleeve : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                )}
                <div className="group relative flex flex-col items-center md:items-start">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-2 group-hover:text-emerald-400 transition-all duration-500">Trouser Length</label>
                  <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                    <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.trouserLength || ''}
                      onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, trouserLength: e.target.value } })}
                      className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center md:text-left"
                      placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].trouserLength : '00'} />
                    <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                  </div>
                </div>
              </div>
            </div>

            {formData.gender === 'Female' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 max-w-3xl mx-auto mt-4">
                <div className="flex flex-col items-center space-y-4">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Sleeves Length</label>
                  <div className="group relative flex flex-col items-center">
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.sleeve || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, sleeve: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].sleeve : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center space-y-4">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Trouser Length</label>
                  <div className="group relative flex flex-col items-center">
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.trouserLength || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, trouserLength: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].trouserLength : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center space-y-4">
                  <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Trouser Bottom</label>
                  <div className="group relative flex flex-col items-center">
                    <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                      <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hips || ''}
                        onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, hips: e.target.value } })}
                        className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center"
                        placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].hips : '00'} />
                      <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4 pt-4">
                <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em]">Trouser Bottom</label>
                <div className="group relative flex flex-col items-center">
                  <div className="relative flex items-end w-full max-w-[200px] theme-bg p-4 rounded-2xl border theme-border shadow-xl backdrop-blur-sm group-hover:border-emerald-500/50 transition-colors">
                    <input type="number" step="0.1" onKeyDown={preventEnterSubmit} value={formData.measurements.hips || ''}
                      onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, hips: e.target.value } })}
                      className="w-full bg-transparent border-b-4 border-gray-800 pb-2 text-xl md:text-3xl font-black text-white focus:border-emerald-500 outline-none transition-all duration-700 placeholder-gray-900 text-center"
                      placeholder={formData.size && getSizeChart()[formData.size] ? getSizeChart()[formData.size].hips : '00'} />
                    <span className="absolute right-4 bottom-5 text-xs md:text-sm font-black text-emerald-500/50">IN</span>
                  </div>
                </div>
              </div>
            )}

            {formData.gender === 'Female' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6 mt-6 md:mt-12 theme-bg-subtle p-4 md:p-8 rounded-2xl md:rounded-[3rem] border theme-border">
                <div className="space-y-4">
                  <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Include Dupatta</label>
                  <label className="flex items-center justify-between p-4 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl transition-all ${formData.femaleOptions.dupatta ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                        <Layers size={18} />
                      </div>
                      <div><p className="font-black text-sm uppercase">Dupatta</p></div>
                    </div>
                    <input type="checkbox" checked={formData.femaleOptions.dupatta}
                      onChange={(e) => setFormData({ ...formData, femaleOptions: { ...formData.femaleOptions, dupatta: e.target.checked } })}
                      className="w-5 h-5 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                  </label>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Include Zip</label>
                  <label className="flex items-center justify-between p-4 theme-bg rounded-[1.5rem] border-2 theme-border cursor-pointer hover:border-pink-500/30 transition-all group h-full">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-xl transition-all flex items-center justify-center ${formData.femaleOptions.zip ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-600'}`}>
                        <span className="font-black text-sm">ZIP</span>
                      </div>
                      <div><p className="font-black text-sm uppercase">Zip</p></div>
                    </div>
                    <input type="checkbox" checked={formData.femaleOptions.zip}
                      onChange={(e) => setFormData({ ...formData, femaleOptions: { ...formData.femaleOptions, zip: e.target.checked } })}
                      className="w-5 h-5 rounded border-2 border-gray-700 bg-gray-900 checked:bg-pink-600 transition-all cursor-pointer" />
                  </label>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Sleeves Length</label>
                  <select value={formData.femaleOptions.sleeves}
                    onChange={(e) => setFormData({ ...formData, femaleOptions: { ...formData.femaleOptions, sleeves: e.target.value } })}
                    className="w-full theme-input rounded-[1.5rem] py-5 px-6 font-bold appearance-none h-full">
                    <option value="half">Half Sleeves</option>
                    <option value="medium">Medium Sleeves</option>
                    <option value="full">Full Sleeves</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black theme-text-muted uppercase tracking-widest ml-2">Shirt Length</label>
                  <select value={formData.femaleOptions.shirtLength}
                    onChange={(e) => setFormData({ ...formData, femaleOptions: { ...formData.femaleOptions, shirtLength: e.target.value } })}
                    className="w-full theme-input rounded-[1.5rem] py-5 px-6 font-bold appearance-none h-full">
                    <option value="short">Short Shirt</option>
                    <option value="long">Long Shirt</option>
                  </select>
                </div>
              </div>
            )}

            <div className="mt-8 md:mt-16 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-2xl md:rounded-[3rem] p-6 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 shadow-inner">
              <div className="p-6 bg-emerald-600 rounded-[2rem] shadow-2xl shadow-emerald-900/50 rotate-6">
                <CheckCircle2 size={28} className="text-white" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-black text-emerald-400 tracking-tight uppercase">Tailor-Ready Verification</p>
                <p className="text-sm theme-text-muted font-bold leading-relaxed max-w-3xl">Values are mapped to the "CUTTING" stage automated patterns. Double-check for 0.5" variance before deployment.</p>
              </div>
            </div>
          </>
        )}

        <div className="col-span-full mt-6 p-4 md:p-6 theme-bg rounded-2xl border border-emerald-500/20">
          <label className="block text-xs md:text-sm font-black theme-text-muted uppercase tracking-[0.35em] mb-3">Measurement Special Notes</label>
          <textarea value={formData.measurements.specialNote || ''}
            onChange={(e) => setFormData({ ...formData, measurements: { ...formData.measurements, specialNote: e.target.value } })}
            className="w-full theme-input rounded-2xl p-4 text-sm font-bold border-2 border-gray-700 focus:border-emerald-500/50 transition-all resize-none" rows={3}
            placeholder="Any special instructions or remarks for the tailor..." />
        </div>
      </div>
    </motion.div>
  );
};

export default SizeChartTab;
