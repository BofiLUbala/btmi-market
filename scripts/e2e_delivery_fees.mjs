// E2E: the Finance-owned TBK delivery tariff drives checkout, the order
// snapshot, the seller's view and the delivery-fee ledger.
// Needs the API started with E2E_TEST_MODE=true and the seeded test admins.
//   node scripts/e2e_delivery_fees.mjs
import { spawnSync } from 'node:child_process'
import { ROLE_ACCOUNTS, adminLogin, get, post, patch, call, check, section, summary, errText, sleep } from './e2e_admin_lib.mjs'

const CONTAINER = process.env.E2E_CONTAINER || 'backend-api-1'
const stamp = Date.now().toString(36)
const password = `E2e!Pass-${stamp}`
const ADDR = { province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue de la Paix', building_number: '12', landmark: 'Face BN' }
const phone = () => `+2438${Math.floor(1e7 + Math.random() * 9e7)}`
const list = (d, ...keys) => { for (const k of keys) if (Array.isArray(d?.[k])) return d[k]; return Array.isArray(d) ? d : [] }
const tokenFromLogs = (email) => {
  const r = spawnSync('docker', ['logs', '--since', '10m', CONTAINER], { encoding: 'utf8', maxBuffer: 1 << 26 })
  let found = null
  for (const line of ((r.stdout || '') + (r.stderr || '')).split(String.fromCharCode(10))) if (line.includes(email)) { const m = line.match(/token=([0-9a-f]{64})/); if (m) found = m[1] }
  return found
}

let F, C, original
const S = {}

async function newOrder(label) {
  const r = await post('/buyer/orders', S.buyer, { shop_id: S.shopId, items: [{ product_id: S.productId, variant_id: S.variantId, quantity: 1 }], use_points: false })
  const id = r.data?.id || r.data?.order?.id
  check(`${label}: order placed`, id, errText(r))
  return id
}
async function deliver(orderId) {
  return post(`/buyer/orders/${orderId}/delivery`, S.buyer, { method: 'TBK_STANDARD', contact_name: 'Awa', phone: phone(), address: '12 Avenue de la Paix', ...ADDR })
}

async function main() {
  F = await adminLogin(ROLE_ACCOUNTS.FINANCE_SUPPORT_ADMIN)
  C = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
  check('finance + commerce admins sign in', F && C)
  original = (await get('/admin/finance/delivery-fees', F)).data
  check('finance reads the tariff', typeof original?.default_fee === 'number', JSON.stringify(original))

  section('Scenario')
  const buyerEmail = `e2e.fee.buyer.${stamp}@tbk.test`, sellerEmail = `e2e.fee.seller.${stamp}@tbk.test`
  await post('/auth/register', undefined, { first_name: 'Awa', last_name: 'Fee', phone: phone(), email: buyerEmail, password, password_confirmation: password, ...ADDR })
  await post('/auth/register/seller', undefined, { first_name: 'Sam', last_name: 'Fee', phone: phone(), email: sellerEmail, password, password_confirmation: password, ...ADDR })
  await sleep(1200)
  for (const e of [buyerEmail, sellerEmail]) { const tok = tokenFromLogs(e); if (tok) await get(`/auth/activate?token=${tok}`) }
  const login = async (email) => (await post('/auth/login', undefined, { email, password })).data?.access_token
  S.buyer = await login(buyerEmail); S.seller = await login(sellerEmail)
  check('buyer + seller ready', S.buyer && S.seller, 'is E2E_TEST_MODE=true?')
  if (!S.buyer || !S.seller) return
  let r = await post('/businesses', S.seller, { name: `E2E Fee Biz ${stamp}`, business_type: 'RETAIL', category: 'general', phone: phone(), email: sellerEmail, country: 'DRC', default_currency: 'USD', ...ADDR })
  S.businessId = r.data?.id
  // A legacy shop fee far from the tariff proves the shop value is ignored.
  r = await post(`/businesses/${S.businessId}/shops`, S.seller, { name: `E2E Fee Shop ${stamp}`, type: 'PHYSICAL', phone: phone(), address: '12 Av', supports_shop_delivery: true, shop_delivery_fee: 3500, ...ADDR })
  S.shopId = r.data?.id
  const categoryId = list((await get('/categories', S.seller)).data, 'categories', 'items')[0]?.id
  r = await post(`/businesses/${S.businessId}/products`, S.seller, { name: `E2E Fee Product ${stamp}`, sku: `EF-${stamp}`, unit_price: 40, cost_price: 20, unit: 'PIECE', category_id: categoryId, self_rating: 4, publication_status: 'PUBLISHED' })
  S.productId = r.data?.id
  r = await post(`/businesses/${S.businessId}/products/${S.productId}/variants`, S.seller, { sku: `EF-V-${stamp}`, name: 'Standard', attributes: { size: 'M' }, sale_price: 40, unit: 'PIECE' })
  S.variantId = r.data?.id
  await post(`/shops/${S.shopId}/stock`, S.seller, { variant_id: S.variantId, quantity: 50 })
  await post('/buyer/profile', S.buyer, { first_name: 'Awa', last_name: 'Fee', phone: phone(), email: buyerEmail, ...ADDR })
  check('seller catalogue ready', S.businessId && S.shopId && S.productId && S.variantId)

  section('RBAC and validation')
  r = await patch('/admin/finance/delivery-fees', C, { default_fee: 1, reason: 'E2E wrong role' })
  check('commerce admin cannot change delivery fees (403)', r.status === 403, `HTTP ${r.status}`)
  r = await patch('/admin/finance/delivery-fees', F, { default_fee: -1, reason: 'E2E negative' })
  check('negative fee refused', r.status === 400, `HTTP ${r.status}`)
  r = await patch('/admin/finance/delivery-fees', F, { default_fee: 3, reason: 'no' })
  check('short reason refused', r.status === 400, `HTTP ${r.status}`)

  section('Default tariff → checkout')
  r = await patch('/admin/finance/delivery-fees', F, { default_fee: 3.5, clear_threshold: true, reason: 'E2E default tariff' })
  check('finance sets 3.50 $ by default', r.status === 200 && r.data?.default_fee === 3.5, errText(r))
  const pub = (await get('/config/delivery-fees')).data
  check('public tariff shows 3.50', pub?.default_fee === 3.5, JSON.stringify(pub))
  const o1 = await newOrder('default')
  const opts = await get(`/buyer/orders/${o1}/delivery-options`, S.buyer)
  check('checkout offers TBK delivery at 3.50 (not the shop’s 3500)', list(opts.data, 'options')[0]?.fee === 3.5, JSON.stringify(opts.data))
  r = await deliver(o1)
  check('selected delivery is charged 3.50', r.data?.delivery?.fee_final === 3.5 || r.data?.delivery?.delivery_fee_final === 3.5 || JSON.stringify(r.data).includes('3.5'), errText(r))
  r = await get(`/buyer/orders/${o1}/checkout-quote`, S.buyer)
  check('payment quote includes the 3.50 delivery', JSON.stringify(r.data ?? r.json).includes('3.5'), errText(r))

  section('City tariff')
  const kin = list((await get('/locations/cities')).data, 'items').find((c) => c.name === 'Kinshasa')
  check('Kinshasa exists in the location hierarchy', kin)
  if (kin) {
    r = await call('PUT', `/admin/finance/delivery-fees/zones/${kin.id}`, { token: F, body: { fee: 1.25, reason: 'E2E Kinshasa tariff' } })
    check('finance sets Kinshasa at 1.25', r.status === 200 && r.data?.zones?.some((z) => z.city_id === kin.id && z.fee === 1.25), errText(r))
    const o2 = await newOrder('city')
    r = await deliver(o2)
    const d2 = (await get(`/buyer/orders/${o2}`, S.buyer)).data
    const fee2 = d2?.delivery_fee_base ?? d2?.order?.delivery_fee_base
    check('a Kinshasa delivery is charged 1.25', fee2 === 1.25, JSON.stringify(d2)?.slice(0, 300))
    const d1 = (await get(`/buyer/orders/${o1}`, S.buyer)).data
    check('the earlier order keeps its 3.50 snapshot', (d1?.delivery_fee_base ?? d1?.order?.delivery_fee_base) === 3.5)
    const seller = (await get(`/orders/${o2}`, S.seller)).data
    check('seller sees the delivery fee on the order', (seller?.delivery_fee_final ?? seller?.order?.delivery_fee_final) === 1.25, JSON.stringify(seller)?.slice(0, 300))
    S.o2 = o2

    section('Free-delivery threshold')
    r = await patch('/admin/finance/delivery-fees', F, { free_delivery_threshold: 30, reason: 'E2E free above 30' })
    check('finance sets free delivery from 30 $', r.status === 200 && r.data?.free_delivery_threshold === 30, errText(r))
    const o3 = await newOrder('free')
    await deliver(o3)
    const d3 = (await get(`/buyer/orders/${o3}`, S.buyer)).data
    check('a 40 $ order ships free', (d3?.delivery_fee_base ?? d3?.order?.delivery_fee_base) === 0, JSON.stringify(d3)?.slice(0, 200))

    r = await call('DELETE', `/admin/finance/delivery-fees/zones/${kin.id}`, { token: F, body: { reason: 'E2E cleanup zone' } })
    check('delete the city tariff', r.status === 200 && !r.data?.zones?.some((z) => z.city_id === kin.id), errText(r))
  }

  section('Ledger and history')
  const today = new Date().toISOString().slice(0, 10)
  r = await get(`/admin/finance/delivery-fees/ledger?date_from=${today}&date_to=${today}`, F)
  check('ledger counts the TBK deliveries of the day', r.data?.orders >= 3 && r.data?.free_deliveries >= 1, errText(r))
  check('ledger billed ≥ 3.50 + 1.25', r.data?.fees_billed >= 4.75, JSON.stringify(r.data))
  const hist = (await get('/admin/finance/delivery-fees', F)).data?.history ?? []
  check('history records default, city and threshold changes', ['DEFAULT', 'CITY', 'THRESHOLD'].every((s) => hist.some((h) => h.scope === s)), hist.map((h) => h.scope).join(','))
  r = await get('/admin/direction/audit-log?action=DELIVERY_FEE_SETTINGS_UPDATE&limit=5', await adminLogin(ROLE_ACCOUNTS.DIRECTION_ADMIN))
  check('audit log has the tariff changes', list(r.data, 'logs').length > 0, errText(r))
}

try { await main() } catch (err) { check('run to completion', false, err.stack) } finally {
  if (F && original) {
    const body = { default_fee: original.default_fee, reason: 'E2E restore tariff' }
    if (original.free_delivery_threshold != null) body.free_delivery_threshold = original.free_delivery_threshold
    else body.clear_threshold = true
    const r = await patch('/admin/finance/delivery-fees', F, body)
    check('tariff restored', r.status === 200, errText(r))
  }
  if (S.productId && C) await post(`/admin/commerce/products/${S.productId}/archive`, C, { reason: 'E2E cleanup' })
  const { failed } = summary()
  process.exit(failed.length ? 1 : 0)
}
