import http from 'http';
import { spawn } from 'child_process';

async function waitForPort(port, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const ok = await new Promise((res, rej) => {
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
    this.pageErrors = [];
    this.consoleErrors = [];
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
        } else if (data.method === 'Runtime.exceptionThrown') {
          console.error('[Browser Exception]', data.params.exceptionDetails);
          this.pageErrors.push(data.params.exceptionDetails);
        } else if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') {
          this.consoleErrors.push(data.params.entry.text);
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

async function run() {
  console.log('=== STARTING CHROME BROWSER RUNTIME VALIDATION ===\n');

  // 1. Get Super Admin Token via API
  console.log('1. Authenticating Admin via API for browser session...');
  const loginRes = await new Promise((resolve, reject) => {
    const req = http.request('http://localhost:8080/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ email: 'admin@tbk.market', password: 'SuperSecretAdmin2026!' }));
    req.end();
  });

  const accessToken = loginRes?.data?.access_token;
  const refreshToken = loginRes?.data?.refresh_token;
  if (!accessToken) {
    throw new Error('Failed to obtain admin token: ' + JSON.stringify(loginRes));
  }
  console.log('Admin authenticated successfully.');

  // 2. Launch Chrome
  console.log('Launching Chrome in headless mode with CDP...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\Dell\\AppData\\Local\\Temp\\chrome-test-profile-' + Date.now(),
    'about:blank'
  ]);

  const ready = await waitForPort(9222);
  if (!ready) {
    chromeProc.kill();
    throw new Error('Chrome did not open remote debugging port 9222 in time');
  }

  const wsUrl = await getCDPTarget();
  console.log('Connecting to Chrome target:', wsUrl);
  const client = new CDPClient(wsUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');

  // Navigate to Web app base URL to set localStorage tokens
  console.log('Navigating to http://localhost:5173/admin/login...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/login' });
  await new Promise(r => setTimeout(r, 2000));

  // Inject authentication into localStorage
  await client.eval(`
    localStorage.setItem('btmi.admin.access', '${accessToken}');
    localStorage.setItem('btmi.admin.refresh', '${refreshToken}');
  `);
  console.log('Injected admin tokens into browser localStorage.');

  // Target pages to verify
  const pagesToTest = [
    {
      name: 'Product Quality Page',
      url: 'http://localhost:5173/admin/commerce/marketplace/quality',
      expectedHeader: 'Product Card Quality'
    },
    {
      name: 'Promotion Visibility Page',
      url: 'http://localhost:5173/admin/commerce/marketplace/promotions',
      expectedHeader: 'Promotion Visibility'
    },
    {
      name: 'Search Admin Page',
      url: 'http://localhost:5173/admin/commerce/marketplace/search',
      expectedHeader: 'Search Admin'
    },
    {
      name: 'Category Performance Page',
      url: 'http://localhost:5173/admin/commerce/performance/categories',
      expectedHeader: 'Category Performance'
    },
    {
      name: 'Shop Performance Page',
      url: 'http://localhost:5173/admin/commerce/performance/shops',
      expectedHeader: 'Shop Performance'
    },
    {
      name: 'Commerce Orders Page',
      url: 'http://localhost:5173/admin/commerce/orders',
      expectedHeader: 'Orders'
    },
    {
      name: 'Commerce Inventory Page',
      url: 'http://localhost:5173/admin/commerce/inventory',
      expectedHeader: 'Inventory'
    }
  ];

  const results = [];

  for (const page of pagesToTest) {
    console.log(`\n--- Testing ${page.name} (${page.url}) ---`);
    client.pageErrors = [];
    client.consoleErrors = [];

    await client.send('Page.navigate', { url: page.url });
    await new Promise(r => setTimeout(r, 2500));

    const pageTitle = await client.eval(`document.title`);
    const pageHeading = await client.eval(`document.querySelector('h2')?.innerText || document.querySelector('h1')?.innerText || ''`);
    const bodyText = await client.eval(`document.body.innerText`);
    const hasCrash = bodyText.includes('Something went wrong') || bodyText.includes('Cannot read properties of undefined') || client.pageErrors.length > 0;

    const hasExpectedHeader = bodyText.toLowerCase().includes(page.expectedHeader.toLowerCase()) || pageHeading.toLowerCase().includes(page.expectedHeader.toLowerCase());

    console.log(`Heading: "${pageHeading}"`);
    console.log(`Page Title: "${pageTitle}"`);
    console.log(`Body excerpt: "${bodyText.substring(0, 150).replace(/\\n/g, ' ')}..."`);
    console.log(`Runtime Exceptions: ${client.pageErrors.length}`);

    if (hasExpectedHeader && !hasCrash) {
      console.log(`[PASS] ${page.name} rendered cleanly in browser`);
      results.push({ name: page.name, pass: true });
    } else {
      console.error(`[FAIL] ${page.name} failed verification! Crashed: ${hasCrash}, FoundHeader: ${hasExpectedHeader}`);
      results.push({ name: page.name, pass: false, error: client.pageErrors });
    }
  }

  client.close();
  chromeProc.kill();

  console.log('\n==========================================');
  const allPassed = results.every(r => r.pass);
  console.log(`BROWSER VERIFICATION: ${results.filter(r => r.pass).length}/${results.length} PAGES PASSED`);
  if (allPassed) {
    console.log('ALL ADMIN RUNTIME PAGES RENDERED SUCCESSFULLY WITHOUT CRASH!');
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Browser runner error:', err);
  process.exit(1);
});
