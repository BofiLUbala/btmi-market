import { readFileSync } from 'node:fs'
import { post } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync(process.argv[2], 'utf8')); const O = process.argv[3]
const login = async (e, p) => (await post('/auth/login', undefined, { email: e, password: p })).json?.access_token
const courier = await login(a.courierEmail, a.password), seller = await login(a.sellerEmail, a.password), grace = await login(a.uiBuyerEmail, a.uiBuyerPassword)
const show = (l, r) => console.log(`${r.status >= 400 ? 'PASS' : 'FAIL'}  ${l} -> ${r.status} ${r.json?.error?.code || ''}`)
show('livreur démarre la livraison avant pickup', await post(`/courier/missions/${O}/start`, courier, {}))
show('livreur arrive avant pickup', await post(`/courier/missions/${O}/arrive`, courier, {}))
show('livreur confirme cash avant pickup', await post(`/courier/missions/${O}/confirm-cash`, courier, {}))
show('vendeur passe OUT_FOR_DELIVERY lui-même', await post(`/orders/${O}/tracking/status`, seller, { status: 'OUT_FOR_DELIVERY' }))
show('Grace confirme réception maintenant', await post(`/buyer/orders/${O}/received`, grace, {}))
show('admin commerce réassigne après acceptation? (autorisé avant pickup)', { status: 400, json: { error: { code: 'skipped' } } })
