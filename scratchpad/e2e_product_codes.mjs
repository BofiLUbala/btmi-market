// At the buyer's door, which codes does product verification accept? Walks two fresh
// orders to COURIER_ARRIVED and tries every identifier a courier can be holding.
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
  const id = (await ok('POST', '/buyer/checkout', buyer, { items: [{ product_id: pid, variant_id: vid, shop_id: sid, quantity: 1 }], use_points: false, idempotency_key: `codes-${tag}-${Date.now()}` })).order_ids[0]
  await ok('POST', `/buyer/orders/${id}/delivery`, buyer, { method: 'TBK_STANDARD', use_points_for_delivery: false, contact_name: 'E2E Buyer', phone: '+243817754829', province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue Codes', building_number: '9', landmark: tag })
  await ok('POST', `/buyer/orders/${id}/payment`, buyer, { payment_method: 'CASH_ON_DELIVERY' })
  for (const s of ['accept', 'prepare']) await ok('POST', `/orders/${id}/${s}`, seller, {})
  await ok('POST', `/orders/${id}/tracking/status`, seller, { status: 'READY' })
  await ok('POST', `/admin/commerce/orders/${id}/assign-courier`, admin, { courier_id: cid })
  for (const s of ['accept', 'pickup']) await ok('POST', `/courier/missions/${id}/${s}`, courier, {})
  const d = new Date(Date.now() + 3600e3).toISOString().slice(0, 10)
  await ok('POST', `/courier/missions/${id}/expected-delivery`, courier, { date: d, slot: 'EVENING' })
  for (const s of ['start', 'arrive']) await ok('POST', `/courier/missions/${id}/${s}`, courier, {})
  return id
}
const lineCodes = (id) => { const [oi, variantRef, sku, psku, number] = sql(`SELECT q.public_reference, pq.public_reference, v.sku, p.sku, o.order_number FROM order_lines ol JOIN orders o ON o.id=ol.order_id JOIN order_item_qr_codes q ON q.order_line_id=ol.id JOIN product_variants v ON v.id=ol.variant_id JOIN products p ON p.id=ol.product_id LEFT JOIN product_qr_codes pq ON pq.variant_id=ol.variant_id WHERE ol.order_id='${id}'`).split('|'); return { oi, variantRef, sku, psku, number } }
const verify = (id, body) => call('POST', `/courier/missions/${id}/verify-product`, courier, body)
const clear = (id) => sql(`DELETE FROM product_handover_verifications WHERE order_id='${id}'`)

const results = []
const check = (name, cond, detail) => { results.push(cond); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`) }

const A = await orderAtDoor('A'), B = await orderAtDoor('B')
const a = lineCodes(A), b = lineCodes(B)
const itemToken = (await ok('GET', `/orders/${A}/items/${sql(`SELECT id FROM order_lines WHERE order_id='${A}'`)}/qr`, seller)).token
const pref = (u) => u.slice(0, 8).toUpperCase()

const cases = [
  ['code VAR imprimé (VAR-XXXXXXXX)', { product_number: `VAR-${pref(a.variantRef)}` }, 'VALID'],
  ['VAR en minuscules, sans tiret', { product_number: `var${pref(a.variantRef).toLowerCase()}` }, 'VALID'],
  ['VAR avec espaces', { product_number: ` VAR - ${pref(a.variantRef)} ` }, 'VALID'],
  ['code article vendeur (OI-XXXXXXXX)', { product_number: `OI-${pref(a.oi)}` }, 'VALID'],
  ['QR article vendeur (tbk.oi…) scanné', { token: itemToken }, 'VALID'],
  ['QR article collé dans le champ manuel', { product_number: itemToken }, 'VALID'],
  ['SKU de la variante', { product_number: a.sku }, 'VALID'],
  ['SKU en minuscules', { product_number: a.sku.toLowerCase() }, 'VALID'],
  ['8 caractères seuls', { product_number: pref(a.variantRef) }, 'VALID'],
  ['code article d’une AUTRE commande', { product_number: `OI-${pref(b.oi)}` }, 'WRONG_ORDER'],
  ['numéro de commande', { product_number: a.number }, 'INVALID_QR', 'ORDER_NUMBER_NOT_PRODUCT'],
  ['code inventé', { product_number: 'VAR-00000000' }, 'INVALID_QR'],
]
for (const [name, body, want, reason] of cases) {
  clear(A)
  const r = await verify(A, body)
  const got = r.data?.result, gotReason = r.data?.reason
  check(name, r.status === 200 && got === want && (!reason || gotReason === reason), `${r.status} ${got}${gotReason && gotReason !== got ? ' / ' + gotReason : ''}`)
}
// Unpublished after the sale: the label printed before still verifies the item.
sql(`UPDATE products SET publication_status='DRAFT' WHERE id='${pid}'`)
clear(A)
let r = await verify(A, { product_number: `VAR-${pref(a.variantRef)}` })
check('produit dépublié après la vente, étiquette VAR', r.data?.result === 'VALID', `${r.status} ${r.data?.result}`)
sql(`UPDATE products SET publication_status='PUBLISHED' WHERE id='${pid}'`)

console.log(`\n${results.filter(Boolean).length}/${results.length} OK`)
process.exit(results.every(Boolean) ? 0 : 1)
