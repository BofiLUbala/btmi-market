import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { ErrorState, Loading } from '../../src/components/ui'
import { useAuth } from '../../src/store/auth'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors } from '../../src/theme'

// Port of web-app/src/pages/seller/reviews/SellerReviewsPage.tsx: reviews of the
// ACTIVE shop (the one picked in the header), with the shop-service / product
// tabs (?type=shop|product), the rating summary and 5→1 breakdown, then the
// list — one column at phone width.
export default function SellerReviews() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const [activeTab, setActiveTab] = useState<'shop' | 'product'>('shop')
  const reviews = useQuery({ queryKey: ['seller', 'reviews', activeShop, activeTab], queryFn: () => sellerApi.reviews(activeShop!, activeTab), enabled: Boolean(activeShop) })

  if (!activeBusiness) return <View style={styles.center}>
    <Text style={{ fontSize: 64 }}>⭐</Text>
    <Text style={styles.h2}>{t('seller.noBusinessSelected')}</Text>
    <Text style={[styles.muted, styles.centerText]}>{t('seller.reviews.noBusinessSubtitle')}</Text>
  </View>
  if (!activeShop) return <View style={styles.page}><View style={styles.card}>
    <Text style={styles.h2}>{t('seller.reviews.selectShopTitle')}</Text>
    <Text style={styles.muted}>{t('seller.reviews.selectShopDesc')}</Text>
  </View></View>
  if (reviews.isLoading) return <Loading label={t('seller.reviews.loading')} />
  if (reviews.isError) return <ErrorState message={reviews.error instanceof Error ? reviews.error.message : t('reviews.loadFailed')} retry={() => void reviews.refetch()} />
  if (!reviews.data) return <ErrorState message={t('seller.reviews.noData')} retry={() => void reviews.refetch()} />

  const summary = reviews.data.summary || { average_rating: 0, total_reviews: 0, rating_1_count: 0, rating_2_count: 0, rating_3_count: 0, rating_4_count: 0, rating_5_count: 0 }
  const reviewList = Array.isArray(reviews.data.reviews) ? reviews.data.reviews : []

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.h1}>{t('seller.reviews')}</Text>
    <View style={styles.tabs}>
      {(['shop', 'product'] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}>
        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab === 'shop' ? t('seller.reviews.tabShopService') : t('seller.reviews.tabProduct')}</Text>
      </Pressable>)}
    </View>

    <View style={styles.card}>
      <Text style={styles.h2}>{activeTab === 'shop' ? t('seller.reviews.shopSummary') : t('seller.reviews.productSummary')}</Text>
      <View style={styles.summary}>
        <Text style={styles.average}>{summary.average_rating.toFixed(1)}</Text>
        <Text style={styles.muted}>{t('seller.reviews.averageRating')}</Text>
        <Text style={styles.small}>{t('seller.reviews.totalReviews', { count: summary.total_reviews })}</Text>
      </View>
      <Text style={styles.h3}>{t('seller.reviews.breakdown')}</Text>
      {[5, 4, 3, 2, 1].map((rating) => {
        const count = summary[`rating_${rating}_count` as keyof typeof summary] as number
        const percent = summary.total_reviews > 0 ? (count / summary.total_reviews) * 100 : 0
        return <View key={rating} style={styles.barRow}>
          <Text style={[styles.small, { width: 40, color: colors.ink }]}>{rating} ★</Text>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${percent}%` }]} /></View>
          <Text style={[styles.small, { width: 40, textAlign: 'right' }]}>{count}</Text>
        </View>
      })}
    </View>

    <View style={styles.card}>
      <Text style={styles.h2}>{activeTab === 'shop' ? t('seller.reviews.recentShop') : t('seller.reviews.recentProduct')}</Text>
      {reviewList.length === 0 ? <Text style={[styles.small, styles.centerText, { padding: 16 }]}>{t('shop.noReviewsYet')}</Text>
        : reviewList.map((review) => <View key={review.id} style={styles.review}>
          {review.product_name ? <View style={styles.productRow}>
            {review.image_url ? <Image source={resolveMediaUrl(review.image_url)} style={styles.productImg} contentFit="cover" /> : null}
            <View style={styles.flex1}>
              <Text style={[styles.small, styles.bold]}>{review.product_name}</Text>
              {review.variant_name ? <Text style={[styles.small, { fontSize: 12.8 }]}>{t('orders.variantWithLabel', { variant: review.variant_name })}</Text> : null}
            </View>
          </View> : null}
          <View style={styles.reviewHead}>
            <View style={[styles.flex1, styles.nameRow]}>
              <Text style={styles.bold}>{review.buyer_display_name}</Text>
              {review.verified_purchase ? <Text style={styles.badge}>{t('reviews.verifiedPurchase')}</Text> : null}
            </View>
            <Text style={styles.stars}>{review.rating} ★</Text>
            <Text style={styles.small}>{new Date(review.created_at).toLocaleDateString()}</Text>
          </View>
          {review.comment ? <Text style={[styles.small, { marginTop: 8 }]}>{review.comment}</Text> : null}
        </View>)}
    </View>
  </ScrollView>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  centerText: { textAlign: 'center' },
  flex1: { flex: 1 },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h2: { fontSize: 20, fontWeight: '700', color: c.ink },
  h3: { fontSize: 16, fontWeight: '700', color: c.ink, marginTop: 16, marginBottom: 8 },
  bold: { fontWeight: '700', color: c.ink },
  muted: { color: c.muted, fontSize: 15 },
  small: { color: c.muted, fontSize: 14 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  tabActive: { backgroundColor: c.green, borderColor: c.green },
  tabText: { color: c.ink, fontWeight: '600' },
  tabTextActive: { color: c.onGreen },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 4, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  summary: { alignItems: 'center', marginVertical: 16 },
  average: { fontSize: 48, lineHeight: 50, fontWeight: '800', color: c.ink },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  barTrack: { flex: 1, height: 8, backgroundColor: c.surface2, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: c.star, borderRadius: 4 },
  review: { borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 16, marginTop: 12 },
  productRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12, backgroundColor: c.surface2, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  productImg: { width: 40, height: 40, borderRadius: 4 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { fontSize: 11, fontWeight: '700', color: c.green, backgroundColor: c.greenSoft, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden' },
  stars: { color: c.star, fontWeight: '700' },
})
