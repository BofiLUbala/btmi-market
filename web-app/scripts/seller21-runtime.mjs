import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const puppeteer = require('C:/Users/Dell/AppData/Local/Temp/opencode/qa/node_modules/puppeteer-core')

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const WEB = 'http://localhost:5174'
const API = 'http://localhost:8080/api/v1'
const OUT = 'C:\\Users\\Dell\\AppData\\Local\\Temp\\opencode\\qa\\seller21'
const PSQL = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe'

const ORDER_ID = 'd63f2c0f-b0b5-4c91-b817-fe171dedd600'
const ORDER_NUMBER = 'BTMI-1174'
const ORDER_BUSINESS = 'b53fd5bd-6a0e-49f7-ac9e-f517d87b42aa'

const requireEnv = (name) => {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var ${name} — set it before running this harness`)
  return v
}

const SELLER_EMAIL = 'courier_f3d2ea47@tbk.cd'
const SELLER_PASS = requireEnv('BTMI_SELLER_PASSWORD')
const COURIER_EMAIL = 'courier_f25b19a0@tbk.cd'
const COURIER_PASS = requireEnv('BTMI_COURIER_PASSWORD')
const COURIER_USER = 'f25b19a0-bccf-4116-98e9-cf4644d8aace'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function psql(sql) {
  const r = spawnSync(PSQL, ['-h', 'localhost', '-U', 'btmi_user', '-d', 'btmi_market', '-t', '-A', '-c', sql], {
    env: { ...process.env, PGPASSWORD: requireEnv('BTMI_DB_PASSWORD') },
    encoding: 'utf8'
  })
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr?.trim() || r.stdout?.trim()}`)
  return r.stdout.trim()
}

async function apiLogin(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`)
  const body = await res.json()
  return { token: body.access_token, refresh: body.refresh_token }
}

async function newPage(context) {
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message.slice(0, 160)))
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('btmi.lang', 'fr') } catch {}
  })
  return page
}

async function inject(page, loginPath, token, refresh) {
  await page.goto(`${WEB}${loginPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(([a, r]) => {
    localStorage.setItem('btmi.access', a)
    localStorage.setItem('btmi.refresh', r)
  }, [token, refresh])
}

async function shot(page, name, tag) {
  const info = await page.evaluate((n) => ({
    path: location.pathname + location.search,
    title: document.querySelector('h1')?.textContent?.slice(0, 80) || '',
    hasConfirmPickup: document.body.innerText.includes('Confirmer la récupération'),
    hasScanSeller: document.body.innerText.includes('Scanner le QR vendeur'),
    bodySnippet: document.body.innerText.slice(0, 1400)
  }), ORDER_NUMBER)
  const line = `${name} | ${info.path} | ${info.title}`
  console.log('   shot', line)
  logLine(`${tag || name}: ${line}`)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
  return info
}

// Wait until the row containing ORDER_NUMBER also contains `text` (re-queries every frame).
async function waitRowText(page, text, ms = 45000) {
  await page.waitForFunction((n, t) => {
    for (const tr of document.querySelectorAll('tbody tr')) {
      const first = tr.querySelector('td:first-child')
      if (first && (first.textContent || '').includes(n) && (tr.textContent || '').includes(t)) return true
    }
    return false
  }, { timeout: ms }, ORDER_NUMBER, text)
}

// Waits until the BTMI row no longer shows any action button of the given label set.
async function waitRowActionGone(page, labels, ms = 45000) {
  await page.waitForFunction((n, lbls) => {
    for (const tr of document.querySelectorAll('tbody tr')) {
      const first = tr.querySelector('td:first-child')
      if (first && (first.textContent || '').includes(n)) {
        const cell = tr.querySelectorAll('td')[4]
        const txt = cell ? cell.textContent || '' : ''
        return !lbls.some((l) => txt.includes(l))
      }
    }
    return false
  }, { timeout: ms }, ORDER_NUMBER, labels)
}

// Click the button inside the row containing ORDER_NUMBER.
async function clickInRow(page, text) {
  const clicked = await page.evaluate((n, t) => {
    for (const tr of document.querySelectorAll('tbody tr')) {
      const first = tr.querySelector('td:first-child')
      if (first && (first.textContent || '').includes(n)) {
        const btn = [...tr.querySelectorAll('button')].find((b) => (b.textContent || '').trim().includes(t))
        if (!btn) return `row found but button ${t} missing`
        btn.click()
        return 'clicked'
      }
    }
    return `row ${n} not found`
  }, ORDER_NUMBER, text)
  if (clicked !== 'clicked') throw new Error(`clickInRow failed: ${clicked}`)
}

function waitDB(condSql, expected, ms = 60000) {
  const deadline = Date.now() + ms
  let last = ''
  while (Date.now() < deadline) {
    last = psql(condSql)
    if (last.includes(expected)) return last
    sleep(2000)
  }
  throw new Error(`DB wait timeout: expected ${expected}, last=${last}`)
}

const logLines = []
function logLine(line) { logLines.push(line); console.log('   ', line) }

const report = {}

async function run() {
  mkdirSync(OUT, { recursive: true })

  const sellerAuth = await apiLogin(SELLER_EMAIL, SELLER_PASS)
  const courierAuth = await apiLogin(COURIER_EMAIL, COURIER_PASS)
  console.log('logins ok', SELLER_EMAIL, COURIER_EMAIL)

  const backup = psql(
    `SELECT status||'|'||delivery_status||'|'||COALESCE(assigned_courier_id::text,'')||'|'||
       COALESCE(courier_assigned_at::text,'')||'|'||COALESCE(courier_accepted_at::text,'')||'|'||
       COALESCE(accepted_at::text,'')||'|'||COALESCE(preparing_at::text,'')||'|'||COALESCE(ready_at::text,'')||'|'||
       COALESCE((SELECT qr_status||'|'||COALESCE(delivery_scanned_at::text,'') FROM delivery_packages WHERE order_id='${ORDER_ID}' AND qr_status='ACTIVE' LIMIT 1),'')
     FROM orders WHERE id='${ORDER_ID}'`)
  const old1070 = psql(`SELECT status||'|'||COALESCE(preparing_at::text,'') FROM orders WHERE order_number='BTMI-1070'`)
  console.log('pristine backup:', backup)

  // ---- Scenario state: courier accepted mission, seller must prepare & mark ready
  psql(`UPDATE orders SET status='ACCEPTED', delivery_status='COURIER_ACCEPTED',
    assigned_courier_id='${COURIER_USER}', courier_assigned_at=now(), courier_accepted_at=now(),
    accepted_at=COALESCE(accepted_at, now()), courier_started_at=NULL, courier_arrived_at=NULL,
    rejected_by_courier_id=NULL, courier_rejection_reason=NULL
    WHERE id='${ORDER_ID}'`)
  report.state_setup = psql(`SELECT status||'|'||delivery_status||'|'||assigned_courier_id FROM orders WHERE id='${ORDER_ID}'`)
  console.log('scenario state:', report.state_setup)

const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 950 }
  })

  // Isolated ORIGIN-storage per side: a real seller phone and a real courier phone
  // do not share localStorage, so each context keeps its own btmi.access/refresh.
  const courierCtx = await browser.createBrowserContext()
  const courierPage = await newPage(courierCtx)
  const courierRefetches = []
  const courierErrs = []
  courierPage.on('response', (r) => {
    if (r.url().includes('/courier/missions') && !r.url().includes('handover')) {
      courierRefetches.push(`${new Date().toISOString().slice(11, 19)}:${r.status()}`)
    }
  })
  courierPage.on('pageerror', (e) => courierErrs.push(`pageerror: ${e.message.slice(0, 140)}`))
  courierPage.on('console', (m) => { if (m.type() === 'error') courierErrs.push(`console: ${m.text().slice(0, 140)}`) })
  await inject(courierPage, '/courier/login', courierAuth.token, courierAuth.refresh)
  await courierPage.goto(`${WEB}/courier/missions/${ORDER_ID}`, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(3500)
  report.courier_before = await shot(courierPage, '00_COURIER_WAITING_SELLER', 'step0-courier-waiting')
  const courierUrlBefore = courierPage.url()
  logLine(`courier before: hasConfirmPickup=${report.courier_before.hasConfirmPickup} hasScanSeller=${report.courier_before.hasScanSeller}`)

  // ---- Seller tab: dashboard shows BTMI-1174 as entry point
  const sellerCtx = await browser.createBrowserContext()
  const sellerPage = await newPage(sellerCtx)
  await inject(sellerPage, '/seller/login', sellerAuth.token, sellerAuth.refresh)
  await sellerPage.goto(`${WEB}/seller/dashboard`, { waitUntil: 'networkidle0', timeout: 30000 })
  await sleep(3000)
  const dash = await shot(sellerPage, '01_SELLER_DASHBOARD', 'step1-seller-dashboard')
  report.dashboard = {
    url: dash.path,
    hasBTMI_row: await sellerPage.evaluate((n) => {
      for (const tr of document.querySelectorAll('table tbody tr, .data-table tbody tr')) {
        if ((tr.textContent || '').includes(n)) return true
      }
      return false
    }, ORDER_NUMBER),
    hasProcessOrdersEntry: (dash.bodySnippet.includes('Traiter les commandes') || dash.bodySnippet.includes('process'))
  }
  logLine(`dashboard recent-orders has BTMI-1174 row=${report.dashboard.hasBTMI_row}`)

  // Real navigation: click the BTMI-1174 order link on the dashboard
  const linkFound = await sellerPage.evaluate((n) => {
    const links = [...document.querySelectorAll('a')]
    const l = links.find((x) => (x.textContent || '').includes(n) && (x.className || '').includes('order-code-link'))
    if (l) { l.click(); return true }
    return false
  }, ORDER_NUMBER)
  if (!linkFound) throw new Error('BTMI-1174 dashboard link not found')
  await sellerPage.waitForFunction((n) => location.pathname === '/seller/orders' && document.body.innerText.includes(n), {}, ORDER_NUMBER)
  await sleep(2500)

  // ---- ACCEPTED + COURIER_ACCEPTED -> [Commencer la préparation] in the BTMI row
  await waitRowText(sellerPage, 'Commencer la préparation')
  const s2 = await shot(sellerPage, '02_SELLER_ORDERS_PREPARER', 'step2-seller-preparer')
  report.preparer_visible = true

  // REAL click #1 -> POST /orders/:id/prepare
  await clickInRow(sellerPage, 'Commencer la préparation')
  await waitDB(`SELECT status||'|'||delivery_status FROM orders WHERE id='${ORDER_ID}'`, 'PREPARING|COURIER_ACCEPTED')
  await waitRowText(sellerPage, 'Marquer comme prête')
  const s3 = await shot(sellerPage, '03_SELLER_ORDERS_PREPARING', 'step3-seller-preparing')
  report.after_prepare = { db: psql(`SELECT status||'|'||delivery_status FROM orders WHERE id='${ORDER_ID}'`) }

  // REAL click #2 -> POST /orders/:id/tracking/status {status:READY}
  await clickInRow(sellerPage, 'Marquer comme prête')
  await waitDB(`SELECT status||'|'||delivery_status FROM orders WHERE id='${ORDER_ID}'`, 'READY|READY_FOR_PICKUP')
  await waitRowActionGone(sellerPage, ['Marquer comme prête', 'Commencer la préparation'])
  await sleep(2000)
  const s4 = await shot(sellerPage, '04_SELLER_ORDERS_READY', 'step4-seller-ready')
  report.after_ready = { db: psql(`SELECT status||'|'||delivery_status FROM orders WHERE id='${ORDER_ID}'`) }

// ---- Courier tab: NO navigation/reload. Bring the tab to the front (as a real
  // user glancing at the courier app would) so the 4s visibility poll resumes.
  logLine(`courier url before unlock: ${courierPage.url()}`)
  await courierPage.bringToFront()
  const visAfterFront = await courierPage.evaluate(() => ({ vis: document.visibilityState, ts: performance.now() }))
  logLine(`courier visibility after bringToFront: ${JSON.stringify(visAfterFront)}`)
  const refetchBaseline = courierRefetches.length
  let pollUnlocked = false
  let pollError = null
  try {
    await waitRowTextImpl(courierPage, 'Confirmer la récupération', 50000)
    pollUnlocked = true
  } catch (e) {
    pollError = String(e)
  }
  logLine(`courier refetch XHRs: ${courierRefetches.length - refetchBaseline} -> ${courierRefetches.slice(-8).join(',')}`)
  if (courierErrs.length) logLine(`courier page errors: ${courierErrs.slice(0, 6).join(' | ')}`)
  report.poll_diag = {
    pollUnlocked,
    pollError,
    refetches: courierRefetches.slice(-10),
    pageErrors: courierErrs.slice(0, 6),
    refetchTotal: courierRefetches.length
  }
  if (!pollUnlocked) {
    // Controlled diagnostic: ONE reload only AFTER the poll window failed, to
    // classify whether this is a polling bug (user's "needs F5" report) vs render bug.
    logLine('DIAGNOSTIC: doing a single controlled reload of the courier mission page')
    await courierPage.reload({ waitUntil: 'networkidle0', timeout: 30000 })
    await sleep(4000)
    const afterReload = await courierPage.evaluate(() => ({
      hasConfirm: document.body.innerText.includes('Confirmer la récupération'),
      hasScanSeller: document.body.innerText.includes('Scanner le QR vendeur'),
      snippet: document.body.innerText.slice(0, 700)
    }))
    logLine(`after controlled reload: confirm=${afterReload.hasConfirm} scanSeller=${afterReload.hasScanSeller}`)
    report.reload_diag = afterReload
  }
  const courierUrlAfter = courierPage.url()
  const s5 = await shot(courierPage, '05_COURIER_UNLOCKED', 'step5-courier-unlocked')
  report.courier_unlocked = {
    pollUnlocked,
    sameUrlNoReload: courierUrlBefore === courierUrlAfter,
    urlBefore: courierUrlBefore,
    urlAfter: courierUrlAfter,
    hasConfirmPickup: s5.hasConfirmPickup,
    hasScanSeller: s5.hasScanSeller,
  }
  logLine(`courier auto-unlock pollUnlocked=${pollUnlocked} sameUrl=${courierUrlBefore === courierUrlAfter}`)

  await browser.close()

  // ---- Restore
  const p = backup.split('|')
  const [s, ds, ac, aat, ccat, acceptedAt, preparingAt, readyAt] = p.slice(0, 8)
  psql(`UPDATE orders SET status='${s}', delivery_status='${ds}',
    assigned_courier_id=${ac === '' ? 'NULL' : `'${ac}'`},
    courier_assigned_at=${aat === '' ? 'NULL' : `'${aat}'`},
    courier_accepted_at=${ccat === '' ? 'NULL' : `'${ccat}'`},
    accepted_at=${acceptedAt === '' ? 'NULL' : `'${acceptedAt}'`},
    preparing_at=${preparingAt === '' ? 'NULL' : `'${preparingAt}'`},
    ready_at=${readyAt === '' ? 'NULL' : `'${readyAt}'`}
    WHERE id='${ORDER_ID}'`)
  if (p[8] && p[8] !== '') {
    psql(`UPDATE delivery_packages SET qr_status='${p[8].replace(/'/g, "''")}',
      delivery_scanned_at=${p[9] === '' ? 'NULL' : `'${p[9]}'`}
      WHERE order_id='${ORDER_ID}' AND qr_status='ACTIVE'`)
  }
  psql(`DELETE FROM product_handover_verifications WHERE order_id='${ORDER_ID}' AND result='SUCCESS' AND (created_at > now() - interval '30 minutes')`)
  psql(`DELETE FROM order_status_history WHERE order_id='${ORDER_ID}' AND status IN ('PREPARING','READY') AND (created_at > now() - interval '30 minutes')`)
  const [s1070, p1070] = old1070.split('|')
  psql(`UPDATE orders SET status='${s1070}', preparing_at=${p1070 === '' ? 'NULL' : `'${p1070}'`} WHERE order_number='BTMI-1070'`)
  console.log('restored:', backup)

  const evidence = {
    order: `${ORDER_NUMBER} (${ORDER_ID})`,
    seller: SELLER_EMAIL,
    courier: COURIER_EMAIL,
    ...report,
  }
  writeFileSync(join(OUT, 'evidence.seller.json'), JSON.stringify(evidence, null, 2))
  writeFileSync(join(OUT, 'evidence.seller.log'), logLines.join('\n'))
  console.log('DONE')
}

async function waitRowTextImpl(page, text, ms) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, text)
}

run().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})