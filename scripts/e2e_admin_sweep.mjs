// Phase 1 — read sweep of the whole admin Control Center.
//
// Logs in one admin per role and calls every read endpoint of every dashboard
// with every filter value the UI offers, asserting a 200 and a well-formed
// payload; then checks the RBAC matrix (each role is refused the dashboards
// it does not own). Run: node scripts/e2e_admin_sweep.mjs
import { ROLE_ACCOUNTS, adminLogin, get, check, section, summary, errText } from './e2e_admin_lib.mjs'

const T = {}
section('Authentication')
for (const [role, email] of Object.entries(ROLE_ACCOUNTS)) {
  T[role] = await adminLogin(email)
  check(`login ${role}`, T[role], `could not log in ${email}`)
}
if (Object.values(T).some((t) => !t)) { summary(); process.exit(1) }

const C = T.COMMERCE_ADMIN, F = T.FINANCE_SUPPORT_ADMIN, X = T.TECHNICAL_ADMIN, D = T.DIRECTION_ADMIN

/** GET must answer 200; `shape` validates the payload and returns an error string or ''. */
async function ok(name, path, token, shape) {
  const r = await get(path, token)
  if (r.status !== 200) return check(name, false, errText(r)) && null
  const problem = shape ? shape(r.data) : ''
  check(name, !problem, problem)
  return r.data
}
const list = (key, totalKey = 'total') => (d) => (!d || !Array.isArray(key ? d[key] : d) ? `missing array ${key}` : totalKey && key && typeof d[totalKey] !== 'number' ? `missing ${totalKey}` : '')
const arr = (d) => (Array.isArray(d) ? '' : 'expected an array')
const numbers = (...keys) => (d) => keys.filter((k) => typeof d?.[k] !== 'number').map((k) => `${k} not a number`).join(', ')

// ---------------------------------------------------------------- Direction
section('Direction')
const dov = await ok('overview', '/admin/direction/overview', D, numbers('total_users', 'total_orders', 'total_shops', 'open_disputes', 'confirmed_cash'))
for (const account_type of ['', 'BUYER', 'SELLER', 'EMPLOYEE'])
  for (const status of ['', 'ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DEACTIVATED'])
    await ok(`users type=${account_type || 'all'} status=${status || 'all'}`, `/admin/direction/users?limit=5&account_type=${account_type}&status=${status}`, D, list('users'))
await ok('users search', '/admin/direction/users?search=a&limit=5', D, list('users'))
await ok('users page 2', '/admin/direction/users?limit=5&offset=5', D, list('users'))
for (const q of ['', '&role=SUPER_ADMIN', '&action=LOGIN', '&target_type=user'])
  await ok(`audit-log ${q || 'all'}`, `/admin/direction/audit-log?limit=5${q}`, D, (d) => (Array.isArray(d?.logs) || Array.isArray(d?.items) || Array.isArray(d) ? '' : 'no log array'))
if (dov) {
  const users = await get('/admin/direction/users?limit=1', D)
  check('overview total_users matches user list total', users.data?.total === dov.total_users, `${users.data?.total} vs ${dov.total_users}`)
}

// ---------------------------------------------------------------- Commerce
section('Commerce')
await ok('overview', '/admin/commerce/overview', C)
for (const account_type of ['SELLER', 'EMPLOYEE'])
  await ok(`operational users ${account_type || 'all'}`, `/admin/commerce/users?limit=5&account_type=${account_type}`, C, list('users'))
await ok('operational users search', '/admin/commerce/users?limit=5&account_type=SELLER&search=a', C, list('users'))
const businesses = await ok('businesses list', '/admin/commerce/businesses?limit=5', C, list('businesses'))
for (const status of ['ACTIVE', 'SUSPENDED']) await ok(`businesses status=${status}`, `/admin/commerce/businesses?limit=5&status=${status}`, C, list('businesses'))
await ok('businesses search', '/admin/commerce/businesses?limit=5&search=a', C, list('businesses'))
const shops = await ok('shops list', '/admin/commerce/shops?limit=5', C, list('shops'))
for (const status of ['ACTIVE', 'SUSPENDED', 'CLOSED']) await ok(`shops status=${status}`, `/admin/commerce/shops?limit=5&status=${status}`, C, list('shops'))

const products = await ok('products', '/admin/commerce/products?limit=5', C, list('products'))
for (const ps of ['PUBLISHED', 'DRAFT', 'UNPUBLISHED', 'ARCHIVED']) await ok(`products publication=${ps}`, `/admin/commerce/products?limit=5&publication_status=${ps}`, C, list('products'))
for (const ss of ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']) await ok(`products stock=${ss}`, `/admin/commerce/products?limit=5&stock_status=${ss}`, C, list('products'))
await ok('products search', '/admin/commerce/products?limit=5&search=a', C, list('products'))
const productId = products?.products?.[0]?.id
if (productId) {
  await ok('product detail', `/admin/commerce/products/${productId}`, C)
  await ok('product visibility', `/admin/commerce/marketplace/visibility/${productId}`, C)
  await ok('product card quality', `/admin/commerce/products/${productId}/card-quality`, C)
}
const cats = await ok('categories', '/admin/commerce/categories', C, arr)
const catId = cats?.[0]?.id
if (catId) await ok('products by category', `/admin/commerce/products?limit=5&category_id=${catId}`, C, list('products'))
await ok('attribute suggestions', '/admin/commerce/attribute-suggestions', C)

const inv = await ok('inventory', '/admin/commerce/inventory?limit=5', C, list('inventory'))
for (const ss of ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']) await ok(`inventory stock=${ss}`, `/admin/commerce/inventory?limit=5&stock_status=${ss}`, C, list('inventory'))
await ok('inventory anomalies', '/admin/commerce/inventory/anomalies', C, arr)
await ok('stock history', '/admin/commerce/inventory/history?limit=5', C, list('movements'))
for (const mt of ['RECEIPT', 'SALE', 'ADJUSTMENT', 'RESERVATION', 'RETURN'])
  await ok(`stock history type=${mt}`, `/admin/commerce/inventory/history?limit=5&movement_type=${mt}`, C, list('movements'))
await ok('stock history date range', '/admin/commerce/inventory/history?limit=5&from=2026-01-01&to=2026-12-31', C, list('movements'))
const shopId = shops?.shops?.[0]?.id || inv?.inventory?.[0]?.shop_id
if (shopId) {
  await ok('inventory by shop', `/admin/commerce/inventory?limit=5&shop_id=${shopId}`, C, list('inventory'))
  await ok('shop page control', `/admin/commerce/shops/${shopId}/page-control`, C)
}

const orders = await ok('orders', '/admin/commerce/orders?limit=5', C, list('orders'))
for (const s of ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'])
  await ok(`orders status=${s}`, `/admin/commerce/orders?limit=5&status=${s}`, C, list('orders'))
for (const m of ['PICKUP', 'DELIVERY']) await ok(`orders delivery=${m}`, `/admin/commerce/orders?limit=5&delivery_method=${m}`, C, list('orders'))
await ok('orders search', '/admin/commerce/orders?limit=5&search=TBK', C, list('orders'))
const orderId = orders?.orders?.[0]?.id
if (orderId) {
  await ok('order detail', `/admin/commerce/orders/${orderId}`, C)
  await ok('order conversation', `/admin/commerce/orders/${orderId}/conversation`, C)
}
await ok('order communications', '/admin/commerce/order-communications?limit=5', C)
await ok('employees', '/admin/commerce/employees?limit=5', C, list('employees'))
await ok('couriers', '/admin/commerce/couriers?limit=5', C)
await ok('couriers available', '/admin/commerce/couriers/available', C)
await ok('search analytics', '/admin/commerce/search/analytics', C, (d) => (d?.available === true ? '' : `search analytics unavailable: ${d?.message}`))
await ok('search queries', '/admin/commerce/search/queries?limit=5', C)
await ok('marketplace ranking', '/admin/commerce/marketplace/ranking', C)
await ok('promotions', '/admin/commerce/promotions?limit=5', C)
await ok('seller performance', '/admin/commerce/sellers/performance?limit=5', C)
await ok('product performance', '/admin/commerce/products/performance?limit=5', C)
await ok('category performance', '/admin/commerce/categories/performance', C, arr)
const shopPerf = await ok('shop performance', '/admin/commerce/shops/performance?limit=5', C)
if (shopPerf) {
  const all = await get('/admin/commerce/shops/performance?limit=100', C)
  const rows = all.data?.performance ?? all.data?.shops ?? []
  check('shop performance total counts every listed shop', (all.data?.total ?? 0) >= rows.length, `total ${all.data?.total} < rows ${rows.length}`)
}

// ---------------------------------------------------------------- Finance
section('Finance')
await ok('summary', '/admin/finance/summary', F, numbers('total_order_value', 'verified_cash', 'open_cases_count', 'risk_alerts_count'))
const ranges = [[], ['date_from=2026-01-01', 'date_to=2026-12-31']]
for (const range of ranges)
  for (const ps of ['', 'VERIFIED', 'PAID', 'PENDING', 'CONFIRMED', 'REFUNDED'])
    for (const cs of ['', 'DUE', 'COLLECTED', 'WAIVED']) {
      const q = [...range, ps && `payment_status=${ps}`, cs && `commission_status=${cs}`].filter(Boolean).join('&')
      await ok(`dashboard ${q || 'all'}`, `/admin/finance/dashboard?${q}`, F)
    }
for (const g of ['shop', 'product', 'variant', 'seller', 'business']) await ok(`breakdown by ${g}`, `/admin/finance/breakdown?group=${g}`, F, list('items', null))
for (const i of ['day', 'week', 'month']) await ok(`timeseries ${i}`, `/admin/finance/timeseries?interval=${i}`, F, list('points', null))
await ok('commission config', '/admin/finance/commission-config', F)
await ok('commission summary', '/admin/finance/commissions/summary', F)
for (const s of ['', 'DUE', 'COLLECTED', 'WAIVED']) await ok(`commissions status=${s || 'all'}`, `/admin/finance/commissions?limit=5&status=${s}`, F, list('commissions'))
const payments = await ok('payments', '/admin/finance/payments?limit=5', F, list('items'))
for (const s of ['PENDING', 'VERIFIED', 'DISPUTED', 'PAID', 'DUE']) await ok(`payments status=${s}`, `/admin/finance/payments?limit=5&payment_status=${s}`, F, list('items'))
if (payments?.items?.[0]) await ok('payment detail', `/admin/finance/payments/${payments.items[0].payment_id}`, F)
await ok('payment config', '/admin/finance/payment-config', F, list('items', null))
await ok('point users', '/admin/finance/points/users?limit=5', F, list('items'))
await ok('point users search', '/admin/finance/points/users?limit=5&search=a', F, list('items'))
const buyers = await ok('buyer points', '/admin/finance/points/buyers?limit=5', F, list('items'))
if (buyers?.items?.[0]) await ok('buyer point history', `/admin/finance/points/buyers/${buyers.items[0].buyer_id || buyers.items[0].user_id}/history`, F)
await ok('seller growth', '/admin/finance/growth/sellers?limit=5', F, list('items'))
for (const s of ['', 'PUBLISHED', 'HIDDEN']) {
  await ok(`product reviews ${s || 'all'}`, `/admin/finance/reviews/products?limit=5&status=${s}`, F, list('items'))
  await ok(`shop reviews ${s || 'all'}`, `/admin/finance/reviews/shops?limit=5&status=${s}`, F, list('items'))
}
for (const s of ['', 'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']) await ok(`cases ${s || 'all'}`, `/admin/finance/cases?limit=5&status=${s}`, F, list('items'))
for (const s of ['', 'OPEN', 'RESOLVED', 'DISMISSED']) await ok(`risk ${s || 'all'}`, `/admin/finance/risk?limit=5&status=${s}`, F, list('items'))

// ---------------------------------------------------------------- Technical
section('Technical')
const tov = await ok('overview', '/admin/technical/overview', X)
await ok('health', '/admin/technical/health', X)
await ok('database', '/admin/technical/database', X)
await ok('redis', '/admin/technical/redis', X)
await ok('workers', '/admin/technical/workers', X)
await ok('failed jobs', '/admin/technical/workers/failed?limit=5', X)
await ok('visual search', '/admin/technical/visual-search', X)
const backups = await ok('backups', '/admin/technical/backups', X)
if (tov && backups) check('overview backup status reflects the backup summary', tov.backup_status === backups.backup_status, `overview=${tov.backup_status} summary=${backups.backup_status}`)
await ok('migrations', '/admin/technical/migrations', X)
await ok('email health', '/admin/technical/email/health', X)
await ok('sessions', '/admin/technical/sessions', X)
for (const s of ['', 'INFO', 'WARNING', 'CRITICAL']) await ok(`security events ${s || 'all'}`, `/admin/technical/security/events?limit=5&severity=${s}`, X)
await ok('app versions', '/admin/technical/versions', X)

// ---------------------------------------------------------------- Platform / Phase 5
section('Platform')
for (const [role, token] of Object.entries(T)) {
  await ok(`feature flags as ${role}`, '/admin/platform/feature-flags', token)
  await ok(`config as ${role}`, '/admin/platform/config', token)
  await ok(`maintenance as ${role}`, '/admin/platform/maintenance', token)
  await ok(`announcements as ${role}`, '/admin/platform/announcements', token)
  await ok(`approvals as ${role}`, '/admin/approvals', token)
  await ok(`exports as ${role}`, '/admin/exports', token)
}
const DASH = { DIRECTION_ADMIN: 'direction', COMMERCE_ADMIN: 'commerce', FINANCE_SUPPORT_ADMIN: 'finance', TECHNICAL_ADMIN: 'technical' }
for (const [role, dash] of Object.entries(DASH))
  for (const days of [1, 7, 30, 90]) {
    const d = await ok(`analytics ${dash} ${days}d`, `/admin/analytics/${dash}?days=${days}`, T[role], list('metrics', null))
    const missing = (d?.metrics || []).filter((m) => !m.available).map((m) => m.key)
    check(`analytics ${dash} ${days}d every metric available`, missing.length === 0, `unavailable: ${missing.join(', ')}`)
    const len = (d?.metrics || [])[0]?.trend?.length
    check(`analytics ${dash} ${days}d has one point per day`, len === days, `got ${len}`)
  }
await ok('public platform state', '/config/platform-state')

// ---------------------------------------------------------------- RBAC matrix
section('RBAC')
const GROUPS = {
  '/admin/direction/overview': ['DIRECTION_ADMIN'],
  '/admin/commerce/overview': ['COMMERCE_ADMIN'],
  '/admin/finance/summary': ['FINANCE_SUPPORT_ADMIN'],
  '/admin/technical/overview': ['TECHNICAL_ADMIN'],
  '/admin/admin-users': []
}
for (const [path, allowed] of Object.entries(GROUPS))
  for (const [role, token] of Object.entries(T)) {
    const r = await get(path, token)
    const expect = allowed.includes(role) ? 200 : 403
    check(`${role} ${path} -> ${expect}`, r.status === expect, `got ${r.status}`)
  }
{
  const r = await get('/admin/commerce/overview')
  check('anonymous is refused (401)', r.status === 401, `got ${r.status}`)
}
for (const [role, dash] of Object.entries(DASH)) {
  const other = Object.values(DASH).find((d) => d !== dash)
  const r = await get(`/admin/analytics/${other}?days=7`, T[role])
  check(`${role} cannot read ${other} analytics`, r.status === 403, `got ${r.status}`)
}

const { failed } = summary()
process.exit(failed.length ? 1 : 0)
