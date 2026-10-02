import { readFileSync } from 'node:fs'
const s = JSON.parse(readFileSync('scratchpad/video-state.json', 'utf8'))
const B = 'http://127.0.0.1:8099/api/v1'
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return t } }
const l = await j(await fetch(B + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: s.courier.email, password: s.password }) }))
const tok = (l.data || l).access_token
const pts = [[-4.3027, 15.3092], [-4.3022, 15.3086], [-4.3018, 15.3079], [-4.3013, 15.3072], [-4.3009, 15.3066], [-4.3005, 15.3060]]
for (const [lat, lng] of pts) {
  const r = await fetch(`${B}/courier/missions/${s.order.id}/location`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ latitude: lat, longitude: lng, accuracy: 8, captured_at: new Date().toISOString() }) })
  console.log(r.status, JSON.stringify(await j(r)).slice(0, 80))
  await new Promise((res) => setTimeout(res, 11000))
}
