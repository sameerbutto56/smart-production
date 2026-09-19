const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== SYSTEM SYNTAX & INTEGRITY AUDIT ===\n');

function checkDir(dir) {
  let errors = 0;
  let count = 0;
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      const res = checkDir(full);
      errors += res.errors;
      count += res.count;
    } else if (f.endsWith('.js') || f.endsWith('.cjs')) {
      count++;
      try {
        execSync(`node --check "${full}"`);
      } catch (e) {
        console.error(`✗ Syntax error in: ${full}`);
        errors++;
      }
    }
  }
  return { errors, count };
}

const backendRes = checkDir(path.resolve(__dirname, '../src'));
console.log(`Backend files checked: ${backendRes.count}, Syntax errors: ${backendRes.errors}`);

if (backendRes.errors === 0) {
  console.log('✓ All backend files have valid syntax.');
} else {
  console.error(`✗ Found ${backendRes.errors} syntax errors!`);
}
