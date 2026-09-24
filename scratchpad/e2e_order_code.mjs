// At the buyer's door the courier types (or scans) the one order code: the order number.
// Walks two fresh orders to COURIER_ARRIVED and checks what is accepted and refused.
import { execFileSync } from 'node:child_process'
const API = 'http://localhost:8080/api/v1', S = process.argv[2] || '1790207754829', PW = 'E2eTest!2026'
const sql = (q) => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-F', '|', '-c', q]).toString().trim()
const call = async (m, p, tk, b) => { const r = await fetch(API + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const j = await r.json().catch(() => ({})); return { status: r.status, data: j.data ?? j } }
const ok = async (...a) => { const r = await call(...a); if (r.status >= 300) throw new Error(`${a[0]} ${a[1]} ${r.status} ${JSON.stringify(r.data)}`); return r.data }
const login = async (e, p = PW, a = false) => (await ok('POST', a ? '/admin/auth/login' : '/auth/login', null, { email: e, password: p })).access_token

const buyer = await login(`e2e_buyer_${S}@test.local`), seller = await login(`e2e_seller_${S}@test.local`), courier = await login(`e2e_courier_${S}@tbk.test`), admin = await login('commerce.test@tbkmarket.com', 'TestAdmin@2025!', true)
const [pid, vid, sid] = sql(`SELECT p.id,v.id,i.shop_id FROM products p JOIN product_variants v ON v.product_id=p.id JOIN inventory i ON i.variant_id=v.id WHERE p.name='E2E Test Sneakers ${S}' AND v.name='Black / 40'`).split('|')
const cid = sql(`SELECT id FROM users WHERE email='e2e_courier_${S}@tbk.test'`)
sql(`UPDATE couriers SET availability='AVAILABLE' WHERE user_id='${cid}'`)

async function orderAtDoor(tag) {
  const id = (await ok('POST', '/buyer/checkout', buyer, { items: [{ product_id: pid, variant_id: vid, shop_id: sid, quantity: 1 }], use_points: false, idempotency_key: `code-${tag}-${Date.now()}` })).order_ids[0]
  await ok('POST', `/buyer/orders/${id}/delivery`, buyer, { method: 'TBK_STANDARD', use_points_for_delivery: false, contact_name: 'E2E Buyer', phone: '+243817754829', province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue Code', building_number: '9', landmark: tag })
  await ok('POST', `/buyer/orders/${id}/payment`, buyer, { payment_method: 'CASH_ON_DELIVERY' })
  for (const s of ['accept', 'prepare']) await ok('POST', `/orders/${id}/${s}`, seller, {})
  await ok('POST', `/orders/${id}/tracking/status`, seller, { status: 'READY' })
  await ok('POST', `/admin/commerce/orders/${id}/assign-courier`, admin, { courier_id: cid })
  for (const s of ['accept', 'pickup']) await ok('POST', `/courier/missions/${id}/${s}`, courier, {})
  await ok('POST', `/courier/missions/${id}/expected-delivery`, courier, { date: new Date(Date.now() + 3600e3).toISOString().slice(0, 10), slot: 'EVENING' })
  for (const s of ['start', 'arrive']) await ok('POST', `/courier/missions/${id}/${s}`, courier, {})
  return id
}
const codes = (id) => { const [number, oi, variantRef, sku] = sql(`SELECT o.order_number, q.public_reference, pq.public_reference, v.sku FROM order_lines ol JOIN orders o ON o.id=ol.order_id JOIN order_item_qr_codes q ON q.order_line_id=ol.id JOIN product_variants v ON v.id=ol.variant_id LEFT JOIN product_qr_codes pq ON pq.variant_id=ol.variant_id WHERE ol.order_id='${id}'`).split('|'); return { number, oi, variantRef, sku } }
const verify = (id, body) => call('POST', `/courier/missions/${id}/verify-product`, courier, body)
const clear = (id) => sql(`DELETE FROM product_handover_verifications WHERE order_id='${id}'`)
const pref = (u) => u.slice(0, 8).toUpperCase()

const results = []
const check = (name, cond, detail) => { results.push(cond); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`) }

const A = await orderAtDoor('A'), B = await orderAtDoor('B')
const a = codes(A), b = codes(B)
check('nouveau numéro au format BTMI-XXXXXXXX', /^BTMI-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(a.number), a.number)
const body8 = a.number.slice(5)
const parcelToken = (await ok('GET', `/orders/${A}/package-qr`, seller)).token

const cases = [
  ['numéro exact', { product_number: a.number }, 'VALID'],
  ['minuscules sans tiret', { product_number: a.number.toLowerCase().replace('-', '') }, 'VALID'],
  ['sans le préfixe BTMI', { product_number: body8.toLowerCase() }, 'VALID'],
  ['avec espaces', { product_number: ` btmi ${body8.slice(0, 4)} ${body8.slice(4)} ` }, 'VALID'],
  ['QR du colis scanné', { token: parcelToken }, 'VALID'],
  ['numéro d’une AUTRE commande', { product_number: b.number }, 'WRONG_ORDER'],
  ['ancien code VAR-', { product_number: `VAR-${pref(a.variantRef)}` }, 'INVALID_QR'],
  ['ancien code OI-', { product_number: `OI-${pref(a.oi)}` }, 'INVALID_QR'],
  ['SKU', { product_number: a.sku }, 'INVALID_QR'],
  ['code inventé', { product_number: 'BTMI-ZZZZZZZZ' }, 'INVALID_QR'],
]
for (const [name, body, want] of cases) {
  clear(A)
  const r = await verify(A, body)
  check(name, r.status === 200 && r.data?.result === want, `${r.status} ${r.data?.result}${r.data?.reason ? ' / ' + r.data.reason : ''}`)
}
clear(A)
await verify(A, { product_number: a.number })
const [verified, total] = sql(`SELECT COUNT(*) FILTER (WHERE result='SUCCESS'), (SELECT COUNT(*) FROM order_lines WHERE order_id='${A}') FROM product_handover_verifications WHERE order_id='${A}'`).split('|')
check('le code valide toute la commande', verified === total && +total > 0, `${verified}/${total} lignes`)
const again = await verify(A, { product_number: a.number })
check('2e saisie = déjà vérifié', again.data?.result === 'ALREADY_USED', again.data?.result)
const buyerCheck = await call('POST', `/buyer/orders/${B}/verify-product`, buyer, { product_number: b.number })
check('l’acheteur peut aussi saisir son code', buyerCheck.status === 200, `${buyerCheck.status}`)
for (const id of [A, B]) { await call('POST', `/buyer/orders/${id}/cancel`, buyer); await call('POST', `/orders/${id}/confirm-return`, seller, {}) }

console.log(`\n${results.filter(Boolean).length}/${results.length} OK`)
process.exit(results.every(Boolean) ? 0 : 1)
