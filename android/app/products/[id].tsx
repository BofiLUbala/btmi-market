import { useMemo, useState } from 'react'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { useCart } from '../../src/store/cart'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { useColors } from '../../src/store/theme'
import { fonts, kicker, radius, spacing, type Colors } from '../../src/theme'
import { categoryImage } from '../../src/lib/categoryVisuals'
import { categoryLabel } from '../../src/lib/categoryLabels'
import { colorSwatch, isColorAttribute } from '../../src/lib/colorSwatch'
import { Accordion, DescriptionText, descriptionItems } from '../../src/components/Accordion'
import { resolvePromotion } from '../../src/lib/promotion'
import { attributeLabel } from '../../src/lib/attributeLabels'
import { useI18n } from '../../src/store/i18n'
import type { ProductReviewSummary } from '../../src/types'
import { formatMoney } from '../../src/lib/money'
import {
  buildAttributeGroups,
  resolveVariant,
  extractSpecifications,
  describeAttributes,
  isValueAvailable,
  type VariantSelection,
} from '../../src/lib/variants'

const stars = (rating: number) =>
  `${'★'.repeat(Math.max(0, Math.min(5, Math.round(rating))))}${'☆'.repeat(
    Math.max(0, 5 - Math.round(rating))
  )}`

const reviewDate = (value: string, lang: string) => {
  const locale = lang === 'en' ? 'en-US' : 'fr-FR'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

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

export default function ProductScreen() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const query = useQuery({
    queryKey: ['marketplace', 'product', id],
    queryFn: () => marketplaceApi.product(id!),
    enabled: Boolean(id),
  })

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
  // in). Drop those rather than leaving a combination no variant satisfies.
  const chooseValue = (key: string, value: string) => {
    setSelection((prev) => {
      const next: VariantSelection = { ...prev, [key]: value }
      for (const g of attributeGroups) {
        if (g.key === key) continue
        const chosen = next[g.key]
        if (chosen && !isValueAvailable(variants, next, g.key, chosen, false)) delete next[g.key]
      }
      return next
    })
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

  const firstImage = product.images?.[0]
  const image = resolveMediaUrl(
    product.primary_image_url ||
      product.image_url ||
      (typeof firstImage === 'string' ? firstImage : firstImage?.url || firstImage?.image_url)
  )

  const variantStock = (v: typeof selected) => v?.stock_quantity ?? v?.available_stock ?? v?.stock_available ?? 0
  // Before an option is picked, the product is in stock if any variant is: the
  // product-level figure is often absent, which read as a false "out of stock".
  const stock = selected
    ? variantStock(selected)
    : product.available_stock ?? variants.reduce((sum, v) => sum + variantStock(v), 0)

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
  const categoryObj = (product as { category?: unknown }).category
  const category = typeof categoryObj === 'object' && categoryObj
    ? (categoryObj as { name?: string; slug?: string })
    : { name: product.category_name, slug: product.category_slug }

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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 96 + insets.bottom }]}>
        <Image
          source={image ?? categoryImage(category.slug, category.name)}
          contentFit="cover"
          style={[styles.image, { height: Math.min(width * 1.25, 560) }]}
        />

        <View style={styles.content}>
          {category.name ? <Text style={styles.kicker}>{categoryLabel(t, category.slug, category.name)}</Text> : null}
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.shop}>{t('product.soldBy', { shop: product.shop_name || t('product.aSeller') })}</Text>
          {reviewData?.summary.total_reviews ? (
            <View style={styles.ratingBadgeRow}>
              <View style={styles.ratingPill}>
                <Text style={styles.ratingPillText}>{reviewData.summary.average_rating.toFixed(1)} ★</Text>
              </View>
              <Text style={styles.ratingCountText}>{t('product.reviewsCount', { count: reviewData.summary.total_reviews })}</Text>
            </View>
          ) : (
            <Text style={styles.ratingEmpty}>
              {reviewQuery.isLoading ? t('product.loadingReviews') : t('product.noReviews')}
            </Text>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatMoney(price, product.currency)}
            </Text>
            {onSale && (
              <>
                <Text style={styles.strikePrice}>
                  {formatMoney(promotion.originalPrice, product.currency)}
                </Text>
                <View style={styles.discountPill}>
                  <Text style={styles.discountPillText}>-{promotion.discountPercent}%</Text>
                </View>
              </>
            )}
          </View>
          {promotion.phase === 'upcoming' && (
            <Text style={styles.promoWindow}>{t('product.promotionUpcoming')}</Text>
          )}
          {(onSale || promotion.phase === 'upcoming') && (promotion.startsAt || promotion.endsAt) && (
            <Text style={styles.promoWindow}>
              {promotion.startsAt ? t('product.promotionFrom', { start: promotion.startsAt.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') }) : ''}
              {promotion.endsAt ? ' ' + t('product.promotionTo', { end: promotion.endsAt.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR') }) : ''}
            </Text>
          )}

          {/* Dynamic Variant Selectors (derives from actual saved attributes) */}
          {hasAttributeGroups ? (
            <View style={styles.optionSection}>
              {attributeGroups.map((g) => {
                const activeVal = selection[g.key]
                const colourGroup = isColorAttribute(g.key, g.label)
                return (
                  <View key={g.key} style={styles.attrGroup}>
                    <Text style={styles.attrLabel}>
                      {attributeLabel(t, g.label)}:{' '}
                      <Text style={{ fontWeight: '600', color: activeVal ? colors.ink : colors.muted }}>
                        {activeVal ?? t('product.toChoose')}
                      </Text>
                    </Text>
                    <View style={styles.pillRow}>
                      {g.values.map((val) => {
                        const isSelected = activeVal === val
                        const exists = isValueAvailable(variants, selection, g.key, val, false)
                        const inStock = isValueAvailable(variants, selection, g.key, val, true)
                        const swatch = colourGroup ? colorSwatch(val) : null
                        return (
                          <Pressable
                            key={val}
                            accessibilityRole="button"
                            accessibilityLabel={val}
                            accessibilityState={{ selected: isSelected, disabled: !exists }}
                            disabled={!exists}
                            onPress={() => chooseValue(g.key, val)}
                            style={[
                              swatch ? styles.swatch : styles.optionPill,
                              isSelected && (swatch ? styles.swatchSelected : styles.optionPillSelected),
                              !exists && styles.optionDisabled,
                              exists && !inStock && styles.optionLow,
                            ]}
                          >
                            {swatch ? (
                              <View style={[styles.swatchDot, { backgroundColor: swatch }]} />
                            ) : (
                              <Text style={[styles.optionPillText, isSelected && styles.optionPillTextSelected]}>{val}</Text>
                            )}
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                )
              })}
            </View>
          ) : variants.length > 1 ? (
            <View style={styles.optionSection}>
              <SectionTitle title={t('product.chooseOption')} />
              <View style={styles.variants}>
                {variants.map((v) => (
                  <Button
                    key={v.id}
                    variant={selected?.id === v.id ? 'primary' : 'outline'}
                    title={v.name || describeAttributes(v) || v.sku || t('product.option')}
                    onPress={() => {
                      setVariantId(v.id)
                      setQuantity(1)
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Text style={[styles.stock, { color: stock > 0 ? colors.success : colors.danger }]}>
            {stock > 3
              ? t('product.inStockCount', { count: stock })
              : stock > 0
              ? t('product.onlyLeft', { count: stock })
              : t('product.outOfStock')}
          </Text>

          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>{t('common.quantity')}</Text>
            <View style={styles.qty}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="−"
                style={styles.qtyBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={18} color={colors.ink} />
              </Pressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="+"
                disabled={quantity >= stock}
                style={[styles.qtyBtn, quantity >= stock && styles.optionDisabled]}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={18} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          <Accordion
            items={[
              ...(description.intro
                ? [{ id: 'description', title: t('product.description'), defaultOpen: true, content: <DescriptionText text={description.intro} /> }]
                : []),
              ...description.items,
              ...(specifications.length > 0
                ? [{
                    id: 'specifications',
                    title: t('product.specifications'),
                    content: (
                      <View style={styles.specsTable}>
                        {specifications.map((spec) => (
                          <View key={spec.key} style={styles.specRow}>
                            <Text style={styles.specKey}>{attributeLabel(t, spec.label)}</Text>
                            <Text style={styles.specVal}>{spec.value}</Text>
                          </View>
                        ))}
                      </View>
                    ),
                  }]
                : []),
            ]}
          />

          <View style={styles.reviewSection}>
            <SectionTitle
              title={`${t('product.customerReviews')}${reviewData?.summary.total_reviews ? ` (${reviewData.summary.total_reviews})` : ''}`}
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
            ) : !reviewData?.summary.total_reviews ? (
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
                      <Text style={styles.score}>{reviewData.summary.average_rating.toFixed(1)}</Text>
                      <Text style={styles.summaryStars}>{stars(reviewData.summary.average_rating)}</Text>
                      <Text style={styles.reviewTotal}>{t('product.verifiedReviews', { count: reviewData.summary.total_reviews })}</Text>
                    </View>
                    <RatingBreakdown summary={reviewData.summary} />
                  </View>
                </Card>
                {reviewData.reviews.map((review) => (
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
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* Naming what is still missing beats a silently disabled button. */}
        {!optionsComplete && (
          <Text style={styles.selectHint} numberOfLines={1}>
            {t('product.selectOptionsFirst', { options: missingOptions.join(' · ') })}
          </Text>
        )}
        <View style={styles.barRow}>
          <View style={styles.priceBlock}>
            <Text style={styles.priceBlockQty} numberOfLines={1}>
              {stock < 1
                ? t('product.outOfStock')
                : `${quantity} × ${formatMoney(price, product.currency)}`}
            </Text>
            <Text style={styles.priceBlockTotal} numberOfLines={1}>
              {formatMoney(price * quantity, product.currency)}
            </Text>
          </View>
          <Button
            dense
            style={styles.barButton}
            variant="primary"
            title={t('product.addToCart')}
            disabled={!optionsComplete || !selected || stock < 1}
            onPress={addLine}
          />
          <Button
            dense
            style={styles.barButton}
            variant="outline"
            title={t('product.buyNow')}
            disabled={!optionsComplete || !selected || stock < 1}
            onPress={() => {
              if (addLine()) router.push('/(buyer)/cart')
            }}
          />
        </View>
      </View>
    </View>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { flex: 1 },
  page: { paddingBottom: 100 },
  image: { width: '100%', backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.md, gap: spacing.md },
  kicker: { ...kicker, color: colors.muted, marginBottom: -8 },
  shop: { color: colors.muted, fontSize: 13 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: fonts.display, fontWeight: '500', color: colors.ink, letterSpacing: -0.3 },
  ratingBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPill: { backgroundColor: colors.success, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ratingPillText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  ratingCountText: { color: colors.muted, fontSize: 13 },
  ratingEmpty: { color: colors.muted, fontStyle: 'italic' },
  price: { fontSize: 28, fontFamily: fonts.display, fontWeight: '500', color: colors.ink },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  strikePrice: { fontSize: 16, color: colors.muted, textDecorationLine: 'line-through' },
  discountPill: { backgroundColor: colors.danger, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  discountPillText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  promoWindow: { color: colors.muted, fontSize: 12 },
  optionSection: { gap: spacing.sm },
  attrGroup: { gap: 6, marginBottom: 8 },
  attrLabel: { fontSize: 14, color: colors.muted },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionPill: { minWidth: 48, minHeight: 44, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.borderControl, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  optionPillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionPillText: { color: colors.ink, fontWeight: '500', fontSize: 14 },
  optionPillTextSelected: { color: colors.onGreen },
  optionDisabled: { opacity: 0.35 },
  optionLow: { borderStyle: 'dashed' },
  swatch: { width: 44, height: 44, borderRadius: 22, padding: 4, borderWidth: 1, borderColor: 'transparent' },
  swatchSelected: { borderColor: colors.ink, borderWidth: 1.5 },
  swatchDot: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.2)' },
  variants: { gap: spacing.sm },
  stock: { fontSize: 14, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { color: colors.ink, fontWeight: '500', fontSize: 15 },
  qty: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderControl, borderRadius: 999 },
  qtyBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontWeight: '600', fontSize: 16, minWidth: 28, textAlign: 'center', color: colors.ink },
  specsTable: { gap: 8, marginTop: 4 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  specKey: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  specVal: { fontSize: 13, color: colors.ink, fontWeight: '700' },
  description: { color: colors.ink, lineHeight: 23 },
  reviewSection: { gap: spacing.md, marginTop: 8 },
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
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    gap: 6,
    zIndex: 100,
    elevation: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  priceBlock: { flex: 1, minWidth: 64 },
  priceBlockQty: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  priceBlockTotal: { color: colors.ink, fontSize: 18, fontFamily: fonts.display, fontWeight: '500' },
  barButton: { flexGrow: 0, flexShrink: 0 },
  selectHint: { color: colors.gold, fontSize: 12, fontWeight: '600', textAlign: 'center' },
})
