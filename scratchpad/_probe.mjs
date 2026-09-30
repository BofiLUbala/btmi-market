import { readFileSync } from 'node:fs'
import { get, post } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync('scratchpad/actors.json', 'utf8'))
const tok = (await post('/auth/login', undefined, { email: a.sellerEmail, password: a.password })).json.access_token
const m = await get(`/shops/${a.shopId}/movements?limit=3`, tok)
console.log(JSON.stringify(m.json).slice(0, 700))
const s = await get(`/businesses/${a.businessId}/cash-sessions`, tok)
const sid = (s.data ?? [])[0]?.id
const p = await get(`/cash-sessions/${sid}/payments`, tok)
console.log(JSON.stringify(p.json))
