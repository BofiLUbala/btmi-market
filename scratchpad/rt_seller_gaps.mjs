// Live checks for the seller features wired in this pass, against the running API
// and real data: goods-in notes, per-business stock events, cash reconciliation and
// the legacy /received route. Usage: node scratchpad/rt_seller_gaps.mjs scratchpad/actors.json
import { readFileSync } from 'node:fs'
import { check, get, post, section, summary } from '../scripts/e2e_admin_lib.mjs'

const a = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const login = async (email) => (await post('/auth/login', undefined, { email, password: a.password })).json?.access_token
const seller = await login(a.sellerEmail)
const buyer = await login(a.buyerEmail)
check('seller and buyer sign in', !!seller && !!buyer)

section('Setup: a product with two variants, one already stocked')
const cats = await get('/categories', seller)
const catList = cats.json?.data ?? cats.json
const cat = (Array.isArray(catList) ? catList : catList.categories)[0]
const prod = await post(`/businesses/${a.businessId}/products`, seller, { name: `Sac Réception ${a.stamp}`, sku: `SAC-${a.stamp}`, unit_price: 30, cost_price: 12, unit: 'PIECE', category_id: cat.id, self_rating: 4, publication_status: 'PUBLISHED', description: 'Sac en toile' })
check('product created', prod.status < 300, JSON.stringify(prod.json).slice(0, 200))
const pid = prod.json.data.id
const v1 = await post(`/businesses/${a.businessId}/products/${pid}/variants`, seller, { sku: `SAC-${a.stamp}-B`, name: 'Bleu', attributes: { couleur: 'Bleu' }, sale_price: 30, purchase_price: 12, unit: 'PIECE' })
const v2 = await post(`/businesses/${a.businessId}/products/${pid}/variants`, seller, { sku: `SAC-${a.stamp}-R`, name: 'Rouge', attributes: { couleur: 'Rouge' }, sale_price: 30, purchase_price: 12, unit: 'PIECE' })
check('two variants created', v1.status < 300 && v2.status < 300)
const blue = v1.json.data.id
const red = v2.json.data.id
await post(`/shops/${a.shopId}/stock`, seller, { variant_id: blue, quantity: 5 })

const qty = async (variantId) => {
  const inv = await get(`/shops/${a.shopId}/inventory`, seller)
  const rows = inv.data ?? []
  const row = rows.find((r) => (r.inventory?.variant_id ?? r.variant_id) === variantId)
  return row ? (row.inventory?.quantity ?? row.quantity) : 0
}
const blueBefore = await qty(blue)
const redBefore = await qty(red)
check('blue starts at 5, red has no stock row', blueBefore === 5 && redBefore === 0, `${blueBefore}/${redBefore}`)

section('Goods-in note (what the Réceptions tab sends)')
const ref = `BL-${a.stamp}`
const rec = await post(`/businesses/${a.businessId}/receipts`, seller, {
  shop_id: a.shopId, reference_number: ref, notes: 'Livraison fournisseur Kin',
  lines: [{ variant_id: blue, quantity: 7, unit_cost: 11.5 }, { variant_id: red, quantity: 4, unit_cost: 12 }],
})
check('note recorded (201)', rec.status === 201, `${rec.status} ${JSON.stringify(rec.json).slice(0, 200)}`)
check('response has receipt + 2 lines', rec.data?.receipt?.reference_number === ref && rec.data?.lines?.length === 2)
check('blue stock 5 → 12', (await qty(blue)) === 12)
check('red stock 0 → 4 (row created)', (await qty(red)) === 4)

const list = await get(`/businesses/${a.businessId}/receipts`, seller)
const listed = (list.data ?? []).find((r) => r.id === rec.data?.receipt?.id)
check('note appears in the shop list', !!listed && listed.shop_id === a.shopId && listed.status === 'RECEIVED')
const detail = await get(`/receipts/${rec.data?.receipt?.id}`, seller)
check('note detail has both lines with cost', detail.data?.lines?.length === 2 && detail.data.lines.some((l) => l.unit_cost === 11.5 && l.quantity === 7))
const moves = await get(`/shops/${a.shopId}/movements?limit=20`, seller)
const stockIns = (moves.data ?? []).filter((m) => m.movement_type === 'STOCK_IN' && m.notes === 'Stock receipt')
check('two STOCK_IN movements written (+7 blue, +4 red)', stockIns.some((m) => m.variant_id === blue && m.quantity === 7 && m.new_quantity === 12) && stockIns.some((m) => m.variant_id === red && m.quantity === 4 && m.new_quantity === 4), `${stockIns.length}`)

const zero = await post(`/businesses/${a.businessId}/receipts`, seller, { shop_id: a.shopId, lines: [{ variant_id: blue, quantity: 0, unit_cost: 1 }] })
check('zero quantity refused (400)', zero.status === 400, `${zero.status}`)
const byBuyer = await post(`/businesses/${a.businessId}/receipts`, buyer, { shop_id: a.shopId, lines: [{ variant_id: blue, quantity: 1, unit_cost: 1 }] })
check('buyer cannot record a note (403)', byBuyer.status === 403, `${byBuyer.status}`)
const buyerList = await get(`/businesses/${a.businessId}/receipts`, buyer)
check('buyer cannot list notes (403)', buyerList.status === 403, `${buyerList.status}`)
check('stock unchanged by refused notes', (await qty(blue)) === 12)

section('Stock events are scoped to the business')
const noBiz = await get('/events/stock', seller)
check('business_id required (400)', noBiz.status === 400, `${noBiz.status}`)
const own = await get(`/events/stock?business_id=${a.businessId}`, seller)
const ev = own.data ?? []
check('own business events readable', own.status === 200 && ev.some((e) => e.event === 'stock.received' && e.variant_id === red))
check('only this business in the result', ev.every((e) => e.business_id === a.businessId))
const other = await get(`/events/stock?business_id=${a.businessId}`, buyer)
check('another user is refused (403)', other.status === 403, `${other.status}`)

section('Cash session: close then reconcile (what the Caisse page sends)')
const opened = await post(`/shops/${a.shopId}/cash-sessions/open`, seller, { opening_amount: 50 })
check('session opened', opened.status < 300, `${opened.status} ${JSON.stringify(opened.json).slice(0, 160)}`)
const sid = opened.data?.id
const early = await post(`/cash-sessions/${sid}/reconcile`, seller, {})
check('reconcile refused while open', early.status >= 400, `${early.status}`)
const closed = await post(`/cash-sessions/${sid}/close`, seller, { declared_closing_amount: 45 })
check('session closed', closed.status < 300 && closed.data?.status === 'CLOSED', `${closed.status}`)
const pays = await get(`/cash-sessions/${sid}/payments`, seller)
check('takings list loads', pays.status === 200 && (pays.data === null || Array.isArray(pays.data)), `${pays.status}`)
const rec2 = await post(`/cash-sessions/${sid}/reconcile`, seller, {})
check('reconciled with SHORTAGE (-5)', rec2.data?.status === 'RECONCILED' && rec2.data?.reconciliation_result === 'SHORTAGE' && rec2.data?.difference === -5, JSON.stringify(rec2.data ?? rec2.json).slice(0, 200))
const byBuyerCash = await post(`/cash-sessions/${sid}/reconcile`, buyer, {})
check('buyer cannot reconcile', byBuyerCash.status === 403 || byBuyerCash.status === 404, `${byBuyerCash.status}`)

section('Legacy /received runs the guarded confirmation')
const otherOrder = (await get(`/businesses/${a.businessId}/orders`, seller)).data?.[0]?.id ?? '00000000-0000-0000-0000-000000000001'
const received = await post(`/buyer/orders/${otherOrder}/received`, buyer, {})
check('not the buyer\'s order → refused with QR_FORBIDDEN', received.status >= 400 && received.json?.error?.code === 'QR_FORBIDDEN', `${received.status} ${JSON.stringify(received.json)}`)

summary()
