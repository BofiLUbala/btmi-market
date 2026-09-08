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
  console.log('=== TEST FRONTEND ERROR DISPLAY & NON-RELOAD ON 401 ===');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\Dell\\AppData\\Local\\Temp\\chrome-ui-test-' + Date.now(),
    'about:blank'
  ]);

  try {
    const ready = await waitForPort(9222);
    if (!ready) throw new Error('Chrome did not start on port 9222');

    const wsUrl = await getCDPTarget();
    const client = new CDPClient(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('1. Navigating to http://localhost:5173/admin/login...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/admin/login' });
    await new Promise(r => setTimeout(r, 2000));

    const title = await client.eval('document.title');
    const hasForm = await client.eval('!!document.querySelector("form")');
    console.log(`Page loaded: title="${title}", formFound=${hasForm}`);

    // Mark window object to detect if page unexpectedly unloads / refreshes
    await client.eval('window.__PAGE_STAYED_MOUNTED__ = true;');

    console.log('2. Filling form with wrong credentials...');
    await client.eval(`
      (() => {
        const emailEl = document.querySelector('#admin-email') || document.querySelector('input[type="email"]');
        const passEl = document.querySelector('#admin-password') || document.querySelector('input[type="password"]');
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        
        nativeSetter.call(emailEl, 'bofibendedji@gmail.com');
        emailEl.dispatchEvent(new Event('input', { bubbles: true }));
        emailEl.dispatchEvent(new Event('change', { bubbles: true }));

        nativeSetter.call(passEl, 'WrongPassword123!');
        passEl.dispatchEvent(new Event('input', { bubbles: true }));
        passEl.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `);

    console.log('3. Submitting form...');
    await client.eval(`
      (() => {
        const btn = document.querySelector('#admin-submit-btn') || document.querySelector('button[type="submit"]');
        btn.click();
      })()
    `);

    console.log('4. Waiting for 401 response and error alert to appear...');
    let errorText = null;
    let pageStayed = false;
    let emailValue = '';

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      errorText = await client.eval(`(() => {
        const el = document.querySelector('#admin-login-error') || document.querySelector('[role="alert"]');
        return el ? el.textContent : null;
      })()`);
      pageStayed = await client.eval('window.__PAGE_STAYED_MOUNTED__ === true');
      emailValue = await client.eval(`document.querySelector('input[type="email"]')?.value`);
      if (errorText) break;
    }

    console.log(`Results:`);
    console.log(`- Page stayed mounted (no accidental reload): ${pageStayed}`);
    console.log(`- Error alert text: "${errorText}"`);
    console.log(`- Email field retained: "${emailValue}"`);

    if (!pageStayed) {
      throw new Error('FAILED: The page refreshed or unmounted unexpectedly!');
    }
    if (!errorText) {
      throw new Error('FAILED: No error alert was displayed to the user!');
    }
    if (emailValue !== 'bofibendedji@gmail.com') {
      throw new Error(`FAILED: Email value was cleared or modified: ${emailValue}`);
    }

    console.log('\n>>> SUCCESS: Form handled 401 gracefully without page reload and clearly displayed the localized error alert! <<<');
    client.close();
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
