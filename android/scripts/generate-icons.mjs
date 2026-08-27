#!/usr/bin/env node
/**
 * Generates every Android/Expo icon variant from a single source image.
 *
 *   node scripts/generate-icons.mjs <path-to-logo.png>
 *
 * Requires sharp, which is not a project dependency. Run it through npx so it
 * is not permanently installed:
 *
 *   npx --yes --package=sharp node scripts/generate-icons.mjs ./tbk-logo.png
 *
 * Produces, in assets/:
 *   icon.png                      1024x1024  full logo
 *   android-icon-foreground.png   1024x1024  logo inside the 66% safe zone
 *   android-icon-monochrome.png   1024x1024  white silhouette on transparent
 *   splash-icon.png               1024x1024  logo on the brand background
 *   favicon.png                     48x48
 *
 * Android masks adaptive icons to a circle and can crop up to ~33% of the
 * edges, so the foreground is deliberately scaled down and padded. Skipping
 * that step is what clips the oval on real devices.
 */
import sharp from 'sharp'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const assets = resolve(here, '..', 'assets')

const source = process.argv[2]
if (!source) {
  console.error('Usage: node scripts/generate-icons.mjs <path-to-logo.png>')
  process.exit(1)
}
if (!existsSync(source)) {
  console.error(`Source image not found: ${source}`)
  process.exit(1)
}
if (!existsSync(assets)) mkdirSync(assets, { recursive: true })

const SIZE = 1024
const BRAND_BG = { r: 0, g: 0, b: 0, alpha: 1 } // logo is white on black

const out = (name) => resolve(assets, name)

async function main() {
  const meta = await sharp(source).metadata()
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format}`)
  if ((meta.width ?? 0) < SIZE) {
    console.warn(
      `Warning: source is narrower than ${SIZE}px. Upscaling will look soft — ` +
      'export the logo at 1024x1024 or larger for a crisp launcher icon.'
    )
  }

  // 1. Full-bleed app icon.
  await sharp(source)
    .resize(SIZE, SIZE, { fit: 'contain', background: BRAND_BG })
    .png()
    .toFile(out('icon.png'))

  // 2. Adaptive foreground: 66% safe zone, transparent padding.
  const inner = Math.round(SIZE * 0.66)
  const pad = Math.round((SIZE - inner) / 2)
  const scaled = await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: scaled, top: pad, left: pad }])
    .png()
    .toFile(out('android-icon-foreground.png'))

  // 3. Monochrome (Material You themed icons): white silhouette, transparent.
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp(scaled).greyscale().normalise().threshold(110).png().toBuffer(),
        top: pad,
        left: pad,
        blend: 'over',
      },
    ])
    .png()
    .toFile(out('android-icon-monochrome.png'))

  // 4. Splash.
  await sharp(source)
    .resize(inner, inner, { fit: 'contain', background: BRAND_BG })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: BRAND_BG })
    .png()
    .toFile(out('splash-icon.png'))

  // 5. Web favicon.
  await sharp(source)
    .resize(48, 48, { fit: 'contain', background: BRAND_BG })
    .png()
    .toFile(out('favicon.png'))

  console.log('\nWrote:')
  for (const f of [
    'icon.png',
    'android-icon-foreground.png',
    'android-icon-monochrome.png',
    'splash-icon.png',
    'favicon.png',
  ]) {
    console.log('  assets/' + f)
  }
  console.log('\nNext: npx expo start --clear   (icons are cached aggressively)')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
