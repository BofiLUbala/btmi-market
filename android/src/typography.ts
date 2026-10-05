/**
 * Native typography: Inter throughout; titles and prices (`fonts.display`)
 * use its bold cuts.
 *
 * On Android a custom font ignores `fontWeight`: each weight is its own
 * family (Inter_600SemiBold…). Rather than rewrite ~90 style sheets, this
 * module wraps `StyleSheet.create` once so every text style gets the family
 * matching its weight. Styles that already name another family (icons,
 * monospace) are left alone. Import it before anything that creates styles.
 */
import { StyleSheet, type TextStyle } from 'react-native'
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces'

/** Marker used by `fonts.display` in theme.ts. */
export const DISPLAY_FAMILY = 'Fraunces'

export const fontAssets = {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
}

const WEIGHTS: Record<string, number> = { normal: 400, bold: 700 }

function weightOf(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return WEIGHTS[value] ?? (Number(value) || 400)
  return 400
}

/** Same weights the web loads: Inter 400–700, Fraunces 400–600. */
function familyFor(display: boolean, weight: number, italic: boolean): string {
  // Display text (titles, prices) is a heavy geometric sans in the TBK
  // reference design, so the display marker resolves to Inter's bold cuts.
  if (display) return weight >= 500 ? 'Inter_700Bold' : 'Inter_600SemiBold'
  if (italic && weight < 500) return 'Inter_400Regular_Italic'
  if (weight >= 700) return 'Inter_700Bold'
  if (weight >= 600) return 'Inter_600SemiBold'
  if (weight >= 500) return 'Inter_500Medium'
  return 'Inter_400Regular'
}

const TEXT_KEYS = ['fontSize', 'fontWeight', 'color', 'lineHeight', 'letterSpacing', 'textAlign', 'fontFamily', 'textTransform', 'fontStyle', 'textDecorationLine']

/** For text styles that don't go through StyleSheet.create (navigator options). */
export function withBrandFont(style: TextStyle): TextStyle {
  return resolveStyle(style as Record<string, unknown>) as TextStyle
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveStyle<T extends Record<string, any>>(style: T): T {
  if (!style || typeof style !== 'object' || Array.isArray(style)) return style
  if (!TEXT_KEYS.some((key) => key in style)) return style
  const family = style.fontFamily as string | undefined
  if (family && family !== DISPLAY_FAMILY) return style
  const resolved = familyFor(family === DISPLAY_FAMILY, weightOf(style.fontWeight), style.fontStyle === 'italic')
  // The weight now lives in the family; keeping fontWeight would make
  // Android synthesise a second, heavier bold on top.
  return { ...style, fontFamily: resolved, fontWeight: 'normal', fontStyle: 'normal' }
}

let installed = false
export function installBrandTypography() {
  if (installed) return
  installed = true
  const original = StyleSheet.create
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(StyleSheet as any).create = (styles: Record<string, any>) => {
    const next: Record<string, unknown> = {}
    for (const key of Object.keys(styles)) next[key] = resolveStyle(styles[key])
    return original(next as never)
  }
}

installBrandTypography()
