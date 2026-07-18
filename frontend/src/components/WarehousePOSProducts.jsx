import React from 'react';
import { Grid3X3, ShoppingCart } from 'lucide-react';
import { useWarehousePOS } from '../context/WarehousePOSContext';

const WarehousePOSProducts = () => {
  const { filteredProducts, categories, activeCategory, set, handleAddToCart, hideZeroStock, set: setState, productsLoading } = useWarehousePOS();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Category pills */}
      <div className="flex gap-1.5 px-4 py-2 bg-gray-950 border-b border-gray-800 overflow-x-auto flex-shrink-0">
        <button onClick={() => set('activeCategory', '')}
          className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider whitespace-nowrap ${!activeCategory ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
          <Grid3X3 size={12} className="inline mr-1" />All
        </button>
        {categories.map(cat => (
          <button key={cat} onClick={() => set('activeCategory', cat)}
            className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider whitespace-nowrap ${activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {productsLoading ? (
          <div className="text-center text-gray-500 py-10 text-sm">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center text-gray-500 py-10 text-sm">No products found</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
  const { handleAddToCart, formatCurrency } = useWarehousePOS();
  const hasVariants = group._variants.length > 1;

  return (
    <div onClick={() => handleAddToCart(group)}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 hover:border-emerald-500/50 hover:bg-gray-800/80 transition-all cursor-pointer active:scale-[0.98]">
      {/* Product name + category */}
      <div className="text-xs font-bold text-white truncate font-data">{group.name}</div>
      <div className="text-[10px] text-gray-500 mt-0.5 font-data">{group.category}</div>

      {/* Color swatches */}
      {group.colors.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {group.colors.map(c => (
            <span key={c} className="text-[9px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{c}</span>
          ))}
        </div>
      )}

      {/* Size badges */}
      {group.sizes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {group.sizes.map(s => (
            <span key={s} className="text-[9px] bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
      )}

      {/* Stock + Price row */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
        <span className="text-[9px] text-gray-500">{group.totalStock} in stock</span>
        <span className="text-[10px] font-bold text-emerald-400">
          {group.minPrice === group.maxPrice
            ? formatCurrency(group.minPrice)
            : `${formatCurrency(group.minPrice)}-${formatCurrency(group.maxPrice)}`}
        </span>
      </div>

      {/* Add to cart hint */}
      <div className="mt-1.5 flex items-center justify-center gap-1 text-[9px] text-emerald-500/70 font-bold">
        <ShoppingCart size={10} />
        {hasVariants ? 'Select Variant' : 'Add to Cart'}
      </div>
    </div>
  );
});

export default WarehousePOSProducts;
