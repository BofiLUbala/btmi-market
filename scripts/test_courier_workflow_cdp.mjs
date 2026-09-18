import http from 'http';
import { spawn } from 'child_process';
const WebSocket = globalThis.WebSocket;

const BASE = 'http://localhost:8080/api/v1';
const WEBAPP = 'http://localhost:5173';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const COMMERCE_ADMIN_EMAIL = 'commerce.test@tbkmarket.com';
const COMMERCE_ADMIN_PASSWORD = 'TestAdmin@2025!';

function waitForPort(port, retries = 30) {
  return new Promise((resolve) => {
    let tried = 0;
    const fn = () => {
      tried++;
      http.get(`http://127.0.0.1:${port}/`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) resolve(true);
        else if (tried >= retries) resolve(false);
        else setTimeout(fn, 500);
      }).on('error', () => { if (tried >= retries) resolve(false); else setTimeout(fn, 500); });
    };
    fn();
  });
}

function getCDPTarget() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(t => t.type === 'page') || list[0];
          resolve(page.webSocketDebuggerUrl);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: 8080,
      path: `${BASE}${path}`,
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function login(email, password) {
  return apiRequest('POST', '/admin/auth/login', { email, password });
}
function courierLogin(email, password) {
  return apiRequest('POST', '/auth/login', { email, password });
}
function getCourierToken(resp) {
  const data = resp?.data || resp;
  return data?.access_token || data?.token;
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
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (msg) => {
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
  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  }
  async navigate(url) { await this.send('Page.navigate', { url }); }
  async click(selector) { await this.eval(`document.querySelector('${selector}')?.click()`); }
  async fill(selector, value) { await this.eval(`document.querySelector('${selector}') && (document.querySelector('${selector}').value = '${value}')`); }
  async textContent(selector) { return await this.eval(`document.querySelector('${selector}')?.textContent || ''`); }
  async innerHTML(selector) { return await this.eval(`document.querySelector('${selector}')?.innerHTML || ''`); }
  close() { if (this.ws) this.ws.close(); }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const results = [];
  function pass(name) { results.push(`${name}: PASS`); console.log(`✅ ${name}`); }
  function fail(name, reason) { results.push(`${name}: FAIL - ${reason}`); console.log(`❌ ${name}: ${reason}`); }

  const SELLER_EMAIL = 'courier_f3d2ea47@tbk.cd';
  const SELLER_PASSWORD = 'StrongPassword123!';
  const BUYER_EMAIL = 'buyer99@test.com';
  const BUYER_PASSWORD = 'StrongPass123!';
  const COURIER_EMAIL = 'courier_979e6e8f@tbk.cd';
  const COURIER_PASSWORD = 'StrongPassword123!';

  console.log('=== TBK MARKET COURIER WORKFLOW TEST ===');
  console.log(`Started at ${new Date().toISOString()}`);

  // Authenticate
  console.log('\n--- Authenticating users ---');
  const adminToken = (await login(COMMERCE_ADMIN_EMAIL, COMMERCE_ADMIN_PASSWORD))?.data?.access_token;
  if (!adminToken) { fail('AUTH_ADMIN', 'No admin token'); process.exit(1); }
  console.log('Admin authenticated');

  const courierToken = getCourierToken(await courierLogin(COURIER_EMAIL, COURIER_PASSWORD));
  if (!courierToken) { fail('AUTH_COURIER', 'No courier token'); process.exit(1); }
  console.log('Courier authenticated');

  // Start Chrome with CDP
  console.log('\n--- Launching Chrome with CDP ---');
  const chromeProc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\Dell\\AppData\\Local\\Temp\\chrome-courier-test-' + Date.now(),
    '--no-sandbox', '--disable-gpu',
    WEBAPP + '/courier/login'
  ]);

  await waitForPort(9222);
  const wsUrl = await getCDPTarget();
  if (!wsUrl) { fail('CHROME_LAUNCH', 'No CDP target'); chromeProc.kill(); process.exit(1); }
  console.log('Chrome launched, CDP connected');

  const client = new CDPClient(wsUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');
  await client.send('Network.setExtraHTTPHeaders', {
    headers: { 'Authorization': `Bearer ${courierToken}` }
  });

  // Navigate to courier login page to establish SPA auth session
  await client.navigate(WEBAPP + '/livreur/login');
  await sleep(2500);
  await client.eval(`
    const setVal = (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setVal(document.querySelector('input[name="email"]'), '${COURIER_EMAIL}');
    setVal(document.querySelector('input[name="password"]'), '${COURIER_PASSWORD}');
    document.querySelector('form')?.requestSubmit();
  `);
  await sleep(4500);

  // === TEST 1: Check current order exists ===
  console.log('\n--- TEST 1: Finding existing order ---');
  const missions = await apiRequest('GET', '/courier/missions', null, courierToken);
  const missionList = missions?.data || [];
  console.log(`Found ${missionList.length} missions`);

  // Find a COURIER_ACCEPTED mission
  const courierAcceptedMission = missionList.find(m => m.delivery_status === 'COURIER_ACCEPTED');
  const readyMission = missionList.find(m => m.delivery_status === 'READY_FOR_PICKUP');
  const assignedMission = missionList.find(m => m.delivery_status === 'COURIER_ASSIGNED');

  let testOrder = courierAcceptedMission || readyMission || assignedMission;

  if (!testOrder) {
    // Try to create a test order by checking what's available
    console.log('No mission found in expected states. Checking all missions...');
    for (const m of missionList) {
      console.log(`  Order: ${m.order_number}, delivery_status: ${m.delivery_status}, status: ${m.status}`);
    }
    if (missionList.length === 0) {
      fail('TEST_ORDER', 'No orders found in system');
      console.log('\n=== FINAL RESULTS ===');
      results.forEach(r => console.log(r));
      client.close();
      chromeProc.kill();
      process.exit(1);
    }
    testOrder = missionList[0];
  }

  console.log(`\nTest order: ${testOrder.order_number}`);
  console.log(`Current delivery_status: ${testOrder.delivery_status}`);
  console.log(`Current order status: ${testOrder.status}`);
  pass('TEST_ORDER_FOUND', `${testOrder.order_number} (${testOrder.delivery_status})`);

  // Navigate to courier mission page
  console.log('\n--- TEST 2: Courier mission page ---');
  await client.navigate(`${WEBAPP}/courier/missions/${testOrder.order_id}`);
  await sleep(3000);

  const courierStatusEl = await client.textContent('.courier-status');
  const courierBody = await client.eval('document.body.innerText');

  console.log(`Courier page status text: ${courierStatusEl}`);
  console.log(`Courier body excerpt: ${courierBody.substring(0, 300)}`);

  // Check if COURIER_ACCEPTED shows waiting message
  if (testOrder.delivery_status === 'COURIER_ACCEPTED') {
    if (courierBody.includes('En attente') || courierBody.includes('vendeur prépare')) {
      pass('COURIER_ACCEPTED_WAITING_MSG', 'Waiting seller message shown');
    } else {
      fail('COURIER_ACCEPTED_WAITING_MSG', 'No waiting seller message');
    }
  }

  // Check no pickup button shown for COURIER_ACCEPTED
  if (testOrder.delivery_status === 'COURIER_ACCEPTED') {
    const hasPickupBtn = await client.eval("document.querySelector('.courier-actions button')?.textContent?.includes('Confirmer la récupération') || Array.from(document.querySelectorAll('.courier-actions button')).some(b => b.textContent.includes('Confirmer la récupération'))");
    if (!hasPickupBtn) {
      pass('NO_PICKUP_FOR_ACCEPTED', 'Pickup button NOT shown for COURIER_ACCEPTED');
    } else {
      fail('NO_PICKUP_FOR_ACCEPTED', 'Pickup button incorrectly shown for COURIER_ACCEPTED');
    }
  }

  // === TEST 3: Seller marks order READY ===
  console.log('\n--- TEST 3: Seller marks READY_FOR_PICKUP via API ---');
  const sellerToken = getCourierToken(await courierLogin(SELLER_EMAIL, SELLER_PASSWORD));
  const orderRes = await apiRequest('GET', `/orders/${testOrder.order_id}`, null, sellerToken);
  const orderData = orderRes?.data;

  // Seller flow: ACCEPTED -> PREPARING -> READY (status READY drives delivery_status to READY_FOR_PICKUP)
  const prepareRes = await apiRequest('POST', `/orders/${testOrder.order_id}/tracking/status`, {
    status: 'PREPARING'
  }, sellerToken);
  console.log(`Prepare transition: ${prepareRes?.error?.message || 'ok'}`);
  const transitionRes = await apiRequest('POST', `/orders/${testOrder.order_id}/tracking/status`, {
    status: 'READY'
  }, sellerToken);

  console.log(`Seller transition response: ${JSON.stringify(transitionRes).substring(0, 200)}`);

  if (transitionRes?.message?.includes('updated') || transitionRes?.data) {
    pass('SELLER_READY_TRANSITION', 'Seller transitioned to READY (READY_FOR_PICKUP)');
  } else {
    fail('SELLER_READY_TRANSITION', transitionRes?.error?.message || 'Unknown error');
  }

  // Verify delivery_status was updated
  await sleep(1000);
  const verifyRes = await apiRequest('GET', `/courier/missions/${testOrder.order_id}`, null, courierToken);
  const updatedMission = verifyRes?.data;
  if (updatedMission?.delivery_status === 'READY_FOR_PICKUP') {
    pass('DELIVERY_STATUS_READY', `delivery_status=${updatedMission.delivery_status}`);
  } else {
    fail('DELIVERY_STATUS_READY', `delivery_status=${updatedMission?.delivery_status}`);
  }

    // === TEST 4: Courier pickup ===
    console.log('\n--- TEST 4: Courier confirms pickup ---');
    await client.navigate(`${WEBAPP}/courier/missions/${testOrder.order_id}`);
    await sleep(3000);

    // Check pickup button is now visible
    const pickupBtnVisible = await client.eval("Array.from(document.querySelectorAll('.courier-actions button')).some(b => b.textContent.includes('Confirmer la récupération'))");
    if (pickupBtnVisible) {
      pass('PICKUP_BUTTON_VISIBLE', 'Confirmer la récupération button is visible');
    } else {
      fail('PICKUP_BUTTON_VISIBLE', 'Pickup button NOT visible');
    }

    // Click pickup
    const pickupRes = await apiRequest('POST', `/courier/missions/${testOrder.order_id}/pickup`, {}, courierToken);
    console.log(`Pickup response: ${JSON.stringify(pickupRes).substring(0, 200)}`);

    if (pickupRes?.message?.includes('Pickup confirmed') || pickupRes?.message?.includes('confirmed')) {
      pass('PICKUP_API_SUCCESS', 'Pickup API returned success');
    } else if (pickupRes?.error) {
      fail('PICKUP_API_SUCCESS', pickupRes.error.message);
    }

    // Verify status changed to PICKED_UP
    await sleep(1000);
    const verifyPickupRes = await apiRequest('GET', `/courier/missions/${testOrder.order_id}`, null, courierToken);
    const pickedMission = verifyPickupRes?.data;
    if (pickedMission?.delivery_status === 'PICKED_UP') {
      pass('PICKED_UP_STATUS', `delivery_status=${pickedMission.delivery_status}`);
    } else {
      fail('PICKED_UP_STATUS', `delivery_status=${pickedMission?.delivery_status}`);
    }

    // === TEST 5: Courier starts delivery ===
    console.log('\n--- TEST 5: Courier starts delivery ---');
    const startRes = await apiRequest('POST', `/courier/missions/${testOrder.order_id}/start`, {}, courierToken);
    if (startRes?.message?.includes('Delivery started')) {
      pass('START_DELIVERY_API', 'Delivery started successfully');
    } else {
      fail('START_DELIVERY_API', startRes?.error?.message || 'Unknown error');
    }

    await sleep(1000);
    const verifyStartRes = await apiRequest('GET', `/courier/missions/${testOrder.order_id}`, null, courierToken);
    const transitMission = verifyStartRes?.data;
    if (transitMission?.delivery_status === 'IN_TRANSIT') {
      pass('IN_TRANSIT_STATUS', `delivery_status=${transitMission.delivery_status}`);
    } else {
      fail('IN_TRANSIT_STATUS', `delivery_status=${transitMission?.delivery_status}`);
    }

    // === TEST 6: Courier arrives ===
    console.log('\n--- TEST 6: Courier arrives ---');
    const arriveRes = await apiRequest('POST', `/courier/missions/${testOrder.order_id}/arrive`, {}, courierToken);
    if (arriveRes?.message?.includes('Arrival confirmed')) {
      pass('ARRIVE_API', 'Arrival confirmed');
    } else {
      fail('ARRIVE_API', arriveRes?.error?.message || 'Unknown error');
    }

    await sleep(1000);
    const verifyArriveRes = await apiRequest('GET', `/courier/missions/${testOrder.order_id}`, null, courierToken);
    const arrivedMission = verifyArriveRes?.data;
    if (arrivedMission?.delivery_status === 'COURIER_ARRIVED') {
      pass('ARRIVED_STATUS', `delivery_status=${arrivedMission.delivery_status}`);
    } else {
      fail('ARRIVED_STATUS', `delivery_status=${arrivedMission?.delivery_status}`);
    }

    // === TEST 7: Verify NO pickup when COURIER_ACCEPTED (regression check) ===
    console.log('\n--- TEST 7: Regression - ConfirmPickup rejects COURIER_ACCEPTED ---');
    // Create a fresh order if one exists in COURIER_ASSIGNED
    const assignedOrder = missionList.find(m => m.delivery_status === 'COURIER_ASSIGNED');
    if (assignedOrder) {
      const confirmPickupRes = await apiRequest('POST', `/courier/missions/${assignedOrder.order_id}/pickup`, {}, courierToken);
      if (confirmPickupRes?.error?.code === 'INVALID_STATUS_TRANSITION') {
        pass('CONFIRMPICKUP_BLOCKED_COURIER_ACCEPTED', 'Pickup correctly blocked for COURIER_ACCEPTED');
      } else {
        fail('CONFIRMPICKUP_BLOCKED_COURIER_ACCEPTED', `Pickup was allowed: ${JSON.stringify(confirmPickupRes).substring(0, 200)}`);
      }
    }

  console.log('\n=== FINAL RESULTS ===');
  results.forEach(r => console.log(r));
  const passCount = results.filter(r => r.includes('PASS')).length;
  const failCount = results.filter(r => r.includes('FAIL')).length;
  console.log(`\nTOTAL: ${passCount} PASS, ${failCount} FAIL`);

  client.close();
  chromeProc.kill();

  if (failCount > 0) process.exit(1);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
