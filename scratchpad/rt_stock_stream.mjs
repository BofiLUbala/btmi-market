// Live check of the stock/cash push: the seller's open SSE stream must receive a
// "stock" event right after a restock and a "cash" event after a cash session
// change; the buyer's stream must receive neither.
// Usage: node scratchpad/rt_stock_stream.mjs scratchpad/actors.json
import { readFileSync } from 'node:fs'
import { API, check, post, section, summary } from '../scripts/e2e_admin_lib.mjs'

const a = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const login = async (email) => (await post('/auth/login', undefined, { email, password: a.password })).json?.access_token
const seller = await login(a.sellerEmail)
const buyer = await login(a.buyerEmail)

function listen(token, label) {
  const events = []
  const abort = new AbortController()
  const ready = (async () => {
    const res = await fetch(`${API}/events/stream`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: abort.signal })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    ;(async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          let end
          while ((end = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, end)
            buf = buf.slice(end + 2)
            const data = block.split('\n').find((l) => l.startsWith('data: '))
            if (data) { try { events.push({ at: Date.now(), ...JSON.parse(data.slice(6)) }) } catch { /* ready frame */ } }
          }
        }
      } catch { /* aborted */ }
    })()
    return res.status
  })()
  return { events, ready, stop: () => abort.abort(), label }
}

const s = listen(seller, 'seller')
const b = listen(buyer, 'buyer')
check('both streams open', (await s.ready) === 200 && (await b.ready) === 200)
await new Promise((r) => setTimeout(r, 800))

section('Restock → instant "stock" event to the seller only')
const variant = '5a5ce46e-f04a-4029-ae1d-d29587fca4e3'
const t0 = Date.now()
const r = await post(`/shops/${a.shopId}/stock`, seller, { variant_id: variant, quantity: 1, notes: 'push test' })
check('restock accepted', r.status < 300, `${r.status}`)
await new Promise((res) => setTimeout(res, 1500))
const stockEv = s.events.find((e) => e.kind === 'stock' && e.at >= t0)
check('seller got a stock event', !!stockEv && stockEv.business_id === a.businessId, JSON.stringify(stockEv))
check('delivered in under 1 s', !!stockEv && stockEv.at - t0 < 1000, stockEv ? `${stockEv.at - t0} ms` : '')
check('buyer got no stock event', !b.events.some((e) => e.kind === 'stock'))

section('Cash session → instant "cash" event to the seller only')
const t1 = Date.now()
const opened = await post(`/shops/${a.shopId}/cash-sessions/open`, seller, { opening_amount: 10 })
check('session opened', opened.status < 300, `${opened.status}`)
await new Promise((res) => setTimeout(res, 1500))
const cashEv = s.events.find((e) => e.kind === 'cash' && e.at >= t1)
check('seller got a cash event', !!cashEv && cashEv.business_id === a.businessId, JSON.stringify(cashEv))
check('buyer got no cash event', !b.events.some((e) => e.kind === 'cash'))
if (opened.data?.id) await post(`/cash-sessions/${opened.data.id}/close`, seller, { declared_closing_amount: 10 })

section('Goods-in note with 2 lines → merged into one event')
const t2 = Date.now()
await post(`/businesses/${a.businessId}/receipts`, seller, { shop_id: a.shopId, lines: [{ variant_id: variant, quantity: 1, unit_cost: 1 }, { variant_id: '3249ac82-3a68-40a3-a6d6-935458d0f40e', quantity: 1, unit_cost: 1 }] })
await new Promise((res) => setTimeout(res, 1500))
const burst = s.events.filter((e) => e.kind === 'stock' && e.at >= t2)
check('one stock event for the whole note', burst.length === 1, `${burst.length}`)

s.stop(); b.stop()
summary()
process.exit(0)
