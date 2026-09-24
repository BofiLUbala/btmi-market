/**
 * Live ORDER_ITEM QR client-integration E2E.
 *
 * Builds a real fixture against the running API (no mocks, no DB shortcuts except
 * account activation) and exercises the six new endpoints exactly the way the web
 * and mobile clients now call them.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const base = 'http://127.0.0.1:8080/api/v1'
const stamp = Date.now().toString()
const password = 'E2eTest!2026'
const adminEmail = 'commerce.test@tbkmarket.com'
const adminPassword = 'TestAdmin@2025!'
const buyerEmail = `iq_buyer_${stamp}@test.local`
const sellerEmail = `iq_seller_${stamp}@test.local`
const outsiderEmail = `iq_outsider_${stamp}@test.local`
const courierEmail = `iq_courier_${stamp}@tbk.test`
const addr = { province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue QR', building_number: '7', landmark: `ITEMQR-${stamp}` }

const results = []
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function raw(method, path, body, token) {
  const r = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let data
  try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data: data?.data ?? data, code: data?.error?.code, text }
}
async function req(method, path, body, token) {
  const r = await raw(method, path, body, token)
  if (r.status < 200 || r.status >= 300) throw new Error(`${method} ${path} -> ${r.status}: ${r.text.slice(0, 400)}`)
  return r.data
}
const tokenOf = x => x?.access_token ?? x?.token

async function bin(path, token) {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } })
  const buf = Buffer.from(await r.arrayBuffer())
  return { status: r.status, type: r.headers.get('content-type'), bytes: buf.length, png: buf.slice(0, 4).toString('hex') === '89504e47', buf }
}

const psql = sql => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim()

/* ---------------- fixture ---------------- */
console.log('--- fixture ---')
await req('POST', '/auth/register', { first_name: 'IQ', last_name: 'Buyer', phone: `+24391${stamp.slice(-7)}`, email: buyerEmail, password, password_confirmation: password, ...addr })
await req('POST', '/auth/register/seller', { first_name: 'IQ', last_name: 'Seller', phone: `+24392${stamp.slice(-7)}`, email: sellerEmail, password, password_confirmation: password, ...addr })
await req('POST', '/auth/register', { first_name: 'IQ', last_name: 'Outsider', phone: `+24393${stamp.slice(-7)}`, email: outsiderEmail, password, password_confirmation: password, ...addr })
psql(`UPDATE users SET status='ACTIVE', email_verified=true WHERE email IN ('${buyerEmail}','${sellerEmail}','${outsiderEmail}');`)

const buyerToken = tokenOf(await req('POST', '/auth/login', { email: buyerEmail, password }))
const sellerToken = tokenOf(await req('POST', '/auth/login', { email: sellerEmail, password }))
const outsiderToken = tokenOf(await req('POST', '/auth/login', { email: outsiderEmail, password }))
const adminLogin = await req('POST', '/admin/auth/login', { email: adminEmail, password: adminPassword })
const adminToken = tokenOf(adminLogin)

const business = await req('POST', '/businesses', { name: `IQ Business ${stamp}`, business_type: 'RETAIL', category: 'general', phone: `+24394${stamp.slice(-7)}`, whatsapp: `+24394${stamp.slice(-7)}`, email: sellerEmail, country: 'DRC', ...addr, default_currency: 'USD' }, sellerToken)
const shop = await req('POST', `/businesses/${business.id}/shops`, { name: `IQ Shop ${stamp}`, type: 'PHYSICAL', phone: `+24395${stamp.slice(-7)}`, ...addr, address: `${addr.building_number} ${addr.street}, ${addr.commune}, ${addr.city}` }, sellerToken)
const categories = await req('GET', '/categories', undefined, sellerToken)
const categoryId = (Array.isArray(categories) ? categories : categories.items ?? categories.categories ?? [])[0]?.id

async function makeProduct(label, sku, price) {
  const p = await req('POST', `/businesses/${business.id}/products`, { name: `IQ ${label} ${stamp}`, sku, unit_price: price, cost_price: price / 2, unit: 'PIECE', category_id: categoryId, self_rating: 5, publication_status: 'PUBLISHED' }, sellerToken)
  const v = await req('POST', `/businesses/${business.id}/products/${p.id}/variants`, { sku: `${sku}-V1`, name: `${label} / Std`, attributes: { color: 'Black', size: '40' }, sale_price: price, unit: 'PIECE' }, sellerToken)
  await req('POST', `/shops/${shop.id}/stock`, { variant_id: v.id, quantity: 20 }, sellerToken)
  return { product: p, variant: v, price }
}
const A = await makeProduct('Sneakers', `IQ-SHOE-${stamp}`, 10)
const B = await makeProduct('Cap', `IQ-CAP-${stamp}`, 25)

try { await req('POST', '/buyer/profile', { first_name: 'IQ', last_name: 'Buyer', phone: `+24391${stamp.slice(-7)}`, email: buyerEmail, ...addr }, buyerToken) } catch { /* already exists */ }

const invite = await req('POST', '/admin/commerce/couriers/invite', { first_name: 'IQ', last_name: 'Courier', email: courierEmail, phone: `+24396${stamp.slice(-7)}`, transport_type: 'MOTORCYCLE', vehicle_info: `IQ Bike ${stamp}`, service_zone: 'Kinshasa' }, adminToken)
await req('POST', '/courier/activate', { token: invite.invitation_token, password, password_confirmation: password, ...addr })
const courierLogin = await req('POST', '/auth/login', { email: courierEmail, password })
const courierToken = tokenOf(courierLogin)
const courierProfileRaw = await req('GET', '/courier/profile', undefined, courierToken)
const courierProfile = courierProfileRaw.courier ?? courierProfileRaw
await req('PATCH', '/courier/availability', { availability: 'AVAILABLE' }, courierToken)

/* ---------------- orders ---------------- */
async function placeOrder(items, paymentMethod, provider) {
  const order = await req('POST', '/buyer/orders', { shop_id: shop.id, items, use_points: false, idempotency_key: `iq-${stamp}-${Math.random()}` }, buyerToken)
  const id = order.order?.id ?? order.id
  const options = await req('GET', `/buyer/orders/${id}/delivery-options`, undefined, buyerToken)
  const methods = options.methods ?? options.options ?? []
  const tbk = methods.find(m => /TBK/i.test(m.method ?? m.code ?? '')) ?? methods[0]
  await req('POST', `/buyer/orders/${id}/delivery`, {
    method: tbk?.method ?? tbk?.code ?? 'TBK_DELIVERY',
    use_points_for_delivery: false,
    contact_name: 'IQ Buyer', phone: `+24391${stamp.slice(-7)}`,
    address: `${addr.building_number} ${addr.street}, ${addr.commune}, ${addr.city}`,
    ...addr, notes: 'Sonner deux fois',
  }, buyerToken)
  const payment = await req('POST', `/buyer/orders/${id}/payment`, { payment_method: paymentMethod, ...(provider ? { provider } : {}) }, buyerToken)
  const detail = await req('GET', `/buyer/orders/${id}`, undefined, buyerToken)
  return { id, detail, payment, order_number: (detail.order ?? detail).order_number }
}

console.log('--- COD order with 2 items ---')
const cod = await placeOrder([
  { product_id: A.product.id, variant_id: A.variant.id, quantity: 2 },
  { product_id: B.product.id, variant_id: B.variant.id, quantity: 1 },
], 'CASH_ON_DELIVERY')
const codLines = cod.detail.lines ?? []
check('COD order has 2 lines', codLines.length === 2, `lines=${codLines.length} order=${cod.order_number}`)

console.log('--- prepaid (MOBILE_PAY_NOW) order ---')
const prepaid = await placeOrder([{ product_id: B.product.id, variant_id: B.variant.id, quantity: 1 }], 'MOBILE_PAY_NOW', 'MPESA')
const prepaidLine = (prepaid.detail.lines ?? [])[0]

/* --- live catalogue price change AFTER the orders exist --- */
const NEW_PRICE = 99
await req('PATCH', `/variants/${A.variant.id}`, { sale_price: NEW_PRICE }, sellerToken)
const liveVariant = await req('GET', `/variants/${A.variant.id}`, undefined, sellerToken)
check('live catalogue price changed after order', Number(liveVariant.sale_price ?? liveVariant.variant?.sale_price) === NEW_PRICE, `now=${liveVariant.sale_price ?? liveVariant.variant?.sale_price}, order snapshot=${A.price}`)

const lineA = codLines.find(l => l.product_id === A.product.id)
const lineB = codLines.find(l => l.product_id === B.product.id)

/* ---------------- 1. seller item QR ---------------- */
console.log('--- seller item QR ---')
const sqA = await req('GET', `/orders/${cod.id}/items/${lineA.id}/qr`, undefined, sellerToken)
const sqB = await req('GET', `/orders/${cod.id}/items/${lineB.id}/qr`, undefined, sellerToken)
check('SELLER ITEM QR API', !!sqA.token && !!sqA.reference && sqA.order_item_id === lineA.id, `${sqA.reference} status=${sqA.status} label=${sqA.label_url}`)
check('MULTI-ITEM UNIQUE QR', sqA.token !== sqB.token && sqA.reference !== sqB.reference, `${sqA.reference} vs ${sqB.reference}`)
check('token is kind-prefixed opaque', sqA.token.startsWith('tbk.oi.') && sqA.token.split('.').length === 4)

const imgA = await bin(`/orders/${cod.id}/items/${lineA.id}/qr/image`, sellerToken)
check('SELLER QR IMAGE', imgA.status === 200 && imgA.png, `${imgA.status} ${imgA.type} ${imgA.bytes}B png=${imgA.png}`)

/* ---------------- 2. buyer item QR ---------------- */
console.log('--- buyer item QR ---')
const bqA = await req('GET', `/buyer/orders/${cod.id}/items/${lineA.id}/qr`, undefined, buyerToken)
const bqB = await req('GET', `/buyer/orders/${cod.id}/items/${lineB.id}/qr`, undefined, buyerToken)
check('BUYER ITEM QR API', !!bqA.token && bqA.order_item_id === lineA.id, `${bqA.reference} label=${bqA.label_url}`)
check('buyer QR distinct per item', bqA.token !== bqB.token)
check('buyer + seller resolve the same physical code', bqA.token === sqA.token, 'same order line, same signed reference')
const bimg = await bin(`/buyer/orders/${cod.id}/items/${lineA.id}/qr/image`, buyerToken)
check('BUYER QR IMAGE', bimg.status === 200 && bimg.png, `${bimg.status} ${bimg.type} ${bimg.bytes}B`)

/* ---------------- 3. resolution ---------------- */
console.log('--- /qr/resolve role filtering ---')
const rSeller = await raw('POST', '/qr/resolve', { token: sqA.token }, sellerToken)
check('QR RESOLVE API (seller)', rSeller.status === 200 && rSeller.data.role === 'SELLER', `role=${rSeller.data?.role}`)
check('seller sees no delivery address', rSeller.data.delivery_address == null)
check('seller sees no buyer phone/email', !rSeller.data.buyer?.phone && !rSeller.data.buyer?.email, JSON.stringify(rSeller.data.buyer ?? null))
check('seller sees no payment method/status', !rSeller.data.order?.payment_method && !rSeller.data.order?.payment_status)

const rBuyer = await raw('POST', '/qr/resolve', { token: bqA.token }, buyerToken)
check('QR RESOLVE API (buyer)', rBuyer.status === 200 && rBuyer.data.role === 'BUYER', `role=${rBuyer.data?.role}`)
check('BUYER SNAPSHOT PRICE', rBuyer.data.price.unit_price === A.price, `resolved unit_price=${rBuyer.data.price.unit_price}, order snapshot=${A.price}, live catalogue=${NEW_PRICE}`)
check('buyer subtotal from snapshot', rBuyer.data.price.subtotal === A.price * 2, `subtotal=${rBuyer.data.price.subtotal}`)

/* assign the courier so the order has an assigned_courier_id */
const assign = await raw('POST', `/admin/commerce/orders/${cod.id}/assign-courier`, { courier_id: courierProfile.id }, adminToken)
if (assign.status >= 300) console.log('assign-courier ->', assign.status, assign.text.slice(0, 300))
const assignedDb = psql(`SELECT assigned_courier_id FROM orders WHERE id='${cod.id}';`)
console.log('orders.assigned_courier_id =', assignedDb, '| courier user =', courierLogin.user?.id, '| courier profile =', courierProfile.id)

const rCourier = await raw('POST', '/qr/resolve', { token: sqA.token }, courierToken)
check('COURIER SCAN / resolve', rCourier.status === 200 && rCourier.data?.role === 'COURIER', `status=${rCourier.status} role=${rCourier.data?.role} code=${rCourier.code ?? ''}`)
if (rCourier.status === 200) {
  const d = rCourier.data
  check('COURIER ROLE FILTERING (no unit price)', d.price.unit_price === 0 && d.price.item_total === 0 && d.price.final_amount === 0, JSON.stringify(d.price))
  check('courier sees recipient + address', !!d.delivery_address?.recipient_name && !!d.delivery_address?.street, `${d.delivery_address?.recipient_name} / ${d.delivery_address?.street}, ${d.delivery_address?.commune}`)
  check('courier sees no buyer email', !d.buyer?.email)
  check('COD AMOUNT TO COLLECT', d.price.amount_to_collect > 0 && !!d.price.currency, `${d.price.amount_to_collect} ${d.price.currency}`)
}

/* prepaid: nothing to collect */
const sqPre = await req('GET', `/orders/${prepaid.id}/items/${prepaidLine.id}/qr`, undefined, sellerToken)
const assignPre = await raw('POST', `/admin/commerce/orders/${prepaid.id}/assign-courier`, { courier_id: courierProfile.id }, adminToken)
if (assignPre.status >= 300) console.log('assign prepaid ->', assignPre.status, assignPre.text.slice(0, 200))
const rPrepaid = await raw('POST', '/qr/resolve', { token: sqPre.token }, courierToken)
if (rPrepaid.status === 200) {
  const p = rPrepaid.data.price
  check('PREPAID NOTHING TO COLLECT', !p.amount_to_collect && !!p.currency, `amount_to_collect=${p.amount_to_collect ?? 'absent'} currency=${p.currency}`)
} else {
  check('PREPAID NOTHING TO COLLECT', false, `resolve -> ${rPrepaid.status} ${rPrepaid.code}`)
}

/* ---------------- 4. negative cases ---------------- */
console.log('--- negative cases ---')
const rOutsider = await raw('POST', '/qr/resolve', { token: sqA.token }, outsiderToken)
check('OUTSIDER FORBIDDEN', rOutsider.status === 403 && rOutsider.code === 'QR_FORBIDDEN', `${rOutsider.status} ${rOutsider.code}`)

const rNoAuth = await raw('POST', '/qr/resolve', { token: sqA.token })
check('unauthenticated rejected', rNoAuth.status === 401, `${rNoAuth.status}`)

const rGarbage = await raw('POST', '/qr/resolve', { token: 'tbk.oi.not-a-uuid.deadbeef' }, buyerToken)
check('invalid QR rejected', rGarbage.status === 422 && rGarbage.code === 'QR_INVALID', `${rGarbage.status} ${rGarbage.code}`)

/* wrong kind: a package token posted to the item resolver */
let pkgToken = ''
try {
  await req('POST', `/orders/${cod.id}/accept`, {}, sellerToken)
  await req('POST', `/orders/${cod.id}/prepare`, {}, sellerToken)
  await req('POST', `/orders/${cod.id}/tracking/status`, { status: 'READY' }, sellerToken)
  const pkg = await req('GET', `/orders/${cod.id}/package-qr`, undefined, sellerToken)
  pkgToken = pkg.token
  check('EXISTING PACKAGE QR REGRESSION', !!pkg.token && !!pkg.reference && pkg.token.split('.')[1] !== 'oi', `${pkg.reference} kind=${pkg.token.split('.')[1]} status=${pkg.status}`)
} catch (e) {
  check('EXISTING PACKAGE QR REGRESSION', false, String(e).slice(0, 200))
}
if (pkgToken) {
  const rWrongKind = await raw('POST', '/qr/resolve', { token: pkgToken }, courierToken)
  check('WRONG QR KIND REJECTED (package -> item resolver)', rWrongKind.status === 422 && rWrongKind.code === 'QR_INVALID', `${rWrongKind.status} ${rWrongKind.code}`)
}
const rItemAsPickup = await raw('POST', '/courier/scans/pickup', { token: sqA.token, order_id: cod.id, idempotency_key: `wk-${stamp}` }, courierToken)
check('WRONG QR KIND REJECTED (item -> pickup scan)', rItemAsPickup.status >= 400 && rItemAsPickup.code === 'QR_INVALID', `${rItemAsPickup.status} ${rItemAsPickup.code}`)

/* seller cannot read another shop's item QR; outsider cannot read the buyer route */
const rSellerOther = await raw('GET', `/orders/${cod.id}/items/${lineA.id}/qr`, undefined, outsiderToken)
check('seller route forbidden to outsider', rSellerOther.status === 403, `${rSellerOther.status} ${rSellerOther.code}`)
const rBuyerOther = await raw('GET', `/buyer/orders/${cod.id}/items/${lineA.id}/qr`, undefined, outsiderToken)
check('buyer route forbidden to outsider', rBuyerOther.status === 403, `${rBuyerOther.status} ${rBuyerOther.code}`)

/* ---------------- 5. admin ---------------- */
console.log('--- admin resolve ---')
const rAdmin = await raw('POST', '/admin/qr/resolve', { token: sqA.token }, adminToken)
check('ADMIN QR RESOLVE', rAdmin.status === 200 && rAdmin.data?.role === 'ADMIN', `${rAdmin.status} role=${rAdmin.data?.role}`)
if (rAdmin.status === 200) {
  check('admin gets full context', !!rAdmin.data.delivery_address && rAdmin.data.price.unit_price === A.price, `unit_price=${rAdmin.data.price.unit_price} address=${!!rAdmin.data.delivery_address}`)
}

/* ---------------- 6. package/delivery regression ---------------- */
console.log('--- existing package/delivery QR regression ---')
try {
  const accepted = await raw('POST', `/courier/missions/${cod.id}/accept`, {}, courierToken)
  console.log('courier accept ->', accepted.status)
  const pickup = await raw('POST', '/courier/scans/pickup', { token: pkgToken, order_id: cod.id, idempotency_key: `pk-${stamp}` }, courierToken)
  check('EXISTING PACKAGE QR SCAN REGRESSION (pickup)', pickup.status === 200, `${pickup.status} ${pickup.code ?? ''} result=${pickup.data?.result ?? ''} delivery_status=${pickup.data?.delivery_status ?? ''}`)
  const dq = await raw('GET', `/buyer/orders/${cod.id}/delivery-qr`, undefined, buyerToken)
  check('EXISTING DELIVERY QR REGRESSION (buyer handover QR)', dq.status === 200 && !!dq.data?.token, `${dq.status} ${dq.data?.reference ?? ''}`)
} catch (e) {
  check('EXISTING PACKAGE/DELIVERY QR REGRESSION', false, String(e).slice(0, 300))
}

/* ---------------- evidence ---------------- */
mkdirSync('scratchpad/e2e-evidence', { recursive: true })
writeFileSync('scratchpad/e2e-evidence/item-qr-seller-label.png', imgA.buf)
writeFileSync('scratchpad/e2e-evidence/item-qr-buyer-label.png', bimg.buf)
const state = {
  run_id: `ITEMQR-${stamp}`,
  password,
  urls: { api: 'http://127.0.0.1:8080', frontend: 'http://127.0.0.1:5174' },
  buyer: { email: buyerEmail },
  seller: { email: sellerEmail, business_id: business.id, shop_id: shop.id },
  courier: { email: courierEmail, user_id: courierLogin.user?.id, courier_profile_id: courierProfile.id },
  outsider: { email: outsiderEmail },
  admin: { email: adminEmail },
  cod_order: { id: cod.id, order_number: cod.order_number, line_a: lineA.id, line_b: lineB.id },
  prepaid_order: { id: prepaid.id, order_number: prepaid.order_number, line: prepaidLine?.id },
  products: { a: { id: A.product.id, variant: A.variant.id, order_price: A.price, live_price_now: NEW_PRICE }, b: { id: B.product.id, variant: B.variant.id, price: B.price } },
  results,
}
writeFileSync('scratchpad/e2e-evidence/item-qr-state.json', JSON.stringify(state, null, 2))

const failed = results.filter(r => !r.ok)
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`)
if (failed.length) console.log('FAILED:\n' + failed.map(f => ` - ${f.name}: ${f.detail ?? ''}`).join('\n'))
