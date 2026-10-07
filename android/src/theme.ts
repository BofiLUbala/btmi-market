/**
 * Palette + theming.
 *
 * `StyleSheet.create` runs once at module load, so a screen that builds its
 * styles at module scope can never react to a theme change. Screens that need
 * to follow the theme therefore build their styles inside the component:
 *
 *     const c = useColors()
 *     const styles = useMemo(() => makeStyles(c), [c])
 *
 * Every screen now does this, so there is no module-scope palette export to
 * reach for by accident — `lightColors`/`darkColors` are only ever read
 * through `useColors()`.
 */

export const lightColors = {
  /* Brand — the TBK reference design: vivid blue primary on cool-grey pages,
     navy for the dark hero surfaces. `green`/`greenSoft`/`gold` keep their
     historical names so the ~250 call sites stay untouched; only values move.
     `green` is the primary fill (buttons, selected states). */
  green: '#1E5EF3',
  greenSoft: '#E8EFFE',

  /* Secondary action accent (the cyan-blue "checkout" buttons). Deep enough
     to carry white text (4.6:1). */
  gold: '#0A73CF',
  goldDark: '#075BA6',
  goldSoft: '#E2F2FD',

  /* Review stars: the reference's amber. */
  star: '#E8890C',
  starEmpty: '#D5DBE5',

  /* Cool neutrals: light grey page, white cards, navy-black text. */
  cream: '#F2F4F8',
  white: '#FFFFFF',
  ink: '#0B1530',
  muted: '#5A6378',
  /* Lighter grey for inactive tab labels, where `muted` reads too strong. */
  mutedLight: '#667089',
  border: '#E4E8EF',
  /* Border for form controls: clears WCAG's 3:1 for UI components. */
  borderControl: '#8C95A8',
  /* Neutral fills for skeletons, placeholders and empty media slots. */
  surfaceAlt: '#E9EDF4',

  danger: '#D92D20',
  dangerSoft: '#FEECEB',
  success: '#12805C',

  successSoft: '#E3F6EE',
  info: '#1E5EF3',
  infoSoft: '#E8EFFE',
  warning: '#B7791F',
  warningSoft: '#FFF7DF',
  purple: '#7C3AED',
  magenta: '#A21CAF',
  surface2: '#EDF0F5',
  faint: '#8D96A8',
  out: '#D1802F',
  outSoft: '#FFEDD5',

  /* Dark hero surfaces (seller dashboard, welcome, cart summary, account
     header). Stay dark in both themes, so text on them uses `onNavy`. */
  navy: '#0A1633',
  navySoft: '#14244A',
  navyLine: '#22345E',
  onNavy: '#FFFFFF',
  onNavyMuted: '#A9B5CF',
  /* Bright cyan for highlights on navy (figures, active tab glow). */
  cyan: '#22B8F0',

  /* Foreground for text/icons sitting ON a filled brand colour. */
  onGreen: '#FFFFFF',
  onGold: '#FFFFFF',
} as const

/** Values are widened to `string`: with `as const` each key's type would be
 *  its own light-theme hex, and no dark value could ever be assigned to it. */
export type Colors = Record<keyof typeof lightColors, string>

export const darkColors: Colors = {
  green: '#5B93FF',
  greenSoft: '#16264A',

  gold: '#38BDF8',
  goldDark: '#0EA5E9',
  goldSoft: '#0F2A3D',

  star: '#F5A524',
  starEmpty: '#3A4560',

  cream: '#070D1D',
  white: '#101A31',
  ink: '#EEF2FA',
  muted: '#A3AEC6',
  mutedLight: '#8994AE',
  border: '#1F2C4A',
  borderControl: '#4A5878',
  surfaceAlt: '#1A2540',

  danger: '#F87171',
  dangerSoft: '#3A1A1E',
  success: '#4ADE80',

  successSoft: '#123024',
  info: '#60A5FA',
  infoSoft: '#16264A',
  warning: '#FBBF24',
  warningSoft: '#332612',
  purple: '#A78BFA',
  magenta: '#E879F9',
  surface2: '#18223B',
  faint: '#76819B',
  out: '#FB923C',
  outSoft: '#3A2614',

  navy: '#050B1A',
  navySoft: '#111D3A',
  navyLine: '#1F2C4A',
  onNavy: '#FFFFFF',
  onNavyMuted: '#A3AEC6',
  cyan: '#38C6F5',

  onGreen: '#061024',
  onGold: '#061024',
}

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const
export const radius = { sm: 12, md: 16, lg: 22, pill: 999 } as const

/** Soft card lift used by the reference design (white cards on cool grey). */
export const shadow = {
  card: { shadowColor: '#0B1530', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  raised: { shadowColor: '#1E5EF3', shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
} as const

/**
 * A listing tile's lift, per theme. The navy shadow above is all but invisible
 * on the dark page it sits on, which left the grid looking like flat patches;
 * dark mode needs a near-black one to read as depth at all. Light mode gets a
 * wider, slightly deeper version of the same soft drop.
 */
export const cardLift = {
  light: { shadowColor: '#0B1530', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  dark: { shadowColor: '#000000', shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
} as const

/** The same tile under the pointer (web): it rises towards the reader. */
export const cardLiftHover = {
  light: { shadowColor: '#0B1530', shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 9 },
  dark: { shadowColor: '#000000', shadowOpacity: 0.72, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 13 },
} as const

/** Titles and prices use the display face: a heavy geometric sans (Inter
 *  bold weights, see src/typography.ts), matching the reference design. */
export const fonts = {
  /** Fraunces; src/typography.ts maps it to the right weight file. */
  display: 'Fraunces',
} as const

/** Uppercase eyebrow above titles (category, section kicker). */
export const kicker = { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' } as const

/** Admin console — `app/admin/_layout.tsx` renders its header/background
 *  always dark, independent of `useColors()`/the light-dark toggle (mirrors
 *  the web admin's "ops console" look, see web-app's --admin-* tokens).
 *  Named here instead of inlined as hex in the layout file so the two call
 *  sites (header style + content style) can't drift from each other, and so
 *  the "always dark, on purpose" intent has one place to change if that
 *  product decision changes. */
export const adminDark = {
  headerBg: '#0f172a',
  headerTint: '#ffffff',
  contentBg: '#090d16',
} as const
