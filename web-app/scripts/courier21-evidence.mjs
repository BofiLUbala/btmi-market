import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('C:/Users/Dell/AppData/Local/Temp/opencode/qa/node_modules/puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const WEB = 'http://localhost:5174'
const API = 'http://localhost:8080/api/v1'
const OUT = 'C:\\Users\\Dell\\AppData\\Local\\Temp\\opencode\\qa\\courier21'
const PSQL = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe'

const ORDER_ID = 'd63f2c0f-b0b5-4c91-b817-fe171dedd600'
const COURIER_USER = 'f25b19a0-bccf-4116-98e9-cf4644d8aace'
const COURIER_EMAIL = 'courier_f25b19a0@tbk.cd'
const COURIER_PASS = 'Password123!'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function psql(sql) {
  const r = spawnSync(PSQL, ['-h', 'localhost', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-c', sql], {
    env: { ...process.env, PGPASSWORD: 'btmi_secret_password' },
    encoding: 'utf8'
  })
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr?.trim() || r.stdout?.trim()}`)
  return r.stdout.trim()
}

const login = async () => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: COURIER_EMAIL, password: COURIER_PASS })
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return res.json()
}

// --- extract rendered evidence for this state ---
async function evidence(page) {
  const ev = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim()
    const btns = [...document.querySelectorAll('button')]
      .map((b) => clean(b.innerText))
      .filter(Boolean)
    // status badge line: first element whose text has a delivery status string
    const badge = [...document.querySelectorAll('span,strong,b,p,h1,h2,h3')]
      .map((e) => clean(e.textContent))
      .find((t) => /^(COURIER_ASSIGNED|COURIER_ACCEPTED|READY_FOR_PICKUP|PICKED_UP|IN_TRANSIT|COURIER_ARRIVED|PRODUCT_VERIFIED|PAYMENT_VERIFIED|DELIVERY_SCAN_SUCCESS|AWAITING_BUYER_CONFIRMATION|DELIVERED)/.test(t)) || ''
    // action panel / prochaine action block
    const panel = (() => {
      const els = [...document.querySelectorAll('div,section,article')]
      for (const e of els) {
        const t = clean(e.textContent)
        if (t.includes('Prochaine action') && t.length < 900) return t
      }
      return ''
    })()
    const h1 = clean(document.querySelector('h1,h2')?.textContent)
    return { h1, badge, panel, btns }
  })
  return ev
}

async function capture(page, token, refresh, name) {
  await page.goto(`${WEB}/courier/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(([a, r]) => {
    localStorage.setItem('btmi.access', a)
    localStorage.setItem('btmi.refresh', r)
    localStorage.setItem('btmi.lang', 'fr')
  }, [token, refresh])
  await page.goto(`${WEB}/courier/missions/${ORDER_ID}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(3000)
  const ev = await evidence(page)
  const line = {
    state: name,
    header: ev.h1,
    badge: ev.badge,
    panel: ev.panel,
    buttons: ev.btns
  }
  lines.push(line)
  console.log(JSON.stringify(line))
}

// --- state restore on any exit ---
const BACKUP_SQL = (backup) => {
  const p = backup.split('|')
  const [s, ds, ac, aat, ccat, cst, carr, rej, rre] = p
  psql(`UPDATE orders SET status='${s}', delivery_status='${ds}', assigned_courier_id=${ac === '' ? 'NULL' : `'${ac}'`},
    courier_assigned_at=${aat === '' ? 'NULL' : `'${aat}'`},
    courier_accepted_at=${ccat === '' ? 'NULL' : `'${ccat}'`},
    courier_started_at=${cst === '' ? 'NULL' : `'${cst}'`},
    courier_arrived_at=${carr === '' ? 'NULL' : `'${carr}'`},
    rejected_by_courier_id=${rej === '' ? 'NULL' : `'${rej}'`},
    courier_rejection_reason=${rre === '' ? 'NULL' : `'${rre.replace(/'/g, "''")}'`}
    WHERE id='${ORDER_ID}'`)
  if (p[9] && p[9] !== '') {
    const bpm = p[9], bps = p[10], bpp = p[11]
    psql(`UPDATE buyer_payments SET payment_method='${bpm.replace(/'/g, "''")}', status='${bps.replace(/'/g, "''")}',
      provider='${bpp.replace(/'/g, "''")}'
      WHERE order_id='${ORDER_ID}'`)
  }
  const dsScan = p[12]
  psql(`UPDATE delivery_packages SET delivery_scanned_at=${dsScan === '' ? 'NULL' : `'${dsScan}'`}
    WHERE order_id='${ORDER_ID}' AND qr_status='ACTIVE'`)
  psql(`DELETE FROM product_handover_verifications WHERE order_id='${ORDER_ID}' AND result='SUCCESS'`)
  console.log('restored BTMI-1174 to', backup)
}

const lines = []

const run = async () => {
  const { access_token: token, refresh_token: refresh } = await login()
  let backup = psql(
    `SELECT status||'|'||delivery_status||'|'||COALESCE(assigned_courier_id::text,'')||'|'||
       COALESCE(courier_assigned_at::text,'')||'|'||COALESCE(courier_accepted_at::text,'')||'|'||
       COALESCE(courier_started_at::text,'')||'|'||COALESCE(courier_arrived_at::text,'')||'|'||
       COALESCE(rejected_by_courier_id::text,'')||'|'||COALESCE(courier_rejection_reason,'')||'|'||
       COALESCE((SELECT payment_method||'|'||status||'|'||COALESCE(provider::text,'')
                 FROM buyer_payments WHERE order_id='${ORDER_ID}' ORDER BY created_at DESC LIMIT 1),'')||'|'||
       COALESCE((SELECT COALESCE(delivery_scanned_at::text,'') FROM delivery_packages WHERE order_id='${ORDER_ID}' AND qr_status='ACTIVE' LIMIT 1),'')
     FROM orders WHERE id='${ORDER_ID}'`)
  // Clear leftovers from any previous run so the flags start clean
  psql(`DELETE FROM product_handover_verifications WHERE order_id='${ORDER_ID}' AND result='SUCCESS'`)
  console.log('backup:', backup.slice(0, 160))

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 950 }
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 120)))
  // The SPA persists its resolved language on mount, so writing btmi.lang after
  // the page loads gets overwritten by the navigator default. Inject instead so
  // every document load forces French before the app resolves its language.
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('btmi.lang', 'fr') } catch {}
  })

  try {
    const assign = `UPDATE orders SET assigned_courier_id='${COURIER_USER}', courier_assigned_at=now(),
      received_at=NULL, delivery_status='COURIER_ASSIGNED', status='PENDING', courier_accepted_at=NULL,
      courier_started_at=NULL, courier_arrived_at=NULL, rejected_by_courier_id=NULL, courier_rejection_reason=NULL WHERE id='${ORDER_ID}'`

    setState(assign)
    await capture(page, token, refresh, 'COURIER_ASSIGNED')
    setState(`UPDATE orders SET delivery_status='COURIER_ACCEPTED', status='PENDING', courier_accepted_at=now() WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'COURIER_ACCEPTED')
    setState(`UPDATE orders SET delivery_status='READY_FOR_PICKUP', status='READY' WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'READY_FOR_PICKUP')
    setState(`UPDATE orders SET delivery_status='PICKED_UP', status='READY', courier_started_at=NULL, courier_arrived_at=NULL WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'PICKED_UP')
    setState(`UPDATE orders SET delivery_status='IN_TRANSIT', courier_started_at=now(), courier_arrived_at=NULL WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'IN_TRANSIT')
    setState(`UPDATE orders SET delivery_status='COURIER_ARRIVED', courier_arrived_at=now() WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'COURIER_ARRIVED')

    const verifyRes = await fetch(`${API}/courier/missions/${ORDER_ID}/verify-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ product_number: 'VAR-8416F9C6' })
    })
    console.log('verify-product:', verifyRes.status)
    await sleep(12000)
    await page.goto(`${WEB}/courier/missions/${ORDER_ID}`, { waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(3000)
    await capture(page, token, refresh, 'PRODUCT_VERIFIED_MOBILE_WAIT')

    // Points 10/11 — PAYMENT_VERIFIED (payment actually settled -> action panel: scan buyer QR button)
    psql(`UPDATE buyer_payments SET status='PAID' WHERE order_id='${ORDER_ID}'`)
    setState(`UPDATE orders SET delivery_status='PAYMENT_VERIFIED' WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'PAYMENT_VERIFIED')

    // Point 12 — DELIVERY_SCAN_SUCCESS (QR scanned, waiting buyer acknowledgment)
    psql(`UPDATE delivery_packages SET delivery_scanned_at=now() WHERE order_id='${ORDER_ID}' AND qr_status='ACTIVE'`)
    setState(`UPDATE orders SET delivery_status='DELIVERY_SCAN_SUCCESS' WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'DELIVERY_SCAN_SUCCESS')
    setState(`UPDATE orders SET delivery_status='DELIVERED', status='DELIVERED' WHERE id='${ORDER_ID}'`)
    await capture(page, token, refresh, 'DELIVERED')

    // Point 8 — PRODUCT_VERIFIED + CASH: temporarily flip this order's payment to
    // cash at delivery so the courier_at_door cash gate opens, then capture the
    // CONFIRM_CASH action panel (the row is restored from backup afterwards).
    setState(`UPDATE orders SET delivery_status='COURIER_ARRIVED', courier_arrived_at=now(),
      courier_started_at=now(), status='READY' WHERE id='${ORDER_ID}'`)
    psql(`UPDATE buyer_payments SET payment_method='CASH_ON_DELIVERY', status='DUE', provider=''
      WHERE order_id='${ORDER_ID}'`)
    const cashVerify = await fetch(`${API}/courier/missions/${ORDER_ID}/verify-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ product_number: 'VAR-8416F9C6' })
    })
    console.log('cash-variant verify-product:', cashVerify.status)
    await sleep(12000)
    await page.goto(`${WEB}/courier/missions/${ORDER_ID}`, { waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(3000)
    await capture(page, token, refresh, 'PRODUCT_VERIFIED_CASH')
  } finally {
    await browser.close()
    try { BACKUP_SQL(backup) } catch (e) { console.error('restore failed:', e.message) }
  }

  writeFileSync(join2(OUT, 'evidence.json'), JSON.stringify(lines, null, 2))
  console.log('DONE')
}

function setState(sql) { psql(sql); console.log('applied:', sql.slice(0, 80)) }
function join2(a, b) { return require('node:path').join(a, b) }

run().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})