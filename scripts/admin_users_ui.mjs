import http from 'http';
import { spawn } from 'child_process';
import { spawnSync } from 'child_process';

const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:18080/api/v1';
const CONTAINER = process.env.E2E_CONTAINER || '';
const SUPER_EMAIL = process.env.E2E_SUPER_EMAIL || 'admin@tbk.market';
const SUPER_PASSWORD = process.env.E2E_SUPER_PASSWORD || '';
const SUSPENDED_EMAIL = process.env.ADM_UI_SUSPENDED_EMAIL || '';
const WEB_HOST = process.env.ADM_UI_WEB_HOST || 'http://localhost:5174';

const results = [];
function assert(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
    results.push({ name, pass: true });
  } else {
    console.error(`[FAIL] ${name} - ${details}`);
    results.push({ name, pass: false, details });
  }
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const base = new URL(API_BASE);
    const urlPath = (base.pathname.endsWith('/') ? base.pathname : base.pathname + '/') + path.replace(/^\//, '');
    const full = new URL(urlPath, base.origin);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: full.hostname,
      port: full.port || 80,
      path: full.pathname + full.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        let parsed = null;
        try { parsed = chunks ? JSON.parse(chunks) : null; } catch { parsed = chunks; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function dockerLogs() {
  if (!CONTAINER) return '';
  try {
    const r = spawnSync('docker', ['logs', CONTAINER], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
    return (r.stdout || '') + (r.stderr || '');
  } catch { return ''; }
}

function tokenFromLog(logs, email, marker) {
  const matches = [];
  let idx = logs.indexOf(email);
  while (idx !== -1) {
    const line = logs.slice(idx, idx + 1500);
    const m = line.match(/token=([0-9a-f]{64})/);
    if (m) matches.push(m[1]);
    idx = logs.indexOf(email, idx + 1);
  }
  if (matches.length) return matches[matches.length - 1];
  return null;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForPort(port, retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const ok = await new Promise((res, rej) => {
        const r = http.get(`http://127.0.0.1:${port}/json/version`, resp => {
          if (resp.statusCode === 200) res(true); else res(false);
        });
        r.on('error', () => res(false));
      });
      if (ok) return true;
    } catch {}
    await sleep(500);
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
          this.pageErrors.push(data.params.exceptionDetails);
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
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  }
  close() { if (this.ws) this.ws.close(); }
}

async function run() {
  console.log('=== ADMIN USERS UI BROWSER VERIFICATION ===\n');

  // 1. Superadmin login
  const login = await request('POST', '/admin/auth/login', { email: SUPER_EMAIL, password: SUPER_PASSWORD });
  assert('SUPER_ADMIN API Login', login.status === 200 && !!login.data?.data?.access_token, `${login.status}`);
  const superH = { Authorization: `Bearer ${login.data.data.access_token}` };

  // 2. Invite + activate a second admin, then suspend it so the page shows both statuses.
  let suspendedAdminId = null;
  if (SUSPENDED_EMAIL) {
    const inv = await request('POST', '/admin/admin-users/invite', {
      first_name: 'E2E', last_name: 'Suspended', email: SUSPENDED_EMAIL, role: 'COMMERCE_ADMIN',
    }, superH);
    assert('Invite second admin', inv.status === 201 && !!inv.data?.data?.id, `${inv.status} ${JSON.stringify(inv.data)}`);
    suspendedAdminId = inv.data?.data?.id;

    const invitePassword = `Inv!${Date.now().toString(36)}Ab9!`;
    const logs = dockerLogs();
    const t = tokenFromLog(logs, SUSPENDED_EMAIL, 'Admin Invitation');
    if (t) {
      const verify = await request('GET', `/admin/invitations/verify?token=${t}`);
      const act = await request('POST', '/admin/invitations/activate', { token: t, password: invitePassword, password_confirmation: invitePassword });
      assert('Activate second admin', act.status === 200, `${act.status} ${JSON.stringify(act.data)}`);
      const susp = await request('POST', `/admin/admin-users/${suspendedAdminId}/suspend`, { reason: 'AdminUI browser verification' }, superH);
      assert('Suspend second admin', susp.status === 200, `${susp.status} ${JSON.stringify(susp.data)}`);
    } else {
      assert('Second admin activation token found', false, SUSPENDED_EMAIL);
    }
  }

  // 3. Confirm the list API returns ACTIVE + SUSPENDED rows.
  const list = await request('GET', '/admin/admin-users?limit=50', null, superH);
  const admins = Array.isArray(list.data?.data?.admins) ? list.data.data.admins
    : (Array.isArray(list.data?.admins) ? list.data.admins
      : (Array.isArray(list.data?.data) ? list.data.data : []));
  const superRow = admins.find(a => a.email === SUPER_EMAIL);
  const suspendedRow = admins.find(a => a.email === SUSPENDED_EMAIL);
  assert('List API has ACTIVE superadmin', !!superRow && superRow.status === 'ACTIVE', JSON.stringify(superRow));
  assert('List API has SUSPENDED admin', !!suspendedRow && suspendedRow.status === 'SUSPENDED', JSON.stringify(suspendedRow));

  // 4. Browser: launch Chrome headless + CDP.
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\Dell\\AppData\\Local\\Temp\\ch-admui-' + Date.now(),
    'about:blank'
  ]);
  const ready = await waitForPort(9222);
  if (!ready) { chromeProc.kill(); throw new Error('Chrome CDP not ready'); }
  const wsUrl = await getCDPTarget();
  const client = new CDPClient(wsUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  await client.send('Page.navigate', { url: `${WEB_HOST}/admin/login` });
  await sleep(2000);
  await client.eval(`
    localStorage.setItem('btmi.admin.access', '${login.data.data.access_token}');
    localStorage.setItem('btmi.admin.refresh', '${login.data.data.refresh_token || ''}');
  `);
  console.log('Injected admin tokens, navigating to Admin Users page...');

  await client.send('Page.navigate', { url: `${WEB_HOST}/admin/admin-users` });
  await sleep(3500);

  const bodyText = (await client.eval('document.body.innerText')) || '';
  const crash = bodyText.includes('Something went wrong') || client.pageErrors.length > 0;
  assert('Admin Users page renders without crash', !crash, `${client.pageErrors.length} runtime exceptions`);

  const showsSuperEmail = bodyText.includes(SUPER_EMAIL);
  const showsSuspendedEmail = !SUSPENDED_EMAIL || bodyText.includes(SUSPENDED_EMAIL);
  assert('Page lists ACTIVE superadmin email', showsSuperEmail, bodyText.slice(0, 300));
  assert('Page lists SUSPENDED admin email', showsSuspendedEmail, bodyText.slice(0, 300));

  // ACTIVE + SUSPENDED status chips both visible (upper-cased text).
  const statusTokens = bodyText.toUpperCase().split(/\s+/);
  assert('Page shows ACTIVE badge', statusTokens.includes('ACTIVE'), bodyText.slice(0, 400));
  assert('Page shows SUSPENDED badge', statusTokens.includes('SUSPENDED'), bodyText.slice(0, 400));
  if (suspendedAdminId) {
    const hasReactivate = bodyText.includes('Reactiver') || bodyText.includes('Réactiver') || bodyText.includes('Reactivate');
    assert('SUSPENDED row offers reactivate action', hasReactivate, bodyText.slice(0, 500));
  }

  // Log the visible table for evidence.
  const tableSnippet = await client.eval(`Array.from(document.querySelectorAll('tr')).slice(0, 12).map(tr => tr.innerText).join(' | ').slice(0, 1200)`);
  console.log(`[Table evidence] ${tableSnippet}`);

  client.close();
  chromeProc.kill();

  const allPassed = results.every(r => r.pass);
  console.log(`\nADMIN USERS UI: ${results.filter(r => r.pass).length}/${results.length} CHECKS PASSED`);
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('AdminUI runner error:', err);
  process.exit(1);
});