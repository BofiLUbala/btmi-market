import http from 'http';
import { spawnSync } from 'child_process';

const API_BASE = (process.env.E2E_API_BASE || 'http://localhost:18080/api/v1');
const CONTAINER = process.env.E2E_CONTAINER || '';

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
    let urlPath;
    if (path === '/health') {
      urlPath = '/health';
    } else {
      urlPath = (base.pathname.endsWith('/') ? base.pathname : base.pathname + '/') + path.replace(/^\//, '');
    }
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
  } catch {
    return '';
  }
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

function pick(doc, key) {
  return doc?.data?.[key] ?? doc?.[key];
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    for (const k of ['items', 'notifications', 'products', 'options', 'data']) {
      if (Array.isArray(v[k])) return v[k];
    }
  }
  return [];
}

async function run() {
  const stamp = Date.now().toString(36);
  const password = `E2e!Pass-${stamp}`;

  const buyerEmail = `e2e.buyer.${stamp}@tbk.test`;
  const sellerEmail = `e2e.seller.${stamp}@tbk.test`;
  const courierEmail = `e2e.courier.${stamp}@tbk.test`;
  const commerceAdminEmail = `e2e.commerce.${stamp}@tbk.test`;
  const financeAdminEmail = `e2e.finance.${stamp}@tbk.test`;

  const STRUCT_ADDR = {
    province: 'Kinshasa',
    city: 'Kinshasa',
    commune: 'Gombe',
    street: 'Avenue de la Paix',
    building_number: '12',
    landmark: 'En face de la BN',
  };

  console.log('=== FULL CROSS-ROLE E2E LIFECYCLE ===\n');

  // ---------- Health ----------
  const health = await request('GET', '/health');
  assert('Health Check', health.status === 200 && health.data?.status === 'ok', String(health.status));

  // ---------- 1. Buyer signup (structured address) ----------
  const buyerReg = await request('POST', '/auth/register', {
    first_name: 'Digital', last_name: 'Myla', phone: `+243${Math.floor(Math.random() * 1e8)}`,
    email: buyerEmail, password, password_confirmation: password,
    ...STRUCT_ADDR,
  });
  assert('Buyer Register (structured address)', buyerReg.status === 201, JSON.stringify(buyerReg.data));
  assert('Buyer Register returns user_id', !!buyerReg.data?.data?.user_id, JSON.stringify(buyerReg.data));

  // ---------- 2. Seller signup ----------
  const sellerReg = await request('POST', '/auth/register/seller', {
    first_name: 'Simplice', last_name: 'Vendeur', phone: `+243${Math.floor(Math.random() * 1e8)}`,
    email: sellerEmail, password, password_confirmation: password,
    ...STRUCT_ADDR,
  });
  assert('Seller Register', sellerReg.status === 201, JSON.stringify(sellerReg.data));

  // ---------- 3. Activate both (dev-mode log tokens) ----------
  await sleep(1200);
  const logs = dockerLogs();
  const buyerToken = tokenFromLog(logs, buyerEmail, 'Activation');
  const sellerToken = tokenFromLog(logs, sellerEmail, 'Activation');
  assert('Buyer activation token found in logs', !!buyerToken, `${buyerEmail}`);
  assert('Seller activation token found in logs', !!sellerToken, `${sellerEmail}`);

  if (buyerToken) {
    const act = await request('GET', `/auth/activate?token=${buyerToken}`);
    assert('Buyer Account Activation', act.status === 200, `${act.status} ${JSON.stringify(act.data)}`);
  }
  if (sellerToken) {
    const act = await request('GET', `/auth/activate?token=${sellerToken}`);
    assert('Seller Account Activation', act.status === 200, `${act.status} ${JSON.stringify(act.data)}`);
  }

  // ---------- 4. Login ----------
  const buyerLogin = await request('POST', '/auth/login', { email: buyerEmail, password });
  const sellerLogin = await request('POST', '/auth/login', { email: sellerEmail, password });
  assert('Buyer Login', buyerLogin.status === 200 && !!buyerLogin.data?.access_token, `${buyerLogin.status}`);
  assert('Seller Login', sellerLogin.status === 200 && !!sellerLogin.data?.access_token, `${sellerLogin.status}`);
  const buyerH = { Authorization: `Bearer ${buyerLogin.data.access_token}` };
  const sellerH = { Authorization: `Bearer ${sellerLogin.data.access_token}` };

  // ---------- 5. SUPER_ADMIN + operational admins ----------
  const superLogin = await request('POST', '/admin/auth/login', {
    email: process.env.E2E_SUPER_EMAIL || 'superadmin@admin-e2e.invalid',
    password: process.env.E2E_SUPER_PASSWORD || 'Super!Secret-1',
  });
  assert('SUPER_ADMIN Login', superLogin.status === 200 && !!superLogin.data?.data?.access_token, `${superLogin.status}`);
  const superH = { Authorization: `Bearer ${superLogin.data.data.access_token}` };

  const inviteAdmin = async (email, role) => {
    const inv = await request('POST', '/admin/admin-users/invite', {
      first_name: 'E2E', last_name: role, email, role,
    }, superH);
    assert(`Invite ${role}`, inv.status === 201 && !!inv.data?.data?.id, `${inv.status} ${JSON.stringify(inv.data)}`);
    const adminId = inv.data?.data?.id;
    const resend = await request('POST', `/admin/admin-users/${adminId}/resend-invitation`, {}, superH);
    assert(`Resend invitation ${role}`, resend.status === 200, `${resend.status}`);
    await sleep(900);
    const logs2 = dockerLogs();
    const t = tokenFromLog(logs2, email, 'Admin Invitation');
    assert(`Admin activation token in logs (${role})`, !!t, email);
    if (!t) return null;
    const verify = await request('GET', `/admin/invitations/verify?token=${t}`);
    assert(`Admin invitation verify ${role}`, verify.status === 200 && verify.data?.data?.role === role, `${verify.status} ${JSON.stringify(verify.data)}`);
    const act = await request('POST', '/admin/invitations/activate', {
      token: t, password, password_confirmation: password,
    });
    assert(`Admin activation ${role}`, act.status === 200, `${act.status} ${JSON.stringify(act.data)}`);
    const lg = await request('POST', '/admin/auth/login', { email, password });
    assert(`Admin login ${role}`, lg.status === 200 && !!lg.data?.data?.access_token, `${lg.status}`);
    return { Authorization: `Bearer ${lg.data.data.access_token}` };
  };

  const commerceH = await inviteAdmin(commerceAdminEmail, 'COMMERCE_ADMIN');
  const financeH = await inviteAdmin(financeAdminEmail, 'FINANCE_SUPPORT_ADMIN');

  // ---------- 6. Seller business + shop (structured address) ----------
  const biz = await request('POST', '/businesses', {
    name: `E2E Business ${stamp}`,
    business_type: 'RETAIL', category: 'general', phone: `+243${Math.floor(Math.random() * 1e8)}`,
    whatsapp: `+243${Math.floor(Math.random() * 1e8)}`, email: sellerEmail,
    country: 'DRC', province: STRUCT_ADDR.province, city: STRUCT_ADDR.city,
    commune: STRUCT_ADDR.commune, street: STRUCT_ADDR.street,
    building_number: STRUCT_ADDR.building_number, landmark: STRUCT_ADDR.landmark,
    default_currency: 'CDF',
  }, sellerH);
  assert('Seller Business Create (structured address)', biz.status === 201 || biz.status === 200, `${biz.status} ${JSON.stringify(biz.data)}`);
  const businessId = biz.data?.data?.id;
  assert('Business id present', !!businessId, JSON.stringify(biz.data));

  const shop = await request('POST', `/businesses/${businessId}/shops`, {
    name: `E2E Shop ${stamp}`, type: 'PHYSICAL', phone: `+243${Math.floor(Math.random() * 1e8)}`,
    province: STRUCT_ADDR.province, city: STRUCT_ADDR.city, commune: STRUCT_ADDR.commune,
    street: STRUCT_ADDR.street, building_number: STRUCT_ADDR.building_number,
    landmark: STRUCT_ADDR.landmark, address: `${STRUCT_ADDR.building_number} ${STRUCT_ADDR.street}, ${STRUCT_ADDR.commune}, ${STRUCT_ADDR.city}`,
  }, sellerH);
  assert('Shop Create (structured address)', shop.status === 201 || shop.status === 200, `${shop.status} ${JSON.stringify(shop.data)}`);
  const shopId = shop.data?.data?.id;
  assert('Shop id present', !!shopId, JSON.stringify(shop.data));

  // ---------- 7. Category, product, variant, stock ----------
  const cats = await request('GET', '/categories', null, sellerH);
  const categoryId = asArray(cats.data?.data ?? cats.data)[0]?.id;
  assert('Category available', !!categoryId, JSON.stringify(cats.data));

  const prod = await request('POST', `/businesses/${businessId}/products`, {
    name: `E2E Product ${stamp}`, sku: `E2E-${stamp}`, unit_price: 100, cost_price: 60,
    unit: 'PIECE', category_id: categoryId, self_rating: 4, publication_status: 'PUBLISHED',
  }, sellerH);
  assert('Product Create', prod.status === 201 && !!prod.data?.data?.id, `${prod.status} ${JSON.stringify(prod.data)}`);
  const productId = prod.data?.data?.id;

  const variant = await request('POST', `/businesses/${businessId}/products/${productId}/variants`, {
    sku: `E2E-V-${stamp}`, name: 'Standard', attributes: { size: 'M' }, sale_price: 100, unit: 'PIECE',
  }, sellerH);
  assert('Variant Create', variant.status === 201 && !!variant.data?.data?.id, `${variant.status} ${JSON.stringify(variant.data)}`);
  const variantId = variant.data?.data?.id;

  const stock = await request('POST', `/shops/${shopId}/stock`, { variant_id: variantId, quantity: 20 }, sellerH);
  assert('Add Stock', stock.status === 201 || stock.status === 200, `${stock.status} ${JSON.stringify(stock.data)}`);

  // ---------- 8. Buyer profile (structured address) ----------
  const buyerProf = await request('POST', '/buyer/profile', {
    first_name: 'Digital', last_name: 'Myla', phone: `+243${Math.floor(Math.random() * 1e8)}`,
    email: buyerEmail, province: STRUCT_ADDR.province, city: STRUCT_ADDR.city,
    commune: STRUCT_ADDR.commune, street: STRUCT_ADDR.street,
    building_number: STRUCT_ADDR.building_number, landmark: STRUCT_ADDR.landmark,
  }, buyerH);
  assert('Buyer Profile Create (structured address)', buyerProf.status === 201 || buyerProf.status === 200 || buyerProf.status === 409, `${buyerProf.status} ${JSON.stringify(buyerProf.data)}`);

  // ---------- 9. Marketplace visibility ----------
  const mkt = await request('GET', `/marketplace/shops/${shopId}/products`, null, buyerH);
  const mktProducts = asArray(mkt.data?.data?.products ?? mkt.data?.data ?? mkt.data);
  assert('Marketplace shows product', Array.isArray(mktProducts) && mktProducts.some(p => p.id === productId || p.product_id === productId), `${mkt.status} ${JSON.stringify(mkt.data)}`);

  // ---------- 10. Buyer order ----------
  const preview = await request('POST', '/buyer/orders/preview', {
    shop_id: shopId, items: [{ product_id: productId, variant_id: variantId, quantity: 1 }], use_points: false,
  }, buyerH);
  assert('Order Preview', preview.status === 200, `${preview.status} ${JSON.stringify(preview.data)}`);

  const order = await request('POST', '/buyer/orders', {
    shop_id: shopId, items: [{ product_id: productId, variant_id: variantId, quantity: 1 }], use_points: false,
  }, buyerH);
  assert('Buyer Order Create', order.status === 201 && !!(order.data?.data?.id || order.data?.data?.order?.id), `${order.status} ${JSON.stringify(order.data)}`);
  const orderId = order.data?.data?.id || order.data?.data?.order?.id;
  const orderNumber = order.data?.data?.order_number || order.data?.data?.order?.order_number;

  // ---------- 11. Delivery + payment ----------
  const opts = await request('GET', `/buyer/orders/${orderId}/delivery-options`, null, buyerH);
  const tbkOption = asArray(opts.data?.data?.options ?? opts.data?.options).find(o => o.method === 'TBK_STANDARD');
  assert('TBK delivery option available', !!tbkOption, `${opts.status} ${JSON.stringify(opts.data)}`);

  const delivery = await request('POST', `/buyer/orders/${orderId}/delivery`, {
    method: 'TBK_STANDARD', contact_name: 'Digital Myla', phone: `+243${Math.floor(Math.random() * 1e8)}`,
    address: `${STRUCT_ADDR.building_number} ${STRUCT_ADDR.street}, ${STRUCT_ADDR.commune}, ${STRUCT_ADDR.city}`,
    province: STRUCT_ADDR.province, city: STRUCT_ADDR.city, commune: STRUCT_ADDR.commune,
    street: STRUCT_ADDR.street, building_number: STRUCT_ADDR.building_number, landmark: STRUCT_ADDR.landmark,
  }, buyerH);
  assert('Select TBK Delivery', delivery.status === 200, `${delivery.status} ${JSON.stringify(delivery.data)}`);

  const payment = await request('POST', `/buyer/orders/${orderId}/payment`, { payment_method: 'CASH_ON_DELIVERY' }, buyerH);
  assert('Create Payment (CASH_ON_DELIVERY)', payment.status === 201 && !!payment.data?.data?.id, `${payment.status} ${JSON.stringify(payment.data)}`);
  const paymentId = payment.data?.data?.id;
  assert('Cash due positive', (payment.data?.data?.cash_due ?? payment.data?.data?.cashDue ?? 0) > 0, JSON.stringify(payment.data?.data));

  // ---------- 12. Seller pipeline: accept -> prepare -> READY ----------
  for (const [name, path] of [['Accept Order', `/orders/${orderId}/accept`], ['Prepare Order', `/orders/${orderId}/prepare`]]) {
    const r = await request('POST', path, {}, sellerH);
    assert(name, r.status === 200, `${r.status} ${JSON.stringify(r.data)}`);
  }
  const ready = await request('POST', `/orders/${orderId}/tracking/status`, { status: 'READY' }, sellerH);
  assert('Seller marks order READY', ready.status === 200, `${ready.status} ${JSON.stringify(ready.data)}`);

  // ---------- 13. Courier: invite -> activate (structured address) -> login -> available ----------
  const courierInvite = await request('POST', '/admin/commerce/couriers/invite', {
    first_name: 'Express', last_name: 'Courier', email: courierEmail,
    phone: `+243${Math.floor(Math.random() * 1e8)}`, transport_type: 'MOTORCYCLE',
    vehicle_info: 'Honda', service_zone: 'Kinshasa',
  }, commerceH || superH);
  assert('Courier Invite', courierInvite.status === 201 && !!courierInvite.data?.data?.invitation_token, `${courierInvite.status} ${JSON.stringify(courierInvite.data)}`);
  const courierInvitationToken = courierInvite.data?.data?.invitation_token;

  const courierVerify = await request('GET', `/courier/verify/${courierInvitationToken}`);
  assert('Courier Invitation Verify', courierVerify.status === 200 && courierVerify.data?.data?.email === courierEmail, `${courierVerify.status} ${JSON.stringify(courierVerify.data)}`);

  const courierActivate = await request('POST', '/courier/activate', {
    token: courierInvitationToken, password, password_confirmation: password,
    province: STRUCT_ADDR.province, city: STRUCT_ADDR.city, commune: STRUCT_ADDR.commune,
    street: STRUCT_ADDR.street, building_number: STRUCT_ADDR.building_number, landmark: STRUCT_ADDR.landmark,
  });
  assert('Courier Activate (structured address)', courierActivate.status === 200, `${courierActivate.status} ${JSON.stringify(courierActivate.data)}`);

  const courierLogin = await request('POST', '/auth/login', { email: courierEmail, password });
  assert('Courier Login', courierLogin.status === 200 && !!courierLogin.data?.access_token, `${courierLogin.status}`);
  const courierH = { Authorization: `Bearer ${courierLogin.data.access_token}` };

  const courierProfile = await request('GET', '/courier/profile', null, courierH);
  const cp = courierProfile.data?.data?.courier ?? courierProfile.data?.data ?? {};
  assert('Courier Profile has structured address', cp.commune === 'Gombe' && cp.street === 'Avenue de la Paix' && cp.building_number === '12' && cp.province === 'Kinshasa', `${courierProfile.status} ${JSON.stringify(courierProfile.data)}`);

  const courierUpdate = await request('PATCH', '/courier/profile', {
    phone: cp.phone, transport_type: cp.transport_type, vehicle_info: cp.vehicle_info,
    service_zone: cp.service_zone, first_name: cp.first_name, last_name: cp.last_name,
    province: 'Kinshasa', city: 'Kinshasa', commune: 'Masina', street: 'Avenue Kalamu',
    building_number: '8', landmark: 'Pres de la gare',
  }, courierH);
  assert('Courier Profile Update (structured address)', courierUpdate.status === 200, `${courierUpdate.status} ${JSON.stringify(courierUpdate.data)}`);
  const cp2raw = await request('GET', '/courier/profile', null, courierH);
  const cp2 = cp2raw.data?.data?.courier ?? cp2raw.data?.data ?? {};
  assert('Courier Profile updated address persisted', cp2.commune === 'Masina' && cp2.street === 'Avenue Kalamu' && cp2.building_number === '8', `${cp2raw.status} ${JSON.stringify(cp2raw.data)}`);

  const avail = await request('PATCH', '/courier/availability', { availability: 'AVAILABLE' }, courierH);
  assert('Courier Available', avail.status === 200, `${avail.status} ${JSON.stringify(avail.data)}`);

  // ---------- 14. Commerce admin assigns courier ----------
  const couriersAvail = await request('GET', '/admin/commerce/couriers/available', null, commerceH || superH);
  const courierRow = asArray(couriersAvail.data?.data ?? couriersAvail.data).find(c => c.email === courierEmail);
  assert('Courier listed as available', !!courierRow, `${couriersAvail.status} ${JSON.stringify(couriersAvail.data)}`);

  const assign = await request('POST', `/admin/commerce/orders/${orderId}/assign-courier`, {
    courier_id: courierRow.id, notes: 'E2E assignment',
  }, commerceH || superH);
  assert('Commerce Admin Assigns Courier', assign.status === 200, `${assign.status} ${JSON.stringify(assign.data)}`);

  // ---------- 15. Courier accepts mission ----------
  const missions = await request('GET', '/courier/missions', null, courierH);
  const missionArr = Array.isArray(missions.data?.data) ? missions.data.data : (Array.isArray(missions.data) ? missions.data : []);
  const mission = missionArr.find(m => m.order_id === orderId);
  assert('Courier sees mission with real shop pickup address', !!mission && mission.shop_address.includes('Avenue de la Paix') && mission.shop_address.includes('Gombe') && mission.shop_address.includes('En face de la BN'), `${missions.status} ${JSON.stringify(missions.data)}`);
  assert('Mission delivery status COURIER_ASSIGNED', mission?.delivery_status === 'COURIER_ASSIGNED', JSON.stringify(mission));

  const accept = await request('POST', `/courier/missions/${orderId}/accept`, {}, courierH);
  assert('Courier Accept Mission', accept.status === 200, `${accept.status} ${JSON.stringify(accept.data)}`);

  // ---------- 16. Seller package QR + courier pickup scan ----------
  const pkg = await request('GET', `/orders/${orderId}/package-qr`, null, sellerH);
  const qrToken = pkg.data?.data?.token;
  assert('Seller package QR (token present)', !!qrToken, `${pkg.status} ${JSON.stringify(pkg.data)}`);

  const pickupScan = await request('POST', '/courier/scans/pickup', { token: qrToken, order_id: orderId }, courierH);
  assert('Courier Pickup QR Scan', pickupScan.status === 200 && pickupScan.data?.data?.delivery_status === 'PICKED_UP', `${pickupScan.status} ${JSON.stringify(pickupScan.data)}`);

  const start = await request('POST', `/courier/missions/${orderId}/start`, {}, courierH);
  assert('Courier Start Delivery', start.status === 200, `${start.status} ${JSON.stringify(start.data)}`);

  const arrive = await request('POST', `/courier/missions/${orderId}/arrive`, {}, courierH);
  assert('Courier Arrive', arrive.status === 200, `${arrive.status} ${JSON.stringify(arrive.data)}`);

  const deliveryScan = await request('POST', '/courier/scans/delivery', { token: qrToken, order_id: orderId }, courierH);
  assert('Courier Delivery QR Scan', deliveryScan.status === 200 && (deliveryScan.data?.data?.delivery_status?.includes('DELIVERED') || deliveryScan.data?.data?.delivery_status === 'AWAITING_BUYER_CONFIRMATION') && deliveryScan.data?.data?.requires_buyer_confirmation === true, `${deliveryScan.status} ${JSON.stringify(deliveryScan.data)}`);

  // ---------- 17. Buyer confirms receipt, payment verified, order completed ----------
  const confirmReceipt = await request('POST', `/buyer/orders/${orderId}/confirm-receipt`, {}, buyerH);
  assert('Buyer Confirm Receipt', confirmReceipt.status === 200, `${confirmReceipt.status} ${JSON.stringify(confirmReceipt.data)}`);

  const buyerPayConfirm = await request('POST', `/buyer/payments/${paymentId}/buyer-confirm`, {}, buyerH);
  assert('Buyer Payment Confirmation', buyerPayConfirm.status === 200, `${buyerPayConfirm.status} ${JSON.stringify(buyerPayConfirm.data)}`);

  const sellerPayConfirm = await request('POST', `/payments/${paymentId}/seller-confirm`, {}, sellerH);
  assert('Seller Payment Confirmation', sellerPayConfirm.status === 200, `${sellerPayConfirm.status} ${JSON.stringify(sellerPayConfirm.data)}`);

  const completed = await request('GET', `/buyer/orders/${orderId}`, null, buyerH);
  const co = completed.data?.data?.order ?? completed.data?.data;
  assert('Order COMPLETED', co?.status === 'COMPLETED', `${completed.status} ${JSON.stringify(completed.data)}`);

  // ---------- 18. Real-time sync across roles ----------
  const tracking = await request('GET', `/buyer/orders/${orderId}/tracking`, null, buyerH);
  assert('Buyer tracking real-time state', tracking.status === 200 && (tracking.data?.data?.current_status === 'COMPLETED' || tracking.data?.data?.order_status === 'COMPLETED'), `${tracking.status} ${JSON.stringify(tracking.data)}`);

  const sellerOrder = await request('GET', `/orders/${orderId}`, null, sellerH);
  assert('Seller order real-time state', sellerOrder.status === 200 && (sellerOrder.data?.data?.status === 'COMPLETED' || sellerOrder.data?.data?.order?.status === 'COMPLETED'), `${sellerOrder.status} ${JSON.stringify(sellerOrder.data)}`);

  const courierMissions2 = await request('GET', '/courier/missions', null, courierH);
  const cm = asArray(courierMissions2.data?.data ?? courierMissions2.data).find(m => m.order_id === orderId);
  assert('Courier mission real-time state', cm?.delivery_status === 'RECEIVED' || cm?.status === 'COMPLETED', JSON.stringify(cm));

  const cOrders = await request('GET', '/admin/commerce/orders?limit=10', null, commerceH || superH);
  const cOrdersList = asArray(cOrders.data?.data?.orders ?? cOrders.data?.orders ?? cOrders.data?.data ?? cOrders.data);
  const cOrder = cOrdersList.find(o => o.id === orderId);
  assert('Commerce admin orders real-time state', !!cOrder && (cOrder.status === 'COMPLETED' || cOrder.delivery_status === 'RECEIVED'), `${cOrders.status} ${JSON.stringify(cOrder)}`);

  const nBuyer = await request('GET', '/notifications?limit=50', null, buyerH);
  const buyerTypes = asArray(nBuyer.data?.items ?? nBuyer.data?.notifications ?? nBuyer.data).map(n => n.type || n.notification_type);
  assert('Buyer received lifecycle notifications', ['ORDER_COMPLETED', 'DELIVERED', 'COURIER_ASSIGNED', 'ORDER_READY_FOR_PICKUP'].some(t => buyerTypes.includes(t)), JSON.stringify(buyerTypes));

  const nSeller = await request('GET', '/notifications?limit=50', null, sellerH);
  const sellerTypes = asArray(nSeller.data?.items ?? nSeller.data?.notifications ?? nSeller.data).map(n => n.type || n.notification_type);
  assert('Seller received lifecycle notifications', sellerTypes.includes('ORDER_COMPLETED') || sellerTypes.includes('PAYMENT_CONFIRMED'), JSON.stringify(sellerTypes));

  // ---------- 19. Finance admin ----------
  const financeSummary = await request('GET', '/admin/finance/summary', null, financeH || superH);
  assert('Finance summary available', financeSummary.status === 200, `${financeSummary.status} ${JSON.stringify(financeSummary.data)}`);

  const payments = await request('GET', '/admin/finance/payments?limit=10', null, financeH || superH);
  const paymentsList = asArray(payments.data?.data?.payments ?? payments.data?.payments ?? payments.data?.data ?? payments.data);
  const e2ePayment = paymentsList.find(p => p.id === paymentId || p.order_id === orderId);
  assert('Finance admin sees order payment', !!e2ePayment, `${payments.status} ${JSON.stringify(payments.data)}`);
  assert('Payment status VERIFIED', e2ePayment?.status === 'VERIFIED' || e2ePayment?.payment_status === 'VERIFIED', JSON.stringify(e2ePayment));

  // ---------- 20. PostgreSQL verification ----------
  await verifyPostgres(businessId, shopId, orderId, paymentId);

  // ---------- Summary ----------
  console.log('\n==========================================');
  const allPassed = results.every(r => r.pass);
  const passed = results.filter(r => r.pass).length;
  console.log(`TOTAL CHECKS: ${results.length}, PASSED: ${passed}, FAILED: ${results.length - passed}`);
  if (!allPassed) {
    console.error('SOME CHECKS FAILED!');
    process.exit(1);
  }
  console.log('ALL FULL LIFECYCLE CHECKS PASSED SUCCESSFULLY!');
}

async function verifyPostgres(businessId, shopId, orderId, paymentId) {
  const dsn = (process.env.E2E_PG_DSN || '');
  if (!dsn) {
    console.log('(skipping direct PostgreSQL console verification: E2E_PG_DSN not set)');
    return;
  }
  const parsed = new URL(dsn);
  const dbName = parsed.pathname.replace(/^\//, '');
  const user = parsed.username;

  const query = async (sql) => {
    const r = spawnSync(
      'docker',
      ['exec', 'backend-postgres-1', 'env', `PGPASSWORD=${parsed.password}`, 'psql', '-h', 'localhost', '-p', '5432', '-U', user, '-d', dbName, '-t', '-A', '-c', sql],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 }
    );
    if (r.status === 0) return (r.stdout || '').trim();
    return '';
  };

  const buyerRow = await query(`SELECT count(*) FROM buyer_profiles bp WHERE bp.street='Avenue de la Paix' AND bp.commune='Gombe' AND bp.building_number='12'`);
  assert('PostgreSQL: buyer structured address persisted', Number(buyerRow) >= 1, buyerRow);

  const bizRow = await query(`SELECT count(*) FROM businesses b WHERE b.street='Avenue de la Paix' AND b.commune='Gombe' AND b.building_number='12'`);
  assert('PostgreSQL: business structured address persisted', bizRow === '1', bizRow);

  const shopRow = await query(`SELECT count(*) FROM shops s WHERE s.street='Avenue de la Paix' AND s.commune='Gombe' AND s.building_number='12'`);
  assert('PostgreSQL: shop structured address persisted', shopRow === '1', shopRow);

  const courierRow = await query(`SELECT count(*) FROM couriers c WHERE c.street='Avenue Kalamu' AND c.commune='Masina' AND c.building_number='8' AND c.landmark='Pres de la gare'`);
  assert('PostgreSQL: courier structured address persisted', Number(courierRow) >= 1, courierRow);

  const orderRow = await query(`SELECT count(*) FROM orders o WHERE o.id='${orderId}' AND o.status='COMPLETED' AND o.delivery_status='RECEIVED'`);
  assert('PostgreSQL: order COMPLETED + RECEIVED', orderRow === '1', `${orderRow}`);

  const payRow = await query(`SELECT count(*) FROM buyer_payments p WHERE p.id='${paymentId}' AND p.status='VERIFIED'`);
  assert('PostgreSQL: payment VERIFIED', payRow === '1', `${payRow}`);

  const qrRow = await query(`SELECT count(*) FROM delivery_scan_events dse WHERE dse.order_id='${orderId}'`);
  assert('PostgreSQL: delivery scan events recorded', Number(qrRow || 0) >= 1, qrRow);
}

run().catch(err => {
  console.error('E2E script crashed:', err);
  process.exit(1);
});