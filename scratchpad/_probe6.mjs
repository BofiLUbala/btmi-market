import { readFileSync } from 'node:fs'
import { get, post } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync('scratchpad/actors.json', 'utf8'))
const tok = (await post('/auth/login', undefined, { email: a.sellerEmail, password: a.password })).json.access_token
const open = ((await get(`/shops/${a.shopId}/cash-sessions`, tok)).data?.sessions ?? []).find((x) => x.status === 'OPEN')
const r = await post(`/cash-sessions/${open.id}/close`, tok, { declared_closing_amount: 100 })
console.log(JSON.stringify(open).slice(0,200), r.status, JSON.stringify(r.json), new Date().toTimeString().slice(0, 8))
