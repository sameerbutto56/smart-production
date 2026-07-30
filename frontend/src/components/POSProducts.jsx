import React from 'react';
import { usePOS } from '../context/POSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';
import { formatCurrency } from '../utils/POSPrint';
import { RefreshCw, Package } from 'lucide-react';

const POSProducts = () => {
  const { isUrdu } = useLanguage();
  const { productsLoading, activeCategory, setActiveCategory, categories, groupedProducts, handleAddToCart } = usePOS();

  return (
    <div className="flex-1 overflow-y-auto p-3">
      {/* Categories */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 flex-shrink-0">
        <button onClick={() => setActiveCategory('')}
          className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${!activeCategory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          All
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${activeCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Products grid */}
      {productsLoading && groupedProducts.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-600">
          <RefreshCw size={24} className="animate-spin mr-2" />
          <span className="font-bold">Loading products...</span>
        </div>
      ) : (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {groupedProducts.map(g => {
          const maxShow = 3;
          const colorsMore = g.colors.length > maxShow ? g.colors.length - maxShow : 0;
          const sizesMore = g.sizes.length > maxShow ? g.sizes.length - maxShow : 0;
          const colorLabel = g.colors.length > 0
            ? (colorsMore > 0 ? g.colors.slice(0, maxShow).join(', ') + ` +${colorsMore}` : g.colors.join(', '))
            : null;
          const sizeLabel = g.sizes.length > 0
            ? (sizesMore > 0 ? g.sizes.slice(0, maxShow).join(', ') + ` +${sizesMore}` : g.sizes.join(', '))
            : null;
          const isOutOfStock = (g.totalStock != null && g.totalStock <= 0) || (g.variants.length === 1 && g.variants[0].stock != null && g.variants[0].stock <= 0);
          return (
            <button key={g.id} onClick={() => handleAddToCart(g.variants.length === 1 ? g.variants[0] : g)}
              disabled={isOutOfStock}
              className={`glass bg-gray-800/80 rounded-xl border-2 p-2 text-left transition-all active:scale-95 ${
                isOutOfStock
                  ? 'border-red-900/30 opacity-50 cursor-not-allowed'
                  : 'border-gray-700/50 hover:border-blue-500/50'
              }`}>
              {g.imageUrl ? (
                <img src={g.imageUrl} className="w-full h-20 object-cover rounded-lg mb-1.5" />
              ) : (
                <div className="w-full h-20 bg-gray-800 rounded-lg mb-1.5 flex items-center justify-center">
                  <Package size={24} className="text-gray-600" />
                </div>
              )}
              <p className="text-[10px] font-bold text-white leading-tight line-clamp-2">{g.name}</p>
              {g.variants.length > 1 && (
                <span className="inline-block text-[7px] font-bold text-blue-400 bg-blue-900/30 rounded-full px-1.5 py-0.5 mb-0.5">{g.variants.length} variants</span>
              )}
              {(colorLabel || sizeLabel) && (
                <p className="text-[8px] text-gray-500 font-bold truncate">{[colorLabel, sizeLabel].filter(Boolean).join(' | ')}</p>
              )}
              <p className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrency(g.price)}</p>
              <p className={`text-[8px] font-bold ${isOutOfStock ? 'text-red-400' : 'text-gray-600'}`}>{isOutOfStock ? 'OUT OF STOCK' : `Stock: ${g.totalStock}`}</p>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default POSProducts;
