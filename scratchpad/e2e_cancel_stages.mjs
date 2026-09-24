// End-to-end check of staged buyer cancellation, buyer-not-found, return to
// seller, expected delivery date and real-time order events, against the local
// API. Uses the E2E fixture accounts created by e2e_live_setup.mjs.
import { execFileSync } from 'node:child_process'

const API = 'http://localhost:8080/api/v1'
const PW = 'E2eTest!2026'
const STAMP = process.argv[2] || '1790207754829'
const BUYER = `e2e_buyer_${STAMP}@test.local`
const SELLER = `e2e_seller_${STAMP}@test.local`
const COURIER = `e2e_courier_${STAMP}@tbk.test`
const ADMIN = ['commerce.test@tbkmarket.com', 'TestAdmin@2025!']

const sql = (q) => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-F', '|', '-c', q]).toString().trim()

async function call(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text(); let json; try { json = JSON.parse(text) } catch { json = text }
  return { status: r.status, data: json?.data ?? json, raw: json }
}
async function ok(method, path, token, body) {
  const res = await call(method, path, token, body)
  if (res.status >= 300) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(res.raw)}`)
  return res.data
}
const login = async (email, pw = PW, admin = false) => (await ok('POST', admin ? '/admin/auth/login' : '/auth/login', null, { email, password: pw })).access_token

// ---- real-time listeners -------------------------------------------------
const events = [] // { role, t, order_id, status, delivery_status }
function listen(role, path, token) {
  const ctrl = new AbortController()
  ;(async () => {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ''
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2)
        const data = block.split('\n').find((l) => l.startsWith('data: '))
        if (!data || !block.includes('event: order')) continue
        const ev = JSON.parse(data.slice(6)); events.push({ role, t: Date.now(), ...ev })
      }
    }
  })().catch(() => {})
  return ctrl
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Waits until every role saw the order reach the given delivery/order status; returns latency per role.
async function seen(orderId, since, match, roles = ['buyer', 'seller', 'courier', 'admin']) {
  const deadline = Date.now() + 5000
  const lat = {}
  while (Date.now() < deadline) {
    for (const role of roles) {
      if (lat[role] !== undefined) continue
      const hit = events.find((e) => e.role === role && e.order_id === orderId && e.t >= since && match(e))
      if (hit) lat[role] = hit.t - since
    }
    if (roles.every((r) => lat[r] !== undefined)) return lat
    await sleep(50)
  }
  return lat
}

// ---- order helpers -------------------------------------------------------
const tokens = {}
let productId, variantId, shopId, courierUserId
async function newOrder(label) {
  const created = await ok('POST', '/buyer/checkout', tokens.buyer, { items: [{ product_id: productId, variant_id: variantId, shop_id: shopId, quantity: 1 }], use_points: false, idempotency_key: `cs-${label}-${Date.now()}` })
  const id = created.order_ids[0]
  await ok('POST', `/buyer/orders/${id}/delivery`, tokens.buyer, { method: 'TBK_STANDARD', use_points_for_delivery: false, contact_name: 'E2E Buyer', phone: '+243817754829', province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue Stages', building_number: '7', landmark: label })
  await ok('POST', `/buyer/orders/${id}/payment`, tokens.buyer, { payment_method: 'CASH_ON_DELIVERY' })
  return id
}
async function sellerReady(id) {
  await ok('POST', `/orders/${id}/accept`, tokens.seller, {})
  await ok('POST', `/orders/${id}/prepare`, tokens.seller, {})
  await ok('POST', `/orders/${id}/tracking/status`, tokens.seller, { status: 'READY' })
}
const assign = (id) => ok('POST', `/admin/commerce/orders/${id}/assign-courier`, tokens.admin, { courier_id: courierUserId, notes: 'stages test' })
const courier = (id, step, body = {}) => call('POST', `/courier/missions/${id}/${step}`, tokens.courier, body)
const orderRow = (id) => { const [status, ds, stage, attempts, date, slot, returned] = sql(`SELECT status, COALESCE(delivery_status,''), COALESCE(cancelled_stage,''), delivery_attempts, COALESCE(expected_delivery_date::text,''), COALESCE(expected_delivery_slot,''), returned_to_seller_at IS NOT NULL FROM orders WHERE id='${id}'`).split('|'); return { status, ds, stage, attempts: +attempts, date, slot, returned: returned === 't' } }
const reserved = () => +sql(`SELECT reserved_quantity FROM inventory WHERE variant_id='${variantId}'`)
const courierAvail = () => sql(`SELECT availability FROM couriers WHERE user_id='${courierUserId}'`)
const day = (offset) => { const d = new Date(Date.now() + 3600e3 + offset * 864e5); return d.toISOString().slice(0, 10) }

const results = []
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

async function main() {
  tokens.buyer = await login(BUYER); tokens.seller = await login(SELLER); tokens.courier = await login(COURIER)
  tokens.admin = await login(ADMIN[0], ADMIN[1], true)
  ;[productId, variantId, shopId] = sql(`SELECT p.id, v.id, i.shop_id FROM products p JOIN product_variants v ON v.product_id=p.id JOIN inventory i ON i.variant_id=v.id WHERE p.name='E2E Test Sneakers ${STAMP}' AND v.name='Black / 40'`).split('|')
  courierUserId = sql(`SELECT id FROM users WHERE email='${COURIER}'`)
  sql(`UPDATE couriers SET availability='AVAILABLE' WHERE user_id='${courierUserId}' AND availability='BUSY' AND NOT EXISTS (SELECT 1 FROM orders WHERE assigned_courier_id='${courierUserId}' AND status NOT IN ('CANCELLED','RECEIVED','COMPLETED'))`)

  const streams = [listen('buyer', '/events/stream', tokens.buyer), listen('seller', '/events/stream', tokens.seller), listen('courier', '/events/stream', tokens.courier), listen('admin', '/admin/commerce/events/stream', tokens.admin)]
  await sleep(800)

  // 1. Not assigned yet --------------------------------------------------
  console.log('\n== 1. Annulation avant assignation')
  let r0 = reserved(); let id = await newOrder('stage1'); await sellerReady(id)
  check('stock réservé à la commande', reserved() === r0 + 1, `${r0} -> ${reserved()}`)
  let t = Date.now(); let res = await call('POST', `/buyer/orders/${id}/cancel`, tokens.buyer)
  let o = orderRow(id)
  check('acheteur annule (non assignée)', res.status === 200 && o.status === 'CANCELLED' && o.stage === 'NOT_ASSIGNED', `${res.status} ${o.status} ${o.stage}`)
  check('stock rendu immédiatement', reserved() === r0, `reserved=${reserved()}`)
  let lat = await seen(id, t, (e) => e.status === 'CANCELLED', ['buyer', 'seller', 'admin'])
  check('temps réel: acheteur, vendeur, admin notifiés', Object.keys(lat).length === 3, JSON.stringify(lat))

  // 2. Courier assigned, parcel still at the shop ------------------------
  console.log('\n== 2. Annulation livreur assigné (avant récupération)')
  r0 = reserved(); id = await newOrder('stage2'); await sellerReady(id); await assign(id)
  await courier(id, 'accept'); check('livreur occupé après acceptation', courierAvail() === 'BUSY', courierAvail())
  t = Date.now(); res = await call('POST', `/buyer/orders/${id}/cancel`, tokens.buyer); o = orderRow(id)
  check('acheteur annule (livreur assigné)', res.status === 200 && o.status === 'CANCELLED' && o.stage === 'COURIER_ASSIGNED' && o.ds === 'CANCELLED', `${res.status} ${o.status} ${o.stage} ${o.ds}`)
  check('stock rendu, livreur libéré', reserved() === r0 && courierAvail() === 'AVAILABLE', `reserved=${reserved()} courier=${courierAvail()}`)
  lat = await seen(id, t, (e) => e.status === 'CANCELLED')
  check('temps réel: les 4 rôles notifiés (dont le livreur)', Object.keys(lat).length === 4, JSON.stringify(lat))

  // 3. In delivery: parcel returns to the seller ---------------------------
  console.log('\n== 3. Annulation en cours de livraison -> retour vendeur')
  r0 = reserved(); id = await newOrder('stage3'); await sellerReady(id); await assign(id)
  await courier(id, 'accept'); await courier(id, 'pickup')
  res = await courier(id, 'start')
  check('démarrage refusé sans date de livraison', res.status === 400 && JSON.stringify(res.raw).includes('EXPECTED_DELIVERY_REQUIRED'), `${res.status}`)
  res = await courier(id, 'expected-delivery', { date: day(-1), slot: 'MORNING' })
  check('date passée refusée', res.status === 400, `${res.status}`)
  t = Date.now(); res = await courier(id, 'expected-delivery', { date: day(1), slot: 'AFTERNOON' }); o = orderRow(id)
  check('livreur saisit date + créneau', res.status === 200 && o.date === day(1) && o.slot === 'AFTERNOON', `${o.date} ${o.slot}`)
  lat = await seen(id, t, () => true)
  check('temps réel: date poussée aux 4 rôles', Object.keys(lat).length === 4, JSON.stringify(lat))
  const bTrack = await ok('GET', `/buyer/orders/${id}/tracking`, tokens.buyer)
  const sOrder = await ok('GET', `/orders/${id}`, tokens.seller)
  const aOrder = await ok('GET', `/admin/commerce/orders/${id}`, tokens.admin)
  const sDate = (sOrder.order ?? sOrder).expected_delivery_date
  check('date visible acheteur / vendeur / admin', bTrack.expected_delivery_date === day(1) && sDate === day(1) && aOrder.order.expected_delivery_date === day(1), `buyer=${bTrack.expected_delivery_date} seller=${sDate} admin=${aOrder.order.expected_delivery_date}`)
  await courier(id, 'start')
  t = Date.now(); res = await call('POST', `/buyer/orders/${id}/cancel`, tokens.buyer); o = orderRow(id)
  check('acheteur annule en route -> retour vendeur', res.status === 200 && o.status === 'CANCELLED' && o.stage === 'IN_DELIVERY' && o.ds === 'RETURNING_TO_SELLER', `${res.status} ${o.status} ${o.stage} ${o.ds}`)
  check('stock toujours réservé, livreur encore occupé', reserved() === r0 + 1 && courierAvail() === 'BUSY', `reserved=${reserved()} courier=${courierAvail()}`)
  const missions = await ok('GET', '/courier/missions', tokens.courier)
  check('la mission retour reste visible pour le livreur', (missions || []).some((m) => m.order_id === id && m.delivery_status === 'RETURNING_TO_SELLER'))
  lat = await seen(id, t, (e) => e.delivery_status === 'RETURNING_TO_SELLER')
  check('temps réel: retour annoncé aux 4 rôles', Object.keys(lat).length === 4, JSON.stringify(lat))
  t = Date.now(); res = await call('POST', `/orders/${id}/confirm-return`, tokens.seller); o = orderRow(id)
  check('vendeur confirme le retour', res.status === 200 && o.ds === 'RETURNED_TO_SELLER' && o.returned, `${res.status} ${o.ds}`)
  check('stock rendu et livreur libéré après retour', reserved() === r0 && courierAvail() === 'AVAILABLE', `reserved=${reserved()} courier=${courierAvail()}`)
  lat = await seen(id, t, (e) => e.delivery_status === 'RETURNED_TO_SELLER')
  check('temps réel: retour confirmé aux 4 rôles', Object.keys(lat).length === 4, JSON.stringify(lat))

  // 4. Buyer not found: new attempt, then return -------------------------
  console.log('\n== 4. Acheteur introuvable -> nouvelle tentative, puis retour')
  r0 = reserved(); id = await newOrder('stage4'); await sellerReady(id); await assign(id)
  await courier(id, 'accept'); await courier(id, 'pickup'); await courier(id, 'expected-delivery', { date: day(0), slot: 'EVENING' })
  await courier(id, 'start'); await courier(id, 'arrive')
  res = await courier(id, 'buyer-not-found', { reason: 'Acheteur injoignable' })
  check('nouvelle tentative exige une nouvelle date', res.status === 400, `${res.status}`)
  t = Date.now(); res = await courier(id, 'buyer-not-found', { reason: 'Acheteur injoignable', next_date: day(2), next_slot: 'MORNING' }); o = orderRow(id)
  check('1re absence -> reprogrammée', res.status === 200 && res.data.outcome === 'RESCHEDULED' && o.ds === 'PICKED_UP' && o.attempts === 1 && o.date === day(2) && o.slot === 'MORNING', `${res.status} ${JSON.stringify(res.data)} ${o.ds} ${o.date} ${o.slot}`)
  lat = await seen(id, t, (e) => e.delivery_status === 'PICKED_UP')
  check('temps réel: nouvelle date poussée aux 4 rôles', Object.keys(lat).length === 4, JSON.stringify(lat))
  await courier(id, 'start')
  t = Date.now(); res = await courier(id, 'buyer-not-found', { reason: 'Toujours absent' }); o = orderRow(id)
  check('2e absence -> annulée, retour vendeur', res.status === 200 && res.data.outcome === 'RETURNING_TO_SELLER' && o.status === 'CANCELLED' && o.stage === 'BUYER_NOT_FOUND' && o.ds === 'RETURNING_TO_SELLER' && o.attempts === 2, `${res.status} ${JSON.stringify(res.data)} ${o.status} ${o.stage}`)
  lat = await seen(id, t, (e) => e.status === 'CANCELLED')
  check('temps réel: annulation poussée aux 4 rôles', Object.keys(lat).length === 4, JSON.stringify(lat))
  res = await call('POST', `/admin/commerce/orders/${id}/confirm-return`, tokens.admin); o = orderRow(id)
  check('admin commerce confirme le retour', res.status === 200 && o.ds === 'RETURNED_TO_SELLER', `${res.status} ${o.ds}`)
  check('stock rendu et livreur libéré', reserved() === r0 && courierAvail() === 'AVAILABLE', `reserved=${reserved()} courier=${courierAvail()}`)

  // Guard: a handed-over order can no longer be cancelled -----------------
  console.log('\n== Garde-fous')
  res = await call('POST', `/buyer/orders/${id}/cancel`, tokens.buyer)
  check('annulation refusée sur une commande déjà annulée', res.status >= 400, `${res.status}`)
  const other = sql(`SELECT id FROM orders WHERE status='COMPLETED' AND buyer_profile_id=(SELECT id FROM buyer_profiles WHERE user_id=(SELECT id FROM users WHERE email='${BUYER}')) LIMIT 1`)
  if (other) { res = await call('POST', `/buyer/orders/${other}/cancel`, tokens.buyer); check('annulation refusée après remise (commande terminée)', res.status >= 400, `${res.status}`) }

  streams.forEach((s) => s.abort())
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`)
  process.exit(failed.length ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
