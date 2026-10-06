import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { marketplaceApi } from '../../src/api'
import { ProductCard } from '../../src/components/ProductCard'
import { ErrorState, Loading } from '../../src/components/ui'
import { formatDate } from '../../src/lib/format'
import { categoryLabel } from '../../src/lib/categoryLabels'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { fonts, kicker, radius, shadow, spacing, type Colors } from '../../src/theme'

type Tab = 'products' | 'reviews'

/** Public shop page: port of web-app ShopDetailPage (detail, products, reviews). */
export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeStyles(c), [c])
  const [tab, setTab] = useState<Tab>('products')

  const detail = useQuery({ queryKey: ['marketplace', 'shop', id], queryFn: () => marketplaceApi.shopDetail(id), enabled: Boolean(id) })
  const products = useQuery({ queryKey: ['marketplace', 'shop', id, 'products'], queryFn: () => marketplaceApi.shopProducts(id), enabled: Boolean(id) })
  const reviews = useQuery({ queryKey: ['marketplace', 'shop', id, 'reviews'], queryFn: () => marketplaceApi.shopReviews(id), enabled: Boolean(id) })

  if (detail.isLoading) return <Loading label={t('shop.loading')} />
  if (detail.isError || !detail.data) return <ErrorState message={detail.isError ? t('shop.loadError') : t('shop.notFound')} retry={() => void detail.refetch()} />

  const shop = detail.data
  const rating = shop.average_rating ?? 0
  const reviewCount = shop.total_reviews ?? 0
  const items = products.data ?? []
  const reviewList = reviews.data?.reviews ?? []
  const refresh = () => { void detail.refetch(); void products.refetch(); void reviews.refetch() }
  const productsLabel = t(shop.product_count === 1 ? 'shop.productsCount' : 'shop.productsCountPlural', { count: shop.product_count })

  const header = (
    <View style={styles.headerGap}>
      <View style={s.hero}>
        <View style={styles.heroRow}>
          <View style={s.shopTile}><Ionicons name="storefront" size={24} color={c.onGreen} /></View>
          <View style={styles.heroText}>
            <Text style={s.heroKicker}>{t('shop.kicker')}</Text>
            <Text style={s.heroName} numberOfLines={2}>{shop.name}</Text>
            {shop.city ? <Text style={s.heroMuted} numberOfLines={1}>{[shop.address, shop.city].filter(Boolean).join(' · ')}</Text> : null}
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={s.stat}>
            <Text style={s.statValue}>{reviewCount > 0 ? `★ ${rating.toFixed(1)}` : '—'}</Text>
            <Text style={s.statLabel} numberOfLines={1}>{reviewCount > 0 ? `${t('shop.reviewsTab')} (${reviewCount})` : t('shop.noReviewsYet')}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>{shop.product_count}</Text>
            <Text style={s.statLabel} numberOfLines={1}>{productsLabel}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue} numberOfLines={1}>{formatDate(shop.created_at)}</Text>
            <Text style={s.statLabel} numberOfLines={1}>{t('common.memberSince')}</Text>
          </View>
        </View>
      </View>
      {shop.categories?.length ? (
        <View style={styles.chips}>
          {shop.categories.map((cat) => (
            <Pressable key={cat.id} style={s.chip} onPress={() => router.push(`/categories/${cat.slug}`)} accessibilityRole="button">
              <Text style={s.chipText}>{categoryLabel(t, cat.slug, cat.name)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['products', 'reviews'] as Tab[]).map((key) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[s.tabText, tab === key && s.tabTextOn]}>
              {key === 'products' ? `${t('shop.productsTab')} (${shop.product_count})` : `${t('shop.reviewsTab')} (${reviewCount})`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )

  if (tab === 'reviews') {
    return (
      <FlatList
        key="reviews"
        style={s.page}
        contentContainerStyle={styles.content}
        data={reviewList}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={reviews.isRefetching} onRefresh={refresh} tintColor={c.green} />}
        ListEmptyComponent={reviews.isLoading ? <Loading /> : <Text style={s.empty}>{t('shop.noReviewsYet')}</Text>}
        renderItem={({ item: r }) => (
          <View style={s.review}>
            <View style={styles.reviewHead}>
              <Text style={s.reviewName} numberOfLines={1}>{r.buyer_display_name}</Text>
              {r.verified_purchase ? <View style={s.verified}><Text style={s.verifiedText}>{t('shop.verified')}</Text></View> : null}
              <Text style={s.reviewDate}>{formatDate(r.created_at)}</Text>
            </View>
            <Text style={s.stars}>{'★'.repeat(Math.round(r.rating))}<Text style={s.starsOff}>{'★'.repeat(Math.max(0, 5 - Math.round(r.rating)))}</Text></Text>
            {r.delivery_rating ? <Text style={s.metrics}>{t('shop.reviewMetrics', { delivery: r.delivery_rating, service: r.service_rating ?? 0, experience: r.order_experience_rating ?? 0 })}</Text> : null}
            {r.comment ? <Text style={s.comment}>{r.comment}</Text> : null}
          </View>
        )}
      />
    )
  }

  return (
    // Distinct keys: a FlatList cannot change numColumns (2 → 1) in place.
    <FlatList
      key="products"
      style={s.page}
      contentContainerStyle={styles.content}
      data={items}
      numColumns={2}
      columnWrapperStyle={styles.columns}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={products.isRefetching} onRefresh={refresh} tintColor={c.green} />}
      ListEmptyComponent={products.isLoading ? <Loading /> : products.isError ? <ErrorState message={t('shop.loadError')} retry={() => void products.refetch()} /> : <Text style={s.empty}>{t('shop.noProductsListed')}</Text>}
      renderItem={({ item }) => <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)} />}
    />
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.cream },
  hero: { backgroundColor: c.navy, borderRadius: 20, padding: spacing.md, gap: spacing.md, ...shadow.card },
  shopTile: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
  heroKicker: { ...kicker, color: c.cyan },
  heroName: { color: c.onNavy, fontFamily: fonts.display, fontWeight: '700', fontSize: 21, letterSpacing: -0.3 },
  heroMuted: { color: c.onNavyMuted, fontSize: 12.5, marginTop: 2 },
  stat: { flex: 1, backgroundColor: c.navySoft, borderWidth: 1, borderColor: c.navyLine, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, gap: 2 },
  statValue: { color: c.cyan, fontFamily: fonts.display, fontWeight: '700', fontSize: 15 },
  statLabel: { color: c.onNavyMuted, fontSize: 11 },
  chip: { borderRadius: radius.pill, backgroundColor: c.greenSoft, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: c.green, fontWeight: '600', fontSize: 12.5 },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: c.navy, borderColor: c.navy },
  tabText: { color: c.ink, fontWeight: '600', fontSize: 13 },
  tabTextOn: { color: c.onNavy },
  empty: { color: c.muted, textAlign: 'center', paddingVertical: spacing.lg },
  review: { backgroundColor: c.white, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: 6, ...shadow.card },
  reviewName: { flexShrink: 1, color: c.ink, fontWeight: '700', fontSize: 14 },
  verified: { backgroundColor: c.successSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  verifiedText: { color: c.success, fontSize: 10.5, fontWeight: '700' },
  reviewDate: { marginLeft: 'auto', color: c.faint, fontSize: 11.5 },
  stars: { color: c.star, fontSize: 14, letterSpacing: 1 },
  starsOff: { color: c.starEmpty },
  metrics: { color: c.muted, fontSize: 12 },
  comment: { color: c.ink, fontSize: 14, lineHeight: 20 },
})

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: 12, paddingBottom: spacing.xl },
  columns: { gap: 12 },
  headerGap: { gap: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroText: { flex: 1, minWidth: 0 },
  statsRow: { flexDirection: 'row', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabs: { flexDirection: 'row', gap: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
