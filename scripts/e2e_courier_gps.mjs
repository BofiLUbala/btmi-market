// Runtime check of live courier GPS against the real API (nothing mocked).
// Coordinates are simulated here: this proves the backend and the event
// stream, not a phone's GPS.
//   node scripts/e2e_courier_gps.mjs <phase: start|arrive> <actors.json> <order_id>
import { readFileSync } from 'node:fs'
import { API, ROLE_ACCOUNTS, adminLogin, get, post, check, summary, section, sleep } from './e2e_admin_lib.mjs'

const [phase, actorsFile, orderId] = process.argv.slice(2)
const actors = JSON.parse(readFileSync(actorsFile, 'utf8'))
const login = async (email) => (await post('/auth/login', undefined, { email, password: actors.password })).json?.access_token

const buyer = await login(actors.buyerEmail)
const seller = await login(actors.sellerEmail)
const courier = await login(actors.courierEmail)
const commerce = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)
const finance = await adminLogin(ROLE_ACCOUNTS.FINANCE_SUPPORT_ADMIN)
check('all actors signed in', buyer && seller && courier && commerce && finance)

/** Collects every SSE frame a stream receives. */
function listen(path, token) {
  const frames = []
  const abort = new AbortController()
  ;(async () => {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: abort.signal })
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let i
      while ((i = buf.indexOf('\n\n')) >= 0) { frames.push(buf.slice(0, i)); buf = buf.slice(i + 2) }
    }
  })().catch(() => undefined)
  return { frames, close: () => abort.abort() }
}
const locationFrames = (s) => s.frames.filter((f) => f.startsWith('event: location'))

const point = (lat, lng, extra = {}) => ({ latitude: lat, longitude: lng, accuracy: 9, heading: -1, speed: -1, captured_at: new Date().toISOString(), ...extra })
const report = (body, token = courier) => post(`/courier/missions/${orderId}/location`, token, body)

const streams = {
  buyer: listen('/events/stream', buyer),
  seller: listen('/events/stream', seller),
  courier: listen('/events/stream', courier),
  admin: listen('/admin/commerce/events/stream', commerce),
}
await sleep(1500)

if (phase === 'start') {
  section('Before IN_TRANSIT')
  let r = await report(point(-4.3200, 15.3000))
  check('PICKED_UP: location refused with 409 TRACKING_NOT_ACTIVE', r.status === 409 && r.json?.error?.code === 'TRACKING_NOT_ACTIVE', `${r.status} ${JSON.stringify(r.json)}`)
  r = await get(`/buyer/orders/${orderId}/tracking`, buyer)
  check('tracking: live_tracking_active=false before start', r.status === 200 && r.data.live_tracking_active === false, JSON.stringify(r.data?.live_tracking_active))

  section('Courier starts the delivery (real transition)')
  r = await post(`/courier/missions/${orderId}/start`, courier)
  check('POST /start -> IN_TRANSIT', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
  r = await get(`/buyer/orders/${orderId}/tracking`, buyer)
  check('tracking: IN_TRANSIT, live_tracking_active, destination coords, no courier coords',
    r.data?.delivery_status === 'IN_TRANSIT' && r.data.live_tracking_active === true && r.data.delivery_latitude === -4.304 && !('location' in r.data),
    JSON.stringify({ s: r.data?.delivery_status, a: r.data?.live_tracking_active, lat: r.data?.delivery_latitude }))

  section('Courier sends points')
  const before = { buyer: locationFrames(streams.buyer).length, admin: locationFrames(streams.admin).length }
  r = await report(point(-4.3200, 15.3000))
  check('first point accepted', r.status === 200 && r.data?.accepted === true, `${r.status} ${JSON.stringify(r.json)}`)
  r = await report(point(-4.3190, 15.3010))
  check('point 1 s later ignored (3 s spacing)', r.status === 200 && r.data?.accepted === false, JSON.stringify(r.json))
  r = await report(point(95, 15.3))
  check('latitude 95 rejected (422)', r.status === 422, `${r.status}`)
  r = await report({ ...point(-4.31, 15.30), accuracy: 400 })
  check('accuracy 400 m rejected (422)', r.status === 422, `${r.status}`)
  r = await report({ ...point(-4.31, 15.30), captured_at: new Date(Date.now() + 5 * 60_000).toISOString() })
  check('5 min in the future rejected (422)', r.status === 422, `${r.status}`)
  const other = await post('/auth/login', undefined, { email: actors.buyerEmail, password: actors.password })
  r = await report(point(-4.31, 15.30), other.json?.access_token)
  check('non-courier user cannot report (403/404)', [403, 404].includes(r.status), `${r.status}`)
  await sleep(3200)
  r = await report(point(-4.3150, 15.3040))
  check('point 3 s later accepted', r.status === 200 && r.data?.accepted === true, JSON.stringify(r.json))
  await sleep(1500)

  section('SSE location events')
  const b = locationFrames(streams.buyer).slice(before.buyer)
  const a = locationFrames(streams.admin).slice(before.admin)
  check('buyer stream got location events for the order', b.length >= 2 && b.every((f) => f.includes(orderId)), `${b.length}`)
  check('Commerce Admin stream got location events', a.length >= 2, `${a.length}`)
  check('seller stream got NO location event', locationFrames(streams.seller).length === 0, `${locationFrames(streams.seller).length}`)
  check('courier stream got NO location event', locationFrames(streams.courier).length === 0, `${locationFrames(streams.courier).length}`)
  check('location events carry no coordinates', [...b, ...a].every((f) => !/latitude|longitude|-4\.3|15\.3/.test(f)), b[0])
  const orderEventsDuringPings = streams.buyer.frames.filter((f) => f.startsWith('event: order')).length
  console.log(`   (buyer order events seen during the whole run: ${orderEventsDuringPings})`)

  section('Reads')
  r = await get(`/buyer/orders/${orderId}/courier-location`, buyer)
  check('buyer owner reads the latest point', r.status === 200 && r.data.available && r.data.location.latitude === -4.315 && r.data.freshness === 'LIVE', JSON.stringify(r.data))
  check('buyer response never names the courier', !JSON.stringify(r.json).includes('courier_user_id'), '')
  r = await get(`/admin/commerce/orders/${orderId}/courier-location`, commerce)
  check('Commerce Admin reads the same point', r.status === 200 && r.data.location?.latitude === -4.315, `${r.status}`)
  r = await get(`/admin/commerce/orders/${orderId}/courier-location`, finance)
  check('Finance admin is refused', r.status === 403, `${r.status}`)
  r = await get(`/buyer/orders/${orderId}/courier-location`, seller)
  check('seller cannot read it through the buyer route', r.status !== 200, `${r.status}`)
  r = await get(`/admin/commerce/orders/${orderId}/courier-location`, buyer)
  check('buyer token refused on the admin route', r.status === 401 || r.status === 403, `${r.status}`)
}

if (phase === 'arrive') {
  section('Courier arrives (real transition)')
  let r = await post(`/courier/missions/${orderId}/arrive`, courier)
  check('POST /arrive -> COURIER_ARRIVED', r.status === 200, `${r.status} ${JSON.stringify(r.json)}`)
  r = await report(point(-4.3050, 15.3075))
  check('server refuses points after arrival (409 TRACKING_NOT_ACTIVE)', r.status === 409 && r.json?.error?.code === 'TRACKING_NOT_ACTIVE', `${r.status}`)
  r = await get(`/buyer/orders/${orderId}/courier-location`, buyer)
  check('buyer sees no position any more', r.status === 200 && r.data.live_tracking_active === false && r.data.location === null, JSON.stringify(r.data))
  r = await get(`/admin/commerce/orders/${orderId}/courier-location`, commerce)
  check('admin sees no position any more', r.status === 200 && r.data.location === null, JSON.stringify(r.data))
  r = await get(`/buyer/orders/${orderId}/tracking`, buyer)
  check('tracking: COURIER_ARRIVED, live_tracking_active=false', r.data?.delivery_status === 'COURIER_ARRIVED' && r.data.live_tracking_active === false, JSON.stringify(r.data?.delivery_status))
}

for (const s of Object.values(streams)) s.close()
summary()
process.exit(0)
