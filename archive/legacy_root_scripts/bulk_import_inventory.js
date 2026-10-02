const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Categorization helper based on keyword match
function getCategory(name) {
  const n = name.toUpperCase();
  if (n.includes('SHOES')) return 'SHOES';
  if (n.includes('CLOGS')) return 'CLOGS';
  if (n.includes('CAP') || n.includes('C. PLAIN')) return 'CAPS';
  if (n.includes('COAT') || n.includes('LAB-COAT') || n.includes('LABCOAT')) return 'COAT';
  if (n.includes('BAG')) return 'BAG';
  if (n.includes('SOCKS')) return 'SOCKS';
  if (n.includes('SLEEVES')) return 'SLEEVES';
  if (n.includes('BOTTLE')) return 'BOTTLE';
  if (n.includes('ENGRAVING') || n.includes('PRINTING') || n.includes('ZIP') || n.includes('LOGO')) return 'CUSTOM';
  return 'SCRUBS'; // Default fallback
}

// DJB2 Hash for barcode generation
const djb2 = (s) => {
  if (!s) return 0;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const generateBarcode = (itemId, size, color, attempt = 0) => {
  const prefix = 'POS';
  const raw = itemId.replace(/-/g, '').slice(0, 8);
  const variantStr = `${size || ''}|${color || ''}|${attempt}`;
  const fullHash = djb2(variantStr);
  const base = ((parseInt(raw, 16) || 0) + fullHash).toString(36).toUpperCase().slice(0, 8);
  return `${prefix}${base}`;
};

const OUTLETS = ['Johar Town', 'Jail Road', 'Abbottabad'];

async function main() {
  console.log('--- STARTING INVENTORY RECOVERY INJECTION ---');

  // Load existing items to avoid duplicates
  const existingItems = await prisma.inventoryItem.findMany();
  const existingNames = new Set(existingItems.map(i => i.name.toLowerCase().trim()));

  // Raw product details from user input
  const rawInput = [
    // Aeros Shoes
    { name: 'Aeros Shoes', size: '35', color: 'CL-021' },
    { name: 'Aeros Shoes', size: '35', color: 'CL-024' },
    { name: 'Aeros Shoes', size: '36', color: 'CL-021' },
    { name: 'Aeros Shoes', size: '36', color: 'CL-024' },
    { name: 'Aeros Shoes', size: '37', color: 'CL-021' },
    { name: 'Aeros Shoes', size: '37', color: 'CL-024' },
    { name: 'Aeros Shoes', size: '38', color: 'CL-020' },
    { name: 'Aeros Shoes', size: '38', color: 'CL-024' },
    { name: 'Aeros Shoes', size: '38', color: 'CL-025' },
    { name: 'Aeros Shoes', size: '39', color: 'CL-021' },
    { name: 'Aeros Shoes', size: '39', color: 'CL-020' },
    { name: 'Aeros Shoes', size: '39', color: 'CL-057' },
    { name: 'Aeros Shoes', size: '40', color: 'CL-021' },
    { name: 'Aeros Shoes', size: '40', color: 'CL-020' },
    { name: 'Aeros Shoes', size: '35', color: 'CL-048' },
    { name: 'Aeros Shoes', size: '37', color: 'CL-040' },
    { name: 'Aeros Shoes', size: '40.5', color: 'CL-037' },

    // Buckle
    { name: 'Buckle', size: null, color: null },

    // Plain Caps
    { name: 'C. Plain Caps', size: null, color: 'Black' },
    { name: 'C. Plain Caps', size: null, color: 'Navy' },
    { name: 'C. Plain Caps', size: null, color: 'Olive Green' },
    { name: 'C. Plain Caps', size: null, color: 'Grey' },
    { name: 'C. Plain Caps', size: null, color: 'Burgundy' },
    { name: 'C. Plain Caps', size: null, color: 'Black Emboss' },
    { name: 'C. Plain Caps', size: null, color: 'Olive Emboss' },

    // COTTON
    { name: 'COTTON', size: 'XS', color: 'Pink' },
    { name: 'COTTON', size: 'S', color: 'Pink' },
    { name: 'COTTON', size: 'M', color: 'Pink' },
    { name: 'COTTON', size: 'L', color: 'Pink' },
    { name: 'COTTON', size: 'XL', color: 'Pink' },
    { name: 'COTTON', size: 'XXL', color: 'Pink' },
    { name: 'COTTON', size: 'C', color: 'Pink' },
    { name: 'COTTON', size: 'XS', color: 'Black' },
    { name: 'COTTON', size: 'S', color: 'Black' },
    { name: 'COTTON', size: 'M', color: 'Black' },
    { name: 'COTTON', size: 'L', color: 'Black' },
    { name: 'COTTON', size: 'XL', color: 'Black' },
    { name: 'COTTON', size: 'XXL', color: 'Black' },
    { name: 'COTTON', size: 'C', color: 'Black' },
    { name: 'COTTON', size: 'XS', color: 'Black Shine' },
    { name: 'COTTON', size: 'S', color: 'Black Shine' },
    { name: 'COTTON', size: 'M', color: 'Black Shine' },
    { name: 'COTTON', size: 'L', color: 'Black Shine' },
    { name: 'COTTON', size: 'XL', color: 'Black Shine' },
    { name: 'COTTON', size: 'XXL', color: 'Black Shine' },
    { name: 'COTTON', size: 'C', color: 'Black Shine' },
    { name: 'COTTON', size: 'XS', color: 'Cardinal Rosa' },
    { name: 'COTTON', size: 'S', color: 'Cardinal Rosa' },
    { name: 'COTTON', size: 'M', color: 'Cardinal Rosa' },
    { name: 'COTTON', size: 'L', color: 'Cardinal Rosa' },
    { name: 'COTTON', size: 'XL', color: 'Cardinal Rosa' },
    { name: 'COTTON', size: 'XXL', color: 'Cardinal Rosa' },
    { name: 'COTTON', size: 'C', color: 'Cardinal Rosa' },
    { name: 'COTTON', size: 'XS', color: 'Vat Navy Strike' },
    { name: 'COTTON', size: 'S', color: 'Vat Navy Strike' },
    { name: 'COTTON', size: 'M', color: 'Vat Navy Strike' },
    { name: 'COTTON', size: 'L', color: 'Vat Navy Strike' },
    { name: 'COTTON', size: 'XL', color: 'Vat Navy Strike' },
    { name: 'COTTON', size: 'XXL', color: 'Vat Navy Strike' },
    { name: 'COTTON', size: 'C', color: 'Vat Navy Strike' },
    { name: 'COTTON', size: 'XS', color: 'Montana Pick' },
    { name: 'COTTON', size: 'S', color: 'Montana Pick' },
    { name: 'COTTON', size: 'M', color: 'Montana Pick' },
    { name: 'COTTON', size: 'L', color: 'Montana Pick' },
    { name: 'COTTON', size: 'XL', color: 'Montana Pick' },
    { name: 'COTTON', size: 'XXL', color: 'Montana Pick' },
    { name: 'COTTON', size: 'C', color: 'Montana Pick' },
    { name: 'COTTON', size: 'XS', color: 'Peach Dusk' },
    { name: 'COTTON', size: 'S', color: 'Peach Dusk' },
    { name: 'COTTON', size: 'M', color: 'Peach Dusk' },
    { name: 'COTTON', size: 'L', color: 'Peach Dusk' },
    { name: 'COTTON', size: 'XL', color: 'Peach Dusk' },
    { name: 'COTTON', size: 'XXL', color: 'Peach Dusk' },
    { name: 'COTTON', size: 'C', color: 'Peach Dusk' },
    { name: 'COTTON', size: 'XS', color: 'Texture Trail' },
    { name: 'COTTON', size: 'S', color: 'Texture Trail' },
    { name: 'COTTON', size: 'M', color: 'Texture Trail' },
    { name: 'COTTON', size: 'L', color: 'Texture Trail' },
    { name: 'COTTON', size: 'XL', color: 'Texture Trail' },
    { name: 'COTTON', size: 'XXL', color: 'Texture Trail' },
    { name: 'COTTON', size: 'C', color: 'Texture Trail' },
    { name: 'COTTON', size: 'XS', color: 'Summit Texture' },
    { name: 'COTTON', size: 'S', color: 'Summit Texture' },
    { name: 'COTTON', size: 'M', color: 'Summit Texture' },
    { name: 'COTTON', size: 'L', color: 'Summit Texture' },
    { name: 'COTTON', size: 'XL', color: 'Summit Texture' },
    { name: 'COTTON', size: 'XXL', color: 'Summit Texture' },
    { name: 'COTTON', size: 'C', color: 'Summit Texture' },
    { name: 'COTTON', size: 'XS', color: 'Summit Texture (Men)' },
    { name: 'COTTON', size: 'S', color: 'Summit Texture (Men)' },
    { name: 'COTTON', size: 'M', color: 'Summit Texture (Men)' },
    { name: 'COTTON', size: 'L', color: 'Summit Texture (Men)' },
    { name: 'COTTON', size: 'XL', color: 'Summit Texture (Men)' },
    { name: 'COTTON', size: 'XXL', color: 'Summit Texture (Men)' },
    { name: 'COTTON', size: 'C', color: 'Summit Texture (Men)' },
    { name: 'COTTON', size: 'XS', color: 'Texture Trail (Men)' },
    { name: 'COTTON', size: 'S', color: 'Texture Trail (Men)' },
    { name: 'COTTON', size: 'M', color: 'Texture Trail (Men)' },
    { name: 'COTTON', size: 'L', color: 'Texture Trail (Men)' },
    { name: 'COTTON', size: 'XL', color: 'Texture Trail (Men)' },
    { name: 'COTTON', size: 'XXL', color: 'Texture Trail (Men)' },
    { name: 'COTTON', size: 'C', color: 'Texture Trail (Men)' },

    // Clogs
    { name: 'Clogs Flufftail', size: null, color: 'White' },
    { name: 'Clogs Flufftail', size: null, color: 'Black' },
    { name: 'Clogs Flufftail', size: null, color: 'Pink' },
    { name: 'Clogs Flufftail', size: null, color: 'Purple' },
    { name: 'Clogs MonoStarlings', size: null, color: 'Black' },
    { name: 'Clogs MonoStarlings', size: null, color: 'Grey' },
    { name: 'Clogs Muffle Bird Sole', size: null, color: 'Brown' },
    { name: 'Clogs Muffle Bird Sole', size: null, color: 'Pink' },
    { name: 'Clogs Muffle Bird Sole', size: null, color: 'Black' },
    { name: 'Clogs Muffle Bird Sole', size: null, color: 'Green' },
    { name: 'Clogs Snug Blockies', size: null, color: 'Cream' },
    { name: 'Clogs Snug Blockies', size: null, color: 'Pink' },
    { name: 'Clogs Snug Blockies', size: null, color: 'Purple' },
    { name: 'Clogs Snug Blockies', size: null, color: 'Black' },
    { name: 'Clogs Snug Blockies', size: null, color: 'White' },
    { name: 'Clogs Tumble Jays', size: null, color: 'Blue' },
    { name: 'Clogs Tumble Jays', size: null, color: 'Black' },
    { name: 'Clogs Work Duo', size: null, color: 'Purple' },
    { name: 'Clogs Work Duo', size: null, color: 'Green' },

    // Crown Women & Men
    { name: 'Crown Women', size: 'XS', color: 'Black' },
    { name: 'Crown Women', size: 'S', color: 'Black' },
    { name: 'Crown Women', size: 'M', color: 'Black' },
    { name: 'Crown Women', size: 'L', color: 'Black' },
    { name: 'Crown Women', size: 'XL', color: 'Black' },
    { name: 'Crown Women', size: 'XXL', color: 'Black' },
    { name: 'Crown Women', size: 'C', color: 'Black' },
    { name: 'Crown Women', size: 'XS', color: 'Navy' },
    { name: 'Crown Women', size: 'S', color: 'Navy' },
    { name: 'Crown Women', size: 'M', color: 'Navy' },
    { name: 'Crown Women', size: 'L', color: 'Navy' },
    { name: 'Crown Women', size: 'XL', color: 'Navy' },
    { name: 'Crown Women', size: 'XXL', color: 'Navy' },
    { name: 'Crown Women', size: 'C', color: 'Navy' },
    { name: 'Crown Women', size: 'XS', color: 'White' },
    { name: 'Crown Women', size: 'S', color: 'White' },
    { name: 'Crown Women', size: 'M', color: 'White' },
    { name: 'Crown Women', size: 'L', color: 'White' },
    { name: 'Crown Women', size: 'XL', color: 'White' },
    { name: 'Crown Women', size: 'XXL', color: 'White' },
    { name: 'Crown Women', size: 'C', color: 'White' },
    { name: 'Crown Women', size: 'XS', color: 'Green' },
    { name: 'Crown Women', size: 'S', color: 'Green' },
    { name: 'Crown Women', size: 'M', color: 'Green' },
    { name: 'Crown Women', size: 'L', color: 'Green' },
    { name: 'Crown Women', size: 'XL', color: 'Green' },
    { name: 'Crown Women', size: 'XXL', color: 'Green' },
    { name: 'Crown Women', size: 'C', color: 'Green' },
    { name: 'Crown Women', size: 'XS', color: 'Zinc' },
    { name: 'Crown Women', size: 'S', color: 'Zinc' },
    { name: 'Crown Women', size: 'M', color: 'Zinc' },
    { name: 'Crown Women', size: 'L', color: 'Zinc' },
    { name: 'Crown Women', size: 'XL', color: 'Zinc' },
    { name: 'Crown Women', size: 'XXL', color: 'Zinc' },
    { name: 'Crown Women', size: 'C', color: 'Zinc' },
    { name: 'Crown Women', size: 'XS', color: 'Olive Green' },
    { name: 'Crown Women', size: 'S', color: 'Olive Green' },
    { name: 'Crown Women', size: 'M', color: 'Olive Green' },
    { name: 'Crown Women', size: 'L', color: 'Olive Green' },
    { name: 'Crown Women', size: 'XL', color: 'Olive Green' },
    { name: 'Crown Women', size: 'XXL', color: 'Olive Green' },
    { name: 'Crown Women', size: 'C', color: 'Olive Green' },
    { name: 'Crown Women', size: 'XS', color: 'Summit Executive' },
    { name: 'Crown Women', size: 'S', color: 'Summit Executive' },
    { name: 'Crown Women', size: 'M', color: 'Summit Executive' },
    { name: 'Crown Women', size: 'L', color: 'Summit Executive' },
    { name: 'Crown Women', size: 'XL', color: 'Summit Executive' },
    { name: 'Crown Women', size: 'XXL', color: 'Summit Executive' },
    { name: 'Crown Women', size: 'C', color: 'Summit Executive' },
    { name: 'Crown Women', size: 'XS', color: 'Black Line Joggers' },
    { name: 'Crown Women', size: 'S', color: 'Black Line Joggers' },
    { name: 'Crown Women', size: 'M', color: 'Black Line Joggers' },
    { name: 'Crown Women', size: 'L', color: 'Black Line Joggers' },
    { name: 'Crown Women', size: 'XL', color: 'Black Line Joggers' },
    { name: 'Crown Women', size: 'XXL', color: 'Black Line Joggers' },
    { name: 'Crown Women', size: 'C', color: 'Black Line Joggers' },
    { name: 'Crown Women', size: 'XS', color: 'Black Peplum' },
    { name: 'Crown Women', size: 'S', color: 'Black Peplum' },
    { name: 'Crown Women', size: 'M', color: 'Black Peplum' },
    { name: 'Crown Women', size: 'L', color: 'Black Peplum' },
    { name: 'Crown Women', size: 'XL', color: 'Black Peplum' },
    { name: 'Crown Women', size: 'XXL', color: 'Black Peplum' },
    { name: 'Crown Women', size: 'C', color: 'Black Peplum' },
    { name: 'Crown Women', size: 'XS', color: 'Purple' },
    { name: 'Crown Women', size: 'S', color: 'Purple' },
    { name: 'Crown Women', size: 'M', color: 'Purple' },
    { name: 'Crown Women', size: 'L', color: 'Purple' },
    { name: 'Crown Women', size: 'XL', color: 'Purple' },
    { name: 'Crown Women', size: 'XXL', color: 'Purple' },
    { name: 'Crown Women', size: 'C', color: 'Purple' },
    { name: 'Crown Women', size: 'XS', color: 'Grey' },
    { name: 'Crown Women', size: 'S', color: 'Grey' },
    { name: 'Crown Women', size: 'M', color: 'Grey' },
    { name: 'Crown Women', size: 'L', color: 'Grey' },
    { name: 'Crown Women', size: 'XL', color: 'Grey' },
    { name: 'Crown Women', size: 'XXL', color: 'Grey' },
    { name: 'Crown Women', size: 'C', color: 'Grey' },
    { name: 'Crown Women', size: 'XS', color: 'Galaxy Ocean Black' },
    { name: 'Crown Women', size: 'S', color: 'Galaxy Ocean Black' },
    { name: 'Crown Women', size: 'M', color: 'Galaxy Ocean Black' },
    { name: 'Crown Women', size: 'L', color: 'Galaxy Ocean Black' },
    { name: 'Crown Women', size: 'XL', color: 'Galaxy Ocean Black' },
    { name: 'Crown Women', size: 'XXL', color: 'Galaxy Ocean Black' },
    { name: 'Crown Women', size: 'C', color: 'Galaxy Ocean Black' },
    { name: 'Crown Women', size: 'XS', color: 'Basic Navy' },
    { name: 'Crown Women', size: 'S', color: 'Basic Navy' },
    { name: 'Crown Women', size: 'M', color: 'Basic Navy' },
    { name: 'Crown Women', size: 'L', color: 'Basic Navy' },
    { name: 'Crown Women', size: 'XL', color: 'Basic Navy' },
    { name: 'Crown Women', size: 'XXL', color: 'Basic Navy' },
    { name: 'Crown Women', size: 'C', color: 'Basic Navy' },
    { name: 'Crown Women', size: 'XS', color: 'Curlup Zinc' },
    { name: 'Crown Women', size: 'S', color: 'Curlup Zinc' },
    { name: 'Crown Women', size: 'M', color: 'Curlup Zinc' },
    { name: 'Crown Women', size: 'L', color: 'Curlup Zinc' },
    { name: 'Crown Women', size: 'XL', color: 'Curlup Zinc' },
    { name: 'Crown Women', size: 'XXL', color: 'Curlup Zinc' },
    { name: 'Crown Women', size: 'C', color: 'Curlup Zinc' },
    { name: 'Crown Women', size: 'XS', color: 'Basic Black' },
    { name: 'Crown Women', size: 'S', color: 'Basic Black' },
    { name: 'Crown Women', size: 'M', color: 'Basic Black' },
    { name: 'Crown Women', size: 'L', color: 'Basic Black' },
    { name: 'Crown Women', size: 'XL', color: 'Basic Black' },
    { name: 'Crown Women', size: 'XXL', color: 'Basic Black' },
    { name: 'Crown Women', size: 'C', color: 'Basic Black' },
    { name: 'Crown Women', size: 'XS', color: 'Navy Festeve' },
    { name: 'Crown Women', size: 'S', color: 'Navy Festeve' },
    { name: 'Crown Women', size: 'M', color: 'Navy Festeve' },
    { name: 'Crown Women', size: 'L', color: 'Navy Festeve' },
    { name: 'Crown Women', size: 'XL', color: 'Navy Festeve' },
    { name: 'Crown Women', size: 'XXL', color: 'Navy Festeve' },
    { name: 'Crown Women', size: 'C', color: 'Navy Festeve' },
    { name: 'Crown Women', size: 'XS', color: 'Burgundy' },
    { name: 'Crown Women', size: 'S', color: 'Burgundy' },
    { name: 'Crown Women', size: 'M', color: 'Burgundy' },
    { name: 'Crown Women', size: 'L', color: 'Burgundy' },
    { name: 'Crown Women', size: 'XL', color: 'Burgundy' },
    { name: 'Crown Women', size: 'XXL', color: 'Burgundy' },
    { name: 'Crown Women', size: 'C', color: 'Burgundy' },

    { name: 'Crown Men', size: 'XS', color: 'Black' },
    { name: 'Crown Men', size: 'S', color: 'Black' },
    { name: 'Crown Men', size: 'M', color: 'Black' },
    { name: 'Crown Men', size: 'L', color: 'Black' },
    { name: 'Crown Men', size: 'XL', color: 'Black' },
    { name: 'Crown Men', size: 'XXL', color: 'Black' },
    { name: 'Crown Men', size: 'C', color: 'Black' },
    { name: 'Crown Men', size: 'XS', color: 'Navy' },
    { name: 'Crown Men', size: 'S', color: 'Navy' },
    { name: 'Crown Men', size: 'M', color: 'Navy' },
    { name: 'Crown Men', size: 'L', color: 'Navy' },
    { name: 'Crown Men', size: 'XL', color: 'Navy' },
    { name: 'Crown Men', size: 'XXL', color: 'Navy' },
    { name: 'Crown Men', size: 'C', color: 'Navy' },
    { name: 'Crown Men', size: 'XS', color: 'White' },
    { name: 'Crown Men', size: 'S', color: 'White' },
    { name: 'Crown Men', size: 'M', color: 'White' },
    { name: 'Crown Men', size: 'L', color: 'White' },
    { name: 'Crown Men', size: 'XL', color: 'White' },
    { name: 'Crown Men', size: 'XXL', color: 'White' },
    { name: 'Crown Men', size: 'C', color: 'White' },
    { name: 'Crown Men', size: 'XS', color: 'Zinc' },
    { name: 'Crown Men', size: 'S', color: 'Zinc' },
    { name: 'Crown Men', size: 'M', color: 'Zinc' },
    { name: 'Crown Men', size: 'L', color: 'Zinc' },
    { name: 'Crown Men', size: 'XL', color: 'Zinc' },
    { name: 'Crown Men', size: 'XXL', color: 'Zinc' },
    { name: 'Crown Men', size: 'C', color: 'Zinc' },
    { name: 'Crown Men', size: 'XS', color: 'Olive Green' },
    { name: 'Crown Men', size: 'S', color: 'Olive Green' },
    { name: 'Crown Men', size: 'M', color: 'Olive Green' },
    { name: 'Crown Men', size: 'L', color: 'Olive Green' },
    { name: 'Crown Men', size: 'XL', color: 'Olive Green' },
    { name: 'Crown Men', size: 'XXL', color: 'Olive Green' },
    { name: 'Crown Men', size: 'C', color: 'Olive Green' },
    { name: 'Crown Men', size: 'XS', color: 'Navy Cossing' },
    { name: 'Crown Men', size: 'S', color: 'Navy Cossing' },
    { name: 'Crown Men', size: 'M', color: 'Navy Cossing' },
    { name: 'Crown Men', size: 'L', color: 'Navy Cossing' },
    { name: 'Crown Men', size: 'XL', color: 'Navy Cossing' },
    { name: 'Crown Men', size: 'XXL', color: 'Navy Cossing' },
    { name: 'Crown Men', size: 'C', color: 'Navy Cossing' },
    { name: 'Crown Men', size: 'XS', color: 'Black Crossing' },
    { name: 'Crown Men', size: 'S', color: 'Black Crossing' },
    { name: 'Crown Men', size: 'M', color: 'Black Crossing' },
    { name: 'Crown Men', size: 'L', color: 'Black Crossing' },
    { name: 'Crown Men', size: 'XL', color: 'Black Crossing' },
    { name: 'Crown Men', size: 'XXL', color: 'Black Crossing' },
    { name: 'Crown Men', size: 'C', color: 'Black Crossing' },
    { name: 'Crown Men', size: 'XS', color: 'The Consultant' },
    { name: 'Crown Men', size: 'S', color: 'The Consultant' },
    { name: 'Crown Men', size: 'M', color: 'The Consultant' },
    { name: 'Crown Men', size: 'L', color: 'The Consultant' },
    { name: 'Crown Men', size: 'XL', color: 'The Consultant' },
    { name: 'Crown Men', size: 'XXL', color: 'The Consultant' },
    { name: 'Crown Men', size: 'C', color: 'The Consultant' },
    { name: 'Crown Men', size: 'XS', color: 'Purple' },
    { name: 'Crown Men', size: 'S', color: 'Purple' },
    { name: 'Crown Men', size: 'M', color: 'Purple' },
    { name: 'Crown Men', size: 'L', color: 'Purple' },
    { name: 'Crown Men', size: 'XL', color: 'Purple' },
    { name: 'Crown Men', size: 'XXL', color: 'Purple' },
    { name: 'Crown Men', size: 'C', color: 'Purple' },
    { name: 'Crown Men', size: 'XS', color: 'Burgundy' },
    { name: 'Crown Men', size: 'S', color: 'Burgundy' },
    { name: 'Crown Men', size: 'M', color: 'Burgundy' },
    { name: 'Crown Men', size: 'L', color: 'Burgundy' },
    { name: 'Crown Men', size: 'XL', color: 'Burgundy' },
    { name: 'Crown Men', size: 'XXL', color: 'Burgundy' },
    { name: 'Crown Men', size: 'C', color: 'Burgundy' },
    { name: 'Crown Men', size: 'XS', color: 'Grey' },
    { name: 'Crown Men', size: 'S', color: 'Grey' },
    { name: 'Crown Men', size: 'M', color: 'Grey' },
    { name: 'Crown Men', size: 'L', color: 'Grey' },
    { name: 'Crown Men', size: 'XL', color: 'Grey' },
    { name: 'Crown Men', size: 'XXL', color: 'Grey' },
    { name: 'Crown Men', size: 'C', color: 'Grey' },
    { name: 'Crown Men', size: 'XS', color: 'Galaxy Ocean Black' },
    { name: 'Crown Men', size: 'S', color: 'Galaxy Ocean Black' },
    { name: 'Crown Men', size: 'M', color: 'Galaxy Ocean Black' },
    { name: 'Crown Men', size: 'L', color: 'Galaxy Ocean Black' },
    { name: 'Crown Men', size: 'XL', color: 'Galaxy Ocean Black' },
    { name: 'Crown Men', size: 'XXL', color: 'Galaxy Ocean Black' },
    { name: 'Crown Men', size: 'C', color: 'Galaxy Ocean Black' },
    { name: 'Crown Men', size: 'XS', color: 'Lesson Poly Navy' },
    { name: 'Crown Men', size: 'S', color: 'Lesson Poly Navy' },
    { name: 'Crown Men', size: 'M', color: 'Lesson Poly Navy' },
    { name: 'Crown Men', size: 'L', color: 'Lesson Poly Navy' },
    { name: 'Crown Men', size: 'XL', color: 'Lesson Poly Navy' },
    { name: 'Crown Men', size: 'XXL', color: 'Lesson Poly Navy' },
    { name: 'Crown Men', size: 'C', color: 'Lesson Poly Navy' },
    { name: 'Crown Men', size: 'XS', color: 'Exicutive' },
    { name: 'Crown Men', size: 'S', color: 'Exicutive' },
    { name: 'Crown Men', size: 'M', color: 'Exicutive' },
    { name: 'Crown Men', size: 'L', color: 'Exicutive' },
    { name: 'Crown Men', size: 'XL', color: 'Exicutive' },
    { name: 'Crown Men', size: 'XXL', color: 'Exicutive' },
    { name: 'Crown Men', size: 'C', color: 'Exicutive' },
    { name: 'Crown Men', size: 'XS', color: 'Galaxy Ocean White' },
    { name: 'Crown Men', size: 'S', color: 'Galaxy Ocean White' },
    { name: 'Crown Men', size: 'M', color: 'Galaxy Ocean White' },
    { name: 'Crown Men', size: 'L', color: 'Galaxy Ocean White' },
    { name: 'Crown Men', size: 'XL', color: 'Galaxy Ocean White' },
    { name: 'Crown Men', size: 'XXL', color: 'Galaxy Ocean White' },
    { name: 'Crown Men', size: 'C', color: 'Galaxy Ocean White' },
    { name: 'Crown Men', size: 'XS', color: 'Ocean Zinc' },
    { name: 'Crown Men', size: 'S', color: 'Ocean Zinc' },
    { name: 'Crown Men', size: 'M', color: 'Ocean Zinc' },
    { name: 'Crown Men', size: 'L', color: 'Ocean Zinc' },
    { name: 'Crown Men', size: 'XL', color: 'Ocean Zinc' },
    { name: 'Crown Men', size: 'XXL', color: 'Ocean Zinc' },
    { name: 'Crown Men', size: 'C', color: 'Ocean Zinc' },
    { name: 'Crown Men', size: 'XS', color: 'Basic Navy' },
    { name: 'Crown Men', size: 'S', color: 'Basic Navy' },
    { name: 'Crown Men', size: 'M', color: 'Basic Navy' },
    { name: 'Crown Men', size: 'L', color: 'Basic Navy' },
    { name: 'Crown Men', size: 'XL', color: 'Basic Navy' },
    { name: 'Crown Men', size: 'XXL', color: 'Basic Navy' },
    { name: 'Crown Men', size: 'C', color: 'Basic Navy' },
    { name: 'Crown Men', size: 'XS', color: 'Duty Command' },
    { name: 'Crown Men', size: 'S', color: 'Duty Command' },
    { name: 'Crown Men', size: 'M', color: 'Duty Command' },
    { name: 'Crown Men', size: 'L', color: 'Duty Command' },
    { name: 'Crown Men', size: 'XL', color: 'Duty Command' },
    { name: 'Crown Men', size: 'XXL', color: 'Duty Command' },
    { name: 'Crown Men', size: 'C', color: 'Duty Command' },
    { name: 'Crown Men', size: 'XS', color: 'Basic Black' },
    { name: 'Crown Men', size: 'S', color: 'Basic Black' },
    { name: 'Crown Men', size: 'M', color: 'Basic Black' },
    { name: 'Crown Men', size: 'L', color: 'Basic Black' },
    { name: 'Crown Men', size: 'XL', color: 'Basic Black' },
    { name: 'Crown Men', size: 'XXL', color: 'Basic Black' },
    { name: 'Crown Men', size: 'C', color: 'Basic Black' },

    // White Coat Women
    { name: 'Designer White Coat Women', size: 'XS', color: 'Blue Paisley' },
    { name: 'Designer White Coat Women', size: 'S', color: 'Blue Paisley' },
    { name: 'Designer White Coat Women', size: 'M', color: 'Blue Paisley' },
    { name: 'Designer White Coat Women', size: 'L', color: 'Blue Paisley' },
    { name: 'Designer White Coat Women', size: 'XL', color: 'Blue Paisley' },
    { name: 'Designer White Coat Women', size: 'XXL', color: 'Blue Paisley' },
    { name: 'Designer White Coat Women', size: 'C', color: 'Blue Paisley' },
    { name: 'Designer White Coat Women', size: 'XS', color: 'Pink Chetha' },
    { name: 'Designer White Coat Women', size: 'S', color: 'Pink Chetha' },
    { name: 'Designer White Coat Women', size: 'M', color: 'Pink Chetha' },
    { name: 'Designer White Coat Women', size: 'L', color: 'Pink Chetha' },
    { name: 'Designer White Coat Women', size: 'XL', color: 'Pink Chetha' },
    { name: 'Designer White Coat Women', size: 'XXL', color: 'Pink Chetha' },
    { name: 'Designer White Coat Women', size: 'C', color: 'Pink Chetha' },

    // Flex Fit Unisex
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Black' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Black' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Black' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Black' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Black' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Black' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Navy' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Navy' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Navy' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Navy' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Navy' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Navy' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Grey' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Grey' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Grey' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Grey' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Grey' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Grey' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Olive Green' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Olive Green' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Olive Green' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Olive Green' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Olive Green' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Olive Green' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Ivy Green' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Ivy Green' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Ivy Green' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Ivy Green' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Ivy Green' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Ivy Green' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Purple' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Purple' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Purple' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Purple' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Purple' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Purple' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Camel' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Camel' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Camel' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Camel' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Camel' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Camel' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Brown' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Brown' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Brown' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Brown' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Brown' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Brown' },
    { name: 'Flex Fit Unisex', size: 'XS', color: 'Red' },
    { name: 'Flex Fit Unisex', size: 'S', color: 'Red' },
    { name: 'Flex Fit Unisex', size: 'M', color: 'Red' },
    { name: 'Flex Fit Unisex', size: 'L', color: 'Red' },
    { name: 'Flex Fit Unisex', size: 'XL', color: 'Red' },
    { name: 'Flex Fit Unisex', size: 'C', color: 'Red' },

    // Flex Stretch
    { name: 'Flex Stretch', size: 'XS', color: 'Black' },
    { name: 'Flex Stretch', size: 'S', color: 'Black' },
    { name: 'Flex Stretch', size: 'M', color: 'Black' },
    { name: 'Flex Stretch', size: 'L', color: 'Black' },
    { name: 'Flex Stretch', size: 'XL', color: 'Black' },
    { name: 'Flex Stretch', size: 'C', color: 'Black' },
    { name: 'Flex Stretch', size: 'XS', color: 'Navy' },
    { name: 'Flex Stretch', size: 'S', color: 'Navy' },
    { name: 'Flex Stretch', size: 'M', color: 'Navy' },
    { name: 'Flex Stretch', size: 'L', color: 'Navy' },
    { name: 'Flex Stretch', size: 'XL', color: 'Navy' },
    { name: 'Flex Stretch', size: 'C', color: 'Navy' },

    // Graffiti Bag
    { name: 'Grafitti Bag', size: null, color: 'Black' },
    { name: 'Grafitti Bag', size: null, color: 'White' },

    // Inner T
    { name: 'Inner T', size: 'S', color: 'White' },
    { name: 'Inner T', size: 'M', color: 'White' },
    { name: 'Inner T', size: 'L', color: 'White' },
    { name: 'Inner T', size: 'XL', color: 'White' },
    { name: 'Inner T', size: 'S', color: 'Black' },
    { name: 'Inner T', size: 'M', color: 'Black' },
    { name: 'Inner T', size: 'L', color: 'Black' },
    { name: 'Inner T', size: 'XL', color: 'Black' },
    { name: 'Inner T', size: 'S', color: 'Navy Blue' },
    { name: 'Inner T', size: 'M', color: 'Navy Blue' },
    { name: 'Inner T', size: 'L', color: 'Navy Blue' },
    { name: 'Inner T', size: 'XL', color: 'Navy Blue' },

    // Lab-Coats
    { name: 'Lab-Coat Men Helium', size: 'XS', color: 'White' },
    { name: 'Lab-Coat Men Helium', size: 'S', color: 'White' },
    { name: 'Lab-Coat Men Helium', size: 'M', color: 'White' },
    { name: 'Lab-Coat Men Helium', size: 'L', color: 'White' },
    { name: 'Lab-Coat Men Helium', size: 'XL', color: 'White' },
    { name: 'Lab-Coat Men Helium', size: 'XXL', color: 'White' },
    { name: 'Lab-Coat Men Helium', size: 'C', color: 'White' },
    { name: 'Lab-Coat Women Helium', size: 'XS', color: 'White' },
    { name: 'Lab-Coat Women Helium', size: 'S', color: 'White' },
    { name: 'Lab-Coat Women Helium', size: 'M', color: 'White' },
    { name: 'Lab-Coat Women Helium', size: 'L', color: 'White' },
    { name: 'Lab-Coat Women Helium', size: 'XL', color: 'White' },
    { name: 'Lab-Coat Women Helium', size: 'XXL', color: 'White' },
    { name: 'Lab-Coat Women Helium', size: 'C', color: 'White' },

    // Makeup Bag
    { name: 'Makeup Bag', size: null, color: 'Graffiti' },
    { name: 'Makeup Bag', size: null, color: 'Black' },

    // Accessories / Extras
    { name: 'Matching Cap', size: null, color: null },
    { name: 'Name Engraving', size: null, color: null },
    { name: 'Name Printing', size: null, color: null },
    { name: 'Additional Zip', size: null, color: null },
    { name: 'Ajrak scrub', size: null, color: null },
    { name: 'Logo', size: null, color: null },
    { name: 'Lab Coat', size: null, color: null },
    { name: 'LabCoat Wrinkle Free', size: null, color: null },
    { name: 'Flexfit unisex', size: null, color: null },
    { name: 'nova', size: null, color: null },

    // Sleeves / Socks
    { name: 'Sleeves', size: null, color: 'Navy' },
    { name: 'Sleeves', size: null, color: 'Black' },
    { name: 'Sleeves', size: null, color: 'Purple' },
    { name: 'Socks', size: null, color: 'ECG' },
    { name: 'Socks', size: null, color: 'Medical Logos' },
    { name: 'Socks', size: null, color: 'Funky Radiology' },
    { name: 'Socks', size: null, color: 'General Surgery' },

    // Temperature Bottles & Tote Bags
    { name: 'Temperature Bottle', size: null, color: 'ECG White' },
    { name: 'Temperature Bottle', size: null, color: 'ECG Black' },
    { name: 'Temperature Bottle', size: null, color: 'Propofol' },
    { name: 'Temperature Bottle', size: null, color: 'Medical' },
    { name: 'Temperature Bottle', size: null, color: 'ENT' },
    { name: 'Temperature Bottle', size: null, color: 'Signature' },
    { name: 'Temperature Bottle', size: null, color: 'molar' },
    { name: 'Tote Bag', size: null, color: 'molar' },
    { name: 'Tote Bag', size: null, color: 'Propofol' },
    { name: 'Tote Bag', size: null, color: 'Dental' },
    { name: 'Tote Bag', size: null, color: 'Ecg White' },
    { name: 'Tote Bag', size: null, color: 'Ecg Black' },

    // Suiting White Coat
    { name: 'Suiting White Coat Men', size: 'XS', color: 'White' },
    { name: 'Suiting White Coat Men', size: 'S', color: 'White' },
    { name: 'Suiting White Coat Men', size: 'M', color: 'White' },
    { name: 'Suiting White Coat Men', size: 'L', color: 'White' },
    { name: 'Suiting White Coat Men', size: 'XL', color: 'White' },
    { name: 'Suiting White Coat Men', size: 'XXL', color: 'White' },
    { name: 'Suiting White Coat Men', size: 'C', color: 'White' },
    { name: 'Suiting White Coat Women', size: 'XS', color: 'White' },
    { name: 'Suiting White Coat Women', size: 'S', color: 'White' },
    { name: 'Suiting White Coat Women', size: 'M', color: 'White' },
    { name: 'Suiting White Coat Women', size: 'L', color: 'White' },
    { name: 'Suiting White Coat Women', size: 'XL', color: 'White' },
    { name: 'Suiting White Coat Women', size: 'XXL', color: 'White' },
    { name: 'Suiting White Coat Women', size: 'C', color: 'White' },

    // Wrinkle Free White Coat
    { name: 'Wrinkle Free White Coat Men', size: 'XS', color: 'White' },
    { name: 'Wrinkle Free White Coat Men', size: 'S', color: 'White' },
    { name: 'Wrinkle Free White Coat Men', size: 'M', color: 'White' },
    { name: 'Wrinkle Free White Coat Men', size: 'L', color: 'White' },
    { name: 'Wrinkle Free White Coat Men', size: 'XL', color: 'White' },
    { name: 'Wrinkle Free White Coat Men', size: 'XXL', color: 'White' },
    { name: 'Wrinkle Free White Coat Men', size: 'C', color: 'White' },
    { name: 'Wrinkle Free White Coat Women', size: 'XS', color: 'White' },
    { name: 'Wrinkle Free White Coat Women', size: 'S', color: 'White' },
    { name: 'Wrinkle Free White Coat Women', size: 'M', color: 'White' },
    { name: 'Wrinkle Free White Coat Women', size: 'L', color: 'White' },
    { name: 'Wrinkle Free White Coat Women', size: 'XL', color: 'White' },
    { name: 'Wrinkle Free White Coat Women', size: 'XXL', color: 'White' },
    { name: 'Wrinkle Free White Coat Women', size: 'C', color: 'White' },

    // Customized Designs
    { name: 'Customised Design (Black)', size: null, color: null },
    { name: 'Customised Design (Navy Blue)', size: null, color: null },
    { name: 'Customised Design (Royal Blue)', size: null, color: null },
    { name: 'Customised Design (Sky Blue)', size: null, color: null },
    { name: 'Customised Design (Splash Blue)', size: null, color: null },
    { name: 'Customised Design (Dark Grey)', size: null, color: null },
    { name: 'Customised Design (Silver Grey)', size: null, color: null },
    { name: 'Customised Design (Green)', size: null, color: null },
    { name: 'Customised Design (D. Green)', size: null, color: null },
    { name: 'Customised Design (Sage Green)', size: null, color: null },
    { name: 'Customised Design (Olive Green)', size: null, color: null },
    { name: 'Customised Design (Brown)', size: null, color: null },
    { name: 'Customised Design (Beige)', size: null, color: null },
    { name: 'Customised Design (Burgundy)', size: null, color: null },
    { name: 'Customised Design (Lavender)', size: null, color: null },
    { name: 'Customised Logo -Multiple Colors', size: null, color: null },
    { name: 'Customised Logo -Single Color', size: null, color: null },
    { name: 'Customised Name Cap Unisex', size: null, color: null },

    // Under Scrubs Unisex
    { name: 'Under Scrubs Unisex', size: 'S', color: 'White' },
    { name: 'Under Scrubs Unisex', size: 'M', color: 'White' },
    { name: 'Under Scrubs Unisex', size: 'L', color: 'White' },
    { name: 'Under Scrubs Unisex', size: 'XL', color: 'White' },
    { name: 'Under Scrubs Unisex', size: 'S', color: 'Black' },
    { name: 'Under Scrubs Unisex', size: 'M', color: 'Black' },
    { name: 'Under Scrubs Unisex', size: 'L', color: 'Black' },
    { name: 'Under Scrubs Unisex', size: 'XL', color: 'Black' },
    { name: 'Under Scrubs Unisex', size: 'S', color: 'Navy' },
    { name: 'Under Scrubs Unisex', size: 'M', color: 'Navy' },
    { name: 'Under Scrubs Unisex', size: 'L', color: 'Navy' },
    { name: 'Under Scrubs Unisex', size: 'XL', color: 'Navy' }
  ];

  // Helper arrays for bulk generation patterns
  const newArticleColors = [
    'D. Green 2.0', 'Silver 2.0', 'Burgundy 2.0', 'Ivy Green', 'Purple', 'Camel',
    'Sky Blue', 'Brown', 'Variable Prints', 'Mehroon', 'Grey', 'Zinc', 'Royal',
    'Splash Black', 'Navy', 'White', 'Black', 'Navy Blue', 'Royal Blue', 'Splash Blue',
    'Dark Grey', 'Silver Grey', 'Green', 'D. Green', 'Sage Green', 'Olive Green',
    'Beige', 'Burgundy', 'Lavender', 'Pink', 'Navy Cossing', 'Black Crossing',
    'Summit Skirt Grey', 'Summit Navy', 'Summit Burgundy', 'Summit Skirt Navy',
    'Influential Grey', 'Grey 2'
  ];
  const newArticleSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  // Add bulk generated New Article variants
  for (const size of newArticleSizes) {
    for (const color of newArticleColors) {
      rawInput.push({ name: 'New Article', size, color });
    }
  }

  // Plain Cap Colors
  const plainCapColors = [
    'D. Green 2.0', 'Silver 2.0', 'Black Nova 2.0', 'Burgundy 2.0', 'Ivy Green', 'Purple',
    'Camel', 'Sky Blue', 'Brown', 'Variable Prints', 'Mehroon', 'Grey', 'Zinc', 'Royal',
    'Splash Black', 'OPG', 'Navy', 'White', 'Black', 'Navy Blue', 'Royal Blue', 'Splash Blue',
    'Dark Grey', 'Silver Grey', 'Green', 'D. Green', 'Sage Green', 'Olive Green', 'Beige',
    'Burgundy', 'Lavender', 'Pink', 'Navy Cossing', 'Black Crossing', 'Summit Skirt Grey',
    'Summit Navy', 'Summit Burgundy', 'Summit Skirt Navy', 'Influential Grey', 'Grey 2',
    'Influential Pink', 'Maternity', 'Maternity Black', 'Summit Executive', 'Grace',
    'Sprinter Influential Contrast', 'Influential Contrast', 'Lavander', 'Stormy', 'Ajrak Scrub',
    'Medical Logo Scrub', 'Molar', 'Propofol', 'Dental', 'ECG White', 'ECG Black', 'Graffiti',
    'ENT', 'Katamine', 'Neuro Surgery', 'Aurtho Joints', 'Ortho Joints', 'Blurry Lungs',
    'Neuro Surgery Colored', 'Neuro Surgery Black & White', 'Veterinary', 'Urologist Kidney',
    'Gynocology', 'Dentist', 'Sprinter Oncology', 'Pacman', 'Sprinter Ancient', 'Batman',
    'ABC Cap', 'Grey Nova', 'Customize', 'Crown Black', 'Crown Navy', 'Crown Grey',
    'Crown Burgundy', 'Crown Olive'
  ];
  for (const color of plainCapColors) {
    rawInput.push({ name: 'Plain Cap', size: null, color });
  }

  // Sprinter Cap Unisex
  const sprinterCapColors = [
    'ENT', 'Propofol', 'Katamine', 'Ortho Joints', 'Blurry Lungs', 'Neuro Surgery Colored',
    'Neuro Surgery Black & White', 'Veterinary', 'Dentist', 'Gynocology', 'Pacman',
    'Urologist Kidney', 'Batman', 'OPG', 'Flame Sprinter', 'Floral', 'Oncology',
    'Ancient Marking', 'Loony Tune', 'CT-Scan', 'Number Plate', 'The Mess', 'Pink Ribbon',
    'Ajruk', 'General Surgery', 'Cardiac Surgery', 'X-Ray', 'Brain', 'Bones Beige',
    'Bones Black n White', 'Neonatal - Paeds', 'Squid Games', 'Medical Logo Scrub', 'ECG Black'
  ];
  for (const color of sprinterCapColors) {
    rawInput.push({ name: 'Sprinter Cap Unisex', size: null, color });
  }

  // Sprinter E Print Men & Women
  const sprinterEPrintMen = ['Variable Prints', 'Ajrak Scrub', 'CT-Texture'];
  const sprinterEPrintWomen = ['Variable Prints', 'Ajrak Scrub', 'Medical Logo Scrub', 'Germicidal', 'Springy'];
  const stdSizes = ['XS', 'S', 'M', 'L', 'XL', 'C'];
  
  for (const size of stdSizes) {
    for (const color of sprinterEPrintMen) {
      rawInput.push({ name: 'Sprinter E Print Men', size, color });
    }
    for (const color of sprinterEPrintWomen) {
      rawInput.push({ name: 'Sprinter E Print Women', size, color });
    }
  }

  // Sprinter Explode Men & Women
  const explodeMenColors = [
    'Sky Blue', 'Brown', 'Mehroon', 'Grey', 'Royal', 'Zinc', 'Navy', 'White', 'Black',
    'Navy Blue', 'Royal Blue', 'Dark Grey', 'Silver Grey', 'Green', 'D. Green', 'Sage Green',
    'Olive Green', 'Beige', 'Burgundy', 'Lavender', 'Pink', 'Black Nova 2.0'
  ];
  const explodeWomenColors = [
    'Mehroon', 'Grey', 'Splash Black', 'Navy', 'Navy Blue', 'Dark Grey', 'Silver Grey',
    'Burgundy', 'Black', 'Green'
  ];
  const fullSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'C'];
  
  for (const size of fullSizes) {
    for (const color of explodeMenColors) {
      rawInput.push({ name: 'Sprinter Explode Men', size, color });
    }
    for (const color of explodeWomenColors) {
      rawInput.push({ name: 'Sprinter Explode Women', size, color });
    }
  }

  // Sprinter Gradient Men & Women
  const gradientMenColors = ['Mehroon', 'Grey', 'Navy', 'Green', 'CT-Testure', 'Brown', 'Purple'];
  const gradientWomenColors = ['Mehroon', 'Grey', 'Navy', 'Purple', 'Tea Pink'];
  for (const size of fullSizes) {
    for (const color of gradientMenColors) {
      rawInput.push({ name: 'Sprinter Gradient Men', size, color });
    }
  }
  for (const size of ['XS', 'S', 'M', 'L', 'XL', 'C']) {
    for (const color of gradientWomenColors) {
      rawInput.push({ name: 'Sprinter Gradient Women', size, color });
    }
  }

  // Sprinter Joggers Men & Women
  const joggerColors = ['Black', 'Navy', 'Grey', 'Burgundy', 'Green'];
  for (const size of fullSizes) {
    for (const color of joggerColors) {
      rawInput.push({ name: 'Sprinter Joggers Men', size, color });
    }
  }
  for (const size of ['S', 'M', 'L', 'XL']) {
    for (const color of joggerColors) {
      rawInput.push({ name: 'Sprinter Joggers Women', size, color });
    }
  }

  // Sprinter Men & Women (Extra Custom Lists)
  const extraSprinterColors = [
    'Black', 'Navy Blue', 'Royal Blue', 'Sky Blue', 'Splash Blue', 'Dark Grey', 'Silver Grey',
    'Green', 'D. Green', 'Sage Green', 'Olive Green', 'Beige', 'Burgundy', 'Lavender', 'Pink',
    'Black Nova 2.0', 'D. Green 2.0', 'Silver 2.0', 'Burgundy 2.0', 'Ivy Green', 'Purple',
    'Camel', 'Brown', 'Royal', 'Zinc', 'Grey', 'White', 'Variable Prints', 'Mehroon', 'Rust'
  ];
  for (const size of fullSizes) {
    for (const color of extraSprinterColors) {
      rawInput.push({ name: 'Sprinter Men', size, color });
    }
  }

  const extraSprinterWomenColors = [
    'Black', 'Navy Blue', 'Royal Blue', 'Sky Blue', 'Splash Blue', 'Dark Grey', 'Silver Grey',
    'Green', 'D. Green', 'Sage Green', 'Olive Green', 'Brown', 'Beige', 'Burgundy', 'Grace',
    'Influential Contrast', 'Lavander', 'Maternity', 'Stormy', 'Influental Leaf', 'Rust', 'Sea Green',
    'Lavender', 'Pink', 'Black Nova 2.0', 'D. Green 2.0', 'Silver 2.0', 'Burgundy 2.0', 'Ivy Green',
    'Purple', 'Camel'
  ];
  for (const size of fullSizes) {
    for (const color of extraSprinterWomenColors) {
      rawInput.push({ name: 'Sprinter Women', size, color });
    }
  }

  // Sprinter Nova Men & Women
  const novaMenColors = ['Black', 'Navy', 'Grey', 'Pink', 'black nova 2.0'];
  const novaWomenColors = ['Black', 'Navy', 'Pink', 'Influential Grey', 'Grey 2', 'Influential pink'];
  for (const size of fullSizes) {
    for (const color of novaMenColors) {
      rawInput.push({ name: 'Sprinter Nova Men', size, color });
    }
    for (const color of novaWomenColors) {
      rawInput.push({ name: 'Sprinter Nova Women', size, color });
    }
  }

  // Trender / Trender Jackets & Jack-Sets
  const trenders = [
    'Trender Men', 'Trender Women', 'Trender Jack-Set 3pcs Men', 'Trender Jack-Set 3pcs Women',
    'Trender Jack-Set Men', 'Trender Jack-Set Women', 'Trender Jacket Men', 'Trender Jacket Women'
  ];
  const trenderColors = ['Black', 'Navy', 'Green', 'Royal', 'Grey'];
  for (const tName of trenders) {
    for (const size of fullSizes) {
      for (const color of trenderColors) {
        rawInput.push({ name: tName, size, color });
      }
    }
  }

  // Velora
  const veloraColors = ['Black', 'Navy', 'Burgundy', 'Grey'];
  const vSizes = ['XS', 'S', 'M', 'L', 'XL', 'C'];
  for (const size of vSizes) {
    for (const color of veloraColors) {
      rawInput.push({ name: 'Velora Long Skirt Scrubs Women', size, color });
    }
  }

  const veloraMenColors = ['Black', 'Navy', 'Burgundy', 'Grey', 'Summit Grey', 'Summit burgundy', 'Rust'];
  for (const size of vSizes) {
    for (const color of veloraMenColors) {
      rawInput.push({ name: 'Velora Men', size, color });
    }
  }

  const veloraWomenColors = [
    'Black', 'Navy', 'Burgundy', 'Grey', 'Summit Skirt Grey', 'Summit Navy',
    'Summit burgundy', 'Summit Skirt Navy', 'Rust', 'Ivy Green'
  ];
  for (const size of vSizes) {
    for (const color of veloraWomenColors) {
      rawInput.push({ name: 'Velora Women', size, color });
    }
  }

  // Group items by unique product name to build clean JSON variants array
  const grouped = {};
  for (const item of rawInput) {
    const key = item.name.trim();
    if (!grouped[key]) {
      grouped[key] = {
        name: key,
        category: getCategory(key),
        variants: []
      };
    }
    // Only push if size/color combo doesn't exist yet
    const exists = grouped[key].variants.some(v => v.size === item.size && v.color === item.color);
    if (!exists) {
      grouped[key].variants.push({
        color: item.color || null,
        size: item.size || null,
        stock: 0,
        price: null
      });
    }
  }

  console.log(`Grouped into ${Object.keys(grouped).length} unique products.`);

  // Create products and variants
  let createdCount = 0;
  for (const key of Object.keys(grouped)) {
    const p = grouped[key];
    
    let dbItem;
    // Check if item already exists in DB
    const existing = await prisma.inventoryItem.findFirst({
      where: { name: { equals: p.name, mode: 'insensitive' } }
    });

    if (existing) {
      dbItem = existing;
      console.log(`Product "${p.name}" already exists. Injecting variants...`);
    } else {
      dbItem = await prisma.inventoryItem.create({
        data: {
          name: p.name,
          category: p.category,
          stock: 0,
          price: p.name.includes('Shoes') ? 4500 : (p.name.includes('Cap') ? 500 : 2500),
          variants: p.variants
        }
      });
      createdCount++;
    }

    // Auto-create OutletVariants for all 3 outlets
    for (const outletName of OUTLETS) {
      for (const vd of p.variants) {
        const ovExists = await prisma.outletVariant.findFirst({
          where: {
            inventoryItemId: dbItem.id,
            outletName,
            color: vd.color,
            size: vd.size
          }
        });

        if (!ovExists) {
          let barcode = generateBarcode(dbItem.id, vd.size, vd.color);
          let attempt = 0;
          while (await prisma.outletVariant.findFirst({ where: { barcode, outletName } })) {
            attempt++;
            barcode = generateBarcode(dbItem.id, vd.size, vd.color, attempt);
          }

          await prisma.outletVariant.create({
            data: {
              inventoryItemId: dbItem.id,
              outletName,
              color: vd.color,
              size: vd.size,
              barcode,
              stock: 0,
              price: dbItem.price,
              isActive: true
            }
          });
        }
      }
    }
  }

  console.log(`\nImport complete! Created ${createdCount} new products. Auto-wired all 3 outlets.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
