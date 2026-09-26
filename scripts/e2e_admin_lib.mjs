// Shared helpers for the admin Control Center E2E simulations.
// Talks to the real API over HTTP; nothing here is mocked.

export const API = (process.env.E2E_API_BASE || 'http://localhost:8080/api/v1').replace(/\/$/, '')
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'TestAdmin@2025!'
export const ROLE_ACCOUNTS = {
  COMMERCE_ADMIN: process.env.E2E_COMMERCE_EMAIL || 'commerce.test@tbkmarket.com',
  FINANCE_SUPPORT_ADMIN: process.env.E2E_FINANCE_EMAIL || 'finance.test@tbkmarket.com',
  TECHNICAL_ADMIN: process.env.E2E_TECHNICAL_EMAIL || 'technical.test@tbkmarket.com',
  DIRECTION_ADMIN: process.env.E2E_DIRECTION_EMAIL || 'direction.test@tbkmarket.com'
}

const results = []
let currentSection = ''

export function section(name) {
  currentSection = name
  console.log(`\n=== ${name} ===`)
}

export function check(name, ok, details = '') {
  results.push({ section: currentSection, name, ok: !!ok, details: ok ? '' : String(details).slice(0, 400) })
  console.log(`${ok ? '  PASS' : '  FAIL'} ${name}${ok ? '' : ` — ${String(details).slice(0, 400)}`}`)
  return !!ok
}

export function summary() {
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('\nFailures:')
    for (const f of failed) console.log(` - [${f.section}] ${f.name}: ${f.details}`)
  }
  return { results, failed }
}

export async function call(method, path, { token, body, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const started = Date.now()
  let res
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (err) {
    return { status: 0, data: null, error: err.message, ms: Date.now() - started }
  }
  if (raw) return { status: res.status, text: await res.text(), headers: res.headers, ms: Date.now() - started }
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  // Admin endpoints answer either {data: ...} or a bare object.
  const data = json && typeof json === 'object' && 'data' in json && !Array.isArray(json) ? json.data : json
  return { status: res.status, data, json, ms: Date.now() - started }
}

export const get = (path, token) => call('GET', path, { token })
export const post = (path, token, body = {}) => call('POST', path, { token, body })
export const patch = (path, token, body = {}) => call('PATCH', path, { token, body })
export const del = (path, token, body) => call('DELETE', path, { token, body })

export async function adminLogin(email, password = ADMIN_PASSWORD) {
  const r = await post('/admin/auth/login', undefined, { email, password })
  return r.status === 200 ? r.data?.access_token : null
}

export function errText(r) {
  return `HTTP ${r.status} ${typeof r.json === 'string' ? r.json : JSON.stringify(r.json)}`
}

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
