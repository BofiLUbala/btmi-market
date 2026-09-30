import { readFileSync } from 'node:fs'
import { post, get } from '../scripts/e2e_admin_lib.mjs'
const a = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const tok = (await post('/auth/login', undefined, { email: a.sellerEmail, password: a.password })).json.access_token
const cats = await get('/categories', tok)
const list = cats.json?.data ?? cats.json
const cat = (Array.isArray(list) ? list : list.categories)[0]
const prod = await post(`/businesses/${a.businessId}/products`, tok, { name: `Casque Bluetooth Visu ${a.stamp}`, sku: `CASQ-${a.stamp}`, unit_price: 45, cost_price: 25, unit: 'PIECE', category_id: cat.id, self_rating: 4, publication_status: 'PUBLISHED', description: 'Casque sans fil, autonomie 30h' })
if (prod.status >= 300) throw new Error('product ' + JSON.stringify(prod.json))
const pid = prod.json.data.id
const v = await post(`/businesses/${a.businessId}/products/${pid}/variants`, tok, { sku: `CASQ-${a.stamp}-N`, name: 'Noir', attributes: { couleur: 'Noir' }, sale_price: 45, unit: 'PIECE' })
if (v.status >= 300) throw new Error('variant ' + JSON.stringify(v.json))
const s = await post(`/shops/${a.shopId}/stock`, tok, { variant_id: v.json.data.id, quantity: 10 })
console.log(JSON.stringify({ productId: pid, variantId: v.json.data.id, stock: s.status }))
