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
  /* Brand — taken from the TBK logo, a black-and-white monogram.
     `green`/`greenSoft` keep their names so the ~250 call sites stay
     untouched; only the values move. */
  green: '#1C1C1A',
  greenSoft: '#EFEDE8',

  /* Action accent. Burnt amber is the one hue that stays legible with white
     text (5.01), on cream (4.60) and against the near-black primary (3.41),
     so a "Buy" button never reads as just another dark button. */
  gold: '#B4531B',
  goldDark: '#8F3F13',
  goldSoft: '#FBEEE5',

  /* Review stars: a convention, not brand colour, and deep enough to stay
     legible on cream (5.03) unlike the previous light gold. */
  star: '#8A6207',
  starEmpty: '#D8D3C7',

  cream: '#F7F4ED',
  white: '#FFFFFF',
  ink: '#13211D',
  muted: '#68746F',
  /* Lighter grey for inactive tab labels, where `muted` reads too strong. */
  mutedLight: '#8A948F',
  border: '#DDD9CF',
  /* Neutral fills for skeletons, placeholders and empty media slots. */
  surfaceAlt: '#ECEAE4',

  /* Semantic feedback keeps its conventional meaning: green still means
     "in stock / verified", independent of the brand colour. */
  danger: '#B42318',
  dangerSoft: '#FEECEB',
  success: '#167647',

  /* Foreground for text/icons sitting ON a filled brand colour. Flips with the
     theme: in dark mode `green` becomes light, so white text on it would be
     unreadable. Never hardcode '#fff' on a themed fill — use this. */
  onGreen: '#FFFFFF',
  onGold: '#FFFFFF',
} as const

/** Values are widened to `string`: with `as const` each key's type would be
 *  its own light-theme hex, and no dark value could ever be assigned to it. */
export type Colors = Record<keyof typeof lightColors, string>

export const darkColors: Colors = {
  /* `green` is the primary fill, so it inverts to a light tone; `greenSoft`
     becomes a dark tint rather than a light one. */
  green: '#F2F0EA',
  greenSoft: '#26262C',

  gold: '#E2793D',
  goldDark: '#C25F27',
  goldSoft: '#3A2417',

  star: '#E0B93F',
  starEmpty: '#4A463D',

  /* `cream` is the page background and `white` the card surface — both become
     dark surfaces here, which is why every screen can keep using the same
     names without knowing which theme is active. */
  cream: '#16161A',
  white: '#1E1E23',
  ink: '#F2F0EA',
  muted: '#A6A49C',
  mutedLight: '#7A786F',
  border: '#35353D',
  surfaceAlt: '#2B2B32',

  /* Lightened so they still pass contrast on a dark surface. */
  danger: '#F87171',
  dangerSoft: '#33191A',
  success: '#4ADE80',

  onGreen: '#16161A',
  onGold: '#16161A',
}

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const
export const radius = { sm: 10, md: 16, lg: 24 } as const
