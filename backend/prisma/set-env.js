const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CWD = path.resolve(__dirname, '..');
const SCOPE = 'sameerbutt056-1019s-projects';

// Write value to a temp file without any encoding issues
const dbUrl = 'postgresql://postgres.edundgyvenutxrzifwxz:HONDA03004679165%40@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true\u0026connection_limit=5\u0026pool_timeout=10\u0026sslmode=require';
const directUrl = 'postgresql://postgres.edundgyvenutxrzifwxz:HONDA03004679165%40@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require';
const jwtSecret = 'your_super_secret_jwt_key_123';

const vars = [
  { key: 'DATABASE_URL', value: dbUrl },
  { key: 'DIRECT_URL', value: directUrl },
  { key: 'JWT_SECRET', value: jwtSecret },
];

for (const v of vars) {
  const tmpFile = path.resolve(__dirname, `_env_${v.key}.tmp`);
  // Write without trailing newline
  fs.writeFileSync(tmpFile, v.value, 'utf8');
  
  try {
    // Use stdin redirect < file approach which avoids all pipe encoding issues
    const cmd = `vercel env add ${v.key} production --yes --scope ${SCOPE} < "${tmpFile}"`;
    console.log(`Setting ${v.key}...`);
    const out = execSync(cmd, { cwd: CWD, shell: 'cmd.exe', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`  ${v.key} OK`);
  } catch (e) {
    console.log(`  ${v.key} FAIL: ${e.message}`);
    console.log(`  stderr: ${e.stderr?.toString() || 'none'}`);
  }
  
  // Clean up temp file
  try { fs.unlinkSync(tmpFile); } catch(_) {}
}

console.log('Done');
