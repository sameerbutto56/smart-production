import React from 'react';
import { Package, Grid3X3 } from 'lucide-react';
import { useWarehousePOS } from '../context/WarehousePOSContext';

const WarehousePOSProducts = () => {
  const { groupedProducts, filteredProducts, categories, activeCategory, set, addToCart, hideZeroStock, productsLoading } = useWarehousePOS();

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
  const { addToCart } = useWarehousePOS();
  const colors = [...new Set(group._variants.map(v => v.color).filter(Boolean))];
  const sizes = [...new Set(group._variants.map(v => v.size).filter(Boolean))];
  const totalStock = group._variants.reduce((s, v) => s + (v.variantStock || 0), 0);
  const minPrice = Math.min(...group._variants.map(v => v.variantPrice).filter(Boolean));
  const maxPrice = Math.max(...group._variants.map(v => v.variantPrice).filter(Boolean));

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 hover:border-gray-500 transition-colors">
      <div className="text-xs font-bold text-white truncate">{group.name}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{group.category}</div>

      {colors.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {colors.map(c => (
            <span key={c} className="text-[9px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{c}</span>
          ))}
        </div>
      )}

      {sizes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {sizes.map(s => (
            <span key={s} className="text-[9px] bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
      )}

      {/* Variant buttons */}
      <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
        {group._variants.filter(v => !v.color && !v.size).slice(0, 1).map(v => (
          <button key={v.id} onClick={() => addToCart(group, v)}
            className="w-full text-[10px] font-bold px-2 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-700/50 text-left">
            <span className="text-[9px] text-gray-400">Stock: {v.variantStock}</span>
            <span className="float-right">{group.price || v.variantPrice}</span>
          </button>
        ))}
        {group._variants.filter(v => v.color || v.size).map(v => (
          <button key={v.id} onClick={() => addToCart(group, v)}
            className="w-full text-[9px] px-2 py-1 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600/50 text-left">
            {v.color && <span className="font-bold">{v.color}</span>}
            {v.size && <span>{v.color ? ' / ' : ''}{v.size}</span>}
            <span className="float-right text-gray-500">₨{v.variantPrice} (s:{v.variantStock})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700/50">
        <span className="text-[9px] text-gray-500">{totalStock} in stock</span>
        <span className="text-[10px] font-bold text-emerald-400">
          {minPrice === maxPrice ? `₨${minPrice}` : `₨${minPrice}-${maxPrice}`}
        </span>
      </div>
    </div>
  );
});

export default WarehousePOSProducts;
