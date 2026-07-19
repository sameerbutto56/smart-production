import React from 'react';
import { Package } from 'lucide-react';
import { useWarehousePOS } from '../context/WarehousePOSContext';
import { useLanguage } from '../context/LanguageContext';
import { toUrduName } from '../utils/urduDictionary';

const WarehousePOSProducts = () => {
  const { isUrdu } = useLanguage();
  const { filteredProducts, categories, activeCategory, set, handleAddToCart, productsLoading } = useWarehousePOS();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Categories */}
      <div className="flex gap-1.5 px-3 py-2 bg-gray-950 border-b border-gray-800 overflow-x-auto flex-shrink-0">
        <button onClick={() => set('activeCategory', '')}
          className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${!activeCategory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          All
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => set('activeCategory', c)}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg whitespace-nowrap uppercase tracking-wider ${activeCategory === c ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Products grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {productsLoading && filteredProducts.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-600">
            <span className="font-bold">Loading products...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-600">
            <span className="font-bold">No products found</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {filteredProducts.map(group => (
              <ProductCard key={group.name} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProductCard = React.memo(({ group }) => {
  const { isUrdu: isUrdu2 } = useLanguage();
  const { handleAddToCart, formatCurrency } = useWarehousePOS();
  const maxShow = 3;
  const colorsMore = group.colors.length > maxShow ? group.colors.length - maxShow : 0;
  const sizesMore = group.sizes.length > maxShow ? group.sizes.length - maxShow : 0;
  const colorLabel = group.colors.length > 0
    ? (colorsMore > 0 ? group.colors.slice(0, maxShow).join(', ') + ` +${colorsMore}` : group.colors.join(', '))
    : null;
  const sizeLabel = group.sizes.length > 0
    ? (sizesMore > 0 ? group.sizes.slice(0, maxShow).join(', ') + ` +${sizesMore}` : group.sizes.join(', '))
    : null;
  const isOutOfStock = group.totalStock != null && group.totalStock <= 0;

  return (
    <button onClick={() => handleAddToCart(group)}
      disabled={isOutOfStock}
      className={`bg-gray-800/80 rounded-xl border-2 p-2 text-left transition-all active:scale-95 ${
        isOutOfStock
          ? 'border-red-900/30 opacity-50 cursor-not-allowed'
          : 'border-gray-700/50 hover:border-blue-500/50'
      }`}>
      <div className="w-full h-20 bg-gray-800 rounded-lg mb-1.5 flex items-center justify-center">
        <Package size={24} className="text-gray-600" />
      </div>
      <p className="text-[10px] font-bold text-white leading-tight line-clamp-2 font-data">{isUrdu2 ? toUrduName(group.name) : group.name}</p>
      {group._variants.length > 1 && (
        <span className="inline-block text-[7px] font-bold text-blue-400 bg-blue-900/30 rounded-full px-1.5 py-0.5 mb-0.5">{group._variants.length} variants</span>
      )}
      {(colorLabel || sizeLabel) && (
        <p className="text-[8px] text-gray-500 font-bold truncate">{[colorLabel, sizeLabel].filter(Boolean).join(' | ')}</p>
      )}
      <p className="text-xs font-black text-emerald-400 mt-0.5">
        {group.minPrice === group.maxPrice
          ? formatCurrency(group.minPrice)
          : `${formatCurrency(group.minPrice)}-${formatCurrency(group.maxPrice)}`}
      </p>
      <p className={`text-[8px] font-bold ${isOutOfStock ? 'text-red-400' : 'text-gray-600'}`}>{isOutOfStock ? 'OUT OF STOCK' : `Stock: ${group.totalStock}`}</p>
    </button>
  );
});

export default WarehousePOSProducts;
