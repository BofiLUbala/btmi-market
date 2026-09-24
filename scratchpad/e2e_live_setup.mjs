import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const base = 'http://127.0.0.1:8080/api/v1'
const stamp = Date.now().toString()
const password = 'E2eTest!2026'
const adminEmail = 'commerce.test@tbkmarket.com'
const adminPassword = 'TestAdmin@2025!'
const buyerEmail = `e2e_buyer_${stamp}@test.local`
const sellerEmail = `e2e_seller_${stamp}@test.local`
const courierEmail = `e2e_courier_${stamp}@tbk.test`
const addr = { province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue E2E', building_number: '21', landmark: `E2E-${stamp}` }

async function req(method, path, body, token) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${text}`)
  return data?.data ?? data
}
const tokenOf = x => x?.access_token ?? x?.token

await req('POST', '/auth/register', { first_name: 'E2E', last_name: 'Buyer', phone: `+24381${stamp.slice(-7)}`, email: buyerEmail, password, password_confirmation: password, ...addr })
await req('POST', '/auth/register/seller', { first_name: 'E2E', last_name: 'Seller', phone: `+24382${stamp.slice(-7)}`, email: sellerEmail, password, password_confirmation: password, ...addr })

// Fixture activation only: workflow transitions remain API/UI-only.
const sql = `UPDATE users SET status='ACTIVE', email_verified=true WHERE email IN ('${buyerEmail}','${sellerEmail}');`
execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'ignore' })

const buyerLogin = await req('POST', '/auth/login', { email: buyerEmail, password })
const sellerLogin = await req('POST', '/auth/login', { email: sellerEmail, password })
const adminLogin = await req('POST', '/admin/auth/login', { email: adminEmail, password: adminPassword })
const buyerToken = tokenOf(buyerLogin), sellerToken = tokenOf(sellerLogin), adminToken = tokenOf(adminLogin)

const business = await req('POST', '/businesses', { name: `E2E Business ${stamp}`, business_type: 'RETAIL', category: 'general', phone: `+24383${stamp.slice(-7)}`, whatsapp: `+24383${stamp.slice(-7)}`, email: sellerEmail, country: 'DRC', ...addr, default_currency: 'USD' }, sellerToken)
const shop = await req('POST', `/businesses/${business.id}/shops`, { name: `E2E Shop ${stamp}`, type: 'PHYSICAL', phone: `+24384${stamp.slice(-7)}`, ...addr, address: `${addr.building_number} ${addr.street}, ${addr.commune}, ${addr.city}` }, sellerToken)
const categories = await req('GET', '/categories', undefined, sellerToken)
const categoryId = (Array.isArray(categories) ? categories : categories.items ?? categories.categories ?? [])[0]?.id
if (!categoryId) throw new Error('No category available')
const product = await req('POST', `/businesses/${business.id}/products`, { name: `E2E Test Sneakers ${stamp}`, sku: `E2E-SHOE-${stamp}`, unit_price: 10, cost_price: 5, unit: 'PIECE', category_id: categoryId, self_rating: 5, publication_status: 'PUBLISHED' }, sellerToken)
const variant = await req('POST', `/businesses/${business.id}/products/${product.id}/variants`, { sku: `E2E-SHOE-${stamp}-BLACK-40`, name: 'Black / 40', attributes: { color: 'Black', size: '40' }, sale_price: 10, unit: 'PIECE' }, sellerToken)
await req('POST', `/shops/${shop.id}/stock`, { variant_id: variant.id, quantity: 10 }, sellerToken)
let buyerProfile
try { buyerProfile = await req('POST', '/buyer/profile', { first_name: 'E2E', last_name: 'Buyer', phone: `+24381${stamp.slice(-7)}`, email: buyerEmail, ...addr }, buyerToken) } catch { buyerProfile = await req('GET', '/buyer/profile', undefined, buyerToken) }

const invite = await req('POST', '/admin/commerce/couriers/invite', { first_name: 'E2E', last_name: 'Courier', email: courierEmail, phone: `+24385${stamp.slice(-7)}`, transport_type: 'MOTORCYCLE', vehicle_info: `E2E Bike ${stamp}`, service_zone: 'Kinshasa' }, adminToken)
await req('POST', '/courier/activate', { token: invite.invitation_token, password, password_confirmation: password, ...addr })
const courierLogin = await req('POST', '/auth/login', { email: courierEmail, password })
const courierToken = tokenOf(courierLogin)
const courierProfileRaw = await req('GET', '/courier/profile', undefined, courierToken)
const courierProfile = courierProfileRaw.courier ?? courierProfileRaw
await req('PATCH', '/courier/availability', { availability: 'AVAILABLE' }, courierToken)

const state = {
  run_id: `E2E-${stamp}`, password,
  urls: { api: 'http://127.0.0.1:8080', frontend: 'http://127.0.0.1:5174' },
  buyer: { email: buyerEmail, user_id: buyerLogin.user?.id, buyer_profile_id: buyerProfile?.id },
  seller: { email: sellerEmail, user_id: sellerLogin.user?.id, business_id: business.id, shop_id: shop.id },
  courier: { email: courierEmail, user_id: courierLogin.user?.id, courier_profile_id: courierProfile.id },
  admin: { email: adminEmail, user_id: adminLogin.user?.id ?? adminLogin.admin?.id },
  product: { product_id: product.id, variant_id: variant.id, reference: `E2E-SHOE-${stamp}`, variant_reference: `E2E-SHOE-${stamp}-BLACK-40`, shop_id: shop.id, price: 10, stock: 10 }
}
mkdirSync('scratchpad/e2e-evidence', { recursive: true })
writeFileSync('scratchpad/e2e-evidence/state.json', JSON.stringify(state, null, 2))
console.log(JSON.stringify({ ...state, password: '<redacted>' }, null, 2))
