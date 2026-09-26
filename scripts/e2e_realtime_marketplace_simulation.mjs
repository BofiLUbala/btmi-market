// Real-time marketplace simulation, end to end, against the live API.
//
//   Finance sets the TBK delivery fee -> a seller lists a (fake) product on the
//   market -> a (fake) buyer agent finds it, checks out and sees the delivery fee
//   in the quote -> Commerce assigns a courier -> the seller accepts and makes
//   the order ready -> the courier picks up and delivers -> the buyer confirms
//   and rates the order.
//
// Every role keeps a live SSE stream open (/events/stream) so the run also
// proves each party is pushed the change as it happens.
//
//   node scripts/e2e_realtime_marketplace_simulation.mjs
//
// Needs the stack from backend/docker-compose.yml and the seeded test admins.
// Accounts are activated by writing a known activation token into Postgres and
// calling the real /auth/activate endpoint, so E2E_TEST_MODE is not required.
// Set E2E_KEEP=1 to keep the simulated product and the Finance tariff in place
// (useful to replay the buyer journey in the web or mobile UI afterwards).
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { API, ROLE_ACCOUNTS, adminLogin, get, post, patch, call, check, section, summary, errText, sleep } from './e2e_admin_lib.mjs'

const PG = process.env.E2E_PG_CONTAINER || 'backend-postgres-1'
const PG_USER = process.env.E2E_PG_USER || 'btmi_user'
const PG_DB = process.env.E2E_PG_DB || 'btmi_market'
const KEEP = process.env.E2E_KEEP === '1'
const OUT = process.env.E2E_OUT || ''

const stamp = Date.now().toString(36)
const password = `Sim!Pass-${stamp}-7`
const ADDR = { province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue de la Paix', building_number: '12', landmark: 'Face BN' }
const PRICE = 25
const QTY = 2
const FEE = 2.75
const phone = () => `+2438${Math.floor(1e7 + Math.random() * 9e7)}`
const list = (d, ...keys) => { for (const k of keys) if (Array.isArray(d?.[k])) return d[k]; return Array.isArray(d) ? d : [] }
const money = (n) => Math.round(Number(n) * 100) / 100
const log = (who, msg) => console.log(`  ${new Date().toISOString().slice(11, 23)} [${who}] ${msg}`)

function psql(sql) {
  const r = spawnSync('docker', ['exec', PG, 'psql', '-U', PG_USER, '-d', PG_DB, '-t', '-A', '-c', sql], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`psql: ${r.stderr}`)
  return (r.stdout || '').trim()
}

// Activation: plant a token we know, then go through the real endpoint.
async function activate(email) {
  const raw = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  const id = psql(`SELECT id FROM users WHERE email='${email}'`)
  if (!id) return false
  psql(`INSERT INTO account_activation_tokens (user_id, token_hash, purpose, expires_at) VALUES ('${id}', '${hash}', 'ACTIVATION', NOW() + interval '1 hour')`)
  const r = await get(`/auth/activate?token=${raw}`)
  return r.status === 200
}

// A live SSE subscription per role; each "order" event is recorded with a time.
function openStream(who, path, token) {
  const events = []
  const ctrl = new AbortController()
  const ready = (async () => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: ctrl.signal })
    if (!res.ok) throw new Error(`${who} stream HTTP ${res.status}`)
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let resolveReady
    const first = new Promise((r) => { resolveReady = r })
    ;(async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i); buf = buf.slice(i + 2)
            const kind = block.match(/^event: (.*)$/m)?.[1]
            const data = block.match(/^data: (.*)$/m)?.[1]
            if (kind === 'ready') resolveReady()
            else if (kind) { let d = {}; try { d = JSON.parse(data) } catch {} ; events.push({ at: Date.now(), kind, ...d }) }
          }
        }
      } catch { /* aborted */ }
    })()
    await first
  })()
  return { who, events, ready, close: () => ctrl.abort() }
}

// Wait until the stream saw an event for this order after `since`.
async function pushed(stream, orderId, since, ms = 4000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const ev = stream.events.find((e) => e.at >= since && (e.order_id === orderId || e.kind === 'resync'))
    if (ev) return ev.at - since
    await sleep(50)
  }
  return null
}

const S = {}
let F, C, originalTariff
const streams = []

// One step of the story: run it, then check every listed role was pushed.
async function step(label, fn, notify = []) {
  const since = Date.now()
  const r = await fn()
  const ok = r && r.status >= 200 && r.status < 300
  check(label, ok, r ? errText(r) : 'no response')
  if (ok && S.orderId) {
    for (const st of notify) {
      const lag = await pushed(st, S.orderId, since)
      check(`  ↳ ${st.who} notified live`, lag !== null, 'no SSE event within 4 s')
      if (lag !== null) log(st.who, `SSE push after ${lag} ms`)
    }
  }
  return r
}

const buyerView = async () => (await get(`/buyer/orders/${S.orderId}/tracking`, S.buyer)).data
const orderOf = (d) => d?.order ?? d
const done0 = (d) => typeof d === 'string' ? d : null
const STOP = process.env.E2E_STOP || ''
const refused = (r, code) => r && r.status >= 400 && r.status < 500 && (!code || JSON.stringify(r.json ?? '').includes(code))

async function main() {
  section('0. Actors')
  F = await adminLogin(ROLE_ACCOUNTS.FINANCE_SUPPORT_ADMIN)
  C = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
  check('Finance + Commerce admins sign in', F && C)
  if (!F || !C) return

  const buyerEmail = `sim.buyer.${stamp}@example.com`
  const sellerEmail = `sim.seller.${stamp}@example.com`
  const courierEmail = `sim.courier.${stamp}@example.com`
  let r = await post('/auth/register', undefined, { first_name: 'Agent', last_name: 'Acheteur', phone: phone(), email: buyerEmail, password, password_confirmation: password, ...ADDR })
  check('fake buyer agent registers', r.status === 201, errText(r))
  r = await post('/auth/register/seller', undefined, { first_name: 'Sim', last_name: 'Vendeur', phone: phone(), email: sellerEmail, password, password_confirmation: password, ...ADDR })
  check('fake seller registers', r.status === 201, errText(r))
  check('buyer activated', await activate(buyerEmail))
  check('seller activated', await activate(sellerEmail))
  const login = async (email) => (await post('/auth/login', undefined, { email, password })).json?.access_token
  S.buyer = await login(buyerEmail); S.seller = await login(sellerEmail)
  check('buyer + seller sign in', S.buyer && S.seller)
  if (!S.buyer || !S.seller) return
  Object.assign(S, { buyerEmail, sellerEmail, courierEmail, password })

  section('1. Finance sets the delivery fee')
  originalTariff = (await get('/admin/finance/delivery-fees', F)).data
  r = await patch('/admin/finance/delivery-fees', F, { default_fee: FEE, clear_threshold: true, reason: `Simulation ${stamp}: tarif livraison` })
  check(`Finance sets TBK delivery at ${FEE} $`, r.status === 200 && r.data?.default_fee === FEE, errText(r))
  const kin = list((await get('/locations/cities')).data, 'items').find((c) => c.name === 'Kinshasa')
  S.kinZone = originalTariff?.zones?.find((z) => z.city_id === kin?.id)
  if (S.kinZone) {
    // A Kinshasa zone would override the default; park it for the run.
    await call('DELETE', `/admin/finance/delivery-fees/zones/${kin.id}`, { token: F, body: { reason: `Simulation ${stamp}: zone parked` } })
  }
  const pub = (await get('/config/delivery-fees')).data
  check('public tariff (what web + mobile read) shows the new fee', pub?.default_fee === FEE, JSON.stringify(pub))

  section('2. Seller lists a fake product on the market')
  r = await post('/businesses', S.seller, { name: `Sim Boutique ${stamp}`, business_type: 'RETAIL', category: 'general', phone: phone(), email: sellerEmail, country: 'DRC', default_currency: 'USD', ...ADDR })
  S.businessId = r.data?.id
  check('business created', S.businessId, errText(r))
  r = await post(`/businesses/${S.businessId}/shops`, S.seller, { name: `Sim Shop ${stamp}`, type: 'PHYSICAL', phone: phone(), address: '12 Avenue de la Paix, Gombe', ...ADDR })
  S.shopId = r.data?.id
  check('shop created', S.shopId, errText(r))
  const categoryId = list((await get('/categories', S.seller)).data, 'categories', 'items')[0]?.id
  S.productName = `Casque Audio Simulation ${stamp}`
  r = await post(`/businesses/${S.businessId}/products`, S.seller, { name: S.productName, description: 'Produit fictif créé par la simulation E2E temps réel.', sku: `SIM-${stamp}`, unit_price: PRICE, cost_price: 12, unit: 'PIECE', category_id: categoryId, self_rating: 4, publication_status: 'PUBLISHED' })
  S.productId = r.data?.id
  check('product created and published', S.productId, errText(r))
  r = await post(`/businesses/${S.businessId}/products/${S.productId}/variants`, S.seller, { sku: `SIM-V-${stamp}`, name: 'Noir', attributes: { color: 'Noir' }, sale_price: PRICE, unit: 'PIECE' })
  S.variantId = r.data?.id
  check('variant created', S.variantId, errText(r))
  r = await post(`/shops/${S.shopId}/stock`, S.seller, { variant_id: S.variantId, quantity: 10 })
  check('stock received (10)', r.status < 300, errText(r))

  section('3. Buyer agent finds it on the market')
  r = await get(`/marketplace/search?q=${encodeURIComponent(S.productName)}`, S.buyer)
  let found = JSON.stringify(r.json ?? '').includes(S.productId)
  if (!found) { r = await get(`/marketplace/shops/${S.shopId}/products`, S.buyer); found = JSON.stringify(r.json ?? '').includes(S.productId) }
  check('product is visible on the marketplace', found, errText(r))
  r = await get(`/marketplace/products/${S.productId}`, S.buyer)
  check('product page opens', r.status === 200, errText(r))
  await post('/buyer/profile', S.buyer, { first_name: 'Agent', last_name: 'Acheteur', phone: phone(), email: buyerEmail, ...ADDR })

  if (STOP === 'catalog') return

  section('4. Checkout: delivery fee shown and totalled')
  const items = [{ product_id: S.productId, variant_id: S.variantId, shop_id: S.shopId, quantity: QTY }]
  r = await post('/buyer/cart/preview', S.buyer, { items, use_points: false })
  check('cart preview', r.status === 200, errText(r))
  const subtotal = money(PRICE * QTY)
  check(`cart subtotal = ${QTY} × ${PRICE} = ${subtotal}`, money(r.data?.subtotal) === subtotal, JSON.stringify(r.data)?.slice(0, 300))
  r = await post('/buyer/checkout', S.buyer, { items, use_points: false, idempotency_key: `sim-${stamp}` })
  const orders = list(r.data, 'orders')
  S.orderId = orders[0]?.id ?? orders[0]?.order?.id ?? r.data?.order_ids?.[0]
  check('checkout creates the order', r.status < 300 && S.orderId, errText(r))
  if (!S.orderId) return

  // Everyone subscribes before the order moves, as the apps do.
  streams.push(openStream('buyer', '/events/stream', S.buyer))
  streams.push(openStream('seller', '/events/stream', S.seller))
  streams.push(openStream('commerce', '/admin/commerce/events/stream', C))
  await Promise.all(streams.map((s) => s.ready))
  const [BUY, SEL, COM] = streams
  check('buyer, seller and Commerce streams are live', true)

  r = await post(`/orders/${S.orderId}/accept`, S.seller)
  check('SELLER cannot accept before the address is confirmed (409)', refused(r, 'DELIVERY_METHOD_REQUIRED'), errText(r))
  r = await get(`/buyer/orders/${S.orderId}/delivery-options`, S.buyer)
  const opt = list(r.data, 'options').find((o) => o.method === 'TBK_STANDARD')
  check(`delivery step offers TBK at ${FEE} $`, opt?.fee === FEE, JSON.stringify(r.data))
  r = await step('buyer selects TBK delivery', () => post(`/buyer/orders/${S.orderId}/delivery`, S.buyer, { method: 'TBK_STANDARD', contact_name: 'Agent Acheteur', phone: phone(), address: '12 Avenue de la Paix, Gombe, Kinshasa', ...ADDR }), [SEL])
  r = await post(`/orders/${S.orderId}/accept`, S.seller)
  check('SELLER cannot accept before the payment method is chosen (409)', refused(r, 'PAYMENT_METHOD_REQUIRED'), errText(r))
  r = await get(`/buyer/orders/${S.orderId}/checkout-quote?payment_method=CASH_ON_DELIVERY`, S.buyer)
  const q = r.data
  check('checkout quote loads', r.status === 200, errText(r))
  check(`quote shows delivery fee ${FEE}`, money(q?.delivery_fee) === FEE, JSON.stringify(q)?.slice(0, 300))
  const expected = money(q.subtotal - (q.discount || 0) - (q.points_discount || 0) + q.delivery_fee + (q.payment_markup || 0))
  check(`quote total = ${q?.subtotal} + ${q?.delivery_fee} (+${q?.payment_markup || 0} fees) = ${expected}`, money(q?.final_total) === expected && money(q?.subtotal) === subtotal, JSON.stringify(q)?.slice(0, 300))
  S.quote = q
  r = await step('buyer pays cash on delivery', () => post(`/buyer/orders/${S.orderId}/payment`, S.buyer, { payment_method: 'CASH_ON_DELIVERY' }), [SEL, COM])
  S.paymentId = r.data?.id
  check('cash due equals the quote total', money(r.data?.cash_due ?? r.data?.amount) === money(q.final_total), JSON.stringify(r.data)?.slice(0, 300))
  const bo = orderOf((await get(`/buyer/orders/${S.orderId}`, S.buyer)).data)
  check('buyer order shows the same delivery fee', money(bo?.delivery_fee_final ?? bo?.delivery_fee_base) === FEE, JSON.stringify(bo)?.slice(0, 300))
  const so = orderOf((await get(`/orders/${S.orderId}`, S.seller)).data)
  check('seller order shows the delivery fee', money(so?.delivery_fee_final) === FEE, JSON.stringify(so)?.slice(0, 300))

  section('5. Commerce admin assigns a courier')
  r = await post('/admin/commerce/couriers/invite', C, { first_name: 'Sim', last_name: 'Livreur', email: courierEmail, phone: phone(), transport_type: 'MOTORCYCLE', vehicle_info: 'Moto Sim', service_zone: 'Kinshasa' })
  const inviteToken = r.data?.invitation_token
  check('Commerce invites a courier', inviteToken, errText(r))
  r = await post('/courier/activate', undefined, { token: inviteToken, password, password_confirmation: password, ...ADDR })
  check('courier activates the account', r.status === 200, errText(r))
  S.courier = await login(courierEmail)
  check('courier signs in', S.courier)
  r = await patch('/courier/availability', S.courier, { availability: 'AVAILABLE' })
  check('courier goes available', r.status === 200, errText(r))
  const COU = openStream('courier', '/events/stream', S.courier)
  streams.push(COU)
  await COU.ready
  const row = list((await get('/admin/commerce/couriers/available', C)).data, 'couriers', 'items').find((c) => c.email === courierEmail)
  check('courier listed as available', row, 'not in /couriers/available')
  await step('Commerce assigns the courier', () => post(`/admin/commerce/orders/${S.orderId}/assign-courier`, C, { courier_id: row?.id, notes: 'Simulation' }), [BUY, SEL, COU])
  const mission = list((await get('/courier/missions', S.courier)).data, 'missions', 'items').find((m) => m.order_id === S.orderId)
  check('courier sees the mission', mission, 'no mission')
  await step('courier accepts the mission', () => post(`/courier/missions/${S.orderId}/accept`, S.courier), [BUY, SEL, COM])

  section('6. Seller accepts and makes it ready')
  await step('seller accepts the order', () => post(`/orders/${S.orderId}/accept`, S.seller), [BUY, COU, COM])
  await step('seller prepares the order', () => post(`/orders/${S.orderId}/prepare`, S.seller), [BUY, COU])
  await step('seller marks it READY', () => post(`/orders/${S.orderId}/tracking/status`, S.seller, { status: 'READY' }), [BUY, COU, COM])
  r = await post(`/orders/${S.orderId}/tracking/status`, S.seller, { status: 'OUT_FOR_DELIVERY' })
  check('SELLER cannot mark a TBK order out for delivery (409)', refused(r, 'COURIER_STEP_ONLY'), errText(r))
  r = await post(`/orders/${S.orderId}/tracking/status`, S.seller, { status: 'DELIVERED' })
  check('SELLER cannot mark a TBK order delivered', refused(r), errText(r))
  r = await post(`/orders/${S.orderId}/courier-arrived`, S.buyer)
  check('retired /courier-arrived shortcut is gone (404)', r.status === 404, errText(r))
  let t = await buyerView()
  log('buyer', `tracking: ${t?.current_status} / ${t?.delivery_status}`)

  section('7. Courier ↔ buyer: pickup, delivery, receipt')
  r = await get(`/orders/${S.orderId}/package-qr`, S.seller)
  const qr = r.data?.token
  check('seller prints the package QR', qr, errText(r))
  await step('courier scans the package at pickup', () => post('/courier/scans/pickup', S.courier, { token: qr, order_id: S.orderId, idempotency_key: `pickup:${S.orderId}` }), [BUY, SEL])
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  await step('courier sets the expected delivery (tomorrow, morning)', () => post(`/courier/missions/${S.orderId}/expected-delivery`, S.courier, { date: tomorrow, slot: 'MORNING' }), [BUY])
  await step('courier starts the delivery', () => post(`/courier/missions/${S.orderId}/start`, S.courier), [BUY, SEL])
  await step('courier arrives at the buyer', () => post(`/courier/missions/${S.orderId}/arrive`, S.courier), [BUY])
  t = await buyerView()
  log('buyer', `tracking: ${t?.current_status} / ${t?.delivery_status}`)
  let h = (await get(`/courier/missions/${S.orderId}/handover`, S.courier)).data
  check(`courier handover shows ${S.quote?.final_total} $ to collect`, money(h?.amount_due) === money(S.quote?.final_total), JSON.stringify(h)?.slice(0, 300))
  r = await post(`/courier/missions/${S.orderId}/confirm-cash`, S.courier, { confirmed: true, idempotency_key: `early-${stamp}` })
  check('COURIER cannot take cash before checking the parcel', refused(r), errText(r))
  r = await post(`/buyer/orders/${S.orderId}/confirm-receipt`, S.buyer)
  check('BUYER cannot confirm receipt before the parcel is checked', refused(r), errText(r))
  r = await post(`/courier/missions/${S.orderId}/verify-product`, S.courier, { product_number: 'BTMI-WRONG000' })
  check('wrong order code is refused', r.data?.result && r.data.result !== 'VALID', errText(r))
  h = (await get(`/courier/missions/${S.orderId}/handover`, S.courier)).data
  check('a refused code verifies nothing', h?.all_products_verified === false, JSON.stringify(h)?.slice(0, 200))
  r = await post(`/courier/missions/${S.orderId}/verify-product`, S.courier, { product_number: h?.order_number })
  check(`courier verifies the parcel with order code ${h?.order_number}`, r.status === 200 && r.data?.result === 'VALID', errText(r))
  let o = orderOf((await get(`/buyer/orders/${S.orderId}`, S.buyer)).data)
  check('not delivered while the cash is still due', o?.status === 'OUT_FOR_DELIVERY', `${o?.status} / ${o?.delivery_status}`)
  r = await post(`/buyer/orders/${S.orderId}/confirm-receipt`, S.buyer)
  check('BUYER cannot confirm receipt before the payment', refused(r), errText(r))
  const bh = (await get(`/buyer/orders/${S.orderId}/handover`, S.buyer)).data
  check('buyer handover offers no door QR step', bh && bh.courier_can_scan_delivery === false && bh.buyer_can_confirm_receipt === false, JSON.stringify(bh)?.slice(0, 300))
  r = await step('courier confirms cash received', () => post(`/courier/missions/${S.orderId}/confirm-cash`, S.courier, { confirmed: true, idempotency_key: `cash-${stamp}` }), [BUY, SEL, COM])
  check('cash collected = quote total', money(r.data?.amount_collected) === money(S.quote?.final_total), JSON.stringify(r.data))
  o = orderOf((await get(`/buyer/orders/${S.orderId}`, S.buyer)).data)
  check('verified parcel + cash ⇒ DELIVERED automatically, no QR', o?.status === 'DELIVERED' && o?.delivery_status === 'AWAITING_BUYER_CONFIRMATION', `${o?.status} / ${o?.delivery_status}`)
  const pk = (await get(`/orders/${S.orderId}/package-qr`, S.seller)).data?.token
  r = await post('/courier/scans/delivery', S.courier, { token: pk, order_id: S.orderId })
  check('door QR scan is retired (refused)', refused(r), errText(r))
  r = await post(`/buyer/orders/${S.orderId}/confirm-receipt`, S.buyer)
  check('BUYER cannot confirm receipt before checking each product', refused(r, 'LINES_NOT_ACKNOWLEDGED'), errText(r))
  r = await step('buyer acknowledges each product', () => post(`/buyer/orders/${S.orderId}/handover/acknowledge`, S.buyer, { lines: (bh?.lines ?? []).map((l) => ({ order_line_id: l.order_line_id, product_received: true, matches_order: true, quantity_correct: true })) }), [])
  await step('buyer confirms receipt', () => post(`/buyer/orders/${S.orderId}/confirm-receipt`, S.buyer), [SEL, COU, COM])
  const done = orderOf((await get(`/buyer/orders/${S.orderId}`, S.buyer)).data)
  check('order COMPLETED for the buyer', done?.status === 'COMPLETED', `${done?.status} / ${done?.delivery_status}`)

  section('8. Evaluation')
  r = await get(`/buyer/orders/${S.orderId}/review-eligibility`, S.buyer)
  check('buyer may rate the order', r.data?.eligible === true, errText(r))
  r = await post(`/buyer/orders/${S.orderId}/service-review`, S.buyer, { delivery_rating: 5, service_rating: 5, order_experience_rating: 5, comment: 'Livraison rapide, livreur poli. (simulation)' })
  S.reviewId = r.data?.id
  check('buyer rates the order 5★ with feedback', r.status < 300 && S.reviewId, errText(r))
  r = await patch(`/buyer/reviews/${S.reviewId}`, S.buyer, { rating: 4, comment: 'Très bien, emballage à améliorer. (simulation)' })
  check('buyer edits the rating to 4★', r.status === 200, errText(r))
  r = await get(`/buyer/orders/${S.orderId}/review-eligibility`, S.buyer)
  check('eligibility now points at the existing review', r.data?.existing_review_id === S.reviewId, errText(r))
  r = await get(`/marketplace/shops/${S.shopId}/reviews`, S.buyer)
  check('the rating shows on the shop’s public reviews', JSON.stringify(r.json ?? '').includes(S.reviewId), errText(r))
  r = await post(`/buyer/orders/${S.orderId}/review`, S.buyer, { order_line_id: (bh?.lines ?? [])[0]?.order_line_id, rating: 5, comment: 'Le casque est excellent. (simulation)' })
  check('buyer also rates the product', r.status < 300, errText(r))

  section('9. Every role sees the same final state')
  const fin = orderOf((await get(`/orders/${S.orderId}`, S.seller)).data)
  check('seller: COMPLETED', fin?.status === 'COMPLETED', fin?.status)
  const cm = list((await get('/courier/missions', S.courier)).data, 'missions', 'items').find((m) => m.order_id === S.orderId)
  const hist = list((await get('/courier/history', S.courier)).data, 'missions', 'items').find((m) => m.order_id === S.orderId)
  check('courier: mission closed', (cm ?? hist) && ['RECEIVED', 'DELIVERED'].includes((cm ?? hist).delivery_status) || !cm, JSON.stringify(cm ?? hist))
  const co = list((await get('/admin/commerce/orders?limit=20', C)).data, 'orders', 'items').find((o) => o.id === S.orderId)
  check('Commerce: COMPLETED', co?.status === 'COMPLETED', JSON.stringify(co)?.slice(0, 200))
  r = await get(`/admin/commerce/orders/${S.orderId}`, C)
  const trail = JSON.stringify(r.json ?? '')
  check('Commerce: order detail loads with the full lifecycle', r.status === 200 && ['ACCEPTED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED'].every((st) => trail.includes(st)), errText(r))
  const today = new Date().toISOString().slice(0, 10)
  r = await get(`/admin/finance/delivery-fees/ledger?date_from=${today}&date_to=${today}`, F)
  check(`Finance ledger counts the ${FEE} $ fee`, r.status === 200 && r.data?.fees_billed >= FEE, errText(r))
  r = await get('/admin/finance/payments?limit=20', F)
  const pay = list(r.data, 'payments', 'items').find((p) => p.order_id === S.orderId || p.id === S.paymentId)
  check('Finance sees the settled cash payment', pay && ['PAID', 'VERIFIED'].includes(pay.payment_status ?? pay.status), JSON.stringify(pay)?.slice(0, 300))
  check(`Finance breakdown: ${pay?.subtotal_amount} + ${pay?.delivery_fee} livraison + ${pay?.payment_markup} frais = ${pay?.total_amount}`, money(pay?.delivery_fee) === FEE && money(pay?.total_amount) === money(S.quote?.final_total), JSON.stringify(pay)?.slice(0, 300))
  const nt = list((await get('/notifications?limit=50', S.buyer)).data, 'items', 'notifications').map((n) => n.type || n.notification_type)
  check('buyer got lifecycle notifications', nt.length >= 3, nt.join(','))
  for (const s of streams) log(s.who, `${s.events.filter((e) => e.order_id === S.orderId).length} live events for this order`)
}

try { await main() } catch (err) { check('run to completion', false, err.stack) } finally {
  for (const s of streams) s.close()
  if (OUT) writeFileSync(OUT, JSON.stringify({ ...S, quote: S.quote }, null, 2))
  if (!KEEP && F && originalTariff) {
    const body = { default_fee: originalTariff.default_fee, reason: `Simulation ${stamp}: tarif restauré` }
    if (originalTariff.free_delivery_threshold != null) body.free_delivery_threshold = originalTariff.free_delivery_threshold
    else body.clear_threshold = true
    const r = await patch('/admin/finance/delivery-fees', F, body)
    check('Finance tariff restored', r.status === 200, errText(r))
    if (S.kinZone) await call('PUT', `/admin/finance/delivery-fees/zones/${S.kinZone.city_id}`, { token: F, body: { fee: S.kinZone.fee, reason: `Simulation ${stamp}: zone restaurée` } })
  }
  if (!KEEP && S.productId && C) await post(`/admin/commerce/products/${S.productId}/archive`, C, { reason: 'Simulation cleanup' })
  const { failed } = summary()
  process.exit(failed.length ? 1 : 0)
}
