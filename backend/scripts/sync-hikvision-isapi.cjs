/**
 * Hikvision DS-K1T342MFWX ISAPI Historical Punch Extractor & Sync Bridge
 * Usage:
 *   node backend/scripts/sync-hikvision-isapi.cjs --ip=192.168.1.100 --user=admin --pass=Enamel12312 --from=2026-09-01
 */

const http = require('http');
const https = require('https');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v;
  return acc;
}, {});

const DEVICE_IP = args.ip || process.env.HIKVISION_IP || '192.168.1.100';
const DEVICE_PORT = parseInt(args.port || process.env.HIKVISION_PORT || '80', 10);
const DEVICE_USER = args.user || process.env.HIKVISION_USER || 'admin';
const DEVICE_PASS = args.pass || process.env.HIKVISION_PASS || '';
const FROM_DATE = args.from || '2026-09-01';
const TO_DATE = args.to || new Date().toISOString().slice(0, 10);
const API_URL = args.api || 'https://smart-production-v2.vercel.app/api/biometric/sync-batch';

console.log('=== HIKVISION ISAPI HISTORICAL PUNCH SYNC BRIDGE ===');
console.log(`Device IP: ${DEVICE_IP}:${DEVICE_PORT}`);
console.log(`Date Range: ${FROM_DATE} to ${TO_DATE}`);
console.log(`Target Sync API: ${API_URL}`);

async function queryDeviceEvents() {
  const postData = JSON.stringify({
    AcsEventCond: {
      searchID: "1",
      searchResultPosition: 0,
      maxResults: 1000,
      major: 5,
      minor: 0,
      startTime: `${FROM_DATE}T00:00:00+05:00`,
      endTime: `${TO_DATE}T23:59:59+05:00`
    }
  });

  console.log(`Querying ISAPI endpoint /ISAPI/AccessControl/AcsEvent?format=json ...`);

  return new Promise((resolve) => {
    const authHeader = 'Basic ' + Buffer.from(`${DEVICE_USER}:${DEVICE_PASS}`).toString('base64');
    const options = {
      hostname: DEVICE_IP,
      port: DEVICE_PORT,
      path: '/ISAPI/AccessControl/AcsEvent?format=json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': authHeader
      },
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ success: true, data: json });
        } catch (e) {
          resolve({ success: false, error: 'Failed to parse JSON response', raw: data.slice(0, 500) });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Connection to device timed out' });
    });

    req.write(postData);
    req.end();
  });
}

async function uploadToBackend(punches) {
  const payload = JSON.stringify({
    machineId: 'DS-K1T342MFWX',
    source: 'MACHINE',
    punches
  });

  return new Promise((resolve) => {
    const isHttps = API_URL.startsWith('https:');
    const client = isHttps ? https : http;
    const urlObj = new URL(API_URL);

    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, raw: data });
        }
      });
    });

    req.on('error', err => resolve({ success: false, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const result = await queryDeviceEvents();
  if (!result.success) {
    console.log(`Could not reach device directly via LAN: ${result.error}`);
    console.log(`Note: If device is on local LAN without direct inbound connectivity, export events via Web GUI or run this script from an in-office PC connected to the same router as the Hikvision terminal.`);
    return;
  }

  const events = result.data?.AcsEvent?.InfoList || [];
  console.log(`Retrieved ${events.length} events from device.`);

  const punches = events.map(e => ({
    machineUserId: String(e.employeeNoString || e.cardNo || ''),
    name: e.name || '',
    timestamp: e.time,
    verifyMode: e.currentVerifyMode || 'BIOMETRIC',
    transactionId: String(e.serialNo || '')
  })).filter(p => p.machineUserId && p.timestamp);

  console.log(`Filtered ${punches.length} valid employee attendance punches.`);
  console.log('Uploading punches to Central Server...');

  const uploadRes = await uploadToBackend(punches);
  console.log('Sync Response:', uploadRes);
}

main().catch(console.error);
