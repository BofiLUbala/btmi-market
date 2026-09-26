// Plays the non-buyer roles of the real-time simulation one stage at a time, so
// the buyer's screen (web or mobile) can be watched updating live.
//   node scripts/e2e_sim_driver.mjs <actors.json> <stage>
// actors.json is written by e2e_realtime_marketplace_simulation.mjs (E2E_OUT);
// stages: assign | ready | pickup | arrive | handover | door
import { readFileSync, writeFileSync } from 'node:fs'
import { ROLE_ACCOUNTS, adminLogin, get, post, patch, errText } from './e2e_admin_lib.mjs'

const [file, stage] = process.argv.slice(2)
const S = JSON.parse(readFileSync(file, 'utf8'))
const login = async (email) => (await post('/auth/login', undefined, { email, password: S.password })).json?.access_token
const list = (d, ...keys) => { for (const k of keys) if (Array.isArray(d?.[k])) return d[k]; return Array.isArray(d) ? d : [] }
const must = (label, r) => { console.log(`${r.status < 300 ? 'OK ' : 'ERR'} ${label}${r.status < 300 ? '' : ' — ' + errText(r)}`); if (r.status >= 300) process.exitCode = 1; return r }
const phone = () => `+2438${Math.floor(1e7 + Math.random() * 9e7)}`

const seller = await login(S.sellerEmail)
const buyer = await login(S.buyerEmail)
if (!S.orderId) {
  // The order the buyer just placed in the UI.
  S.orderId = list((await get('/buyer/orders', buyer)).data, 'orders', 'items')[0]?.id
  console.log('order', S.orderId)
}
const id = S.orderId

if (stage === 'assign') {
  const C = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
  const inv = must('Commerce invites courier', await post('/admin/commerce/couriers/invite', C, { first_name: 'Sim', last_name: 'Livreur', email: S.courierEmail, phone: phone(), transport_type: 'MOTORCYCLE', vehicle_info: 'Moto Sim', service_zone: 'Kinshasa' }))
  must('courier activates', await post('/courier/activate', undefined, { token: inv.data?.invitation_token, password: S.password, password_confirmation: S.password, province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Avenue de la Paix', building_number: '12' }))
  const courier = await login(S.courierEmail)
  must('courier available', await patch('/courier/availability', courier, { availability: 'AVAILABLE' }))
  const row = list((await get('/admin/commerce/couriers/available', C)).data, 'couriers', 'items').find((c) => c.email === S.courierEmail)
  must('Commerce assigns courier', await post(`/admin/commerce/orders/${id}/assign-courier`, C, { courier_id: row?.id, notes: 'Simulation UI' }))
  must('courier accepts mission', await post(`/courier/missions/${id}/accept`, courier))
}
const courier = stage === 'assign' ? null : await login(S.courierEmail)
if (stage === 'ready') {
  must('seller accepts', await post(`/orders/${id}/accept`, seller))
  must('seller prepares', await post(`/orders/${id}/prepare`, seller))
  must('seller marks READY', await post(`/orders/${id}/tracking/status`, seller, { status: 'READY' }))
}
if (stage === 'pickup') {
  const qr = (await get(`/orders/${id}/package-qr`, seller)).data?.token
  must('courier pickup scan', await post('/courier/scans/pickup', courier, { token: qr, order_id: id }))
  must('expected delivery', await post(`/courier/missions/${id}/expected-delivery`, courier, { date: new Date(Date.now() + 864e5).toISOString().slice(0, 10), slot: 'MORNING' }))
  must('courier starts delivery', await post(`/courier/missions/${id}/start`, courier))
}
if (stage === 'arrive') must('courier arrives', await post(`/courier/missions/${id}/arrive`, courier))
if (stage === 'handover') {
  const h = (await get(`/courier/missions/${id}/handover`, courier)).data
  must(`courier verifies parcel ${h?.order_number}`, await post(`/courier/missions/${id}/verify-product`, courier, { product_number: h?.order_number }))
  const cash = must('courier confirms cash', await post(`/courier/missions/${id}/confirm-cash`, courier, { confirmed: true, idempotency_key: `ui-${id}` }))
  console.log('   collected', cash.data?.amount_collected, cash.data?.currency)
}
if (stage === 'door') {
  const token = (await get(`/buyer/orders/${id}/delivery-qr`, buyer)).data?.token
  must('courier scans buyer QR', await post('/courier/scans/delivery', courier, { token, order_id: id }))
}
writeFileSync(file, JSON.stringify(S, null, 2))
