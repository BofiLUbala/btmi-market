import { useMemo, useState, type ReactNode } from 'react'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { useCart } from '../../src/store/cart'
import { Button, Card, ErrorState, Loading } from '../../src/components/ui'
import { useColors } from '../../src/store/theme'
import { fonts, kicker, radius, spacing, type Colors } from '../../src/theme'
import { categoryImage } from '../../src/lib/categoryVisuals'
import { categoryLabel } from '../../src/lib/categoryLabels'
import { colorSwatch, isColorAttribute } from '../../src/lib/colorSwatch'
import { DescriptionText, descriptionItems } from '../../src/components/Accordion'
import { ProductCard } from '../../src/components/ProductCard'
import { useFavorites, useIsFavorite } from '../../src/store/favorites'
import { get } from '../../src/api/client'
import type { PublicImage, PublicProduct, PublicVariant } from '../../src/types'
import { resolvePromotion } from '../../src/lib/promotion'
import { attributeLabel } from '../../src/lib/attributeLabels'
import { useI18n } from '../../src/store/i18n'
import type { ProductReviewSummary } from '../../src/types'
import { formatMoney } from '../../src/lib/money'
import { dateLocale } from '../../src/lib/format'
import {
  buildAttributeGroups,
  resolveVariant,
  extractSpecifications,
  describeAttributes,
  optionValueState,
  selectOptionValue,
  variantOptionLabel,
  type VariantSelection,
} from '../../src/lib/variants'

const stars = (rating: number) =>
  `${'★'.repeat(Math.max(0, Math.min(5, Math.round(rating))))}${'☆'.repeat(
    Math.max(0, 5 - Math.round(rating))
  )}`

const reviewDate = (value: string, lang: string) => {
  const locale = dateLocale(lang === 'en' ? 'en' : 'fr')
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

const variantStock = (v?: PublicVariant) => v?.stock_quantity ?? v?.available_stock ?? v?.stock_available ?? 0

const imageUrl = (img: PublicImage | string) => (typeof img === 'string' ? img : img.url || img.image_url)

function RatingBreakdown({ summary }: { summary: ProductReviewSummary }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.breakdown}>
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = summary[
          `rating_${rating}_count` as keyof ProductReviewSummary
        ] as number
        const width = summary.total_reviews
          ? (`${Math.round((count / summary.total_reviews) * 100)}%` as `${number}%`)
          : '0%'
        return (
          <View key={rating} style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>{rating} ★</Text>
            <View style={styles.ratingTrack}>
              <View style={[styles.ratingFill, { width }]} />
            </View>
            <Text style={styles.ratingCount}>{count}</Text>
          </View>
        )
      })}
    </View>
  )
}

/** Accent square + uppercase label heading a page section. */
function SectionHeader({ title }: { title: string }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionSquare} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

interface InfoCardItem {
  id: string
  title: string
  icon: keyof typeof Ionicons.glyphMap
  content: ReactNode
  defaultOpen?: boolean
}

/** Framed, individually collapsible cards for the long-form product text. */
function InfoCards({ items }: { items: InfoCardItem[] }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.filter((i) => i.defaultOpen).map((i) => [i.id, true]))
  )
  return (
    <View style={styles.infoList}>
      {items.map((item) => {
        const expanded = Boolean(open[item.id])
        return (
          <View key={item.id} style={styles.infoCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setOpen((prev) => ({ ...prev, [item.id]: !expanded }))
              }}
              style={styles.infoSummary}
            >
              <Ionicons name={item.icon} size={18} color={colors.ink} />
              <Text style={styles.infoTitle}>{item.title}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>
            {expanded && <View style={styles.infoBody}>{item.content}</View>}
          </View>
        )
      })}
    </View>
  )
}

export default function ProductScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [photoIndex, setPhotoIndex] = useState(0)

  const query = useQuery({
    queryKey: ['marketplace', 'product', id],
    queryFn: () => marketplaceApi.product(id!),
    enabled: Boolean(id),
  })

  // Scored look-alikes from other listings (backend ranks by subcategory,
  // name keywords, variant dimensions and price), one row per real offer.
  const similarQuery = useQuery({
    queryKey: ['marketplace', 'product', id, 'similar'],
    queryFn: async () => {
      const data = await get<{ products?: PublicProduct[] } | PublicProduct[]>(`/marketplace/products/${id}/similar?limit=10`)
      return Array.isArray(data) ? data : data?.products ?? []
    },
    enabled: Boolean(id),
  })
  const isFavorite = useIsFavorite(id ?? '')
  const toggleFavorite = useFavorites((state) => state.toggle)

  const reviewQuery = useQuery({
    queryKey: ['marketplace', 'product', id, 'reviews'],
    queryFn: () => marketplaceApi.productReviews(id!),
    enabled: Boolean(id),
  })

  const add = useCart((state) => state.add)
  const [selection, setSelection] = useState<VariantSelection>({})
  const [variantId, setVariantId] = useState<string>()
  const [quantity, setQuantity] = useState(1)

  const product = query.data
  const reviewData = reviewQuery.data
  const variants = product?.variants ?? []

  const attributeGroups = useMemo(() => buildAttributeGroups(variants), [variants])
  const hasAttributeGroups = attributeGroups.length > 0
  const specifications = useMemo(() => extractSpecifications(variants), [variants])

  // The buyer picks every option themselves. Falling back to "first variant in
  // stock" made a size and a colour look already chosen while the buy buttons
  // stayed enabled, so an order could ship a variant nobody selected.
  const selected = useMemo(() => {
    if (variants.length === 0) return undefined
    if (hasAttributeGroups) {
      if (!attributeGroups.every((g) => selection[g.key])) return undefined
      return resolveVariant(variants, selection) ?? undefined
    }
    if (variants.length > 1) return variants.find((v) => v.id === variantId)
    return variants[0]
  }, [variants, selection, variantId, hasAttributeGroups, attributeGroups])

  /** Choices still owed by the buyer — named in the hint above the buy bar. */
  const missingOptions = useMemo(() => {
    if (hasAttributeGroups) return attributeGroups.filter((g) => !selection[g.key]).map((g) => attributeLabel(t, g.label))
    if (variants.length > 1 && !variantId) return [t('product.option')]
    return []
  }, [attributeGroups, hasAttributeGroups, selection, variants.length, variantId, t])
  const optionsComplete = missingOptions.length === 0

  // Picking a value can rule out an earlier one (a colour that size never comes
  // in). Keep the choices the closest variant agrees with and clear only the
  // others: dropping them one by one used to clear choices that still fit.
  const chooseValue = (key: string, value: string) => {
    setSelection((prev) => selectOptionValue(variants, prev, key, value))
    setQuantity(1)
  }

  if (query.isLoading) return <Loading label={t('product.loading')} />
  if (!product || query.isError) {
    return (
      <ErrorState
        message={t('product.unavailable')}
        retry={() => query.refetch()}
      />
    )
  }

  // Primary photo first, then the rest in the seller's order.
  const photos = [...(product.images ?? [])]
    .sort((a, b) => Number(typeof b !== 'string' && b.is_primary) - Number(typeof a !== 'string' && a.is_primary))
    .map((img) => resolveMediaUrl(imageUrl(img)))
    .filter((url): url is string => Boolean(url))
  const primaryUrl = resolveMediaUrl(product.primary_image_url || product.image_url)
  if (photos.length === 0 && primaryUrl) photos.push(primaryUrl)
  const image = photos[0]

  // Before an option is picked, the product is in stock if any variant is: the
  // product-level figure is often absent, which read as a false "out of stock".
  const stock = selected
    ? variantStock(selected)
    : product.available_stock ?? variants.reduce((sum, v) => sum + variantStock(v), 0)
  const stockColor = stock > 3 ? colors.success : stock > 0 ? colors.warning : colors.danger

  // Same resolver as the product card and the web app, so the price shown here
  // is the price the backend will charge at checkout.
  const regularPrice =
    selected?.base_price ||
    selected?.price ||
    product.base_price ||
    product.price ||
    0
  const promotion = resolvePromotion(
    { ...product, seller_sale_price: selected?.sale_price ?? selected?.unit_price },
    regularPrice
  )
  const price =
    promotion.effectivePrice ||
    selected?.sale_price ||
    selected?.unit_price ||
    selected?.price ||
    product.sale_price ||
    product.price ||
    product.base_price ||
    0
  const onSale = promotion.phase === 'active' && promotion.discountPercent > 0
  const description = descriptionItems(product.description)
  // `/detail` nests the category as { name, slug }; listings flatten it.
  const detail = product as {
    category?: unknown
    subcategory?: { name?: string; slug?: string } | null
    sku?: string
    seller_trust?: string
    free_delivery?: boolean
  }
  const category = typeof detail.category === 'object' && detail.category
    ? (detail.category as { name?: string; slug?: string })
    : { name: product.category_name, slug: product.category_slug }
  const subcategoryName = detail.subcategory?.name
  const categoryName = category.name ? categoryLabel(t, category.slug, category.name) : ''
  const sku = selected?.sku || detail.sku
  const totalReviews = reviewData?.summary.total_reviews ?? 0
  const freeDelivery = Boolean(detail.free_delivery)
  const trusted = detail.seller_trust === 'HIGH'

  const specRows = [
    ...(categoryName ? [{ key: 'category', label: t('product.category'), value: categoryName }] : []),
    ...(subcategoryName ? [{ key: 'subcategory', label: t('product.subcategory'), value: subcategoryName }] : []),
    ...(product.unit ? [{ key: 'unit', label: t('product.unit'), value: product.unit }] : []),
    ...specifications.map((spec) => ({ key: spec.key, label: attributeLabel(t, spec.label), value: spec.value })),
  ]

  // A cart may hold several shops: checkout creates one order per shop.
  const addLine = () =>
    add({
      productId: product.id,
      variantId: selected!.id,
      name: product.name,
      variantName: describeAttributes(selected!),
      shopId: product.shop_id || '',
      shopName: product.shop_name || '',
      price,
      quantity,
      image,
    })
  const canBuy = optionsComplete && Boolean(selected) && stock > 0

  const galleryWidth = width
  const galleryHeight = Math.min(width * 1.05, 520)
  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / galleryWidth))

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {/* Full-bleed gallery: stock + favourite on top, reference + counter below */}
        <View style={[styles.gallery, { height: galleryHeight }]}>
          {photos.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onGalleryScroll}
            >
              {photos.map((url, i) => (
                <Image
                  key={url + i}
                  source={url}
                  contentFit="cover"
                  accessibilityLabel={t('product.photo', { index: i + 1, count: photos.length })}
                  style={{ width: galleryWidth, height: galleryHeight }}
                />
              ))}
            </ScrollView>
          ) : (
            <Image
              source={image ?? categoryImage(category.slug, category.name)}
              contentFit="cover"
              style={{ width: galleryWidth, height: galleryHeight }}
            />
          )}
          <View style={styles.galleryTop} pointerEvents="box-none">
            <View style={styles.overlayChip}>
              <View style={[styles.dot, { backgroundColor: stockColor }]} />
              <Text style={styles.overlayChipText}>
                {stock > 3 ? t('stock.inStock') : stock > 0 ? t('stock.lowStock') : t('stock.outOfStock')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? t('product.removeFromFavorites') : t('product.addToFavorites')}
              accessibilityState={{ selected: isFavorite }}
              hitSlop={8}
              style={styles.favBtn}
              onPress={() => toggleFavorite({
                productId: product.id,
                name: product.name,
                shopId: product.shop_id || '',
                shopName: product.shop_name || '',
                price,
                currency: product.currency || 'USD',
                unit: product.unit || '',
                image,
                categorySlug: category.slug,
                categoryName: category.name,
                addedAt: new Date().toISOString(),
              })}
            >
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? '#B3261E' : '#1C1C1A'} />
            </Pressable>
          </View>
          <View style={styles.galleryBottom} pointerEvents="none">
            {categoryName ? (
              <Text style={styles.galleryCaption} numberOfLines={1}>
                {categoryName}{subcategoryName ? ` / ${subcategoryName}` : ''}
              </Text>
            ) : <View />}
            {photos.length > 1 ? (
              <View style={styles.counter}>
                <Text style={styles.counterText}>{photoIndex + 1} / {photos.length}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {photos.length > 1 ? (
          <View style={styles.dots}>
            {photos.map((url, i) => (
              <View key={url + i} style={[styles.pageDot, i === photoIndex && styles.pageDotActive]} />
            ))}
          </View>
        ) : null}

        <View style={styles.content}>
          {/* Seller + reference */}
          <View style={styles.sellerRow}>
            <View style={styles.sellerLeft}>
              <Text style={styles.metaLabel}>{t('product.soldByLabel')}</Text>
              <View style={styles.shopChip}>
                <Text style={styles.shopChipText} numberOfLines={1}>{product.shop_name || t('product.aSeller')}</Text>
              </View>
              {trusted ? (
                <Ionicons name="checkmark-circle" size={16} color={colors.success} accessibilityLabel={t('product.trustedSeller')} />
              ) : null}
            </View>
            {sku ? <Text style={styles.metaLabel} numberOfLines={1}>{t('product.skuLabel', { sku })}</Text> : null}
          </View>

          <Text style={styles.title}>{product.name}</Text>

          <View style={styles.ratingLine}>
            {totalReviews > 0 ? (
              <>
                <Text style={styles.ratingStars}>{stars(reviewData!.summary.average_rating)}</Text>
                <Text style={styles.ratingValue}>{reviewData!.summary.average_rating.toFixed(1)}</Text>
                <Text style={styles.ratingSep}>•</Text>
                <Text style={styles.ratingLink}>{t('product.reviewsCount', { count: totalReviews })}</Text>
              </>
            ) : typeof product.self_rating === 'number' && product.self_rating > 0 ? (
              <>
                <Text style={styles.ratingStars}>{stars(product.self_rating)}</Text>
                <Text style={styles.ratingMuted}>{t('product.selfRatingLabel')}</Text>
              </>
            ) : (
              <Text style={styles.ratingMuted}>
                {reviewQuery.isLoading ? t('product.loadingReviews') : t('reviews.noneYet')}
              </Text>
            )}
          </View>

          {/* Price card */}
          <View style={styles.priceCard}>
            <View style={styles.priceTop}>
              <View style={styles.flex1}>
                <Text style={styles.metaLabel}>{t('product.unitPriceLabel')}</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, onSale && { color: colors.danger }]}>{formatMoney(price, product.currency)}</Text>
                  {product.unit ? <Text style={styles.perUnit}>/ {product.unit}</Text> : null}
                </View>
                {onSale ? (
                  <Text style={styles.strikePrice}>{formatMoney(promotion.originalPrice, product.currency)}</Text>
                ) : null}
              </View>
              {onSale ? (
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>-{promotion.discountPercent}%</Text>
                </View>
              ) : promotion.phase === 'upcoming' ? (
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>{t('product.promotionUpcoming')}</Text>
                </View>
              ) : null}
            </View>
            {(onSale || promotion.phase === 'upcoming') && (promotion.startsAt || promotion.endsAt) ? (
              <Text style={styles.promoWindow}>
                {promotion.startsAt ? t('product.promotionFrom', { start: promotion.startsAt.toLocaleDateString(dateLocale(lang === 'en' ? 'en' : 'fr')) }) : ''}
                {promotion.endsAt ? ' ' + t('product.promotionTo', { end: promotion.endsAt.toLocaleDateString(dateLocale(lang === 'en' ? 'en' : 'fr')) }) : ''}
              </Text>
            ) : null}
            <View style={styles.priceDivider} />
            <View style={styles.priceBottom}>
              <View style={styles.stockLine}>
                <View style={[styles.dot, { backgroundColor: stockColor }]} />
                <Text style={[styles.stockText, { color: stockColor }]}>
                  {stock > 3
                    ? t('product.inStockCount', { count: stock })
                    : stock > 0
                    ? t('product.onlyLeft', { count: stock })
                    : t('product.outOfStock')}
                </Text>
              </View>
              <View style={styles.deliveryMeta}>
                <Text style={styles.metaLabel}>{t('product.delivery')}</Text>
                <Text style={styles.deliveryValue}>{freeDelivery ? t('product.deliveryFree') : t('product.deliveryAtCheckout')}</Text>
              </View>
            </View>
          </View>

          {/* Options, derived from the variants' saved attributes */}
          {hasAttributeGroups ? attributeGroups.map((g) => {
            const activeVal = selection[g.key]
            const colourGroup = isColorAttribute(g.key, g.label)
            const shortValues = g.values.every((v) => v.length <= 4)
            return (
              <View key={g.key} style={styles.optionSection}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionLabel}>
                    {attributeLabel(t, g.label)} :{' '}
                    <Text style={[styles.optionValue, !activeVal && { color: colors.muted }]}>
                      {activeVal ?? t('product.toChoose')}
                    </Text>
                  </Text>
                  {g.values.length > 1 ? (
                    <Text style={styles.metaLabel}>{t('product.optionsCount', { count: g.values.length })}</Text>
                  ) : null}
                </View>
                <View style={colourGroup ? styles.colourGrid : styles.tileRow}>
                  {g.values.map((val) => {
                    const isSelected = activeVal === val
                    // Only a value no variant carries is disabled: variants rarely
                    // cover every combination, and locking values left whole
                    // variants unreachable. Picking one drops the choices it rules out.
                    const { exists, compatible, units } = optionValueState(variants, selection, g.key, val)
                    const soldOut = !exists || units < 1
                    const otherCombo = exists && !compatible
                    if (colourGroup) {
                      const swatch = colorSwatch(val)
                      return (
                        <Pressable
                          key={val}
                          accessibilityRole="button"
                          accessibilityLabel={val}
                          accessibilityState={{ selected: isSelected, disabled: !exists }}
                          disabled={!exists}
                          onPress={() => chooseValue(g.key, val)}
                          style={[styles.colourCard, otherCombo && styles.optionOther, isSelected && styles.optionSelected, !exists && styles.optionDisabled]}
                        >
                          <View style={[styles.colourDot, { backgroundColor: swatch ?? colors.surfaceAlt }]}>
                            {isSelected ? <View style={styles.colourDotInner} /> : null}
                          </View>
                          <View style={styles.flex1}>
                            <Text style={styles.colourName} numberOfLines={1}>{val}</Text>
                            <Text
                              style={[styles.colourStock, { color: soldOut ? colors.danger : units <= 3 ? colors.warning : colors.success }]}
                              numberOfLines={1}
                            >
                              {soldOut
                                ? t('product.valueSoldOut')
                                : units <= 3
                                ? t('product.valueLowStock', { count: units })
                                : t('product.valueStock', { count: units })}
                            </Text>
                          </View>
                        </Pressable>
                      )
                    }
                    return (
                      <Pressable
                        key={val}
                        accessibilityRole="button"
                        accessibilityLabel={val}
                        accessibilityState={{ selected: isSelected, disabled: !exists }}
                        disabled={!exists}
                        onPress={() => chooseValue(g.key, val)}
                        style={[
                          styles.tile,
                          shortValues && styles.tileEven,
                          otherCombo && styles.optionOther,
                          isSelected && styles.optionSelected,
                          !exists && styles.optionDisabled,
                        ]}
                      >
                        <Text style={[styles.tileText, isSelected && styles.tileTextSelected, soldOut && styles.tileTextOut]} numberOfLines={1}>
                          {val}
                        </Text>
                        {soldOut ? <Text style={styles.tileSub}>{t('product.valueSoldOut')}</Text> : null}
                        {isSelected ? <View style={styles.tileBadge} /> : null}
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            )
          }) : variants.length > 1 ? (
            <View style={styles.optionSection}>
              <View style={styles.optionHeader}>
                <Text style={styles.optionLabel}>
                  {t('product.option')} :{' '}
                  <Text style={[styles.optionValue, !selected && { color: colors.muted }]}>
                    {selected ? variantOptionLabel(selected, product.name) || describeAttributes(selected) : t('product.toChoose')}
                  </Text>
                </Text>
              </View>
              <View style={styles.tileRow}>
                {variants.map((v) => {
                  const isSelected = selected?.id === v.id
                  const soldOut = variantStock(v) < 1
                  return (
                    <Pressable
                      key={v.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => {
                        setVariantId(v.id)
                        setQuantity(1)
                      }}
                      style={[styles.tile, isSelected && styles.optionSelected]}
                    >
                      <Text style={[styles.tileText, isSelected && styles.tileTextSelected, soldOut && styles.tileTextOut]} numberOfLines={1}>
                        {variantOptionLabel(v, product.name) || describeAttributes(v) || t('product.option')}
                      </Text>
                      {soldOut ? <Text style={styles.tileSub}>{t('product.valueSoldOut')}</Text> : null}
                      {isSelected ? <View style={styles.tileBadge} /> : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}

          {/* Quantity card */}
          <View style={styles.qtyCard}>
            <View style={styles.flex1}>
              <Text style={styles.qtyTitle}>{t('common.quantity')}</Text>
              <Text style={styles.qtySub} numberOfLines={1}>
                {t('product.subtotalValue', { amount: formatMoney(price * quantity, product.currency) })}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('web.cart.decreaseQuantity')}
                disabled={quantity <= 1}
                style={[styles.stepBtn, quantity <= 1 && styles.optionDisabled]}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={18} color={colors.ink} />
              </Pressable>
              <Text style={styles.stepValue}>{quantity}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('web.cart.increaseQuantity')}
                disabled={quantity >= stock}
                style={[styles.stepBtn, quantity >= stock && styles.optionDisabled]}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={18} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          {/* Technical sheet */}
          {specRows.length > 0 ? (
            <View style={styles.block}>
              <SectionHeader title={t('product.specifications')} />
              <View style={styles.specTable}>
                {specRows.map((row, i) => (
                  <View key={row.key} style={[styles.specRow, i === specRows.length - 1 && styles.specRowLast]}>
                    <Text style={styles.specKey}>{row.label}</Text>
                    <Text style={styles.specVal}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <InfoCards
            items={[
              ...(description.intro
                ? [{ id: 'description', icon: 'document-text-outline' as const, title: t('product.description'), defaultOpen: true, content: <DescriptionText text={description.intro} /> }]
                : []),
              ...description.items.map((item) => ({ ...item, icon: 'list-outline' as const })),
              {
                id: 'delivery',
                icon: 'cube-outline' as const,
                title: t('product.delivery'),
                content: <DescriptionText text={freeDelivery ? t('product.freeDelivery') : t('product.deliveryNote')} />,
              },
            ]}
          />

          <View style={styles.block}>
            <SectionHeader
              title={`${t('product.customerReviews')}${totalReviews ? ` (${totalReviews})` : ''}`}
            />
            {reviewQuery.isLoading ? (
              <View style={styles.reviewLoading}>
                <Loading label={t('product.loadingReviews')} />
              </View>
            ) : reviewQuery.isError ? (
              <Card>
                <Text style={styles.reviewEmptyTitle}>{t('product.reviewsUnavailable')}</Text>
                <Text style={styles.reviewEmpty}>
                  {t('product.reviewsUnavailableBody')}
                </Text>
                <Button title={t('common.retry')} variant="outline" onPress={() => reviewQuery.refetch()} />
              </Card>
            ) : !totalReviews ? (
              <Card>
                <Text style={styles.reviewEmptyTitle}>{t('product.noReviewsYet')}</Text>
                <Text style={styles.reviewEmpty}>
                  {t('product.noReviewsYetBody')}
                </Text>
              </Card>
            ) : (
              <>
                <Card>
                  <View style={styles.summary}>
                    <View style={styles.scoreBlock}>
                      <Text style={styles.score}>{reviewData!.summary.average_rating.toFixed(1)}</Text>
                      <Text style={styles.summaryStars}>{stars(reviewData!.summary.average_rating)}</Text>
                      <Text style={styles.reviewTotal}>{t('product.verifiedReviews', { count: totalReviews })}</Text>
                    </View>
                    <RatingBreakdown summary={reviewData!.summary} />
                  </View>
                </Card>
                {reviewData!.reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <View>
                        <Text style={styles.reviewStars}>{stars(review.rating)}</Text>
                        <Text style={styles.reviewer}>{review.buyer_display_name || t('product.tbkBuyer')}</Text>
                      </View>
                      <Text style={styles.reviewDate}>{reviewDate(review.created_at, lang)}</Text>
                    </View>
                    {review.verified_purchase && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={styles.verifiedText}>{t('product.verifiedPurchase')}</Text>
                      </View>
                    )}
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                    {review.helpful_count > 0 && (
                      <Text style={styles.helpful}>
                        {t('product.helpfulFor', { count: review.helpful_count })}
                      </Text>
                    )}
                    {review.replies?.map((reply) => (
                      <View key={reply.id} style={styles.reply}>
                        <Text style={styles.replyAuthor}>{reply.author_display_name}</Text>
                        <Text style={styles.replyBody}>{reply.body}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {similarQuery.data && similarQuery.data.length > 0 ? (
          <View style={styles.similar}>
            <View style={styles.similarHeader}>
              <SectionHeader title={t('product.similarProducts')} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarRail}
            >
              {similarQuery.data.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  style={styles.similarCard}
                  onPress={() => router.push(`/products/${item.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* Naming what is still missing beats a silently disabled button. */}
        {!optionsComplete && (
          <Text style={styles.selectHint} numberOfLines={1}>
            {t('product.selectOptionsFirst', { options: missingOptions.join(' · ') })}
          </Text>
        )}
        <View style={styles.barRow}>
          <View style={styles.totalBlock}>
            <Text style={styles.metaLabel}>{t('product.total')}</Text>
            <Text style={styles.totalValue} numberOfLines={1}>
              {formatMoney(price * quantity, product.currency)}
            </Text>
            <Text style={styles.totalSub} numberOfLines={1}>
              {t('product.totalDetail', { qty: quantity, price: formatMoney(price, product.currency) })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('product.addToCart')}
            disabled={!canBuy}
            onPress={addLine}
            style={({ pressed }) => [styles.cartBtn, !canBuy && styles.optionDisabled, pressed && styles.pressed]}
          >
            <Ionicons name="bag-outline" size={17} color={colors.ink} />
            <Text style={styles.cartBtnText}>{t('product.cartShort')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canBuy}
            onPress={() => {
              if (addLine()) router.push('/(buyer)/cart')
            }}
            style={({ pressed }) => [styles.orderBtn, !canBuy && styles.optionDisabled, pressed && styles.pressed]}
          >
            <Text style={styles.orderBtnText} numberOfLines={1}>
              {stock < 1 ? t('product.outOfStock') : t('product.orderNow')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1 },
  flex1: { flex: 1 },
  pressed: { opacity: 0.85 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metaLabel: { ...kicker, fontSize: 10, color: colors.muted },

  gallery: { backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  galleryTop: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overlayChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  overlayChipText: { ...kicker, fontSize: 10, color: '#1C1C1A' },
  favBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  galleryBottom: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  galleryCaption: { ...kicker, fontSize: 10, color: '#1C1C1A', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', flexShrink: 1 },
  counter: { backgroundColor: 'rgba(28,28,26,0.82)', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 12 },
  pageDot: { width: 8, height: 4, borderRadius: 2, backgroundColor: colors.border },
  pageDotActive: { width: 36, backgroundColor: colors.gold },

  content: { paddingHorizontal: spacing.md, paddingTop: 18, gap: 18 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sellerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  shopChip: { borderWidth: 1, borderColor: colors.borderControl, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 1 },
  shopChipText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  title: { fontSize: 26, lineHeight: 32, fontFamily: fonts.display, fontWeight: '600', color: colors.ink, letterSpacing: -0.3, marginTop: -6 },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: -8 },
  ratingStars: { color: colors.star, fontSize: 14, letterSpacing: 1 },
  ratingValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  ratingSep: { color: colors.muted },
  ratingLink: { color: colors.muted, fontSize: 13, textDecorationLine: 'underline' },
  ratingMuted: { color: colors.muted, fontSize: 13 },

  priceCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, padding: spacing.md, gap: 10 },
  priceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  price: { fontSize: 32, lineHeight: 38, fontFamily: fonts.display, fontWeight: '600', color: colors.ink },
  perUnit: { ...kicker, fontSize: 11, color: colors.muted },
  strikePrice: { fontSize: 14, color: colors.muted, textDecorationLine: 'line-through' },
  promoBadge: { borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  promoBadgeText: { color: colors.gold, fontWeight: '800', fontSize: 13 },
  promoWindow: { color: colors.muted, fontSize: 12 },
  priceDivider: { height: 1, backgroundColor: colors.border },
  priceBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stockLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  stockText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  deliveryMeta: { alignItems: 'flex-end', gap: 2 },
  deliveryValue: { color: colors.ink, fontSize: 12, fontWeight: '600' },

  optionSection: { gap: 10 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optionLabel: { ...kicker, fontSize: 11, color: colors.muted, flexShrink: 1 },
  optionValue: { color: colors.ink, fontWeight: '800' },
  optionSelected: { borderColor: colors.gold, borderWidth: 2, borderStyle: 'solid' },
  optionOther: { borderStyle: 'dashed', borderColor: colors.borderControl },
  optionDisabled: { opacity: 0.4 },
  colourGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  colourCard: { width: '48.5%', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 10 },
  colourDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  colourDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold, borderWidth: 1.5, borderColor: '#FFFFFF' },
  colourName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  colourStock: { fontSize: 11, marginTop: 2 },
  tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { minWidth: 58, height: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  tileEven: { flexGrow: 1, flexBasis: 56 },
  tileText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  tileTextSelected: { color: colors.gold, fontWeight: '800' },
  tileTextOut: { color: colors.muted, textDecorationLine: 'line-through' },
  tileSub: { color: colors.muted, fontSize: 9, marginTop: 1 },
  tileBadge: { position: 'absolute', top: -5, right: -5, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold, borderWidth: 2, borderColor: colors.cream },

  qtyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, padding: spacing.md },
  qtyTitle: { ...kicker, fontSize: 11, color: colors.ink },
  qtySub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.borderControl, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 34, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '700' },

  block: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionSquare: { width: 10, height: 10, backgroundColor: colors.gold, borderRadius: 2 },
  sectionHeaderText: { ...kicker, fontSize: 12, fontWeight: '800', color: colors.ink },
  specTable: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: spacing.md },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  specRowLast: { borderBottomWidth: 0 },
  specKey: { ...kicker, fontSize: 10, color: colors.muted, flex: 1, lineHeight: 16 },
  specVal: { color: colors.ink, fontSize: 13, fontWeight: '700', flex: 1.4, textAlign: 'right' },

  infoList: { gap: 10 },
  infoCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  infoSummary: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 14 },
  infoTitle: { ...kicker, fontSize: 12, fontWeight: '800', color: colors.ink, flex: 1 },
  infoBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },

  reviewLoading: { minHeight: 120 },
  reviewEmptyTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  reviewEmpty: { color: colors.muted, lineHeight: 20 },
  summary: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  scoreBlock: { width: 105, alignItems: 'center' },
  score: { fontSize: 38, fontFamily: fonts.display, fontWeight: '500', color: colors.ink },
  summaryStars: { color: colors.star, fontSize: 17, letterSpacing: 1 },
  reviewTotal: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 5 },
  breakdown: { flex: 1, gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ratingLabel: { width: 27, fontSize: 11, color: colors.muted },
  ratingTrack: { height: 6, flex: 1, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  ratingFill: { height: '100%', borderRadius: 3, backgroundColor: colors.star },
  ratingCount: { width: 22, fontSize: 11, color: colors.muted, textAlign: 'right' },
  reviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 9,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reviewStars: { color: colors.star, fontSize: 16, letterSpacing: 1 },
  reviewer: { fontWeight: '800', color: colors.ink, marginTop: 4 },
  reviewDate: { fontSize: 11, color: colors.muted },
  verifiedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.greenSoft,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: '800', color: colors.success },
  reviewComment: { color: colors.ink, lineHeight: 21 },
  helpful: { fontSize: 11, color: colors.muted },
  reply: {
    backgroundColor: colors.greenSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.green,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  replyAuthor: { fontSize: 12, fontWeight: '700', color: colors.green },
  replyBody: { fontSize: 13, color: colors.ink, lineHeight: 18 },

  similar: { marginTop: 28, gap: 12 },
  similarHeader: { paddingHorizontal: spacing.md },
  similarRail: { paddingHorizontal: spacing.md, gap: 12 },
  // Explicit grow/shrink/basis: the card's own `flex: 1` would otherwise
  // squeeze every card of the rail into the screen width.
  similarCard: { flexGrow: 0, flexShrink: 0, flexBasis: 164, width: 164, maxWidth: 164 },

  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    gap: 6,
    zIndex: 100,
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalBlock: { flex: 1, minWidth: 80 },
  totalValue: { color: colors.ink, fontSize: 20, fontFamily: fonts.display, fontWeight: '600', marginTop: 1 },
  totalSub: { color: colors.muted, fontSize: 11 },
  cartBtn: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.borderControl, backgroundColor: colors.white },
  cartBtnText: { ...kicker, fontSize: 11, fontWeight: '800', color: colors.ink },
  orderBtn: { height: 48, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', maxWidth: 150 },
  orderBtnText: { ...kicker, fontSize: 11, fontWeight: '800', color: colors.onGold },
  selectHint: { color: colors.gold, fontSize: 12, fontWeight: '600', textAlign: 'center' },
})
