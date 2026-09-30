import { readFileSync } from 'node:fs'
import { get, post } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync('scratchpad/actors.json', 'utf8'))
const tok = (await post('/auth/login', undefined, { email: a.sellerEmail, password: a.password })).json.access_token
const inv = await get(`/shops/${a.shopId}/inventory`, tok)
console.log('rows', (inv.data ?? []).length, (inv.data ?? []).map((r) => r.inventory?.id ?? r.id).join(' '))
