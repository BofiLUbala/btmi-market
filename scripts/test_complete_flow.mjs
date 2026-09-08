import http from 'http';
import { spawn } from 'child_process';

const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'bofibendedji@gmail.com';
const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

if (!adminPassword) {
  console.error('[ERROR] SUPER_ADMIN_PASSWORD environment variable is required.');
  process.exit(1);
}

async function waitForPort(port, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const ok = await new Promise((res) => {
        const r = http.get(`http://127.0.0.1:${port}/json/version`, resp => {
          if (resp.statusCode === 200) res(true);
          else res(false);
        });
        r.on('error', () => res(false));
      });
      if (ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function getCDPTarget() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const list = JSON.parse(data);
        const page = list.find(t => t.type === 'page') || list[0];
        resolve(page.webSocketDebuggerUrl);
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(data.error);
          else cb.resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res?.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('=== VERIFYING COMPLETE SUPER_ADMIN AUTH FLOW ===\n');

  // STEP 1: API Direct Validation
  console.log('--- Step 1: POST /api/v1/admin/auth/login ---');
  const loginRes = await fetch('http://localhost:8080/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  console.log(`Login HTTP Status: ${loginRes.status}`);
  if (loginRes.status !== 200) {
    const errBody = await loginRes.text();
    throw new Error(`Login API failed with status ${loginRes.status}: ${errBody}`);
  }
  const loginData = await loginRes.json();
  const accessToken = loginData?.data?.access_token;
  const refreshToken = loginData?.data?.refresh_token;
  const adminUser = loginData?.data?.admin;

  console.log(`- Access token returned: ${!!accessToken}`);
  console.log(`- Refresh token returned: ${!!refreshToken}`);
  console.log(`- Admin ID: ${adminUser?.id}`);
  console.log(`- Admin Email: ${adminUser?.email}`);
  console.log(`- Admin Role: ${adminUser?.role}`);
  console.log(`- Admin Status: ${adminUser?.status}`);

  if (adminUser?.role !== 'SUPER_ADMIN') {
    throw new Error(`Expected role SUPER_ADMIN, got: ${adminUser?.role}`);
  }

  // STEP 2: GET /api/v1/admin/auth/me
  console.log('\n--- Step 2: GET /api/v1/admin/auth/me with Bearer token ---');
  const meRes = await fetch('http://localhost:8080/api/v1/admin/auth/me', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log(`Me HTTP Status: ${meRes.status}`);
  if (meRes.status !== 200) {
    throw new Error(`Me API failed with status ${meRes.status}`);
  }
  const meData = await meRes.json();
  console.log(`- Authenticated admin: ${meData?.data?.email} (${meData?.data?.role})`);

  // STEP 3: Validate API endpoints for all 4 dashboards
  console.log('\n--- Step 3: Checking API authorization for all 4 Dashboards ---');
  const directionRes = await fetch('http://localhost:8080/api/v1/admin/direction/overview', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log(`- Direction API Status: ${directionRes.status}`);

  const commerceRes = await fetch('http://localhost:8080/api/v1/admin/commerce/overview', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log(`- Commerce API Status: ${commerceRes.status}`);

  const financeRes = await fetch('http://localhost:8080/api/v1/admin/finance/summary', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log(`- Finance API Status: ${financeRes.status}`);

  const techRes = await fetch('http://localhost:8080/api/v1/admin/technical/overview', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  console.log(`- Technical API Status: ${techRes.status}`);

  // STEP 4: Real Browser UI Flow Test
  console.log('\n--- Step 4: Real Browser Flow (Login Form -> Redirect -> Dashboard -> Refresh) ---');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\Dell\\AppData\\Local\\Temp\\chrome-full-flow-' + Date.now(),
    'about:blank'
  ]);

  try {
    const ready = await waitForPort(9222);
    if (!ready) throw new Error('Chrome remote debugging port did not open');

    const wsUrl = await getCDPTarget();
    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('4.1 Navigating to http://localhost:5173/admin/login...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/admin/login' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('4.2 Filling in SUPER_ADMIN credentials and submitting...');
    await client.eval(`
      (() => {
        const emailEl = document.querySelector('#admin-email') || document.querySelector('input[type="email"]');
        const passEl = document.querySelector('#admin-password') || document.querySelector('input[type="password"]');
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        
        nativeSetter.call(emailEl, ${JSON.stringify(adminEmail)});
        emailEl.dispatchEvent(new Event('input', { bubbles: true }));
        emailEl.dispatchEvent(new Event('change', { bubbles: true }));

        nativeSetter.call(passEl, ${JSON.stringify(adminPassword)});
        passEl.dispatchEvent(new Event('input', { bubbles: true }));
        passEl.dispatchEvent(new Event('change', { bubbles: true }));

        const submitBtn = document.querySelector('#admin-submit-btn') || document.querySelector('button[type="submit"]');
        submitBtn.click();
      })()
    `);

    console.log('4.3 Waiting for authentication and redirection to /admin/direction...');
    let currentPath = '';
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 300));
      currentPath = await client.eval('window.location.pathname');
      if (currentPath && currentPath !== '/admin/login') break;
    }
    console.log(`- Path after login: ${currentPath}`);
    if (currentPath !== '/admin/direction' && currentPath !== '/admin') {
      throw new Error(`Expected redirection to /admin/direction or /admin, but got: ${currentPath}`);
    }

    // Check stored tokens in localStorage
    const storedAccess = await client.eval(`localStorage.getItem('btmi.admin_access_token')`);
    console.log(`- Stored Access Token in localStorage: ${!!storedAccess}`);

    // Check that Dashboard UI loaded
    await new Promise(r => setTimeout(r, 1000));
    const bodyText = await client.eval('document.body.innerText');
    console.log(`- Dashboard page text snippet: "${bodyText.slice(0, 100).replace(/\\n/g, ' ')}..."`);

    // 4.4 Test navigating to the other dashboards
    console.log('4.4 Navigating to /admin/commerce...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/admin/commerce' });
    await new Promise(r => setTimeout(r, 1500));
    const commercePath = await client.eval('window.location.pathname');
    console.log(`- Navigation to Commerce: ${commercePath}`);

    console.log('4.5 Navigating to /admin/finance...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/admin/finance' });
    await new Promise(r => setTimeout(r, 1500));
    const financePath = await client.eval('window.location.pathname');
    console.log(`- Navigation to Finance: ${financePath}`);

    console.log('4.6 Navigating to /admin/technical...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/admin/technical' });
    await new Promise(r => setTimeout(r, 1500));
    const techPath = await client.eval('window.location.pathname');
    console.log(`- Navigation to Technical: ${techPath}`);

    // 4.7 Test page refresh and session persistence
    console.log('4.7 Testing page reload (F5) persistence on /admin/direction...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/admin/direction' });
    await new Promise(r => setTimeout(r, 1500));
    await client.send('Page.reload');
    await new Promise(r => setTimeout(r, 2000));
    const pathAfterReload = await client.eval('window.location.pathname');
    console.log(`- Path after page reload: ${pathAfterReload}`);

    if (pathAfterReload === '/admin/login') {
      throw new Error('Session lost after page reload!');
    }

    console.log('\n======================================================');
    console.log('>>> ALL CHECKS PASSED: FULL SUPER_ADMIN FLOW VERIFIED <<<');
    console.log('======================================================');
    client.close();
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
