import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import type { PublicProduct } from '../types'
import { cardLift, cardLiftHover, fonts, kicker, radius, spacing, type Colors } from '../theme'
import { categoryLabel } from '../lib/categoryLabels'
import { useTheme } from '../store/theme'
import { useI18n } from '../store/i18n'
import { resolveMediaUrl } from '../api/client'
import { ProductPhoto } from './ProductPhoto'
import { resolvePromotion } from '../lib/promotion'
import { formatMoney } from '../lib/money'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useFavorites, useIsFavorite } from '../store/favorites'

const money = (value = 0, currency?: string) => formatMoney(value, currency)

export function ProductCard({ product, onPress, style }: { product: PublicProduct; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors: c, theme } = useTheme()
  const { t } = useI18n()
  const styles = useMemo(() => makeStyles(c, theme), [c, theme])
  // Web only: a pointer over the tile raises it. Touch never reports hover.
  const [hovered, setHovered] = useState(false)

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
  const favorite = useIsFavorite(product.id)
  const toggleFavorite = useFavorites((state) => state.toggle)
  const lowStock = product.availability === 'LOW_STOCK'
  const stars = '★'.repeat(Math.round(rating)) + '☆'.repeat(Math.max(0, 5 - Math.round(rating)))

  // The card navigates to the product, so it is a link: as a button it would
  // wrap the favourite button, an invalid nested <button> on the web.
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [styles.card, style, hovered && styles.cardHover, hovered && staticStyles.hoverRise, pressed && staticStyles.pressed]}
      accessibilityRole="link"
    >
      <View style={styles.media}>
        <ProductPhoto
          uri={image}
          categorySlug={product.category_slug}
          categoryName={product.category_name}
          style={[staticStyles.image, outOfStock && staticStyles.imageOut]}
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
        {/* Same round heart as the web card; favourites stay on the device. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? t('product.removeFromFavorites') : t('product.addToFavorites')}
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={() => toggleFavorite({
            productId: product.id,
            name: product.name,
            shopId: product.shop_id || '',
            shopName: product.shop_name || '',
            price,
            currency: product.currency || 'USD',
            unit: product.unit || '',
            image: typeof image === 'string' ? image : undefined,
            categorySlug: product.category_slug,
            categoryName: product.category_name,
            addedAt: new Date().toISOString(),
          })}
          style={staticStyles.fav}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={19} color={favorite ? '#1E5EF3' : '#0B1530'} />
        </Pressable>
      </View>
      <View style={staticStyles.body}>
        {product.category_name ? <Text numberOfLines={1} style={styles.kicker}>{categoryLabel(t, product.category_slug, product.category_name)}</Text> : null}
        <Text numberOfLines={2} style={[styles.name, outOfStock && styles.mutedText]}>{product.name}</Text>
        <Text numberOfLines={1} style={styles.shop}>{product.shop_name || t('product.aSeller')}</Text>
        <Text style={staticStyles.rating} accessibilityLabel={t('productCard.ratingA11y', { rating: rating.toFixed(1), count: reviews })}>
          <Text style={styles.stars}>{stars}</Text>{reviews > 0 && <Text style={styles.reviewCount}> ({reviews})</Text>}
        </Text>
        {!outOfStock ? <Text style={[styles.stock, lowStock && styles.stockLow]}>{t(lowStock ? 'stock.lowStock' : 'stock.inStock')}</Text> : null}
        <View style={staticStyles.priceRow}>
          <Text style={[styles.price, onSale && styles.salePrice, outOfStock && styles.mutedText]}>{money(price, product.currency)}</Text>
          {onSale && <Text style={styles.strikePrice}>{money(promotion.originalPrice, product.currency)}</Text>}
        </View>
      </View>
    </Pressable>
  )
}

/** Colour-bearing styles are rebuilt per theme; layout-only rules stay static. */
const makeStyles = (c: Colors, theme: 'light' | 'dark') =>
  StyleSheet.create({
    // Reference card: white tile, photo on top, blue price underneath. The
    // caller caps the width (see useProductGrid); 48.5% is the two-column
    // default a grid overrides.
    card: { flex: 1, maxWidth: '48.5%', backgroundColor: c.white, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: c.border, ...cardLift[theme] },
    cardHover: { borderColor: c.green, ...cardLiftHover[theme] },
    // Square crop so every listing photo lines up across the grid.
    media: { aspectRatio: 1, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
    kicker: { ...kicker, fontSize: 9.5, color: c.green },
    name: { color: c.ink, fontWeight: '600', fontSize: 13.5, lineHeight: 18, minHeight: 36 },
    mutedText: { color: c.muted },
    shop: { color: c.muted, fontSize: 12 },
    stock: { color: c.success, fontSize: 12, fontWeight: '600' },
    stockLow: { color: c.warning },
    stars: { color: c.star, fontSize: 12, letterSpacing: 0.5 },
    reviewCount: { color: c.muted, fontSize: 11 },
    price: { color: c.green, fontFamily: fonts.display, fontWeight: '700', fontSize: 16, marginTop: 2 },
    salePrice: { color: c.danger },
    strikePrice: { color: c.muted, fontSize: 12, textDecorationLine: 'line-through' },
    discountBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.green, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    discountBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
    upcomingBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: c.warningSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    upcomingBadgeText: { color: c.ink, fontWeight: '600', fontSize: 10 },
    outBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    outBadgeText: { color: '#1C1C1A', fontWeight: '700', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  })

const staticStyles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  hoverRise: { transform: [{ translateY: -3 }] },
  image: { width: '100%', height: '100%' },
  imageOut: { opacity: 0.5 },
  fav: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 10, paddingHorizontal: 10, paddingBottom: 12, gap: 3 },
  rating: { fontSize: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: 2 },
})
