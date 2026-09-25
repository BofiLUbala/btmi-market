// Full delivery, every step, against the local API: buyer buys, seller accepts/prepares/readies,
// commerce admin assigns, courier accepts, picks up, sets the date, leaves, arrives, verifies the
// order code, takes the cash, scans the buyer QR; buyer acknowledges and confirms receipt.
// After EVERY step: all 4 live streams must push the order, and the buyer's own views
// (order, tracking, payment, handover) must already show the new state.
import { execFileSync } from 'node:child_process'
const API = 'http://localhost:8080/api/v1', S = process.argv[2] || '1790207754829', PW = 'E2eTest!2026'
const PRODUCT = process.argv[3] || 'Casserole TBK Démo'
const sql = (q) => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-F', '|', '-c', q]).toString().trim()
const call = async (m, p, tk, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => ({})); return { status: r.status, data: j.data ?? j } }
const ok = async (...a) => { const r = await call(...a); if (r.status >= 300) throw new Error(`${a[0]} ${a[1]} ${r.status} ${JSON.stringify(r.data)}`); return r.data }
const login = async (e, p = PW, a = false) => (await ok('POST', a ? '/admin/auth/login' : '/auth/login', null, { email: e, password: p })).access_token
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const events = []
function listen(role, path, token) {
  const ctrl = new AbortController()
  ;(async () => {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
    const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ''
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      buf += dec.decode(value, { stream: true }); let i
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2)
        const data = block.split('\n').find((l) => l.startsWith('data: '))
        if (!data || !block.includes('event: order')) continue
        events.push({ role, t: Date.now(), ...JSON.parse(data.slice(6)) })
      }
    }
  })().catch(() => {})
  return ctrl
}
async function pushed(orderId, since, roles) {
  const lat = {}, deadline = Date.now() + 5000
  while (Date.now() < deadline && !roles.every((r) => lat[r] !== undefined)) {
    for (const r of roles) if (lat[r] === undefined) { const e = events.find((x) => x.role === r && x.order_id === orderId && x.t >= since); if (e) lat[r] = e.t - since }
    await sleep(25)
  }
  return lat
}

const results = []
const check = (name, cond, detail = '') => { results.push(cond); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`) }

const tk = {
  buyer: await login(`e2e_buyer_${S}@test.local`), seller: await login(`e2e_seller_${S}@test.local`),
  courier: await login(`e2e_courier_${S}@tbk.test`), admin: await login('commerce.test@tbkmarket.com', 'TestAdmin@2025!', true),
}
const [pid, vid, sid] = sql(`SELECT p.id,v.id,i.shop_id FROM products p JOIN product_variants v ON v.product_id=p.id JOIN inventory i ON i.variant_id=v.id WHERE p.name='${PRODUCT}' LIMIT 1`).split('|')
const cid = sql(`SELECT id FROM users WHERE email='e2e_courier_${S}@tbk.test'`)
check('produit publié trouvé', !!pid, PRODUCT)
const streams = [listen('buyer', '/events/stream', tk.buyer), listen('seller', '/events/stream', tk.seller), listen('courier', '/events/stream', tk.courier), listen('admin', '/admin/commerce/events/stream', tk.admin)]
await sleep(800)

// What the buyer sees right now, across the four reads the apps make.
async function buyerView(id) {
  const [d, tr, pay, ho] = await Promise.all([call('GET', `/buyer/orders/${id}`, tk.buyer), call('GET', `/buyer/orders/${id}/tracking`, tk.buyer), call('GET', `/buyer/orders/${id}/payment`, tk.buyer), call('GET', `/buyer/orders/${id}/handover`, tk.buyer)])
  const o = d.data.order
  return { t: tr.data, order: o, status: o.status, delivery: o.delivery_status, tracking: tr.data.delivery_status, history: (tr.data.history || []).map((h) => h.status), pay: pay.data?.status, date: o.expected_delivery_date, slot: o.expected_delivery_slot, ho: ho.status === 200 ? ho.data : null }
}

let id, stepNo = 0
const timeline = []
async function step(label, action, expect, roles = ['buyer', 'seller', 'admin', 'courier']) {
  stepNo++
  const since = Date.now()
  await action()
  const lat = await pushed(id, since, roles)
  const missing = roles.filter((r) => lat[r] === undefined)
  check(`${stepNo}. ${label} → temps réel ${roles.join('/')}`, missing.length === 0, missing.length ? `manquant: ${missing}` : Object.entries(lat).map(([r, v]) => `${r} ${v}ms`).join(', '))
  const v = await buyerView(id)
  for (const [what, fn] of Object.entries(expect)) {
    const res = fn(v)
    check(`${stepNo}. ${label} → acheteur voit ${what}`, res === true, res === true ? '' : JSON.stringify({ status: v.status, delivery: v.delivery, tracking: v.tracking, pay: v.pay, ho: v.ho && { verified: v.ho.all_products_verified, scanned: v.ho.delivery_scanned, paid: v.ho.payment_verified, canConfirm: v.ho.buyer_can_confirm_receipt } }))
  }
  timeline.push({ step: label, ms: Math.max(...Object.values(lat)), status: v.status, delivery: v.delivery, pay: v.pay })
}

// ---- buyer buys -------------------------------------------------------
id = (await ok('POST', '/buyer/checkout', tk.buyer, { items: [{ product_id: pid, variant_id: vid, shop_id: sid, quantity: 1 }], use_points: false, idempotency_key: `full-${Date.now()}` })).order_ids[0]
await ok('POST', `/buyer/orders/${id}/delivery`, tk.buyer, { method: 'TBK_STANDARD', use_points_for_delivery: false, contact_name: 'E2E Buyer', phone: '+243817754829', province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue du Flux', building_number: '12', landmark: 'e2e full' })
await step('acheteur choisit paiement à la livraison', () => ok('POST', `/buyer/orders/${id}/payment`, tk.buyer, { payment_method: 'CASH_ON_DELIVERY' }),
  { 'PENDING / en attente d’assignation': (v) => v.status === 'PENDING' && v.delivery === 'PENDING_TBK_ASSIGNMENT' }, ['buyer', 'seller', 'admin'])
const number = sql(`SELECT order_number FROM orders WHERE id='${id}'`)
check('numéro de commande = code unique BTMI-XXXXXXXX', /^BTMI-[2-9A-HJKMNP-Z]{8}$/.test(number), number)

// ---- seller -----------------------------------------------------------
await step('vendeur accepte', () => ok('POST', `/orders/${id}/accept`, tk.seller, {}), { 'ACCEPTED + historique': (v) => v.status === 'ACCEPTED' && v.history.includes('ACCEPTED') }, ['buyer', 'seller', 'admin'])
await step('vendeur prépare', () => ok('POST', `/orders/${id}/prepare`, tk.seller, {}), { PREPARING: (v) => v.status === 'PREPARING' && v.history.includes('PREPARING') }, ['buyer', 'seller', 'admin'])
await step('vendeur : prête', () => ok('POST', `/orders/${id}/tracking/status`, tk.seller, { status: 'READY' }), {
  READY: (v) => v.status === 'READY',
  // READY_FOR_PICKUP is the seller's milestone: no courier step may look done yet.
  'aucun livreur daté (prête avant assignation)': (v) => v.delivery === 'READY_FOR_PICKUP' && !v.t.courier_assigned_at && !v.t.courier_accepted_at,
}, ['buyer', 'seller', 'admin'])

// ---- admin commerce ---------------------------------------------------
sql(`UPDATE couriers SET availability='AVAILABLE' WHERE user_id='${cid}'`)
await step('admin assigne le livreur', () => ok('POST', `/admin/commerce/orders/${id}/assign-courier`, tk.admin, { courier_id: cid }), { 'livreur assigné (daté)': (v) => v.delivery === 'COURIER_ASSIGNED' && !!v.t.courier_assigned_at && !!v.order.courier_assigned_at })

// ---- courier ----------------------------------------------------------
const mission = await ok('GET', `/courier/missions/${id}`, tk.courier)
check('le livreur voit la mission et le montant à encaisser', +mission.total_amount > 0, JSON.stringify({ amount: mission.total_amount, number: mission.order_number }))
await step('livreur accepte', () => ok('POST', `/courier/missions/${id}/accept`, tk.courier, {}), { 'livreur a accepté (daté)': (v) => v.delivery === 'COURIER_ACCEPTED' && !!v.t.courier_accepted_at && !!v.order.courier_accepted_at })
await step('livreur confirme l’enlèvement', () => ok('POST', `/courier/missions/${id}/pickup`, tk.courier, {}), { 'produit récupéré (daté)': (v) => v.delivery === 'PICKED_UP' && v.status === 'OUT_FOR_DELIVERY' && !!v.t.pickup_verified_at })
const day = new Date(Date.now() + 86400e3).toISOString().slice(0, 10)
await step('livreur fixe date + créneau', () => ok('POST', `/courier/missions/${id}/expected-delivery`, tk.courier, { date: day, slot: 'MORNING' }), { 'date + créneau': (v) => String(v.date || '').startsWith(day) && v.slot === 'MORNING' })
await step('livreur démarre la livraison', () => ok('POST', `/courier/missions/${id}/start`, tk.courier, {}), { 'en route (daté)': (v) => v.delivery === 'IN_TRANSIT' && !!v.t.courier_started_at })
await step('livreur arrivé', () => ok('POST', `/courier/missions/${id}/arrive`, tk.courier, {}), { 'arrivé (daté) + cadre de remise avec le code': (v) => v.delivery === 'COURIER_ARRIVED' && !!v.t.courier_arrived_at && v.ho?.order_number === number && !v.ho.all_products_verified })

const courierHo = await ok('GET', `/courier/missions/${id}/handover`, tk.courier)
check('le livreur voit le même code', courierHo.order_number === number, courierHo.order_number)
const wrong = await ok('POST', `/courier/missions/${id}/verify-product`, tk.courier, { product_number: 'BTMI-ZZZZZZZZ' })
check('un faux code est refusé', wrong.result === 'INVALID_QR', wrong.result)
let verdict
await step('livreur saisit le code de commande', async () => { verdict = await ok('POST', `/courier/missions/${id}/verify-product`, tk.courier, { product_number: number.toLowerCase() }) }, { 'produits vérifiés': (v) => v.ho?.all_products_verified === true })
check('verdict VALID, libellé sans doublon', verdict.result === 'VALID' && !/(.+) · \1/.test(verdict.product_name), `${verdict.result} · "${verdict.product_name}"`)
await step('livreur confirme les espèces', () => ok('POST', `/courier/missions/${id}/confirm-cash`, tk.courier, { confirmed: true, idempotency_key: `cash-${id}` }), { 'Payé': (v) => ['PAID', 'VERIFIED'].includes(v.pay) && v.ho?.payment_verified === true })
const qr = await ok('GET', `/buyer/orders/${id}/delivery-qr`, tk.buyer)
await step('livreur scanne le QR de l’acheteur', () => ok('POST', '/courier/scans/delivery', tk.courier, { token: qr.token, order_id: id, idempotency_key: `dq-${id}` }), { 'QR scanné / livré': (v) => v.ho?.delivery_scanned === true && v.status === 'DELIVERED' })

// ---- buyer ------------------------------------------------------------
const ho = (await buyerView(id)).ho
check('confirmer la réception bloqué avant validation des articles', ho.buyer_can_confirm_receipt === false)
await step('acheteur valide les articles', () => ok('POST', `/buyer/orders/${id}/handover/acknowledge`, tk.buyer, { lines: ho.lines.map((l) => ({ order_line_id: l.order_line_id, product_received: true, matches_order: true, quantity_correct: true })) }), { 'peut confirmer': (v) => v.ho?.buyer_can_confirm_receipt === true }, ['buyer', 'seller', 'admin', 'courier'])
await step('acheteur confirme la réception', () => ok('POST', `/buyer/orders/${id}/confirm-receipt`, tk.buyer), { 'reçue / terminée': (v) => ['RECEIVED', 'COMPLETED'].includes(v.status) && v.ho?.receipt_confirmed === true })
await sleep(1500)

// ---- afterwards -------------------------------------------------------
const [fs, fd] = sql(`SELECT status, delivery_status FROM orders WHERE id='${id}'`).split('|')
check('commande terminée', fs === 'COMPLETED', `${fs}/${fd}`)
check('livreur libéré', sql(`SELECT availability FROM couriers WHERE user_id='${cid}'`) === 'AVAILABLE')
const sellerOrder = await call('GET', `/orders/${id}`, tk.seller)
check('le vendeur voit la commande terminée', sellerOrder.status === 200 && ['COMPLETED', 'RECEIVED'].includes((sellerOrder.data.order || sellerOrder.data).status), `${sellerOrder.status}`)
const adminList = await ok('GET', `/admin/commerce/orders?search=${number}&limit=5`, tk.admin)
const row = (adminList.orders || adminList.items || adminList.data || adminList).find?.((o) => o.id === id)
const payTotal = +(await ok('GET', `/buyer/orders/${id}/payment`, tk.buyer)).final_total
check('liste admin : montant dû réel + devise', row && +row.amount_due === payTotal && row.currency === 'USD', JSON.stringify(row && { amount_due: row.amount_due, currency: row.currency, final_total: row.final_total, payTotal }))
const adminOrder = await ok('GET', `/admin/commerce/orders/${id}`, tk.admin)
check('l’admin voit la commande terminée', ['COMPLETED', 'RECEIVED'].includes((adminOrder.order || adminOrder).status))
const hist = await ok('GET', `/courier/history?limit=5`, tk.courier)
check('la course est dans l’historique du livreur', JSON.stringify(hist).includes(id))

streams.forEach((s) => s.abort())
console.log(`\nCommande ${number} (${id})`)
console.table(timeline)
console.log(`${results.filter(Boolean).length}/${results.length} OK`)
process.exit(results.every(Boolean) ? 0 : 1)
