// Phase 2 — live end-to-end simulation of the admin Control Center.
//
// Builds a real marketplace scenario (seller, business, shop, product, stock,
// buyer, order, payment) through the public API, then drives every admin
// action of the four dashboards and the platform layer, and checks each one's
// effect where it matters: on the marketplace, on the buyer/seller API, on the
// public platform state, in the audit log and on the real-time event stream.
// Every setting it changes is put back at the end, even after a failure.
//
// Needs the API started with E2E_TEST_MODE=true (activation links are read
// from `docker logs`), and one admin per role (scripts/seed_test_admins.go).
//   node scripts/e2e_admin_live_simulation.mjs
import { spawnSync } from 'node:child_process'
import { API, ROLE_ACCOUNTS, adminLogin, get, post, patch, del, call, check, section, summary, errText, sleep } from './e2e_admin_lib.mjs'

const CONTAINER = process.env.E2E_CONTAINER || 'backend-api-1'
const stamp = Date.now().toString(36)
const password = `E2e!Pass-${stamp}`
const ADDR = { province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue de la Paix', building_number: '12', landmark: 'Face BN' }
const phone = () => `+2438${Math.floor(1e7 + Math.random() * 9e7)}`
const cleanups = [] // LIFO restore actions
const list = (d, ...keys) => { for (const k of keys) if (Array.isArray(d?.[k])) return d[k]; return Array.isArray(d) ? d : [] }

function tokenFromLogs(email) {
  const r = spawnSync('docker', ['logs', '--since', '10m', CONTAINER], { encoding: 'utf8', maxBuffer: 1 << 26 })
  const logs = (r.stdout || '') + (r.stderr || '')
  let found = null
  for (const line of logs.split('\n')) if (line.includes(email)) { const m = line.match(/token=([0-9a-f]{64})/); if (m) found = m[1] }
  return found
}

/** Polls `fn` until it returns truthy (real-time propagation), up to `ms`. */
async function eventually(fn, ms = 8000, every = 400) {
  const end = Date.now() + ms
  let last
  while (Date.now() < end) { last = await fn(); if (last) return last; await sleep(every) }
  return last
}

/** Opens the admin SSE stream and collects events until closed. */
function openStream(path, token) {
  const events = []
  const ctrl = new AbortController()
  const ready = (async () => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    ;(async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
            const ev = /^event: (.*)$/m.exec(chunk)?.[1] || 'message'
            const data = /^data: (.*)$/m.exec(chunk)?.[1]
            events.push({ ev, data })
          }
        }
      } catch { /* aborted */ }
    })()
    return res.status
  })()
  return { events, ready, close: () => ctrl.abort() }
}

const T = {}
const S = {} // scenario ids
const FLAG_OWNER = {
  BUYER_POINTS_ENABLED: 'FINANCE_SUPPORT_ADMIN', SHOP_REVIEWS_ENABLED: 'FINANCE_SUPPORT_ADMIN', PRODUCT_REVIEWS_ENABLED: 'FINANCE_SUPPORT_ADMIN',
  VISUAL_SEARCH_ENABLED: 'TECHNICAL_ADMIN', SELLER_PROMOTIONS_ENABLED: 'COMMERCE_ADMIN', NEW_SELLER_REGISTRATION_ENABLED: 'COMMERCE_ADMIN',
  REVIEWS_ENABLED: 'DIRECTION_ADMIN'
}

async function main() {
  // ============================================================ ADMINS
  section('Admin sessions')
  for (const [role, email] of Object.entries(ROLE_ACCOUNTS)) {
    T[role] = await adminLogin(email)
    check(`login ${role}`, T[role], email)
  }
  if (Object.values(T).some((t) => !t)) return
  const C = T.COMMERCE_ADMIN, F = T.FINANCE_SUPPORT_ADMIN, X = T.TECHNICAL_ADMIN, D = T.DIRECTION_ADMIN
  const me = async (token) => (await get('/admin/auth/me', token)).data

  // Everything a later step may flip starts from a known "on" state.
  // Each flag is written by the admin owning its category (models.HasPermission).
  for (const key of Object.keys(FLAG_OWNER))
    await patch(`/admin/platform/feature-flags/${key}`, T[FLAG_OWNER[key]], { enabled: true, reason: 'E2E baseline', confirm: true })
  const mOff = await get('/admin/platform/maintenance', X)
  if (mOff.data?.status !== 'OFF') await patch('/admin/platform/maintenance', X, { status: 'OFF', reason: 'E2E baseline', message: '', affected_clients: [] })

  const before = (await get('/admin/direction/overview', D)).data

  // ============================================================ SCENARIO
  section('Scenario setup (public API)')
  const buyerEmail = `e2e.admin.buyer.${stamp}@tbk.test`
  const sellerEmail = `e2e.admin.seller.${stamp}@tbk.test`
  let r = await post('/auth/register', undefined, { first_name: 'Awa', last_name: 'Acheteuse', phone: phone(), email: buyerEmail, password, password_confirmation: password, ...ADDR })
  check('buyer registers', r.status === 201, errText(r))
  r = await post('/auth/register/seller', undefined, { first_name: 'Sam', last_name: 'Vendeur', phone: phone(), email: sellerEmail, password, password_confirmation: password, ...ADDR })
  check('seller registers', r.status === 201, errText(r))
  await sleep(1200)
  for (const email of [buyerEmail, sellerEmail]) {
    const tok = tokenFromLogs(email)
    check(`activation link issued for ${email.split('.')[2]}`, tok, 'no token in API logs — is E2E_TEST_MODE=true?')
    if (tok) { const a = await get(`/auth/activate?token=${tok}`); check(`activate ${email.split('.')[2]}`, a.status === 200, errText(a)) }
  }
  const login = async (email) => { const l = await post('/auth/login', undefined, { email, password }); return l.data?.access_token ?? l.json?.access_token }
  S.buyer = await login(buyerEmail); S.seller = await login(sellerEmail)
  check('buyer + seller log in', S.buyer && S.seller)
  if (!S.buyer || !S.seller) return

  r = await post('/businesses', S.seller, { name: `E2E Admin Biz ${stamp}`, business_type: 'RETAIL', category: 'general', phone: phone(), whatsapp: phone(), email: sellerEmail, country: 'DRC', default_currency: 'USD', ...ADDR })
  S.businessId = r.data?.id; check('business created', S.businessId, errText(r))
  r = await post(`/businesses/${S.businessId}/shops`, S.seller, { name: `E2E Admin Shop ${stamp}`, type: 'PHYSICAL', phone: phone(), address: '12 Avenue de la Paix', supports_shop_delivery: true, shop_delivery_fee: 2, ...ADDR })
  S.shopId = r.data?.id; check('shop created', S.shopId, errText(r))
  const cats = await get('/categories', S.seller)
  const categoryId = list(cats.data, 'categories', 'items')[0]?.id
  r = await post(`/businesses/${S.businessId}/products`, S.seller, { name: `E2E Admin Product ${stamp}`, sku: `EA-${stamp}`, unit_price: 40, cost_price: 20, unit: 'PIECE', category_id: categoryId, self_rating: 4, publication_status: 'PUBLISHED' })
  S.productId = r.data?.id; check('product created (published)', S.productId, errText(r))
  r = await post(`/businesses/${S.businessId}/products/${S.productId}/variants`, S.seller, { sku: `EA-V-${stamp}`, name: 'Standard', attributes: { size: 'M' }, sale_price: 40, unit: 'PIECE' })
  S.variantId = r.data?.id; check('variant created', S.variantId, errText(r))
  r = await post(`/shops/${S.shopId}/stock`, S.seller, { variant_id: S.variantId, quantity: 20 })
  check('stock received (20)', r.status === 200 || r.status === 201, errText(r))
  r = await post('/buyer/profile', S.buyer, { first_name: 'Awa', last_name: 'Acheteuse', phone: phone(), email: buyerEmail, ...ADDR })
  check('buyer profile', [200, 201, 409].includes(r.status), errText(r))

  // Real-time: the admin order stream must see the order the moment it exists.
  const stream = openStream('/admin/commerce/events/stream', C)
  check('admin event stream opens', (await stream.ready) === 200)
  r = await post('/buyer/orders', S.buyer, { shop_id: S.shopId, items: [{ product_id: S.productId, variant_id: S.variantId, quantity: 1 }], use_points: false })
  S.orderId = r.data?.id || r.data?.order?.id; S.orderNumber = r.data?.order_number || r.data?.order?.order_number
  check('buyer places an order', S.orderId, errText(r))
  const pushed = await eventually(() => stream.events.find((e) => e.ev !== 'ready' && (e.data || '').includes(S.orderId)), 6000)
  check('order pushed live to the admin stream', pushed, `events seen: ${stream.events.map((e) => e.ev).join(',')}`)
  stream.close()
  const opts = await get(`/buyer/orders/${S.orderId}/delivery-options`, S.buyer)
  const option = list(opts.data, 'options')[0]
  r = await post(`/buyer/orders/${S.orderId}/delivery`, S.buyer, { method: option?.method, contact_name: 'Awa Acheteuse', phone: phone(), address: '12 Avenue de la Paix, Gombe, Kinshasa', ...ADDR })
  check(`buyer selects delivery (${option?.method})`, r.status === 200, errText(r))
  r = await post(`/buyer/orders/${S.orderId}/payment`, S.buyer, { payment_method: 'CASH_ON_DELIVERY' })
  S.paymentId = r.data?.id; check('buyer picks cash on delivery', S.paymentId || r.status === 201, errText(r))

  // ============================================================ DIRECTION
  section('Direction — live KPIs, users, audit')
  const after = await eventually(async () => { const o = (await get('/admin/direction/overview', D)).data; return o?.total_users >= before.total_users + 2 && o.total_orders >= before.total_orders + 1 ? o : null })
  check('overview counts the 2 new users and the order', after, `before ${before.total_users}/${before.total_orders}`)
  check('overview counts the new business and shop', after && after.total_businesses >= before.total_businesses + 1 && after.total_shops >= before.total_shops + 1)
  r = await get(`/admin/direction/users?search=${encodeURIComponent(buyerEmail)}&limit=5`, D)
  const buyerUser = list(r.data, 'users')[0]; S.buyerUserId = buyerUser?.id
  check('user search finds the buyer', buyerUser?.email === buyerEmail, errText(r))
  r = await post(`/admin/direction/users/${S.buyerUserId}/suspend`, D, { reason: 'E2E suspension test' })
  check('suspend buyer', r.status === 200, errText(r))
  r = await post('/auth/login', undefined, { email: buyerEmail, password })
  check('suspended buyer cannot sign in', r.status !== 200, `HTTP ${r.status}`)
  r = await get(`/admin/direction/users?status=SUSPENDED&search=${encodeURIComponent(buyerEmail)}`, D)
  check('status filter SUSPENDED lists the buyer', list(r.data, 'users').some((u) => u.id === S.buyerUserId))
  r = await post(`/admin/direction/users/${S.buyerUserId}/reactivate`, D, { reason: 'E2E reactivation test' })
  check('reactivate buyer', r.status === 200, errText(r))
  S.buyer = await login(buyerEmail)
  check('reactivated buyer signs in again', S.buyer)
  r = await post(`/admin/direction/users/${S.buyerUserId}/force-logout`, D, { reason: 'E2E force logout test' })
  check('force-logout buyer', r.status === 200, errText(r))
  S.buyer = await login(buyerEmail)
  r = await get(`/admin/direction/audit-log?target_id=${S.buyerUserId}&limit=20`, D)
  const actions = list(r.data, 'logs').map((l) => l.action)
  check('audit log records suspend, reactivate and force-logout', ['suspend', 'reactivat', 'logout'].every((w) => actions.some((a) => a.toLowerCase().includes(w))), actions.join(','))

  // ============================================================ COMMERCE
  section('Commerce — businesses & shops lifecycle')
  r = await get(`/admin/commerce/businesses?search=${stamp}`, C)
  const biz = list(r.data, 'businesses')[0]
  check('business listed under its real name', biz?.name === `E2E Admin Biz ${stamp}`, errText(r))
  check('business owner is the seller', biz?.owner_email === sellerEmail, biz?.owner_email)
  check('business counters are live (1 shop, 1 product, 1 order)', biz?.shop_count === 1 && biz?.product_count === 1 && biz?.order_count === 1, JSON.stringify(biz))
  r = await get(`/admin/commerce/shops?business_id=${S.businessId}`, C)
  const shop = list(r.data, 'shops')[0]
  check('shop listed under its business', shop?.id === S.shopId && shop.business_name === biz?.name, errText(r))
  check('shop shows available units and the open order', shop?.available_units > 0 && shop?.open_order_count === 1, JSON.stringify(shop))

  const visible = async () => (await get(`/marketplace/products/${S.productId}`)).status === 200
  check('product visible on marketplace', await visible())
  r = await post(`/admin/commerce/shops/${S.shopId}/status`, C, { status: 'SUSPENDED', reason: 'E2E shop suspension' })
  check('suspend shop', r.status === 200, errText(r))
  check('suspended shop is off the marketplace', (await get(`/marketplace/shops/${S.shopId}`)).status !== 200)
  r = await post(`/admin/commerce/shops/${S.shopId}/status`, C, { status: 'ACTIVE', reason: 'E2E shop reactivation' })
  check('reactivate shop', r.status === 200 && (await get(`/marketplace/shops/${S.shopId}`)).status === 200, errText(r))
  r = await post(`/admin/commerce/businesses/${S.businessId}/status`, C, { status: 'SUSPENDED', reason: 'E2E business suspension' })
  check('suspend business', r.status === 200, errText(r))
  check('suspended business hides its product', !(await visible()))
  r = await get(`/admin/commerce/businesses?status=SUSPENDED&search=${stamp}`, C)
  check('status filter SUSPENDED lists the business', list(r.data, 'businesses').some((b) => b.id === S.businessId))
  r = await post(`/admin/commerce/businesses/${S.businessId}/status`, C, { status: 'ACTIVE', reason: 'E2E business reactivation' })
  check('reactivate business → product visible again', r.status === 200 && (await visible()), errText(r))
  r = await post(`/admin/commerce/businesses/${S.businessId}/status`, C, { status: 'BOGUS', reason: 'E2E invalid' })
  check('invalid status refused', r.status === 400, `HTTP ${r.status}`)
  r = await post(`/admin/commerce/businesses/${S.businessId}/status`, C, { status: 'SUSPENDED', reason: 'no' })
  check('short reason refused', r.status === 400, `HTTP ${r.status}`)
  r = await post(`/admin/commerce/businesses/${S.businessId}/status`, F, { status: 'SUSPENDED', reason: 'E2E wrong role' })
  check('finance admin cannot suspend a business (403)', r.status === 403, `HTTP ${r.status}`)

  section('Commerce — products, inventory, stock history')
  r = await get(`/admin/commerce/products?search=${stamp}&business_id=${S.businessId}`, C)
  check('product search + business filter', list(r.data, 'products').some((p) => p.id === S.productId), errText(r))
  r = await get(`/admin/commerce/products/${S.productId}`, C); check('product detail', r.status === 200, errText(r))
  r = await get(`/admin/commerce/marketplace/visibility/${S.productId}`, C); check('visibility diagnosis says visible', r.data?.is_visible === true, JSON.stringify(r.data))
  r = await get(`/admin/commerce/products/${S.productId}/card-quality`, C); check('card quality', r.status === 200, errText(r))
  r = await get(`/admin/commerce/inventory?search=${stamp}`, C)
  const row = list(r.data, 'inventory')[0]
  check('inventory search runs server-side', row?.variant_id === S.variantId, errText(r))
  r = await post('/admin/commerce/inventory/adjust', C, { shop_id: S.shopId, variant_id: S.variantId, new_quantity: 30, reason: 'E2E stock count correction' })
  check('adjust stock to 30', r.status === 200, errText(r))
  r = await get(`/admin/commerce/inventory?search=${stamp}`, C)
  check('inventory shows 30 on hand', list(r.data, 'inventory')[0]?.quantity === 30, errText(r))
  r = await get(`/admin/commerce/inventory/history?variant_id=${S.variantId}&limit=20`, C)
  const moves = list(r.data, 'movements')
  check('stock history records the adjustment', moves.some((m) => /ADJUST/i.test(m.movement_type)), moves.map((m) => m.movement_type).join(','))
  r = await post('/admin/commerce/inventory/adjust', C, { shop_id: S.shopId, variant_id: S.variantId, new_quantity: -1, reason: 'E2E negative' })
  check('negative stock refused', r.status === 400, `HTTP ${r.status}`)

  section('Global config drives live thresholds')
  const cfg = list((await get('/admin/platform/config', X)).data, 'configs')
  const lowStock = cfg.find((c) => c.key === 'LOW_STOCK_THRESHOLD')?.value ?? '5'
  r = await patch('/admin/platform/config/LOW_STOCK_THRESHOLD', C, { value: '50', reason: 'E2E threshold test' })
  cleanups.push(() => patch('/admin/platform/config/LOW_STOCK_THRESHOLD', C, { value: lowStock, reason: 'E2E restore' }))
  check('set LOW_STOCK_THRESHOLD=50', r.status === 200, errText(r))
  r = await get(`/admin/commerce/inventory?search=${stamp}&stock_status=LOW_STOCK`, C)
  check('30 units now filtered and labelled LOW_STOCK', list(r.data, 'inventory')[0]?.stock_status === 'LOW_STOCK', errText(r))
  await patch('/admin/platform/config/LOW_STOCK_THRESHOLD', C, { value: lowStock, reason: 'E2E restore' })
  r = await get(`/admin/commerce/inventory?search=${stamp}&stock_status=IN_STOCK`, C)
  check('threshold restored → IN_STOCK again', list(r.data, 'inventory')[0]?.stock_status === 'IN_STOCK', errText(r))

  section('Commerce — orders, search, performance')
  r = await get(`/admin/commerce/orders?search=${encodeURIComponent(S.orderNumber || stamp)}`, C)
  check('order search finds the live order', list(r.data, 'orders').some((o) => o.id === S.orderId), errText(r))
  r = await get(`/admin/commerce/orders?shop_id=${S.shopId}&status=PENDING`, C)
  check('shop + status filters', list(r.data, 'orders').some((o) => o.id === S.orderId), errText(r))
  r = await get(`/admin/commerce/orders?business_id=${S.businessId}`, C)
  check('business filter', list(r.data, 'orders').some((o) => o.id === S.orderId), errText(r))
  r = await get(`/admin/commerce/orders/${S.orderId}`, C); check('order detail', r.status === 200, errText(r))
  const sa0 = (await get('/admin/commerce/search/analytics', C)).data?.total_queries ?? 0
  await get(`/marketplace/search?q=${encodeURIComponent(`E2E Admin Product ${stamp}`)}`)
  const sa1 = await eventually(async () => { const a = (await get('/admin/commerce/search/analytics', C)).data; return a?.total_queries > sa0 ? a : null })
  check('a marketplace search shows up in search analytics', sa1, `still ${sa0}`)
  r = await get('/admin/commerce/search/queries?limit=20', C)
  check('search query log lists the query', list(r.data, 'queries', 'logs').some((q) => (q.query || '').includes(stamp)), errText(r))
  r = await get('/admin/commerce/sellers/performance?limit=100', C)
  check('seller performance includes the business', list(r.data, 'performance', 'sellers').some((p) => p.business_id === S.businessId), errText(r))
  r = await get('/admin/commerce/shops/performance?limit=100', C)
  check('shop performance includes the shop', list(r.data, 'performance', 'shops').some((p) => p.shop_id === S.shopId), errText(r))

  section('Commerce — categories')
  const catName = `E2E Cat ${stamp}`
  r = await post('/admin/commerce/categories', C, { name: catName, slug: `e2e-cat-${stamp}`, sort_order: 999 })
  check('create category', [200, 201].includes(r.status), errText(r))
  let catList = (await get('/admin/commerce/categories', C)).data
  const newCat = list(catList).map((c) => ({ id: c.ID, name: c.Name, subcategories: c.Subcategories })).find((c) => c.name === catName)
  check('category listed', newCat, 'not found')
  if (newCat) {
    cleanups.push(() => patch(`/admin/commerce/categories/${newCat.id}`, C, { status: 'INACTIVE', reason: 'E2E cleanup' }))
    r = await patch(`/admin/commerce/categories/${newCat.id}`, C, { name: `${catName} v2`, reason: 'E2E rename' })
    check('rename category', r.status === 200, errText(r))
    r = await post('/admin/commerce/subcategories', C, { category_id: newCat.id, name: `E2E Sub ${stamp}`, slug: `e2e-sub-${stamp}`, sort_order: 1 })
    check('create subcategory', [200, 201].includes(r.status), errText(r))
    catList = (await get('/admin/commerce/categories', C)).data
    const sub = list(catList).find((c) => c.ID === newCat.id)?.Subcategories?.find((s) => s.name === `E2E Sub ${stamp}`)
    check('subcategory listed under category', sub, 'not found')
    if (sub) { r = await patch(`/admin/commerce/subcategories/${sub.id}`, C, { status: 'INACTIVE', reason: 'E2E deactivate' }); check('deactivate subcategory', r.status === 200, errText(r)) }
    r = await patch(`/admin/commerce/categories/${newCat.id}`, C, { status: 'INACTIVE', reason: 'E2E deactivate' })
    check('deactivate category', r.status === 200, errText(r))
    const pub = await get('/categories')
    check('inactive category hidden from public taxonomy', !JSON.stringify(pub.data).includes(newCat.id))
  }

  section('Commerce — couriers & assignment')
  const courierEmail = `e2e.admin.courier.${stamp}@tbk.test`
  r = await post('/admin/commerce/couriers/invite', C, { first_name: 'Kofi', last_name: 'Livreur', email: courierEmail, phone: phone(), transport_type: 'MOTORCYCLE', vehicle_info: 'Honda', service_zone: 'Kinshasa' })
  const invToken = r.data?.invitation_token
  check('invite courier', invToken, errText(r))
  if (invToken) {
    r = await post('/courier/activate', undefined, { token: invToken, password, password_confirmation: password, ...ADDR })
    check('courier activates the invitation', r.status === 200 || r.status === 201, errText(r))
    const courierTok = await login(courierEmail)
    if (courierTok) await patch('/courier/availability', courierTok, { availability: 'AVAILABLE' })
    r = await get('/admin/commerce/couriers?limit=100', C)
    const courier = list(r.data, 'couriers', 'items').find((c) => c.email === courierEmail)
    check('courier listed', courier, errText(r))
    if (courier) {
      S.courierId = courier.id
      r = await post(`/admin/commerce/couriers/${courier.id}/suspend`, C, { reason: 'E2E courier suspension' })
      check('suspend courier', r.status === 200, errText(r))
      r = await get('/admin/commerce/couriers/available', C)
      check('suspended courier not assignable', !list(r.data, 'couriers', 'items').some((c) => c.id === courier.id))
      r = await post(`/admin/commerce/couriers/${courier.id}/reactivate`, C, { reason: 'E2E courier reactivation' })
      check('reactivate courier', r.status === 200, errText(r))
      // Seller pipeline to READY so the order can be dispatched.
      for (const step of ['accept', 'prepare']) await post(`/orders/${S.orderId}/${step}`, S.seller)
      await post(`/orders/${S.orderId}/tracking/status`, S.seller, { status: 'READY' })
      r = await post(`/admin/commerce/orders/${S.orderId}/assign-courier`, C, { courier_id: courier.id, notes: 'E2E dispatch' })
      check('assign courier to the order', r.status === 200, errText(r))
      if (courierTok) {
        const missions = await get('/courier/missions', courierTok)
        check('mission reaches the courier', JSON.stringify(missions.data || '').includes(S.orderId), errText(missions))
      }
    }
  }
  const inv2 = await post('/admin/commerce/couriers/invite', C, { first_name: 'Temp', last_name: 'Invite', email: `e2e.admin.cancel.${stamp}@tbk.test`, phone: phone(), transport_type: 'BICYCLE' })
  const pending = list((await get('/admin/commerce/couriers?limit=100', C)).data, 'invitations').find((c) => c.email === `e2e.admin.cancel.${stamp}@tbk.test`)
  const invId = pending?.invitation_id || pending?.id || inv2.data?.invitation_id
  if (invId) { r = await del(`/admin/commerce/couriers/invitations/${invId}`, C); check('cancel a pending courier invitation', r.status === 200, errText(r)) }
  else check('cancel a pending courier invitation', false, 'invitation id not exposed')

  // ============================================================ FINANCE
  section('Finance — payments, points, cases, risk')
  r = await get(`/admin/finance/payments?order_number=${encodeURIComponent(S.orderNumber || '')}`, F)
  const pay = list(r.data, 'items')[0]
  check('payment listed for the order', pay?.order_number === S.orderNumber, errText(r))
  if (pay) { r = await get(`/admin/finance/payments/${pay.payment_id}`, F); check('payment detail', r.status === 200, errText(r)) }
  r = await get(`/admin/finance/points/users?search=${encodeURIComponent(buyerEmail)}`, F)
  const pu = list(r.data, 'items')[0]
  const acct = pu?.accounts?.find((a) => a.account_type === 'BUYER')
  check('buyer point account listed', acct, errText(r))
  if (acct) {
    const start = acct.current_points
    r = await post(`/admin/finance/points/users/${pu.user_id}/adjust`, F, { account_type: 'BUYER', type: 'ADD', amount: 50, reason: 'E2E goodwill credit', request_id: crypto.randomUUID() })
    check('credit 50 points', r.data?.new_balance === start + 50, errText(r))
    r = await post(`/admin/finance/points/users/${pu.user_id}/adjust`, F, { account_type: 'BUYER', type: 'REMOVE', amount: 20, reason: 'E2E partial reversal', request_id: crypto.randomUUID() })
    check('debit 20 points', r.data?.new_balance === start + 30, errText(r))
    r = await post(`/admin/finance/points/users/${pu.user_id}/adjust`, F, { account_type: 'BUYER', type: 'REMOVE', amount: 1e6, reason: 'E2E overdraft', request_id: crypto.randomUUID() })
    check('overdraft refused', r.status >= 400, `HTTP ${r.status}`)
    const bp = await get('/buyer/points', S.buyer)
    check('buyer sees the new balance', JSON.stringify(bp.data).includes(String(start + 30)), JSON.stringify(bp.data))
    r = await get(`/admin/finance/points/buyers/${pu.user_id}/history`, F)
    check('point history shows both adjustments', list(r.data, 'history').filter((h) => /ADMIN/i.test(h.reason)).length >= 2, errText(r))
  }

  const financeAdmin = await me(F)
  r = await post('/admin/finance/cases', F, { case_type: 'PAYMENT_DISPUTE', priority: 'HIGH', title: `E2E dispute ${stamp}`, description: 'Buyer says change was not returned', order_id: S.orderId })
  const caseId = r.data?.id
  check('open a case', caseId, errText(r))
  if (caseId) {
    r = await get('/admin/finance/cases?status=OPEN&limit=100', F)
    check('case listed as OPEN', list(r.data, 'items').some((c) => c.id === caseId), errText(r))
    r = await post(`/admin/finance/cases/${caseId}/assign`, F, { admin_id: financeAdmin?.id }); check('assign case to me', r.status === 200, errText(r))
    r = await post(`/admin/finance/cases/${caseId}/messages`, F, { visibility: 'INTERNAL_ADMIN_NOTE', message: 'Called the courier' }); check('add internal note', r.status === 200 || r.status === 201, errText(r))
    r = await get(`/admin/finance/cases/${caseId}`, F)
    check('case detail has the assignee and the note', r.data?.assigned_admin_id === financeAdmin?.id && JSON.stringify(r.data).includes('Called the courier'), errText(r))
    const o1 = (await get('/admin/finance/summary', F)).data?.open_cases_count
    r = await post(`/admin/finance/cases/${caseId}/resolve`, F, { status: 'RESOLVED', resolution: 'Refunded the difference' })
    check('resolve case', r.status === 200, errText(r))
    const o2 = (await get('/admin/finance/summary', F)).data?.open_cases_count
    check('open-cases KPI drops by one', o2 === o1 - 1, `${o1} → ${o2}`)
    r = await post('/admin/finance/cases', F, { case_type: 'OTHER', priority: 'LOW', title: `E2E noise ${stamp}`, description: 'duplicate' })
    if (r.data?.id) { r = await post(`/admin/finance/cases/${r.data.id}/resolve`, F, { status: 'DISMISSED', resolution: 'Duplicate' }); check('dismiss case', r.status === 200, errText(r)) }
  }

  const stuck = cfg.find((c) => c.key === 'STUCK_ORDER_THRESHOLD_HOURS')?.value ?? '48'
  r = await patch('/admin/platform/config/STUCK_ORDER_THRESHOLD_HOURS', C, { value: '0.0003', reason: 'E2E risk rule test' })
  check('set STUCK_ORDER_THRESHOLD_HOURS≈1s', r.status === 200, errText(r))
  r = await patch('/admin/platform/config/STUCK_ORDER_THRESHOLD_HOURS', C, { value: '0', reason: 'E2E invalid' })
  check('threshold 0 refused by validation', r.status === 400, `HTTP ${r.status}`)
  cleanups.push(() => patch('/admin/platform/config/STUCK_ORDER_THRESHOLD_HOURS', C, { value: stuck, reason: 'E2E restore' }))
  await sleep(1100)
  r = await post('/admin/finance/risk/scan', F)
  check('risk scan runs on demand', r.status === 200, errText(r))
  // Walks every page: a real database can hold many open events.
  const openRisk = async () => {
    const all = []
    for (let page = 1; page < 50; page++) {
      const res = await get(`/admin/finance/risk?status=OPEN&limit=100&page=${page}`, F)
      const items = list(res.data, 'items'); all.push(...items)
      if (items.length < 100) break
    }
    return all
  }
  const riskEv = (await openRisk()).find((e) => e.target_id === S.orderId && e.rule_code === 'STUCK_ORDER')
  check('scan raises STUCK_ORDER for the live order', riskEv, 'not found in open events')
  await post('/admin/finance/risk/scan', F)
  const dupes = (await openRisk()).filter((e) => e.target_id === S.orderId && e.rule_code === 'STUCK_ORDER')
  check('a second scan does not duplicate the open event', dupes.length === 1, `${dupes.length} open events`)
  const scanLogs = spawnSync('docker', ['logs', '--since', '2m', CONTAINER], { encoding: 'utf8', maxBuffer: 1 << 26 })
  const ruleErrors = ((scanLogs.stdout || '') + (scanLogs.stderr || '')).split(String.fromCharCode(10)).filter((l) => l.includes('[risk] rule'))
  check('every risk rule executes without SQL error', ruleErrors.length === 0, ruleErrors.slice(0, 3).join(' | '))
  await patch('/admin/platform/config/STUCK_ORDER_THRESHOLD_HOURS', C, { value: stuck, reason: 'E2E restore' })
  if (riskEv) {
    r = await post(`/admin/finance/risk/${riskEv.id}/resolve`, F, { status: 'RESOLVED', reason: 'E2E verified with seller' })
    check('resolve risk event', r.status === 200, errText(r))
  }

  section('Finance — configuration round-trips')
  r = await get('/admin/finance/payment-config', F)
  const pc = list(r.data, 'items')[0]
  if (pc) {
    r = await patch(`/admin/finance/payment-config/${pc.code}`, F, { ...pc, label: `${pc.label} E2E` })
    check('rename payment method', r.data?.label === `${pc.label} E2E`, errText(r))
    r = await patch(`/admin/finance/payment-config/${pc.code}`, F, pc)
    check('restore payment method', r.data?.label === pc.label, errText(r))
  }
  r = await get('/admin/finance/commission-config', F)
  const rate = r.data?.rate ?? r.data?.commission_rate
  if (typeof rate === 'number') {
    r = await patch('/admin/finance/commission-config', F, { rate, reason: 'E2E no-op rewrite' })
    check('commission config write (same rate)', r.status === 200, errText(r))
  }
  r = await get('/admin/finance/growth/sellers?search=' + stamp, F)
  check('seller growth lists the business', list(r.data, 'items').some((g) => g.business_id === S.businessId), errText(r))

  // ============================================================ TECHNICAL
  section('Technical — security events, sessions, versions, backups')
  r = await post('/admin/auth/login', undefined, { email: ROLE_ACCOUNTS.TECHNICAL_ADMIN, password: 'wrong-password' })
  check('wrong admin password refused', r.status === 401 || r.status === 400, `HTTP ${r.status}`)
  const secEv = await eventually(async () => list((await get('/admin/technical/security/events?limit=20', X)).data, 'events').find((e) => e.event_type === 'ADMIN_LOGIN_FAILED' && e.status === 'NEW'))
  check('failed sign-in appears as a security event', secEv)
  if (secEv) {
    r = await post(`/admin/technical/security/events/${secEv.id}/acknowledge`, X, { status: 'ACKNOWLEDGED', reason: 'E2E expected failure' })
    check('acknowledge security event', r.status === 200, errText(r))
  }
  const extra = await adminLogin(ROLE_ACCOUNTS.TECHNICAL_ADMIN)
  r = await get('/admin/technical/sessions', X)
  const sessions = list(r.data, 'sessions')
  check('active sessions listed', sessions.length > 0, errText(r))
  const mine = sessions.filter((s) => s.admin_email === ROLE_ACCOUNTS.TECHNICAL_ADMIN || s.email === ROLE_ACCOUNTS.TECHNICAL_ADMIN)
  if (mine.length > 1) {
    const target = mine[mine.length - 1]
    r = await post(`/admin/technical/sessions/${target.session_id}/revoke`, X, { reason: 'E2E revoke test' })
    check('revoke a session', r.status === 200, errText(r))
  }
  void extra
  r = await get('/admin/technical/versions', X)
  const web = list(r.data, 'versions').find((v) => v.platform === 'WEB')
  if (web) {
    r = await patch('/admin/technical/versions/WEB', X, { current_version: web.current_version, min_supported_version: web.min_supported_version, recommended_version: web.recommended_version, reason: 'E2E no-op rewrite' })
    check('app version write (unchanged values)', r.status === 200, errText(r))
  }
  const ov = (await get('/admin/technical/overview', X)).data
  const bk = (await get('/admin/technical/backups', X)).data
  check('overview backup status = backup summary', ov?.backup_status === bk?.backup_status, `${ov?.backup_status} vs ${bk?.backup_status}`)
  check('worker status reflects a real heartbeat', ['HEALTHY', 'DOWN'].includes(ov?.worker_status), ov?.worker_status)
  r = await post('/admin/technical/backups', X, { reason: 'E2E backup run' })
  check('on-demand backup', r.status === 200 && r.data?.backup_status === 'OK', errText(r))

  // ============================================================ PLATFORM
  section('Platform — feature flags enforced end to end')
  const flag = async (key, enabled) => patch(`/admin/platform/feature-flags/${key}`, T[FLAG_OWNER[key]], { enabled, reason: `E2E ${enabled ? 'enable' : 'disable'}`, confirm: true })
  r = await patch('/admin/platform/feature-flags/BUYER_POINTS_ENABLED', C, { enabled: false, reason: 'E2E wrong owner', confirm: true })
  check('commerce admin cannot flip a FINANCE flag (403)', r.status === 403, `HTTP ${r.status}`)
  const publicFlag = async (key) => (await get('/config/platform-state')).data?.feature_flags?.[key]
  for (const key of ['BUYER_POINTS_ENABLED', 'VISUAL_SEARCH_ENABLED', 'SHOP_REVIEWS_ENABLED', 'SELLER_PROMOTIONS_ENABLED'])
    cleanups.push(() => flag(key, true))

  r = await flag('BUYER_POINTS_ENABLED', false); check('disable buyer points', r.status === 200, errText(r))
  check('public state reports points off', (await publicFlag('BUYER_POINTS_ENABLED')) === false)
  r = await post('/buyer/orders', S.buyer, { shop_id: S.shopId, items: [{ product_id: S.productId, variant_id: S.variantId, quantity: 1 }], use_points: true })
  check('order with points refused while off (503)', r.status === 503, `HTTP ${r.status}`)
  r = await post('/buyer/orders/preview', S.buyer, { shop_id: S.shopId, items: [{ product_id: S.productId, variant_id: S.variantId, quantity: 1 }], use_points: false })
  check('order without points still works', r.status === 200, errText(r))
  await flag('BUYER_POINTS_ENABLED', true)
  r = await post('/buyer/orders/preview', S.buyer, { shop_id: S.shopId, items: [{ product_id: S.productId, variant_id: S.variantId, quantity: 1 }], use_points: true })
  check('points accepted again once on', r.status === 200, errText(r))

  await flag('VISUAL_SEARCH_ENABLED', false)
  r = await call('POST', '/marketplace/search/image', { body: {} })
  check('visual search refused while off (503)', r.status === 503, `HTTP ${r.status}`)
  await flag('VISUAL_SEARCH_ENABLED', true)
  r = await call('POST', '/marketplace/search/image', { body: {} })
  check('visual search reachable once on', r.status !== 503, `HTTP ${r.status}`)

  await flag('SHOP_REVIEWS_ENABLED', false)
  r = await post(`/buyer/orders/${S.orderId}/service-review`, S.buyer, { rating: 5, comment: 'E2E' })
  check('shop review refused while off (503)', r.status === 503, `HTTP ${r.status}`)
  await flag('SHOP_REVIEWS_ENABLED', true)

  await flag('SELLER_PROMOTIONS_ENABLED', false)
  r = await call('PATCH', `/businesses/${S.businessId}/products/${S.productId}`, { token: S.seller, body: { name: `E2E Admin Product ${stamp}`, unit_price: 40, discount_active: true, discount_type: 'PERCENTAGE', discount_value: 10 } })
  check('seller discount refused while promotions off (503)', r.status === 503, `HTTP ${r.status}`)
  await flag('SELLER_PROMOTIONS_ENABLED', true)

  section('Platform — maintenance enforced by the API')
  cleanups.push(() => patch('/admin/platform/maintenance', X, { status: 'OFF', reason: 'E2E restore', message: '', affected_clients: [] }))
  r = await patch('/admin/platform/maintenance', X, { status: 'PARTIAL', reason: 'E2E maintenance drill', message: 'Maintenance E2E', affected_clients: [] })
  check('technical admin sets PARTIAL', r.status === 200, errText(r))
  await sleep(5500) // enforcement cache window
  const ps = (await get('/config/platform-state')).data
  check('public state shows the active maintenance', ps?.maintenance_active === true && ps?.maintenance?.message === 'Maintenance E2E', JSON.stringify(ps?.maintenance))
  check('PARTIAL: browsing still works', (await get(`/marketplace/products/${S.productId}`)).status === 200)
  r = await post('/buyer/orders/preview', S.buyer, { shop_id: S.shopId, items: [{ product_id: S.productId, variant_id: S.variantId, quantity: 1 }], use_points: false })
  check('PARTIAL: writes refused with 503', r.status === 503 && /MAINTENANCE/.test(JSON.stringify(r.json)), errText(r))
  check('PARTIAL: admin API unaffected', (await get('/admin/commerce/overview', C)).status === 200)
  r = await patch('/admin/platform/maintenance', X, { status: 'FULL', reason: 'E2E', confirm: true })
  check('FULL refused to a non-super admin', r.status >= 400, `HTTP ${r.status}`)
  r = await patch('/admin/platform/maintenance', C, { status: 'OFF', reason: 'E2E wrong role' })
  check('commerce admin cannot change maintenance', r.status === 403, `HTTP ${r.status}`)
  await patch('/admin/platform/maintenance', X, { status: 'OFF', reason: 'E2E end drill', message: '', affected_clients: [] })
  await sleep(5500)
  r = await post('/buyer/orders/preview', S.buyer, { shop_id: S.shopId, items: [{ product_id: S.productId, variant_id: S.variantId, quantity: 1 }], use_points: false })
  check('OFF: writes accepted again', r.status === 200, errText(r))

  section('Platform — announcements reach the public state')
  r = await post('/admin/platform/announcements', D, { title: `E2E notice ${stamp}`, message: 'Livraison gratuite ce week-end', audience: 'BUYERS', status: 'DRAFT' })
  const ann = r.data
  check('direction creates a draft', ann?.id, errText(r))
  const inPublic = async () => ((await get('/config/platform-state')).data?.announcements || []).some((a) => a.id === ann?.id)
  check('draft is not public', !(await inPublic()))
  if (ann?.id) {
    cleanups.push(() => patch(`/admin/platform/announcements/${ann.id}`, D, { ...ann, status: 'ARCHIVED' }))
    r = await patch(`/admin/platform/announcements/${ann.id}`, D, { ...ann, status: 'ACTIVE' })
    check('publish', r.status === 200, errText(r))
    check('published announcement is public', await inPublic())
    r = await patch(`/admin/platform/announcements/${ann.id}`, D, { ...ann, status: 'ARCHIVED' })
    check('archived announcement leaves the public state', r.status === 200 && !(await inPublic()), errText(r))
  }
  r = await post('/admin/platform/announcements', C, { title: 'x', message: 'y', audience: 'ALL' })
  check('commerce admin cannot publish announcements', r.status === 403, `HTTP ${r.status}`)

  section('Platform — approvals (separation of duties)')
  r = await post('/admin/approvals', C, { action_type: 'BULK_UNPUBLISH', target_type: 'BUSINESS', target_id: S.businessId, reason: 'E2E governance request', payload: { stamp } })
  const apId = r.data?.id ?? r.json?.id
  check('commerce admin files an approval request', apId, errText(r))
  if (apId) {
    r = await post(`/admin/approvals/${apId}/approve`, C, { reason: 'self' }); check('requester cannot decide it', r.status >= 400, `HTTP ${r.status}`)
    r = await post(`/admin/approvals/${apId}/approve`, D, { reason: 'E2E approved' }); check('direction approves', r.status === 200, errText(r))
    r = await post(`/admin/approvals/${apId}/reject`, D, { reason: 'again' }); check('cannot decide twice', r.status >= 400, `HTTP ${r.status}`)
    const ap = list((await get('/admin/approvals', D)).data, 'approvals').find((a) => a.id === apId)
    check('approval shows APPROVED', ap?.status === 'APPROVED', ap?.status)
  }

  section('Platform — exports (generate, download, RBAC)')
  r = await post('/admin/exports', F, { dataset: 'ORDERS', reason: 'E2E monthly reconciliation' })
  const exportId = r.data?.id ?? r.json?.id
  check('finance requests an ORDERS export', exportId, errText(r))
  const job = await eventually(async () => list((await get('/admin/exports', F)).data, 'exports').find((x) => x.id === exportId && (x.status === 'COMPLETED' || x.status === 'FAILED')), 15000)
  check('export job completes', job?.status === 'COMPLETED', job ? `${job.status} ${job.error_message || ''}` : 'still queued')
  if (job?.status === 'COMPLETED') {
    const dl = await call('GET', `/admin/exports/${exportId}/download`, { token: F, raw: true })
    check('CSV downloads', dl.status === 200 && /text\/csv|octet-stream/.test(dl.headers.get('content-type') || ''), `HTTP ${dl.status} ${dl.headers.get('content-type')}`)
    check('CSV contains the live order', dl.text.includes('order_number') && dl.text.includes(S.orderNumber), dl.text.slice(0, 200))
    const other = await call('GET', `/admin/exports/${exportId}/download`, { token: C, raw: true })
    check("another admin cannot download finance's export", other.status === 403, `HTTP ${other.status}`)
  }
  r = await post('/admin/exports', F, { dataset: 'USERS', reason: 'E2E forbidden dataset' })
  check('finance cannot export USERS (403)', r.status === 403, `HTTP ${r.status}`)
  r = await post('/admin/exports', F, { dataset: 'NOPE', reason: 'E2E unknown' })
  check('unknown dataset refused', r.status === 400, `HTTP ${r.status}`)

  section('Analytics reflect the simulation')
  const fa = list((await get('/admin/analytics/finance?days=1', F)).data, 'metrics')
  check("finance analytics count today's cases", (fa.find((m) => m.key === 'cases')?.value ?? 0) >= 2, JSON.stringify(fa.map((m) => [m.key, m.value])))
  const ta = list((await get('/admin/analytics/technical?days=1', X)).data, 'metrics')
  check("technical analytics count today's security events", (ta.find((m) => m.key === 'security_events')?.value ?? 0) >= 1, JSON.stringify(ta.map((m) => [m.key, m.value])))
  for (const a of ['BUSINESS_STATUS_SUSPENDED', 'SHOP_STATUS_SUSPENDED', 'EXPORT_REQUEST', 'EXPORT_DOWNLOAD', 'MAINTENANCE_UPDATE', 'ANNOUNCEMENT_UPDATE', 'APPROVAL_APPROVED']) {
    r = await get(`/admin/direction/audit-log?action=${a}&limit=5`, D)
    check(`audit log has ${a}`, list(r.data, 'logs').length > 0, errText(r))
  }
}

try {
  await main()
} catch (err) {
  check('simulation ran to completion', false, err.stack || err.message)
} finally {
  section('Cleanup (restore every changed setting)')
  for (const undo of cleanups.reverse()) {
    try { await undo() } catch { /* best effort */ }
  }
  if (S.productId && T.COMMERCE_ADMIN) {
    const u = await post(`/admin/commerce/products/${S.productId}/unpublish`, T.COMMERCE_ADMIN, { reason: 'E2E moderation test' })
    check('unpublish the E2E product', u.status === 200, errText(u))
    const vis = await get(`/admin/commerce/marketplace/visibility/${S.productId}`, T.COMMERCE_ADMIN)
    check('visibility diagnosis explains it is hidden', vis.data?.is_visible === false, JSON.stringify(vis.data))
    const r = await post(`/admin/commerce/products/${S.productId}/archive`, T.COMMERCE_ADMIN, { reason: 'E2E simulation cleanup' })
    check('archive the E2E product', r.status === 200, errText(r))
    check('archived product off the marketplace', (await get(`/marketplace/products/${S.productId}`)).status !== 200)
  }
  const { failed } = summary()
  process.exit(failed.length ? 1 : 0)
}
