import { useMemo } from 'react'
import { Image } from 'expo-image'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { PublicProduct } from '../types'
import { fonts, kicker, radius, spacing, type Colors } from '../theme'
import { categoryImage } from '../lib/categoryVisuals'
import { categoryLabel } from '../lib/categoryLabels'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { resolveMediaUrl } from '../api/client'
import { resolvePromotion } from '../lib/promotion'
import { formatMoney } from '../lib/money'

const money = (value = 0, currency?: string) => formatMoney(value, currency)

export function ProductCard({ product, onPress }: { product: PublicProduct; onPress: () => void }) {
  const c = useColors()
  const { t } = useI18n()
  const styles = useMemo(() => makeStyles(c), [c])

  const firstImage = product.images?.[0]
  const rawImage = product.primary_image_url || product.image_url || (typeof firstImage === 'string' ? firstImage : firstImage?.url || firstImage?.image_url)
  const image = resolveMediaUrl(rawImage)
  const outOfStock = product.availability === 'OUT_OF_STOCK'

  // Same resolver as the web card and the product page, so the price shown on
  // a listing is the price the backend will charge.
  const promotion = resolvePromotion(product, product.base_price || product.price || 0)
  const price = promotion.effectivePrice || product.sale_price || product.price || product.base_price || 0
  const onSale = promotion.phase === 'active' && promotion.discountPercent > 0

  const reviews = product.total_reviews ?? 0
  const rating = reviews > 0 ? (product.average_rating ?? 0) : (product.self_rating ?? 0)
  const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(Math.max(0, 5 - Math.round(rating)))

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && staticStyles.pressed]} accessibilityRole="button">
      <View style={styles.media}>
        <Image
          source={image ?? categoryImage(product.category_slug, product.category_name)}
          style={[staticStyles.image, outOfStock && staticStyles.imageOut]}
          contentFit="cover"
          transition={180}
        />
        {outOfStock && (
          <View style={styles.outBadge}>
            <Text style={styles.outBadgeText}>{t('stock.outOfStock')}</Text>
          </View>
        )}
        {!outOfStock && onSale && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{promotion.discountPercent}%</Text>
          </View>
        )}
        {!outOfStock && promotion.phase === 'upcoming' && (
          <View style={styles.upcomingBadge}>
            <Text style={styles.upcomingBadgeText}>{t('product.promotionUpcoming')}</Text>
          </View>
        )}
      </View>
      <View style={staticStyles.body}>
        {product.category_name ? <Text numberOfLines={1} style={styles.kicker}>{categoryLabel(t, product.category_slug, product.category_name)}</Text> : null}
        <Text numberOfLines={2} style={[styles.name, outOfStock && styles.mutedText]}>{product.name}</Text>
        <Text style={staticStyles.rating} accessibilityLabel={`${rating.toFixed(1)} / 5, ${reviews}`}>
          <Text style={styles.stars}>{stars}</Text>{reviews > 0 && <Text style={styles.reviewCount}> ({reviews})</Text>}
        </Text>
        <Text numberOfLines={1} style={styles.shop}>{product.shop_name || t('product.aSeller')}</Text>
        <View style={staticStyles.priceRow}>
          <Text style={[styles.price, onSale && styles.salePrice, outOfStock && styles.mutedText]}>{money(price, product.currency)}</Text>
          {onSale && <Text style={styles.strikePrice}>{money(promotion.originalPrice, product.currency)}</Text>}
        </View>
      </View>
    </Pressable>
  )
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    // Editorial card: the photo carries it, so no frame around the whole card.
    card: { flex: 1, maxWidth: '48.5%' },
    // 4:5 cover, as on the web storefront.
    media: { aspectRatio: 4 / 5, backgroundColor: c.surfaceAlt, borderRadius: 14, overflow: 'hidden' },
    kicker: { ...kicker, fontSize: 10, color: c.muted },
    name: { color: c.ink, fontWeight: '500', fontSize: 14, lineHeight: 19, minHeight: 38 },
    mutedText: { color: c.muted },
    shop: { color: c.muted, fontSize: 12 },
    stars: { color: c.star, fontSize: 12, letterSpacing: 0.5 },
    reviewCount: { color: c.muted, fontSize: 11 },
    price: { color: c.ink, fontFamily: fonts.display, fontWeight: '600', fontSize: 17, marginTop: 2 },
    salePrice: { color: c.danger },
    strikePrice: { color: c.muted, fontSize: 12, textDecorationLine: 'line-through' },
    discountBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.danger, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    discountBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
    upcomingBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.warningSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    upcomingBadgeText: { color: c.ink, fontWeight: '600', fontSize: 10 },
    outBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    outBadgeText: { color: '#1C1C1A', fontWeight: '700', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  })

const staticStyles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  image: { width: '100%', height: '100%' },
  imageOut: { opacity: 0.5 },
  body: { paddingTop: 10, paddingHorizontal: 2, gap: 4 },
  rating: { fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: 2 },
})
