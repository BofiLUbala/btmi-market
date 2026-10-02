import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
const base = 'http://127.0.0.1:8099/api/v1'
const s = JSON.parse(readFileSync('scratchpad/video-state.json', 'utf8'))
const orderId = process.argv[2]
const pg = (q) => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-c', q], { encoding: 'utf8' }).trim()
async function req(method, path, body, token) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${t}`); const d = JSON.parse(t); return d?.data ?? d
}
const admin = (await req('POST', '/admin/auth/login', { email: 'commerce.test@tbkmarket.com', password: 'TestAdmin@2025!' })).access_token
await req('POST', `/admin/commerce/orders/${orderId}/assign-courier`, { courier_id: s.courier.user_id }, admin)
s.order = { id: orderId, number: pg(`SELECT order_number FROM orders WHERE id='${orderId}'`), status: pg(`SELECT status||' / '||delivery_status FROM orders WHERE id='${orderId}'`) }
writeFileSync('scratchpad/video-state.json', JSON.stringify(s, null, 2))
console.log(JSON.stringify({ buyer: s.buyer.email, courier: s.courier.email, order: s.order }, null, 2))
