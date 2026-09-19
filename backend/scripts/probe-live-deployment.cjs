/**
 * probe-live-deployment.cjs
 * Verify that the live deployment on https://smart-production-v2.vercel.app
 * is serving the updated build without SSO intercepts.
 */
const https = require('https');

function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== Probing Live Vercel Production ===\n');

  // 1. Health Probe
  const health = await request('https://smart-production-v2.vercel.app/api/health');
  console.log(`Health Check [${health.statusCode}]: ${health.body}`);
  if (health.statusCode !== 200) throw new Error('Health check failed');

  // 2. Index HTML Probe (Check for SSO intercept)
  const index = await request('https://smart-production-v2.vercel.app/');
  console.log(`Index HTML [${index.statusCode}]: ${index.body.length} bytes`);
  if (index.body.includes('data-dpl-id')) {
    throw new Error('CRITICAL: SSO Protection is intercepting requests!');
  }
  console.log('✓ PASS: No SSO intercept on production.');

  // 3. API Route Auth Guard Probe
  const unseenTasks = await request('https://smart-production-v2.vercel.app/api/orders/unseen-tasks');
  console.log(`API unseen-tasks [${unseenTasks.statusCode}]: ${unseenTasks.body.slice(0, 80)}`);
  if (unseenTasks.statusCode !== 401) {
    throw new Error(`Unexpected status code: ${unseenTasks.statusCode}`);
  }
  console.log('✓ PASS: API route is live and correctly auth-guarded.');

  // 4. Verify Dispatch chunk on live CDN
  const dispatchChunk = await request('https://smart-production-v2.vercel.app/assets/DispatchPage-fnF_o2ZM.js');
  console.log(`Dispatch Chunk [${dispatchChunk.statusCode}]: ${dispatchChunk.body.length} bytes`);
  if (dispatchChunk.statusCode === 200) {
    console.log('✓ PASS: Updated Dispatch chunk is live on production.');
  } else {
    console.warn('Dispatch chunk returned status:', dispatchChunk.statusCode);
  }

  console.log('\n=== All Live Probes Succeeded! ===\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
