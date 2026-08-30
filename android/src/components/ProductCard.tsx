import { useMemo } from 'react'
import { Image } from 'expo-image'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { PublicProduct } from '../types'
import { radius, spacing, type Colors } from '../theme'
import { useColors } from '../store/theme'
import { useI18n } from '../store/i18n'
import { resolveMediaUrl } from '../api/client'
import { resolvePromotion } from '../lib/promotion'

const money = (value = 0, currency = 'FC') => `${value.toLocaleString('fr-FR')} ${currency === 'CDF' ? 'FC' : currency}`

export function ProductCard({ product, onPress }: { product: PublicProduct; onPress: () => void }) {
  const c = useColors()
  const { t } = useI18n()
  const styles = useMemo(() => makeStyles(c), [c])

  const firstImage = product.images?.[0]
  const rawImage = product.primary_image_url || product.image_url || (typeof firstImage === 'string' ? firstImage : firstImage?.url || firstImage?.image_url)
  const image = resolveMediaUrl(rawImage)

  // Same resolver as the web card and the product page, so the price shown on
  // a listing is the price the backend will charge.
  const promotion = resolvePromotion(product, product.base_price || product.price || 0)
  const price = promotion.effectivePrice || product.sale_price || product.price || product.base_price || 0
  const onSale = promotion.phase === 'active' && promotion.discountPercent > 0

  const reviews = product.total_reviews ?? 0
  const rating = product.average_rating ?? 0
  // An unrated product shows nothing: an empty star row would read as a bad
  // score rather than "not rated yet".
  const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(Math.max(0, 5 - Math.round(rating)))

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && staticStyles.pressed]} accessibilityRole="button">
      <View style={styles.media}>
        {image ? <Image source={image} style={staticStyles.image} contentFit="cover" transition={180} /> : <Text style={styles.placeholder}>TBK</Text>}
        {onSale && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{promotion.discountPercent}%</Text>
          </View>
        )}
        {promotion.phase === 'upcoming' && (
          <View style={styles.upcomingBadge}>
            <Text style={styles.upcomingBadgeText}>{t('product.promotionUpcoming')}</Text>
          </View>
        )}
      </View>
      <View style={staticStyles.body}>
        <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
        <Text numberOfLines={1} style={styles.shop}>{product.shop_name || t('product.aSeller')}</Text>
        {reviews > 0 && (
          <Text style={staticStyles.rating} accessibilityLabel={`${rating.toFixed(1)} / 5, ${reviews}`}>
            <Text style={styles.stars}>{stars}</Text> <Text style={styles.reviewCount}>({reviews})</Text>
          </Text>
        )}
        <View style={staticStyles.priceRow}>
          <Text style={styles.price}>{money(price, product.currency)}</Text>
          {onSale && <Text style={styles.strikePrice}>{money(promotion.originalPrice, product.currency)}</Text>}
        </View>
      </View>
    </Pressable>
  )
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static. */
const makeStyles = (c: Colors) =>
  StyleSheet.create({
    card: { flex: 1, maxWidth: '48.5%', borderRadius: radius.md, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: c.green, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    media: { height: 150, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center' },
    placeholder: { color: c.green, fontWeight: '900', fontSize: 19 },
    name: { color: c.ink, fontWeight: '800', minHeight: 40, lineHeight: 19 },
    shop: { color: c.muted, fontSize: 12 },
    stars: { color: c.star, fontSize: 12, letterSpacing: 0.5 },
    reviewCount: { color: c.muted, fontSize: 11 },
    price: { color: c.green, fontWeight: '900', fontSize: 16, marginTop: 2 },
    strikePrice: { color: c.muted, fontSize: 12, textDecorationLine: 'line-through' },
    discountBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.success, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    discountBadgeText: { color: c.onGreen, fontWeight: '900', fontSize: 11 },
    upcomingBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    upcomingBadgeText: { color: c.onGold, fontWeight: '800', fontSize: 10 },
  })

const staticStyles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  image: { width: '100%', height: '100%' },
  body: { padding: 12, gap: 5 },
  rating: { fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: 2 },
})
