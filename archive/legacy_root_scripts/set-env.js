const { execSync } = require('child_process');
const path = require('path');

const CWD = path.resolve(__dirname);
const SCOPE = 'sameerbutt056-1019s-projects';

const dbUrl = 'postgresql://postgres.edundgyvenutxrzifwxz:HONDA03004679165%40@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10&sslmode=require';

const vars = [
  { key: 'DATABASE_URL', value: dbUrl },
  { key: 'DIRECT_URL', value: 'postgresql://postgres.edundgyvenutxrzifwxz:HONDA03004679165%40@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require' },
  { key: 'JWT_SECRET', value: 'your_super_secret_jwt_key_123' },
];

for (const v of vars) {
  try {
    const cmd = `cmd.exe /c echo ${v.value} | vercel env add ${v.key} production --yes --scope ${SCOPE}`;
    console.log(`Setting ${v.key}...`);
    const out = execSync(cmd, { cwd: CWD, shell: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`  ${v.key} OK`);
  } catch (e) {
    console.log(`  ${v.key} FAIL: ${e.message}`);
  }
}
console.log('Done');
