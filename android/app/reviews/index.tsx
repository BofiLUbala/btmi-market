import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { buyerApi } from '../../src/api'
import { Button, ErrorState, Loading } from '../../src/components/ui'
import { formatDate } from '../../src/lib/format'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { kicker, radius, shadow, type Colors, fonts } from '../../src/theme'
import Ionicons from '@expo/vector-icons/Ionicons'

// Port of web-app/src/pages/buyer/MyReviewsPage.tsx: product / shop tabs with
// counts, each review with its stars, verified badge, date, service breakdown,
// comment, a link to what was reviewed and "Withdraw" (DELETE /buyer/reviews/:id).
export default function MyReviews() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ['buyer', 'reviews'], queryFn: buyerApi.reviews })
  const [activeTab, setActiveTab] = useState<'product' | 'shop'>('product')
  const [withdrawing, setWithdrawing] = useState<string | null>(null)

  function withdraw(id: string) {
    Alert.alert(t('reviews.withdraw'), t('reviews.withdrawConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('reviews.withdraw'), style: 'destructive', onPress: async () => {
        setWithdrawing(id)
        try { await buyerApi.withdrawReview(id); await queryClient.invalidateQueries({ queryKey: ['buyer', 'reviews'] }) }
        finally { setWithdrawing(null) }
      } },
    ])
  }

  if (q.isLoading) return <Loading label={t('reviews.loading')} />
  if (q.isError) return <ErrorState message={q.error instanceof Error ? q.error.message : t('reviews.loadFailed')} retry={() => void q.refetch()} />

  const reviews = Array.isArray(q.data?.reviews) ? q.data!.reviews : []
  const productReviews = reviews.filter((r) => r.product_id)
  const shopReviews = reviews.filter((r) => !r.product_id)
  const active = activeTab === 'product' ? productReviews : shopReviews

  return <ScrollView contentContainerStyle={styles.page}>
    <View>
      <Text style={styles.eyebrow}>{t('account.eyebrow')}</Text>
      <Text style={styles.h1}>{t('account.myReviews')}</Text>
      <Text style={styles.muted}>{t('reviews.manageSubtitle')}</Text>
    </View>
    <View style={styles.tabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'product' }} onPress={() => setActiveTab('product')} style={[styles.tab, activeTab === 'product' && styles.tabOn]}><Text style={[styles.tabText, activeTab === 'product' && styles.tabTextOn]}>{t('reviews.productReviews', { count: productReviews.length })}</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'shop' }} onPress={() => setActiveTab('shop')} style={[styles.tab, activeTab === 'shop' && styles.tabOn]}><Text style={[styles.tabText, activeTab === 'shop' && styles.tabTextOn]}>{t('reviews.shopReviews', { count: shopReviews.length })}</Text></Pressable>
    </View>
    {active.length === 0 ? <View style={styles.empty}>
      <Ionicons name="star-outline" size={40} color={colors.muted} />
      <Text style={styles.h3}>{activeTab === 'product' ? t('reviews.noProductReviews') : t('reviews.noShopReviews')}</Text>
      <Text style={[styles.muted, { textAlign: 'center' }]}>{activeTab === 'product' ? t('reviews.noProductReviewsDesc') : t('reviews.noShopReviewsDesc')}</Text>
      <Button title={t('account.myOrders')} onPress={() => router.push('/orders')} />
    </View> : <View style={styles.card}>
      {active.map((r) => <View key={r.id} style={styles.item}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.bold}>{r.product_id ? t('reviews.productReviewLabel') : t('reviews.shopServiceEvaluation')}</Text>
            <View style={styles.rowWrap}>
              <Text style={styles.stars}>{'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}</Text>
              <Text style={styles.badge}>{r.verified_purchase ? t('reviews.verifiedPurchase') : t('reviews.pending')}</Text>
            </View>
          </View>
          <Text style={styles.small}>{formatDate(r.created_at)}</Text>
        </View>
        {!r.product_id && r.delivery_rating ? <Text style={styles.small}>{t('reviews.serviceBreakdown', { delivery: r.delivery_rating ?? 0, service: r.service_rating ?? 0, overall: r.order_experience_rating ?? 0 })}</Text> : null}
        {r.comment ? <Text style={styles.text}>{r.comment}</Text> : null}
        <View style={styles.rowBetween}>
          {r.product_id ? <Pressable accessibilityRole="link" onPress={() => router.push(`/products/${r.product_id}`)}><Text style={styles.link}>{t('reviews.viewProductPage')}</Text></Pressable> : <View />}
          <Button dense variant="outline" title={t('reviews.withdraw')} loading={withdrawing === r.id} onPress={() => withdraw(r.id)} />
        </View>
      </View>)}
    </View>}
  </ScrollView>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48, gap: 12, backgroundColor: c.cream, flexGrow: 1 },
  eyebrow: { ...kicker, color: c.green },
  h1: { fontSize: 22, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: c.ink, marginTop: 2 },
  h3: { fontSize: 16, fontFamily: fonts.display, fontWeight: '700', color: c.ink, textAlign: 'center' },
  text: { color: c.ink, fontSize: 13.5, lineHeight: 19 },
  bold: { color: c.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: c.muted, fontSize: 13, marginTop: 2 },
  small: { color: c.muted, fontSize: 12 },
  link: { color: c.green, fontSize: 13, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: { minHeight: 34, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  tabOn: { backgroundColor: c.green, borderColor: c.green },
  tabText: { color: c.ink, fontWeight: '600', fontSize: 13 },
  tabTextOn: { color: c.onGreen, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 8, backgroundColor: c.white, borderRadius: 18, borderWidth: 1, borderColor: c.border, ...shadow.card },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16, gap: 14, ...shadow.card },
  item: { gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stars: { color: c.star, fontSize: 16, letterSpacing: 1 },
  badge: { fontSize: 11, fontWeight: '700', color: c.success, backgroundColor: c.successSoft, paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.pill, overflow: 'hidden' },
})
