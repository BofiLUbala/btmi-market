import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const s = JSON.parse(readFileSync('scratchpad/video-state.json', 'utf8'))
const B = 'http://127.0.0.1:8099/api/v1'
const pg = (q) => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-c', q], { encoding: 'utf8' }).trim()
async function req(method, path, body, token) {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${t}`); const d = JSON.parse(t); return d?.data ?? d
}
const login = async (e) => (await req('POST', '/auth/login', { email: e, password: s.password })).access_token
const [buyer, seller, courier] = [await login(s.buyer.email), await login(s.seller.email), await login(s.courier.email)]
const admin = (await req('POST', '/admin/auth/login', { email: 'commerce.test@tbkmarket.com', password: 'TestAdmin@2025!' })).access_token
const id = (await req('POST', '/buyer/checkout', { items: [{ product_id: s.product.product_id, variant_id: s.product.variant_id, shop_id: s.product.shop_id, quantity: 1 }], use_points: false, idempotency_key: `notif-${Date.now()}` }, buyer)).order_ids[0]
await req('POST', `/buyer/orders/${id}/delivery`, { method: 'TBK_STANDARD', use_points_for_delivery: false, contact_name: 'Client Test', phone: '+243817000111', province: 'Kinshasa', city: 'Kinshasa', commune: 'Gombe', street: 'Boulevard du 30 Juin', building_number: '14', landmark: 'test' }, buyer)
await req('POST', `/buyer/orders/${id}/payment`, { payment_method: 'CASH_ON_DELIVERY' }, buyer)
await req('POST', `/orders/${id}/accept`, {}, seller)
await req('POST', `/admin/commerce/orders/${id}/assign-courier`, { courier_id: s.courier.user_id }, admin)
await req('POST', `/courier/missions/${id}/accept`, {}, courier)
await new Promise((r) => setTimeout(r, 1500))
console.log(pg(`SELECT n.type||' | '||n.title||' | '||COALESCE(n.link,'') FROM notifications n WHERE n.user_id='${s.buyer.user_id}' AND n.created_at > now() - interval '2 minutes' ORDER BY n.created_at`))
const loc = await req('POST', `/courier/missions/${id}/location`, { latitude: -4.31, longitude: 15.30, accuracy: 8, captured_at: new Date().toISOString() }, courier)
console.log('courier point at COURIER_ACCEPTED:', JSON.stringify(loc))
