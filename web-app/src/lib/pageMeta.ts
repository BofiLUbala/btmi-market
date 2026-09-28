import { useEffect } from 'react'
import type { PublicProductDetail, PublicShopDetail } from '@/api/types'

// Per-page SEO metadata for the public catalog (product, shop, category
// pages). The app is client-rendered: Googlebot executes JavaScript and reads
// these tags, but link-preview bots that do not run JS still see index.html.
// See docs/search-ranking.md for the pre-rendering recommendation.

export interface PageMeta {
  title: string
  description: string
  /** Absolute canonical URL. */
  canonical: string
  image?: string
  type?: 'website' | 'product' | 'profile'
  jsonLd?: Record<string, unknown>
}

const SITE = 'TBK'
const JSON_LD_ID = 'page-jsonld'

export function absoluteUrl(path: string, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  if (/^https?:\/\//.test(path)) return path
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Plain-text summary for a meta description (about 160 characters). */
export function metaDescription(text: string | undefined | null, fallback: string) {
  const clean = (text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const source = clean || fallback
  return source.length > 160 ? `${source.slice(0, 157).trimEnd()}…` : source
}

const SCHEMA_AVAILABILITY: Record<string, string> = {
  AVAILABLE: 'https://schema.org/InStock',
  LOW_STOCK: 'https://schema.org/LimitedAvailability',
  OUT_OF_STOCK: 'https://schema.org/OutOfStock',
}

/**
 * schema.org Product + Offer (+ AggregateRating from verified buyer reviews
 * only; the seller's own self_rating is never published as a rating).
 */
export function productJsonLd(p: PublicProductDetail, url: string, reviews?: { average_rating: number; total_reviews: number } | null, origin?: string) {
  const images = (p.images ?? []).map((img) => absoluteUrl(img.url, origin))
  // The page quotes variant prices; the product-level price is only a fallback.
  const variantPrices = (p.variants ?? []).map((v) => v.unit_price).filter((n) => n > 0)
  const price = variantPrices.length ? Math.min(...variantPrices) : (p.seller_sale_price ?? p.base_price ?? 0)
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: metaDescription(p.description, p.name),
    sku: p.sku || undefined,
    image: images.length ? images : undefined,
    category: p.category?.name || undefined,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: p.currency || 'USD',
      price: Number(price.toFixed(2)),
      availability: SCHEMA_AVAILABILITY[p.availability] ?? 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: p.shop_name || p.business_name },
    },
  }
  if (reviews && reviews.total_reviews > 0) {
    data.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(reviews.average_rating.toFixed(1)), reviewCount: reviews.total_reviews, bestRating: 5, worstRating: 1 }
  }
  return data
}

/** schema.org Store (a LocalBusiness). The phone number is left out on purpose. */
export function shopJsonLd(shop: PublicShopDetail, url: string) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: shop.name,
    url,
    address: { '@type': 'PostalAddress', streetAddress: shop.address || undefined, addressLocality: shop.city || undefined, addressCountry: 'CD' },
  }
  if (shop.total_reviews && shop.total_reviews > 0 && shop.average_rating) {
    data.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(shop.average_rating.toFixed(1)), reviewCount: shop.total_reviews, bestRating: 5, worstRating: 1 }
  }
  return data
}

function setMeta(attr: 'name' | 'property', key: string, value: string | undefined, restore: Array<() => void>) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  const created = !el
  const previous = el?.getAttribute('content')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  if (value) el.setAttribute('content', value)
  restore.push(() => {
    if (created) el!.remove()
    else if (previous != null) el!.setAttribute('content', previous)
  })
}

/** Applies meta for the current page and restores the defaults on leave. */
export function usePageMeta(meta: PageMeta | null) {
  const key = meta ? JSON.stringify(meta) : ''
  useEffect(() => {
    if (!meta) return
    const restore: Array<() => void> = []
    const previousTitle = document.title
    document.title = `${meta.title} | ${SITE}`
    restore.push(() => { document.title = previousTitle })

    setMeta('name', 'description', meta.description, restore)
    setMeta('property', 'og:title', meta.title, restore)
    setMeta('property', 'og:description', meta.description, restore)
    setMeta('property', 'og:url', meta.canonical, restore)
    setMeta('property', 'og:type', meta.type ?? 'website', restore)
    if (meta.image) setMeta('property', 'og:image', meta.image, restore)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    const createdCanonical = !canonical
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    const previousCanonical = canonical.href
    canonical.href = meta.canonical
    restore.push(() => { if (createdCanonical) canonical!.remove(); else canonical!.href = previousCanonical })

    if (meta.jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = JSON_LD_ID
      // JSON.stringify output cannot close the script element except through
      // "</", which is escaped here.
      script.textContent = JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')
      document.getElementById(JSON_LD_ID)?.remove()
      document.head.appendChild(script)
      restore.push(() => script.remove())
    }
    return () => restore.reverse().forEach((fn) => fn())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
