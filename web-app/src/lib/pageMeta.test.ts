import { describe, expect, it } from 'vitest'
import type { PublicProductDetail, PublicShopDetail } from '@/api/types'
import { absoluteUrl, metaDescription, productJsonLd, shopJsonLd } from './pageMeta'

const product = {
  id: 'p1', shop_id: 's1', shop_name: 'Chez Mama', business_id: 'b1', business_name: 'Mama Commerce',
  name: 'Samsung Galaxy A15', sku: 'SGA15', description: '<p>Smartphone   Android</p>', unit: 'piece',
  base_price: 150, seller_sale_price: 135.5, currency: 'USD', availability: 'LOW_STOCK', variants: [],
  images: [{ url: '/uploads/a15.jpg' }], seller_level: 'STARTER', seller_trust: 'NORMAL', self_rating: 5, created_at: '',
  category: { name: 'Electronics' },
} as unknown as PublicProductDetail

describe('page metadata', () => {
  it('builds absolute URLs and short descriptions', () => {
    expect(absoluteUrl('/products/p1', 'https://tbk.example')).toBe('https://tbk.example/products/p1')
    expect(absoluteUrl('https://cdn.example/x.jpg', 'https://tbk.example')).toBe('https://cdn.example/x.jpg')
    expect(metaDescription('<b>Hello</b>   world', 'x')).toBe('Hello world')
    expect(metaDescription('', 'Fallback')).toBe('Fallback')
    expect(metaDescription('a'.repeat(300), 'x')).toHaveLength(158)
  })

  it('describes a product offer with verified reviews only', () => {
    const ld = productJsonLd(product, 'https://tbk.example/products/p1', null, 'https://tbk.example')
    expect(ld).toMatchObject({
      '@type': 'Product', name: 'Samsung Galaxy A15', sku: 'SGA15', description: 'Smartphone Android',
      image: ['https://tbk.example/uploads/a15.jpg'], category: 'Electronics',
      offers: { '@type': 'Offer', price: 135.5, priceCurrency: 'USD', availability: 'https://schema.org/LimitedAvailability' },
    })
    // The seller's self_rating must never become a public rating.
    expect(ld.aggregateRating).toBeUndefined()
    const withVariants = { ...product, variants: [{ unit_price: 160 }, { unit_price: 150 }] } as unknown as PublicProductDetail
    expect(productJsonLd(withVariants, 'u').offers).toMatchObject({ price: 150 })
    const rated = productJsonLd(product, 'u', { average_rating: 4.26, total_reviews: 12 })
    expect(rated.aggregateRating).toMatchObject({ ratingValue: 4.3, reviewCount: 12 })
  })

  it('describes a shop as a Store without its phone number', () => {
    const shop = { id: 's1', name: 'Chez Mama', city: 'Lubumbashi', address: 'Av. X', phone: '+243 999', total_reviews: 3, average_rating: 4.5 } as PublicShopDetail
    const ld = shopJsonLd(shop, 'https://tbk.example/shops/s1')
    expect(ld).toMatchObject({ '@type': 'Store', address: { addressLocality: 'Lubumbashi' }, aggregateRating: { reviewCount: 3 } })
    expect(JSON.stringify(ld)).not.toContain('+243')
  })
})
