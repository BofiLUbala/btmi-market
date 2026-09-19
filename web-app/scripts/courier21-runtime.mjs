import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('C:/Users/Dell/AppData/Local/Temp/opencode/qa/node_modules/puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const WEB = 'http://localhost:5174'
const API = 'http://localhost:8080/api/v1'
const OUT = 'C:\\Users\\Dell\\AppData\\Local\\Temp\\opencode\\qa\\courier21'
const PSQL = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe'

const ORDER_ID = 'd63f2c0f-b0b5-4c91-b817-fe171dedd600'
const ORDER_NUMBER = 'BTMI-1174'
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
  const body = await res.json()
  return body
}

async function shot(page, name) {
  const d = await page.evaluate(() => ({
    url: location.pathname,
    title: document.querySelector('h1,h2')?.textContent?.slice(0, 60) || ''
  }))
  console.log('   shot', name, d.url, '|', d.title)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

async function capture(page, token, refresh, name) {
  await page.goto(`${WEB}/courier/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(([a, r]) => {
    localStorage.setItem('btmi.access', a)
    localStorage.setItem('btmi.refresh', r)
  }, [token, refresh])
  await page.goto(`${WEB}/courier/missions/${ORDER_ID}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(3000)
  await shot(page, name)
}

const setState = (sql) => { psql(sql); console.log('   applied:', sql.slice(0, 90)) }

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const { access_token: token, refresh_token: refresh } = await login()
  console.log('logged in, tokens', token.length, refresh?.length)

  const backup = psql(
    `SELECT status||'|'||delivery_status||'|'||COALESCE(assigned_courier_id::text,'')||'|'||
       COALESCE(courier_assigned_at::text,'')||'|'||COALESCE(courier_accepted_at::text,'')||'|'||
       COALESCE(courier_started_at::text,'')||'|'||COALESCE(courier_arrived_at::text,'')||'|'||
       COALESCE(rejected_by_courier_id::text,'')||'|'||COALESCE(courier_rejection_reason,'')||'|'||
       COALESCE((SELECT payment_method||'|'||status||'|'||COALESCE(provider::text,'')
                 FROM buyer_payments WHERE order_id='${ORDER_ID}' ORDER BY created_at DESC LIMIT 1),'')||'|'||
       COALESCE((SELECT COALESCE(delivery_scanned_at::text,'') FROM delivery_packages WHERE order_id='${ORDER_ID}' AND qr_status='ACTIVE' LIMIT 1),'')
     FROM orders WHERE id='${ORDER_ID}'`)
  psql(`DELETE FROM product_handover_verifications WHERE order_id='${ORDER_ID}' AND result='SUCCESS'`)
  console.log('backup:', backup)

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 950 }
  })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 120)))
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('btmi.lang', 'fr') } catch {}
  })

  const assign = `UPDATE orders SET assigned_courier_id='${COURIER_USER}', courier_assigned_at=now(),
    received_at=NULL, delivery_status='COURIER_ASSIGNED', status='PENDING', courier_accepted_at=NULL,
    courier_started_at=NULL, courier_arrived_at=NULL, rejected_by_courier_id=NULL, courier_rejection_reason=NULL WHERE id='${ORDER_ID}'`

  // Point 2 — COURIER_ASSIGNED
  setState(assign)
  await capture(page, token, refresh, '01_COURIER_ASSIGNED')

  // Point 3 — COURIER_ACCEPTED
  setState(`UPDATE orders SET delivery_status='COURIER_ACCEPTED', status='PENDING', courier_accepted_at=now() WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '02_COURIER_ACCEPTED')

  // Point 4 — READY_FOR_PICKUP
  setState(`UPDATE orders SET delivery_status='READY_FOR_PICKUP', status='READY' WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '03_READY_FOR_PICKUP')

  // Point 5 — PICKED_UP
  setState(`UPDATE orders SET delivery_status='PICKED_UP', status='READY', courier_started_at=NULL, courier_arrived_at=NULL WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '04_PICKED_UP')

  // Point 6 — IN_TRANSIT
  setState(`UPDATE orders SET delivery_status='IN_TRANSIT', courier_started_at=now(), courier_arrived_at=NULL WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '05_IN_TRANSIT')

  // Point 7 — COURIER_ARRIVED (handover panel product-verify UI)
  setState(`UPDATE orders SET delivery_status='COURIER_ARRIVED', courier_arrived_at=now() WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '06_COURIER_ARRIVED')

  // Real product verification -> panel shows the mobile-payment wait (point 9)
  const verifyRes = await fetch(`${API}/courier/missions/${ORDER_ID}/verify-product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ product_number: 'VAR-8416F9C6' })
  })
  const verifyBody = await verifyRes.json().catch(() => ({}))
  console.log('   verify-product:', verifyRes.status, JSON.stringify(verifyBody).slice(0, 160))
  if (verifyRes.status !== 200) {
    psql(`DELETE FROM product_handover_verifications WHERE order_id='${ORDER_ID}' AND result='SUCCESS' AND (created_at > now() - interval '10 minutes')`)
  }
  await sleep(12000)
  await page.goto(`${WEB}/courier/missions/${ORDER_ID}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(3000)
  await shot(page, '07_PRODUCT_VERIFIED_WAIT_PAYMENT')

  // Points 10/11 — PAYMENT_VERIFIED (action panel: scan buyer QR button)
  setState(`UPDATE orders SET delivery_status='PAYMENT_VERIFIED' WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '08_PAYMENT_VERIFIED')

  // Point 12 — DELIVERY_SCAN_SUCCESS (waiting buyer acknowledgment)
  setState(`UPDATE orders SET delivery_status='DELIVERY_SCAN_SUCCESS' WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '09_DELIVERY_SCAN_SUCCESS')

  // Point 13 — DELIVERED
  setState(`UPDATE orders SET delivery_status='DELIVERED', status='DELIVERED' WHERE id='${ORDER_ID}'`)
  await capture(page, token, refresh, '10_DELIVERED')

  // Point 8 — PRODUCT_VERIFIED + CASH (temporarily flip the order's payment)
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
  await shot(page, '11_PRODUCT_VERIFIED_CASH')

  await browser.close()

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
    psql(`UPDATE buyer_payments SET payment_method='${p[9].replace(/'/g, "''")}', status='${p[10].replace(/'/g, "''")}',
      provider='${p[11].replace(/'/g, "''")}' WHERE order_id='${ORDER_ID}'`)
  }
  psql(`UPDATE delivery_packages SET delivery_scanned_at=${p[12] === '' ? 'NULL' : `'${p[12]}'`}
    WHERE order_id='${ORDER_ID}' AND qr_status='ACTIVE'`)
  psql(`DELETE FROM product_handover_verifications WHERE order_id='${ORDER_ID}' AND result='SUCCESS'`)
  console.log('restored BTMI-1174 to', backup)
  console.log('DONE')
}

run().catch((e) => {
  console.error('FATAL', e)
  const [s, ds, ac, aat, ccat, cst, carr, rej, rre] = (process.env.BACKUP || '').split('|')
  process.exit(1)
})
