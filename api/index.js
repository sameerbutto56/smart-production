const { execSync } = require('child_process');
const path = require('path');

try {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.join(__dirname, '..', 'backend'),
    stdio: 'pipe',
    timeout: 30000,
  });
} catch (_e) {
  // non-fatal — app can still start, PosBookSession queries will fail gracefully
}

const app = require('../backend/src/app');

module.exports = app;
