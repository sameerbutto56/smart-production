const https = require('https');

async function testLiveApi() {
  // First login to get a JWT token
  const postData = JSON.stringify({
    email: 'admin@enamels.com',
    password: 'enamels1212',
    deviceId: 'test-device-id'
  });

  const loginOptions = {
    hostname: 'smart-production-v2.vercel.app',
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const token = await new Promise((resolve, reject) => {
    const req = https.request(loginOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed.token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  console.log("Logged in successfully! Token received.");

  // Fetch /api/dispatch-profile/orders?employeeName=Noman
  const getOptions = {
    hostname: 'smart-production-v2.vercel.app',
    path: '/api/dispatch-profile/orders?employeeName=Noman',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const response = await new Promise((resolve, reject) => {
    const req = https.request(getOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });

  console.log("\nLive API Response for Noman:");
  console.log(`Counts: unseen=${response.counts?.unseen}, seen=${response.counts?.seen}, active=${response.counts?.active}, alreadyStarted=${response.counts?.alreadyStarted}`);
  if (response.unseen && response.unseen.length > 0) {
    console.log(`First 10 Unseen Orders:`, response.unseen.slice(0, 10).map(o => o.orderNumber));
  } else {
    console.log("Unseen array is empty!", response);
  }
}

testLiveApi().catch(console.error);
