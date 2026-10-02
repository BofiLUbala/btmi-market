// End-to-end test of push notifications against the local stack.
//
// A fake push service on this machine plays the browsers' push servers and
// Expo's API: the API must be started with
//   PUSH_EXTRA_HOSTS=http://host.docker.internal:9911
//   EXPO_PUSH_URL=http://host.docker.internal:9911/expo
// Web pushes are decrypted here with the subscription's private key (RFC 8291),
// exactly as a browser would, so the test sees what a device really shows.
//
//   node scripts/e2e_push_notifications.mjs
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { createDecipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto'
import { API, ROLE_ACCOUNTS, adminLogin, call, get, post, patch, sleep, errText } from './e2e_admin_lib.mjs'

const PORT = 9911
const HOST = process.env.E2E_PUSH_HOST || 'http://host.docker.internal:9911'
const PG = process.env.E2E_PG_CONTAINER || 'backend-postgres-1'
const b64u = (buf) => Buffer.from(buf).toString('base64url')

let failures = 0
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail ? `  -> ${detail}` : ''}`)
  if (!cond) failures++
}
function psql(sql) {
  const r = spawnSync('docker', ['exec', PG, 'psql', '-U', 'btmi_user', '-d', process.env.E2E_PG_DB || 'btmi_market', '-t', '-A', '-c', sql], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`psql: ${r.stderr}`)
  return (r.stdout || '').trim()
}
const must = (label, r) => { if (!r || r.status >= 300) throw new Error(`${label}: ${errText(r)}`); return r }
const data = (r) => r?.json?.data ?? r?.json

// ── Fake push service ──────────────────────────────────────────────────────
const devices = new Map() // name -> { ecdh, auth }
const received = new Map() // name -> [payload]
const behaviour = new Map() // name -> list of status codes to answer (then 201)

function decrypt(body, { ecdh, auth }) {
  const salt = body.subarray(0, 16)
  const idlen = body[20]
  const asPublic = body.subarray(21, 21 + idlen)
  const ct = body.subarray(21 + idlen)
  const shared = ecdh.computeSecret(asPublic)
  const uaPublic = ecdh.getPublicKey()
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic])
  const ikm = Buffer.from(hkdfSync('sha256', shared, auth, keyInfo, 32))
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
  const d = createDecipheriv('aes-128-gcm', cek, nonce)
  d.setAuthTag(ct.subarray(ct.length - 16))
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()])
  return JSON.parse(plain.subarray(0, plain.length - 1).toString('utf8'))
}

const server = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const body = Buffer.concat(chunks)
    if (req.url.startsWith('/web/')) {
      const name = req.url.slice(5)
      const queue = behaviour.get(name) || []
      if (queue.length) {
        const status = queue.shift()
        res.writeHead(status).end()
        return
      }
      const dev = devices.get(name)
      try {
        const payload = decrypt(body, dev)
        payload._headers = { urgency: req.headers.urgency, ttl: req.headers.ttl, topic: req.headers.topic, auth: req.headers.authorization?.slice(0, 8) }
        received.set(name, [...(received.get(name) || []), payload])
        res.writeHead(201).end()
      } catch (e) {
        console.log('decrypt failed for', name, e.message)
        res.writeHead(400).end()
      }
      return
    }
    if (req.url === '/expo/send') {
      for (const m of JSON.parse(body.toString())) {
        received.set(m.to, [...(received.get(m.to) || []), m])
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: [{ status: 'ok', id: `ticket-${Date.now()}` }] }))
      return
    }
    if (req.url === '/expo/getReceipts') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ data: {} }))
      return
    }
    res.writeHead(404).end()
  })
})
await new Promise((r) => server.listen(PORT, '0.0.0.0', r))

function newDevice(name) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  devices.set(name, { ecdh, auth })
  return { endpoint: `${HOST}/web/${name}`, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } }
}

/** Waits until device `name` received a push matching pred (or times out). */
async function waitPush(name, pred, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const hit = (received.get(name) || []).find(pred)
    if (hit) return hit
    await sleep(300)
  }
  return null
}
const typeOf = (p) => p.type ?? p.data?.type
const hasType = (name, type) => (received.get(name) || []).some((p) => typeOf(p) === type)

// ── Actors ─────────────────────────────────────────────────────────────────
console.log('Creating actors…')
const actors = spawnSync('node', ['scripts/e2e_visual_actors.mjs'], { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') })
if (actors.status !== 0) throw new Error(actors.stderr)
const A = JSON.parse(actors.stdout)
// Signs in with a chosen User-Agent (the new-device alert keys on it).
async function login(email, ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/129.0 Safari/537.36') {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': ua }, body: JSON.stringify({ email, password: A.password }) })
  const json = await res.json().catch(() => null)
  return json?.data?.access_token ?? json?.access_token
}
const buyer = await login(A.buyerEmail)
const seller = await login(A.sellerEmail)
const courier = await login(A.courierEmail)
const commerce = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
const buyerId = psql(`SELECT id FROM users WHERE email='${A.buyerEmail}'`)
const sellerId = psql(`SELECT id FROM users WHERE email='${A.sellerEmail}'`)
const commerceId = psql(`SELECT id FROM admin_users WHERE email='${ROLE_ACCOUNTS.COMMERCE_ADMIN}'`)
ok('actors signed in', buyer && seller && courier && commerce)

// ── Devices ────────────────────────────────────────────────────────────────
const cfg = await get('/push/config')
ok('push config exposes a VAPID key', cfg.json?.web_enabled && cfg.json?.vapid_public_key?.length > 80, JSON.stringify(cfg.json))
const reg = async (token, path, body) => call('POST', path, { token, body })
ok('buyer registers browser', (await reg(buyer, '/push/subscriptions', { platform: 'WEB', ...newDevice('buyer'), device_label: 'Chrome sur Windows' })).status === 200)
ok('seller registers browser', (await reg(seller, '/push/subscriptions', { platform: 'WEB', ...newDevice('seller'), device_label: 'Edge sur Windows' })).status === 200)
const courierToken = `ExponentPushToken[e2e${A.stamp}courier00]`
ok('courier registers phone', (await reg(courier, '/push/subscriptions', { platform: 'EXPO', expo_token: courierToken, device_label: 'Pixel 7' })).status === 200)
ok('commerce admin registers browser', (await reg(commerce, '/admin/push/subscriptions', { platform: 'WEB', ...newDevice('admin') })).status === 200)
const ssrf = await reg(buyer, '/push/subscriptions', { platform: 'WEB', endpoint: 'http://169.254.169.254/latest', keys: newDevice('x').keys })
ok('internal endpoint refused (SSRF guard)', ssrf.status === 400, ssrf.status)

// ── Test push and recipient isolation ──────────────────────────────────────
await post('/push/test?audience=SELLER', seller)
const t1 = await waitPush('seller', (p) => p.type === 'PUSH_TEST')
ok('test push delivered and decrypted', !!t1 && t1.uid === sellerId && t1.link === '/seller/notifications', JSON.stringify(t1))
ok('web push carries VAPID auth + urgency', t1?._headers.auth === 'vapid t=' && t1?._headers.urgency === 'high', JSON.stringify(t1?._headers))
ok('buyer did not receive the seller test', !hasType('buyer', 'PUSH_TEST'))

// ── Order flow ─────────────────────────────────────────────────────────────
console.log('Order flow…')
const cats = await get('/categories', seller)
const categoryId = (data(cats) || [])[0]?.id
const prod = must('product', await post(`/businesses/${A.businessId}/products`, seller, {
  name: `Lampe push ${A.stamp}`, sku: `PUSH-${A.stamp}`, unit_price: 100, cost_price: 60, unit: 'PIECE', category_id: categoryId, self_rating: 4, publication_status: 'PUBLISHED'
}))
const productId = data(prod).id
const variant = must('variant', await post(`/businesses/${A.businessId}/products/${productId}/variants`, seller, { sku: `PUSH-V-${A.stamp}`, name: 'Standard', attributes: {}, sale_price: 100, unit: 'PIECE' }))
const variantId = data(variant).id
must('stock', await post(`/shops/${A.shopId}/stock`, seller, { variant_id: variantId, quantity: 5 }))

// Buyer follows the product and opts in to followed-product alerts.
ok('buyer follows product', (await call('PUT', `/watches/${productId}`, { token: buyer })).status === 200)
ok('watchlist consent', (await call('PUT', '/notifications/preferences/WATCHLIST', { token: buyer, body: { consent: true } })).json?.consented === true)

const order = must('order', await post('/buyer/orders', buyer, { shop_id: A.shopId, items: [{ product_id: productId, variant_id: variantId, quantity: 1 }], use_points: false }))
const orderId = data(order).id || data(order).order?.id
must('delivery', await post(`/buyer/orders/${orderId}/delivery`, buyer, {
  method: 'TBK_STANDARD', contact_name: 'Awa Mbuyi', phone: '+243810000000', address: '12 Avenue de la Paix, Gombe, Kinshasa',
  province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue de la Paix', building_number: '12', landmark: 'Face BN'
}))
await post(`/buyer/orders/${orderId}/payment`, buyer, { payment_method: 'CASH_ON_DELIVERY' })

const newOrder = await waitPush('seller', (p) => p.type === 'NEW_ORDER')
ok('seller: NEW_ORDER push → seller orders screen', newOrder?.link === `/seller/orders?orderId=${orderId}` && newOrder?.priority === 'HIGH', JSON.stringify(newOrder))
const adminNew = await waitPush('admin', (p) => p.type === 'NEW_ORDER', 6000)
ok('admin: NEW_ORDER is in-app only (LOW, no push)', !adminNew)

must('accept', await post(`/orders/${orderId}/accept`, seller))
const accepted = await waitPush('buyer', (p) => p.type === 'ORDER_ACCEPTED')
ok('buyer: ORDER_ACCEPTED push → /orders/:id', accepted?.link === `/orders/${orderId}` && accepted?.audience === 'BUYER', JSON.stringify(accepted))
must('prepare', await post(`/orders/${orderId}/prepare`, seller))
// Courier assignment, refusal (bug D1), reassignment.
const available = data(await get('/admin/commerce/couriers/available', commerce)) || []
const courierRow = (Array.isArray(available) ? available : available.couriers || []).find((c) => c.email === A.courierEmail)
must('assign', await post(`/admin/commerce/orders/${orderId}/assign-courier`, commerce, { courier_id: courierRow?.id, notes: 'push e2e' }))
const mission = await waitPush(courierToken, (m) => m.data?.type === 'COURIER_ASSIGNED')
ok('courier phone: mission push via Expo (HIGH, orders channel)', mission?.data?.app_link === `/courier/${orderId}` && mission?.priority === 'high' && mission?.channelId === 'orders', JSON.stringify(mission))

must('courier rejects', await post(`/courier/missions/${orderId}/reject`, courier, { reason: 'Pneu crevé' }))
const rejected = await waitPush('admin', (p) => p.type === 'COURIER_MISSION_REJECTED')
ok('admin: mission refused alert with reason', !!rejected && rejected.body.includes('Pneu crevé') && rejected.link === '/admin/commerce/delivery-assignments', JSON.stringify(rejected))
await sleep(6000)
ok('buyer NOT told "order rejected" when a courier refuses (bug D1 fixed)', !hasType('buyer', 'ORDER_REJECTED'))
const buyerTypes = (data(await get('/notifications?audience=BUYER&limit=50', buyer))?.items || []).map((n) => n.type)
ok('…not even in-app', !buyerTypes.includes('ORDER_REJECTED'), buyerTypes.join(','))

await patch('/courier/availability', courier, { availability: 'AVAILABLE' })
must('reassign', await post(`/admin/commerce/orders/${orderId}/assign-courier`, commerce, { courier_id: courierRow?.id, notes: 'push e2e bis' }))
must('courier accepts', await post(`/courier/missions/${orderId}/accept`, courier))
await sleep(6000)
ok('buyer gets no second "order accepted" when the courier accepts (bug D2 fixed)', (received.get('buyer') || []).filter((p) => p.type === 'ORDER_ACCEPTED').length === 1)

must('ready', await post(`/orders/${orderId}/tracking/status`, seller, { status: 'READY' }))
const readyCourier = await waitPush(courierToken, (m) => m.data?.type === 'ORDER_READY_FOR_PICKUP')
ok('courier phone: order ready for pickup', !!readyCourier && readyCourier.data?.app_link === `/courier/${orderId}`, JSON.stringify(readyCourier))
const readyAdmin = await waitPush('admin', (p) => p.type === 'ORDER_READY_FOR_PICKUP')
ok('admin: order ready alert (HIGH, admin principal)', readyAdmin?.kind === 'ADMIN' && readyAdmin?.uid === commerceId && readyAdmin?.priority === 'HIGH', JSON.stringify(readyAdmin))
await sleep(6000)
ok('buyer: PREPARING and READY (delivery) stay in-app (LOW)', !hasType('buyer', 'ORDER_PREPARING') && !hasType('buyer', 'ORDER_READY_FOR_PICKUP'))
const inApp = data(await get('/notifications?audience=BUYER&limit=50', buyer))
ok('…but they are in the buyer’s in-app list', (inApp?.items || []).some((n) => n.type === 'ORDER_PREPARING'), JSON.stringify(inApp?.items?.map((n) => n.type)))

// Private message: content hidden on the lock screen.
const msg = await post(`/orders/${orderId}/messages`, buyer, { body: 'Mon code portail est 4512', recipient: 'ADMIN' })
const adminMsg = await waitPush('admin', (p) => p.type === 'NEW_MESSAGE')
ok('admin: message push hides the content', msg.status < 300 && !!adminMsg && !adminMsg.body.includes('4512'), `${msg.status} ${JSON.stringify(adminMsg)}`)

// Delivery leg: pickup scan, departure, arrival.
const pkg = data(await get(`/orders/${orderId}/package-qr`, seller))
const pickup = await post('/courier/scans/pickup', courier, { token: pkg?.token, order_id: orderId })
const picked = await waitPush('seller', (p) => p.type === 'COURIER_PICKED_UP')
ok('seller: parcel picked up', pickup.status === 200 && !!picked, `${pickup.status} ${errText(pickup)}`)
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
must('expected delivery', await post(`/courier/missions/${orderId}/expected-delivery`, courier, { date: tomorrow, slot: 'EVENING' }))
must('start delivery', await post(`/courier/missions/${orderId}/start`, courier))
const transit = await waitPush('buyer', (p) => p.type === 'DELIVERY_IN_TRANSIT')
ok('buyer: in transit → live tracking page', transit?.link === `/orders/${orderId}/tracking`, JSON.stringify(transit))
ok('buyer gets one "on its way" push, not two (D3 fixed)', !hasType('buyer', 'COURIER_PICKED_UP'))
must('arrive', await post(`/courier/missions/${orderId}/arrive`, courier))
const arrived = await waitPush('buyer', (p) => p.type === 'COURIER_ARRIVED')
ok('buyer: courier arrived (HIGH)', arrived?.priority === 'HIGH', JSON.stringify(arrived))

// ── Shop moderation + per-category preference ─────────────────────────────
must('suspend shop', await post(`/admin/commerce/shops/${A.shopId}/status`, commerce, { status: 'SUSPENDED', reason: 'Contrôle qualité' }))
const susp = await waitPush('seller', (p) => p.type === 'SHOP_SUSPENDED')
ok('seller: shop suspended push with reason', !!susp && susp.body.includes('Contrôle qualité') && susp.link === '/seller/shops', JSON.stringify(susp))
ok('seller turns SHOP push off', (await call('PUT', '/notifications/preferences/SHOP', { token: seller, body: { push_enabled: false } })).json?.push_enabled === false)
must('reactivate shop', await post(`/admin/commerce/shops/${A.shopId}/status`, commerce, { status: 'ACTIVE', reason: 'Contrôle terminé' }))
await sleep(7000)
ok('…reactivation not pushed', !hasType('seller', 'SHOP_REACTIVATED'))
const sellerTypes = (data(await get('/notifications?audience=SELLER&limit=50', seller))?.items || []).map((n) => n.type)
ok('…but present in-app', sellerTypes.includes('SHOP_REACTIVATED'), sellerTypes.join(','))
ok('security push cannot be disabled', (await call('PUT', '/notifications/preferences/SECURITY', { token: seller, body: { push_enabled: false } })).status === 409)

// ── Price drop on a followed product ──────────────────────────────────────
psql(`UPDATE product_watches SET last_price = 100, last_in_stock = true WHERE user_id='${buyerId}' AND product_id='${productId}'`)
await call('PATCH', `/variants/${variantId}`, { token: seller, body: { sale_price: 80 } })
console.log('Waiting for the watch sweep (up to 2 min)…')
const drop = await waitPush('buyer', (p) => p.type === 'PRICE_DROP', 150000)
ok('buyer: price drop on followed product → product page', drop?.link === `/products/${productId}` && /80/.test(drop.body) && /100/.test(drop.body), JSON.stringify(drop))

// ── Marketing consent and frequency cap ───────────────────────────────────
const campaign = (title) => post('/admin/commerce/notifications/campaigns', commerce, { title, body: 'Livraison offerte ce week-end', target_path: `/products/${productId}` })
await campaign('Avant consentement')
await sleep(6000)
ok('no marketing without explicit consent', !hasType('buyer', 'MARKETING_CAMPAIGN'))
ok('buyer consents to marketing', (await call('PUT', '/notifications/preferences/MARKETING', { token: buyer, body: { consent: true } })).json?.consented === true)
await campaign('Offre du week-end')
const promo = await waitPush('buyer', (p) => p.type === 'MARKETING_CAMPAIGN')
ok('marketing delivered after consent → target page', promo?.link === `/products/${productId}`, JSON.stringify(promo))
await campaign('Deuxième offre')
await sleep(7000)
ok('daily marketing cap (1/day) respected', (received.get('buyer') || []).filter((p) => p.type === 'MARKETING_CAMPAIGN').length === 1)
await call('PUT', '/notifications/preferences/MARKETING', { token: buyer, body: { consent: false } })

// ── Security alert ─────────────────────────────────────────────────────────
await login(A.buyerEmail, 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Firefox/130.0')
const newLogin = await waitPush('buyer', (p) => p.type === 'NEW_LOGIN')
ok('buyer: new-device sign-in alert', !!newLogin && newLogin.body.includes('Firefox sur Android'), JSON.stringify(newLogin))
await login(A.buyerEmail, 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Firefox/131.0')
await sleep(6000)
ok('same device after a browser update: no second alert', (received.get('buyer') || []).filter((p) => p.type === 'NEW_LOGIN').length === 1)

// ── Delivery failures: retry, expired device, sign-out ─────────────────────
behaviour.set('seller', [503])
await post('/push/test?audience=SELLER', seller)
await sleep(5000)
const retry = psql(`SELECT d.status||':'||d.attempts FROM push_deliveries d JOIN notifications n ON n.id=d.notification_id WHERE n.user_id='${sellerId}' AND n.type='PUSH_TEST' ORDER BY d.created_at DESC LIMIT 1`)
ok('503 from push service → queued for retry', retry === 'PENDING:1', retry)
psql(`UPDATE push_deliveries SET next_attempt_at = NOW() WHERE status='PENDING'`)
const retried = await waitPush('seller', (p) => p.type === 'PUSH_TEST' && p !== t1, 10000)
ok('…delivered on retry', !!retried)

behaviour.set('seller', [410])
await post('/push/test?audience=SELLER', seller)
await sleep(6000)
const revoked = psql(`SELECT COALESCE(revoked_reason,'') FROM push_subscriptions WHERE endpoint='${HOST}/web/seller'`)
ok('410 Gone → device removed', revoked === 'GONE', revoked)

const unreg = await post('/push/unregister', undefined, { endpoint: `${HOST}/web/buyer` })
const before = (received.get('buyer') || []).length
await post('/push/test?audience=BUYER', buyer)
await sleep(6000)
ok('signed-out device stops receiving', unreg.status === 200 && (received.get('buyer') || []).length === before)

// Password reset: security alert, then the account's devices are cut off.
const courierId = psql(`SELECT id FROM users WHERE email='${A.courierEmail}'`)
const rawReset = randomBytes(32).toString('hex')
psql(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ('${courierId}', encode(sha256('${rawReset}'::bytea), 'hex'), NOW() + interval '1 hour')`)
const newPassword = `${A.password}x`
const reset = await post('/auth/reset-password', undefined, { token: rawReset, password: newPassword, password_confirmation: newPassword })
const pwd = await waitPush(courierToken, (m) => m.data?.type === 'PASSWORD_CHANGED')
ok('courier phone: password changed alert', reset.status === 200 && !!pwd && pwd.priority === 'high', `${reset.status} ${errText(reset)}`)
const graceLeft = Number(psql(`SELECT EXTRACT(EPOCH FROM revoked_at - NOW())::int FROM push_subscriptions WHERE expo_token='${courierToken}'`))
ok('…and its devices are revoked after a short grace', graceLeft > 200 && graceLeft <= 300, graceLeft)

const stats = await get('/admin/push/stats', await adminLogin(ROLE_ACCOUNTS.TECHNICAL_ADMIN || ROLE_ACCOUNTS.SUPER_ADMIN))
console.log('Delivery stats (24 h):', JSON.stringify(stats.json?.stats?.by_status))

server.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll push checks passed')
process.exit(failures ? 1 : 0)
