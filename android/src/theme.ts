export const colors = {
  /* Brand — taken from the TBK logo, a black-and-white monogram. The previous
     dark green was inherited from the BTMI identity and had no source in the
     current brand.
     `green`/`greenSoft` keep their names so the ~70 call sites stay untouched;
     only the values move. Renaming them would be a large diff for no gain. */
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
  /* Neutral fills for skeletons, placeholders and empty media slots. These
     were five near-identical greys hardcoded across as many files. */
  surfaceAlt: '#ECEAE4',

  /* Semantic feedback keeps its conventional meaning: green still means
     "in stock / verified", independent of the brand colour. */
  danger: '#B42318',
  dangerSoft: '#FEECEB',
  success: '#167647',
} as const

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const
export const radius = { sm: 10, md: 16, lg: 24 } as const
