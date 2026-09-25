/**
 * "Product · variant" for an order line. Variants are named "Product — options"
 * when they are created, so the product name is dropped when the variant
 * already starts with it instead of being printed twice.
 */
export function lineLabel(productName: string, variantName?: string | null): string {
  const variant = (variantName || '').trim()
  if (!variant || variant === productName) return productName
  return variant.startsWith(productName) ? variant : `${productName} · ${variant}`
}
