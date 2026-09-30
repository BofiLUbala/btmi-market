import { readFileSync } from 'node:fs'
import { get, post } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync('scratchpad/actors.json', 'utf8'))
const tok = (await post('/auth/login', undefined, { email: a.sellerEmail, password: a.password })).json.access_token
for (const p of [`/businesses/${a.businessId}/cash-sessions?limit=10`, `/shops/${a.shopId}/cash-sessions`, `/businesses/${a.businessId}/cash-summary`]) {
  const r = await get(p, tok)
  console.log(p, r.status, JSON.stringify(r.json).slice(0, 400))
}
