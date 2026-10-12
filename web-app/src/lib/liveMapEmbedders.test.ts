// @ts-nocheck -- reads the source tree with Node APIs (no Node types in this tsconfig), like locales/parity.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// The live courier map is shown to the buyer and to Commerce Admin only;
// seller and finance pages must never embed it.
describe('who embeds the live map', () => {
  const src = join(dirname(fileURLToPath(import.meta.url)), '..')
  const embedders: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry) && !entry.includes('.test.') && readFileSync(full, 'utf8').includes('tracking/LiveCourierMap')) {
        embedders.push(full.slice(src.length + 1).replace(/\\/g, '/'))
      }
    }
  }
  walk(join(src, 'pages'))

  // The buyer and courier pages left web-app with the marketplace UI (they live in
  // the Expo app now), so the admin delivery drawer is the only embedder left.
  it('is the Commerce Admin delivery drawer only', () => {
    expect(embedders.sort()).toEqual([
      'pages/admin/commerce/deliveries/CommerceDeliveryAssignmentsPage.tsx',
    ])
  })

  it('never appears on seller or finance pages', () => {
    expect(embedders.filter((p) => /seller|finance/i.test(p))).toEqual([])
  })
})
