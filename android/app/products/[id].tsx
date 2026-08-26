import { useMemo, useState } from 'react'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { useCart } from '../../src/store/cart'
import { Button, Card, ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, radius, spacing } from '../../src/theme'
import type { ProductReviewSummary } from '../../src/types'
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

const reviewDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
}

function RatingBreakdown({ summary }: { summary: ProductReviewSummary }) {
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
  const { id } = useLocalSearchParams<{ id: string }>()
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

  const selected = useMemo(() => {
    if (variants.length === 0) return undefined
    if (hasAttributeGroups && Object.keys(selection).length > 0) {
      const resolved = resolveVariant(variants, selection)
      if (resolved) return resolved
    }
    if (variantId) {
      const byId = variants.find((v) => v.id === variantId)
      if (byId) return byId
    }
    return variants.find((v) => (v.stock_quantity ?? 0) > 0) || variants[0]
  }, [variants, selection, variantId, hasAttributeGroups])

  if (query.isLoading) return <Loading label="Chargement du produit…" />
  if (!product || query.isError) {
    return (
      <ErrorState
        message="Ce produit n’est pas disponible pour le moment."
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

  const stock =
    selected?.stock_quantity ??
    selected?.available_stock ??
    selected?.stock_available ??
    product.available_stock ??
    0

  const price =
    selected?.sale_price ||
    selected?.unit_price ||
    selected?.price ||
    product.sale_price ||
    product.price ||
    product.base_price ||
    0

  const addLine = () => {
    const accepted = add({
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
    if (!accepted) {
      Alert.alert(
        'Boutique différente',
        'Votre panier contient déjà des produits d’une autre boutique. Terminez ou videz ce panier avant de continuer.'
      )
    }
    return accepted
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 110 + insets.bottom }]}>
        {image ? (
          <Image source={image} contentFit="contain" style={[styles.image, { height: Math.min(width, 470) }]} />
        ) : (
          <View style={styles.noImage}>
            <Text style={styles.noImageText}>BTMI</Text>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.shop}>Vendu par {product.shop_name || 'un vendeur BTMI'}</Text>
          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.rating}>
            {reviewData?.summary.total_reviews
              ? `${reviewData.summary.average_rating.toFixed(1)} ★  ·  ${reviewData.summary.total_reviews} avis`
              : reviewQuery.isLoading
              ? 'Chargement des avis…'
              : 'Aucun avis pour le moment'}
          </Text>
          <Text style={styles.price}>
            {price.toLocaleString()} {product.currency === 'USD' ? 'USD' : 'FC'}
          </Text>

          {/* Dynamic Variant Selectors (derives from actual saved attributes) */}
          {hasAttributeGroups ? (
            <View style={styles.optionSection}>
              <SectionTitle title="Options disponibles" />
              {attributeGroups.map((g) => {
                const activeVal = selection[g.key] || selected?.attributes?.[g.key] || g.values[0]
                return (
                  <View key={g.key} style={styles.attrGroup}>
                    <Text style={styles.attrLabel}>
                      {g.label}: <Text style={{ fontWeight: '900', color: colors.green }}>{activeVal}</Text>
                    </Text>
                    <View style={styles.pillRow}>
                      {g.values.map((val) => {
                        const isSelected = activeVal === val
                        const exists = isValueAvailable(variants, selection, g.key, val, false)
                        const inStock = isValueAvailable(variants, selection, g.key, val, true)
                        return (
                          <Button
                            key={val}
                            variant={isSelected ? 'primary' : 'outline'}
                            title={val}
                            disabled={!exists}
                            onPress={() => {
                              const matching =
                                variants.find(
                                  (candidate) =>
                                    (candidate.stock_quantity ?? 0) > 0 && candidate.attributes?.[g.key] === val
                                ) ?? variants.find((candidate) => candidate.attributes?.[g.key] === val)

                              if (matching?.attributes) {
                                setSelection({ ...matching.attributes })
                              } else {
                                setSelection((prev) => ({ ...prev, [g.key]: val }))
                              }
                              setQuantity(1)
                            }}
                          />
                        )
                      })}
                    </View>
                  </View>
                )
              })}
            </View>
          ) : variants.length > 1 ? (
            <View style={styles.optionSection}>
              <SectionTitle title="Choisissez une option" />
              <View style={styles.variants}>
                {variants.map((v) => (
                  <Button
                    key={v.id}
                    variant={selected?.id === v.id ? 'primary' : 'outline'}
                    title={v.name || describeAttributes(v) || v.sku || 'Option'}
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
              ? `En stock — ${stock} disponibles`
              : stock > 0
              ? `Plus que ${stock} en stock`
              : 'Rupture de stock'}
          </Text>

          <Card>
            <SectionTitle title="Quantité" />
            <View style={styles.qty}>
              <Button variant="outline" title="−" onPress={() => setQuantity(Math.max(1, quantity - 1))} />
              <Text style={styles.qtyValue}>{quantity}</Text>
              <Button
                variant="outline"
                title="+"
                disabled={quantity >= stock}
                onPress={() => setQuantity(quantity + 1)}
              />
            </View>
          </Card>

          {/* Product Specifications */}
          {specifications.length > 0 && (
            <Card>
              <SectionTitle title="Caractéristiques" />
              <View style={styles.specsTable}>
                {specifications.map((spec) => (
                  <View key={spec.key} style={styles.specRow}>
                    <Text style={styles.specKey}>{spec.label}</Text>
                    <Text style={styles.specVal}>{spec.value}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {product.description ? (
            <Card>
              <SectionTitle title="Description" />
              <Text style={styles.description}>{product.description}</Text>
            </Card>
          ) : null}

          <View style={styles.reviewSection}>
            <SectionTitle
              title={`Avis clients${reviewData?.summary.total_reviews ? ` (${reviewData.summary.total_reviews})` : ''}`}
            />
            {reviewQuery.isLoading ? (
              <View style={styles.reviewLoading}>
                <Loading label="Chargement des avis…" />
              </View>
            ) : reviewQuery.isError ? (
              <Card>
                <Text style={styles.reviewEmptyTitle}>Avis indisponibles</Text>
                <Text style={styles.reviewEmpty}>
                  Les avis n’ont pas pu être chargés. Réessayez dans quelques instants.
                </Text>
                <Button title="Réessayer" variant="outline" onPress={() => reviewQuery.refetch()} />
              </Card>
            ) : !reviewData?.summary.total_reviews ? (
              <Card>
                <Text style={styles.reviewEmptyTitle}>Pas encore d’avis</Text>
                <Text style={styles.reviewEmpty}>
                  Les acheteurs ayant terminé leur commande pourront partager ici leur expérience avec ce produit.
                </Text>
              </Card>
            ) : (
              <>
                <Card>
                  <View style={styles.summary}>
                    <View style={styles.scoreBlock}>
                      <Text style={styles.score}>{reviewData.summary.average_rating.toFixed(1)}</Text>
                      <Text style={styles.summaryStars}>{stars(reviewData.summary.average_rating)}</Text>
                      <Text style={styles.reviewTotal}>{reviewData.summary.total_reviews} avis vérifiés</Text>
                    </View>
                    <RatingBreakdown summary={reviewData.summary} />
                  </View>
                </Card>
                {reviewData.reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <View>
                        <Text style={styles.reviewStars}>{stars(review.rating)}</Text>
                        <Text style={styles.reviewer}>{review.buyer_display_name || 'Acheteur BTMI'}</Text>
                      </View>
                      <Text style={styles.reviewDate}>{reviewDate(review.created_at)}</Text>
                    </View>
                    {review.verified_purchase && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={styles.verifiedText}>Achat vérifié</Text>
                      </View>
                    )}
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                    {review.helpful_count > 0 && (
                      <Text style={styles.helpful}>
                        Utile pour {review.helpful_count} personne{review.helpful_count > 1 ? 's' : ''}
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
        <Button
          style={styles.actionButton}
          variant="outline"
          title="Ajouter au panier"
          disabled={!selected || stock < 1}
          onPress={addLine}
        />
        <Button
          style={styles.actionButton}
          variant="gold"
          title="Acheter maintenant"
          disabled={!selected || stock < 1}
          onPress={() => {
            if (addLine()) router.push('/(buyer)/cart')
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { paddingBottom: 100 },
  image: { width: '100%', backgroundColor: colors.white },
  noImage: { height: 330, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  noImageText: { fontSize: 34, fontWeight: '900', color: colors.green },
  content: { padding: spacing.md, gap: spacing.md },
  shop: { color: colors.green, fontWeight: '800' },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '900', color: colors.ink },
  rating: { color: colors.muted },
  price: { fontSize: 30, fontWeight: '900', color: colors.green },
  optionSection: { gap: spacing.sm },
  attrGroup: { gap: 6, marginBottom: 8 },
  attrLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  variants: { gap: spacing.sm },
  stock: { fontSize: 16, fontWeight: '900' },
  qty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  qtyValue: { fontWeight: '900', fontSize: 20, minWidth: 30, textAlign: 'center' },
  specsTable: { gap: 8, marginTop: 4 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  specKey: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  specVal: { fontSize: 13, color: colors.ink, fontWeight: '700' },
  description: { color: colors.ink, lineHeight: 23 },
  reviewSection: { gap: spacing.md, marginTop: 8 },
  reviewLoading: { minHeight: 120 },
  reviewEmptyTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  reviewEmpty: { color: colors.muted, lineHeight: 20 },
  summary: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  scoreBlock: { width: 105, alignItems: 'center' },
  score: { fontSize: 38, fontWeight: '900', color: colors.ink },
  summaryStars: { color: colors.gold, fontSize: 17, letterSpacing: 1 },
  reviewTotal: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 5 },
  breakdown: { flex: 1, gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ratingLabel: { width: 27, fontSize: 11, color: colors.muted },
  ratingTrack: { height: 6, flex: 1, borderRadius: 3, backgroundColor: '#E8E7E1', overflow: 'hidden' },
  ratingFill: { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
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
  reviewStars: { color: colors.gold, fontSize: 16, letterSpacing: 1 },
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
  replyAuthor: { fontSize: 12, fontWeight: '900', color: colors.green },
  replyBody: { fontSize: 13, color: colors.ink, lineHeight: 18 },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: { flex: 1, paddingHorizontal: 8 },
})
