// @ts-nocheck
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const LOCALES_DIR = dirname(fileURLToPath(import.meta.url))

function parseKeys(filePath: string): Set<string> {
  const src = readFileSync(filePath, 'utf8')
  const keys = new Set<string>()
  const re = /^\s*'([a-z][a-zA-Z0-9.]*?)'\s*:/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) keys.add(m[1])
  return keys
}

function walk(dir: string, out: Set<string>) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const entry of entries) {
    if (['node_modules', 'dist', '.git', '.expo'].includes(entry)) continue
    const full = join(dir, entry)
    try {
      const st = statSync(full)
      if (st.isDirectory()) walk(full, out)
      else if (/\.(tsx|ts|jsx|js)$/.test(entry)) {
        const src = readFileSync(full, 'utf8')
        for (const cm of src.matchAll(/\bt\(['"]([a-z][a-zA-Z0-9.:]*?)['"]/g)) out.add(cm[1])
        for (const cm of src.matchAll(/\bt\(`([a-z][a-zA-Z0-9.:]*?)`/g)) out.add(cm[1])
      }
    } catch { /* skip */ }
  }
}

describe('FR / EN locale parity', () => {
  const frKeys = parseKeys(join(LOCALES_DIR, 'fr.ts'))
  const enKeys = parseKeys(join(LOCALES_DIR, 'en.ts'))

  it('has the same keys in FR and EN', () => {
    const onlyFr = [...frKeys].filter((k) => !enKeys.has(k))
    const onlyEn = [...enKeys].filter((k) => !frKeys.has(k))
    expect(onlyFr, `keys only in FR (${onlyFr.length}): ${onlyFr.slice(0, 20).join(', ')}`).toHaveLength(0)
    expect(onlyEn, `keys only in EN (${onlyEn.length}): ${onlyEn.slice(0, 20).join(', ')}`).toHaveLength(0)
  })

  it('has no duplicate keys inside FR', () => {
    const all = [...readFileSync(join(LOCALES_DIR, 'fr.ts'), 'utf8').matchAll(/'([a-z][a-zA-Z0-9.]*?)'/g)].map((m) => m[1])
    const seen = new Set<string>()
    const dups = [...all].filter((k) => { if (seen.has(k)) return true; seen.add(k); return false })
    expect(dups).toHaveLength(0)
  })

  it('has no duplicate keys inside EN', () => {
    const all = [...readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf8').matchAll(/'([a-z][a-zA-Z0-9.]*?)'/g)].map((m) => m[1])
    const seen = new Set<string>()
    const dups = [...all].filter((k) => { if (seen.has(k)) return true; seen.add(k); return false })
    expect(dups).toHaveLength(0)
  })

  it('every key referenced via t() in the web app exists in FR', () => {
    const usedKeys = new Set<string>()
    walk(join(LOCALES_DIR, '..', '..'), usedKeys)
    const missing = [...usedKeys].filter((k) => !frKeys.has(k))
    expect(missing, `t() keys missing from FR: ${missing.slice(0, 20).join(', ')}`).toHaveLength(0)
  })
})