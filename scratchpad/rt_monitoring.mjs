// Live check of the Direction sign-in monitoring against the running API:
// real refused sign-ins must appear, with the right role and reason, and the
// signed-in accounts list must come from live sessions. Run: node scratchpad/rt_monitoring.mjs
import { API, ROLE_ACCOUNTS, adminLogin, check, get, post, section, summary, uid } from '../scripts/e2e_admin_lib.mjs'
import { execFileSync } from 'node:child_process'

const sql = (q) => execFileSync('docker', ['exec', 'backend-postgres-1', 'psql', '-U', 'btmi_user', '-d', 'btmi_market', '-tAc', q], { encoding: 'utf8' }).trim()

const direction = await adminLogin(ROLE_ACCOUNTS.DIRECTION_ADMIN)
const commerce = await adminLogin(ROLE_ACCOUNTS.COMMERCE_ADMIN)

section('Refused sign-ins are recorded with role and reason')
const stamp = uid()
const unknownEmail = `nobody.${stamp}@tbk.test`
// A real buyer account with a wrong password.
const buyerEmail = sql(`SELECT email FROM users WHERE account_type='BUYER' AND status='ACTIVE' ORDER BY created_at DESC LIMIT 1`) || null

const r1 = await post('/auth/login', null, { email: unknownEmail, password: 'wrong-password-1' })
check('unknown account refused', r1.status === 401, `status ${r1.status}`)
if (buyerEmail) {
  const r2 = await post('/auth/login', null, { email: buyerEmail, password: `wrong-${stamp}` })
  check('wrong buyer password refused', r2.status === 401, `status ${r2.status}`)
}
const adminFail = `ghost.admin.${stamp}@tbk.test`
const r3 = await post('/admin/auth/login', null, { email: adminFail, password: 'nope-nope-1' })
check('admin sign-in refused', r3.status === 401, `status ${r3.status}`)

await new Promise((r) => setTimeout(r, 800)) // recording is asynchronous

const failures = await get('/admin/direction/monitoring/auth-failures?limit=50', direction)
check('direction admin can read failures', failures.status === 200, `status ${failures.status}`)
const rows = failures.data ?? []
const unknownRow = rows.find((f) => f.email === unknownEmail)
check('unknown account row present', !!unknownRow, JSON.stringify(unknownRow))
check('unknown account → role unknown / UNKNOWN_ACCOUNT', unknownRow?.role === 'unknown' && unknownRow?.error_code === 'UNKNOWN_ACCOUNT')
if (buyerEmail) {
  const buyerRow = rows.find((f) => f.email === buyerEmail.toLowerCase())
  check('buyer wrong password → role buyer / WRONG_PASSWORD', buyerRow?.role === 'buyer' && buyerRow?.error_code === 'WRONG_PASSWORD', JSON.stringify(buyerRow))
}
const adminRow = rows.find((f) => f.email === adminFail)
check('admin failure → role admin', adminRow?.role === 'admin', JSON.stringify(adminRow))
check('ip and device captured', !!unknownRow?.ip_address && !!unknownRow?.user_agent)

const filtered = await get('/admin/direction/monitoring/auth-failures?role=admin', direction)
check('role filter returns only admin rows', (filtered.data ?? []).every((f) => f.role === 'admin') && (filtered.data ?? []).length > 0)
const bad = await get('/admin/direction/monitoring/auth-failures?role=hacker', direction)
check('invalid role filter rejected (400)', bad.status === 400, `status ${bad.status}`)

section('Summary and sessions')
const sum = await get('/admin/direction/monitoring/summary', direction)
check('summary loads', sum.status === 200, JSON.stringify(sum.data?.summary))
check('24h failures counted', (sum.data?.summary?.failures_last_24h ?? 0) >= 2)
const sessions = await get('/admin/direction/monitoring/sessions', direction)
check('sessions load', sessions.status === 200, `status ${sessions.status}`)
const list = sessions.data ?? []
check('sessions are one row per account', new Set(list.map((s) => s.user_id)).size === list.length, `${list.length} rows`)
check('active_accounts matches list size (≤ limit)', sum.data?.summary?.active_accounts === list.length || list.length === 300, `${sum.data?.summary?.active_accounts} vs ${list.length}`)

section('Access control')
const denied = await get('/admin/direction/monitoring/auth-failures', commerce)
check('commerce admin is refused (403)', denied.status === 403, `status ${denied.status}`)
const anon = await fetch(`${API}/admin/direction/monitoring/sessions`)
check('anonymous is refused (401)', anon.status === 401, `status ${anon.status}`)

summary()
