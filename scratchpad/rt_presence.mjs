// Live check of presence against the running API: an anonymous visitor, a
// signed-in buyer, and a device whose account signed out must each appear with
// the right status and page; leaving removes them; tokens in URLs are dropped.
// Usage: node scratchpad/rt_presence.mjs scratchpad/actors.json
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { API, ROLE_ACCOUNTS, adminLogin, check, get, section, summary } from '../scripts/e2e_admin_lib.mjs'

const a = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const direction = await adminLogin(ROLE_ACCOUNTS.DIRECTION_ADMIN)
const commerce = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
const buyer = (await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: a.buyerEmail, password: a.password }) })).json()).access_token

const beat = (body, token) => fetch(`${API}/presence/heartbeat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})
const leave = (id) => fetch(`${API}/presence/leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitor_id: id }) })
const live = async () => (await get('/admin/direction/monitoring/presence', direction)).data
const find = (snap, id) => snap?.visitors?.find((v) => v.visitor_id === id)

const anon = randomUUID(), signed = randomUUID(), gone = randomUUID()

section('Three kinds of visitors')
check('anonymous heartbeat accepted', (await beat({ visitor_id: anon, path: '/', platform: 'web' })).status === 200)
check('signed-in heartbeat accepted', (await beat({ visitor_id: signed, path: '/products/abc?ref=home', platform: 'android', has_session: true }, buyer)).status === 200)
await beat({ visitor_id: gone, path: '/cart', platform: 'web', has_session: true }, buyer) // was signed in on this device…
await beat({ visitor_id: gone, path: '/activate?token=SECRET123', platform: 'web', has_session: false }) // …then signed out

let snap = await live()
check('direction admin reads presence', !!snap?.visitors, JSON.stringify(snap?.summary))
check('anonymous visitor → ANONYMOUS on home', find(snap, anon)?.status === 'ANONYMOUS' && find(snap, anon)?.path === '/' && !find(snap, anon)?.email)
const s = find(snap, signed)
check('signed-in buyer → SIGNED_IN with account and role', s?.status === 'SIGNED_IN' && s?.email === a.buyerEmail && s?.role === 'buyer', JSON.stringify(s))
check('query string dropped from the page', s?.path === '/products/abc')
check('platform recorded', s?.platform === 'android')
const g = find(snap, gone)
check('signed-out device → KNOWN_SIGNED_OUT with its account', g?.status === 'KNOWN_SIGNED_OUT' && g?.email === a.buyerEmail, JSON.stringify(g))
check('activation token never stored', g?.path === '/activate' && !JSON.stringify(snap).includes('SECRET123'))
check('summary counts each kind', snap.summary.anonymous >= 1 && snap.summary.signed_in >= 1 && snap.summary.known_signed_out >= 1)
check('page breakdown present', snap.summary.by_page.home >= 1 && snap.summary.by_page.product >= 1)

section('Idle past the access-token lifetime stays "signed in"')
await beat({ visitor_id: signed, path: '/orders', platform: 'android', has_session: true }) // no token, session kept
snap = await live()
check('still SIGNED_IN', find(snap, signed)?.status === 'SIGNED_IN' && find(snap, signed)?.path === '/orders')

section('Leaving removes the visitor at once')
await leave(anon)
snap = await live()
check('anonymous visitor gone after leave', !find(snap, anon))

section('Input and access control')
check('non-UUID visitor refused (400)', (await beat({ visitor_id: 'abc', path: '/' })).status === 400)
check('commerce admin refused (403)', (await get('/admin/direction/monitoring/presence', commerce)).status === 403)
check('anonymous refused (401)', (await fetch(`${API}/admin/direction/monitoring/presence`)).status === 401)

await leave(signed); await leave(gone)
summary()
