import http from 'http';
import { spawn } from 'child_process';

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
    this.pageErrors = [];
    this.consoleErrors = [];
    this.networkErrors = [];
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
        } else if (data.method === 'Network.responseReceived') {
          const resp = data.params.response;
          if (resp.status === 401 && resp.url.includes('/api/v1/admin/auth/login')) {
            this.networkErrors.push(`401 Unauthorized on ${resp.url}`);
          }
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
  console.log('=== STARTING REAL BROWSER LOGIN TEST ===\n');

  console.log('Launching Chrome in headless mode with CDP...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\Dell\\AppData\\Local\\Temp\\chrome-login-test-' + Date.now(),
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
  await client.send('Network.enable');

  console.log('1. Navigating to http://localhost:5173/admin/login...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/login' });
  await new Promise(r => setTimeout(r, 2000));

  // Check login page elements
  const loginTitle = await client.eval(`document.title`);
  const formExists = await client.eval(`!!document.querySelector('form')`);
  const emailInput = await client.eval(`!!document.querySelector('input[type="email"]')`);
  const passwordInput = await client.eval(`!!document.querySelector('input[type="password"]')`);
  console.log(`Login page loaded: title="${loginTitle}", form=${formExists}, emailInput=${emailInput}, passwordInput=${passwordInput}`);

  if (!emailInput || !passwordInput) {
    throw new Error('Email or password input not found on /admin/login');
  }

  console.log('2. Entering credentials for admin@tbkmarket.com (alias)...');
  await client.eval(`
    (() => {
      const emailEl = document.querySelector('input[type="email"]');
      const passEl = document.querySelector('input[type="password"]');
      
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      
      nativeInputValueSetter.call(emailEl, 'admin@tbkmarket.com');
      emailEl.dispatchEvent(new Event('input', { bubbles: true }));
      emailEl.dispatchEvent(new Event('change', { bubbles: true }));
      
      nativeInputValueSetter.call(passEl, 'SuperSecretAdmin2026!');
      passEl.dispatchEvent(new Event('input', { bubbles: true }));
      passEl.dispatchEvent(new Event('change', { bubbles: true }));
    })()
  `);

  await new Promise(r => setTimeout(r, 500));

  console.log('3. Submitting login form...');
  await client.eval(`
    (() => {
      const submitBtn = document.querySelector('button[type="submit"]') || document.querySelector('form button');
      if (submitBtn) {
        submitBtn.click();
      } else {
        document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    })()
  `);

  // Wait for network response and redirect
  console.log('Waiting for authentication and redirect...');
  let redirected = false;
  let currentUrl = '';
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    currentUrl = await client.eval(`window.location.pathname`);
    if (currentUrl && currentUrl !== '/admin/login') {
      redirected = true;
      break;
    }
  }

  console.log(`Current URL after submit: ${currentUrl} (Redirected: ${redirected})`);

  // Wait for dashboard DOM to load
  await new Promise(r => setTimeout(r, 2000));

  const bodyText = await client.eval(`document.body.innerText`);
  const navItems = await client.eval(`
    Array.from(document.querySelectorAll('a, button, nav *'))
      .map(el => el.innerText?.trim())
      .filter(Boolean)
  `);

  console.log('Current Page Nav/Action Items:', navItems.slice(0, 20));

  // Check for Super Admin Navigation elements
  const hasAdminUsers = bodyText.toLowerCase().includes('admin user') || 
                        navItems.some(item => item.toLowerCase().includes('admin user') || item.toLowerCase().includes('administrateur'));
  const hasDirectionNav = currentUrl.includes('/admin/direction') || 
                          navItems.some(item => item.toLowerCase().includes('direction') || item.toLowerCase().includes('super_admin'));

  console.log(`\n--- Verification Results ---`);
  console.log(`Redirect after login: ${redirected ? 'PASS' : 'FAIL'} (${currentUrl})`);
  console.log(`401 Network Errors: ${client.networkErrors.length === 0 ? 'PASS (0)' : 'FAIL: ' + client.networkErrors.join(', ')}`);
  console.log(`Console Errors: ${client.consoleErrors.length === 0 ? 'PASS (0)' : client.consoleErrors.length}`);
  console.log(`Admin Users Visible: ${hasAdminUsers ? 'PASS' : 'FAIL'}`);

  // Test clicking or navigating to Admin Users page (/admin/admin-users)
  console.log('\n4. Navigating to Admin Users page (/admin/admin-users)...');
  await client.send('Page.navigate', { url: 'http://localhost:5173/admin/admin-users' });
  await new Promise(r => setTimeout(r, 2000));

  const usersUrl = await client.eval(`window.location.pathname`);
  const usersBodyText = await client.eval(`document.body.innerText`);
  const usersHeading = await client.eval(`document.querySelector('h1, h2, h3')?.innerText || ''`);

  console.log(`Admin Users URL: ${usersUrl}`);
  console.log(`Admin Users Heading: "${usersHeading}"`);
  console.log(`Admin Users Excerpt: "${usersBodyText.substring(0, 150).replace(/\\n/g, ' ')}..."`);
  const usersPageLoaded = !usersBodyText.includes('Page not found') && !usersBodyText.includes('403') && !usersBodyText.includes('Unauthorized');
  console.log(`Admin Users Page Access: ${usersPageLoaded ? 'PASS' : 'FAIL'}`);

  client.close();
  chromeProc.kill();

  if (redirected && client.networkErrors.length === 0 && usersPageLoaded) {
    console.log('\n>>> BROWSER LOGIN AND ADMIN ACCESS VERIFIED SUCCESSFULLY! <<<');
  } else {
    throw new Error('Browser login verification failed');
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
