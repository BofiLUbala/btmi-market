import { readFileSync } from 'node:fs'
import { post } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync('scratchpad/actors.json', 'utf8'))
const tok = (await post('/auth/login', undefined, { email: a.sellerEmail, password: a.password })).json.access_token
const r = await post(`/shops/${a.shopId}/stock`, tok, { variant_id: '5a5ce46e-f04a-4029-ae1d-d29587fca4e3', quantity: 5, notes: 'autre appareil' })
console.log(r.status, new Date().toTimeString().slice(0, 8))
