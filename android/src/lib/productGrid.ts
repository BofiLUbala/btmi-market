import { useWindowDimensions, type ViewStyle } from 'react-native'

/**
 * How many products a grid shows side by side, from the window width. A fixed
 * two columns made a listing card as wide as half a desktop screen, and the
 * square photo on top as tall, so a category showed two giant tiles and a lot
 * of empty space.
 */
export function productGridColumns(width: number): number {
  if (width >= 1600) return 6
  if (width >= 1280) return 5
  if (width >= 980) return 4
  if (width >= 700) return 3
  return 2
}

/**
 * Columns for the current window, with the cap a card needs: without it the
 * last row stretches its one or two cards across the whole grid. One point
 * under an even share leaves room for the gap between columns (the same 24%
 * the home grid already used for four).
 */
export function useProductGrid(): { columns: number; cardStyle: ViewStyle } {
  const { width } = useWindowDimensions()
  const columns = productGridColumns(width)
  const share = `${(100 / columns - 1).toFixed(2)}%` as `${number}%`
  return { columns, cardStyle: { maxWidth: share } }
}
