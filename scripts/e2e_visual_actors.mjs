// Prepares fresh actors for a visual (UI-driven) end-to-end run:
// a seller with an empty business + shop, a buyer with a profile address, and an
// active, available courier. Everything else (product, fees, order, chat,
// delivery, payment, rating) is meant to be done by hand in the web/mobile UIs.
//   node scripts/e2e_visual_actors.mjs > actors.json
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { ROLE_ACCOUNTS, adminLogin, get, post, patch, errText } from './e2e_admin_lib.mjs'

const PG = process.env.E2E_PG_CONTAINER || 'backend-postgres-1'
const stamp = Date.now().toString(36)
const password = `Visu!Pass-${stamp}-7`
const ADDR = { province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue de la Paix', building_number: '12', landmark: 'Face BN' }
const phone = () => `+2438${Math.floor(1e7 + Math.random() * 9e7)}`
const list = (d, ...keys) => { for (const k of keys) if (Array.isArray(d?.[k])) return d[k]; return Array.isArray(d) ? d : [] }
const must = (label, r) => { if (!r || r.status >= 300) throw new Error(`${label}: ${errText(r)}`); console.error(`OK  ${label}`); return r }

function psql(sql) {
  const r = spawnSync('docker', ['exec', PG, 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-c', sql], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`psql: ${r.stderr}`)
  return (r.stdout || '').trim()
}
async function activate(email) {
  const raw = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  const id = psql(`SELECT id FROM users WHERE email='${email}'`)
  psql(`INSERT INTO account_activation_tokens (user_id, token_hash, purpose, expires_at) VALUES ('${id}', '${hash}', 'ACTIVATION', NOW() + interval '1 hour')`)
  must(`activate ${email}`, await get(`/auth/activate?token=${raw}`))
}
const login = async (email) => (await post('/auth/login', undefined, { email, password })).json?.access_token

const buyerEmail = `visu.acheteur.${stamp}@tbk.test`
const sellerEmail = `visu.vendeur.${stamp}@tbk.test`
const courierEmail = `visu.livreur.${stamp}@tbk.test`

must('buyer registers', await post('/auth/register', undefined, { first_name: 'Awa', last_name: 'Mbuyi', phone: phone(), email: buyerEmail, password, password_confirmation: password, ...ADDR }))
must('seller registers', await post('/auth/register/seller', undefined, { first_name: 'Patrick', last_name: 'Lukusa', phone: phone(), email: sellerEmail, password, password_confirmation: password, ...ADDR }))
await activate(buyerEmail)
await activate(sellerEmail)
const buyer = await login(buyerEmail)
const seller = await login(sellerEmail)
await post('/buyer/profile', buyer, { first_name: 'Awa', last_name: 'Mbuyi', phone: phone(), email: buyerEmail, ...ADDR }) // 409 when registration already created it
const biz = must('business', await post('/businesses', seller, { name: `Lukusa Électronique ${stamp}`, business_type: 'RETAIL', category: 'general', phone: phone(), email: sellerEmail, country: 'DRC', default_currency: 'USD', ...ADDR }))
const shop = must('shop', await post(`/businesses/${biz.data.id}/shops`, seller, { name: `Lukusa Shop Gombe`, type: 'PHYSICAL', phone: phone(), address: '12 Avenue de la Paix, Gombe', ...ADDR }))

const C = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
const inv = must('commerce invites courier', await post('/admin/commerce/couriers/invite', C, { first_name: 'Joël', last_name: 'Kasongo', email: courierEmail, phone: phone(), transport_type: 'MOTORCYCLE', vehicle_info: 'Moto TVS rouge', service_zone: 'Kinshasa' }))
let token = inv.data?.invitation_token
if (!token) {
  // Without E2E_TEST_MODE the token is only emailed: plant a known one.
  const raw = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  psql(`UPDATE courier_invitations SET token_hash='${hash}' WHERE email='${courierEmail}'`)
  token = raw
}
must('courier activates', await post('/courier/activate', undefined, { token, password, password_confirmation: password, ...ADDR }))
const courier = await login(courierEmail)
must('courier available', await patch('/courier/availability', courier, { availability: 'AVAILABLE' }))

console.log(JSON.stringify({ stamp, password, buyerEmail, sellerEmail, courierEmail, businessId: biz.data.id, shopId: shop.data.id }, null, 2))
