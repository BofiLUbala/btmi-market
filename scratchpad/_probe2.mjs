import { readFileSync } from 'node:fs'
import { get, post } from '../scripts/e2e_admin_lib.mjs'
import { execFileSync } from 'node:child_process'
const a = JSON.parse(readFileSync('scratchpad/actors.json', 'utf8'))
const sql = (q) => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-tAc', q], { encoding: 'utf8' }).trim()
const [pid, vid] = sql(`select v.product_id, v.id from product_variants v join products p on p.id=v.product_id where p.business_id='${a.businessId}' and v.name='Bleu' limit 1`).split('|')
const buyer = (await post('/auth/login', undefined, { email: a.buyerEmail, password: a.password })).json.access_token
for (const q of [-2, 0, 1]) {
  const r = await post('/buyer/cart/preview', buyer, { items: [{ product_id: pid, variant_id: vid, shop_id: a.shopId, quantity: q }] })
  console.log('qty', q, '->', r.status, JSON.stringify(r.json).slice(0, 260))
}
