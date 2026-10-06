import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, Tabs } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useAuth } from '../../src/store/auth'
import { useColors } from '../../src/store/theme'
import { useFavorites, type FavoritesItem } from '../../src/store/favorites'
import { categoryLabel } from '../../src/lib/categoryLabels'
import { formatMoney } from '../../src/lib/money'
import { kicker, radius, shadow, spacing, type Colors, fonts } from '../../src/theme'
import { ProductPhoto } from '../../src/components/ProductPhoto'
import { AccountShell } from '../../src/components/AccountShell'

type Segment = 'all' | 'items' | 'shops'

/** Pairs items into rows of two for the photo grid. */
const pairs = <T,>(list: T[]) => list.reduce<T[][]>((rows, item, i) => (i % 2 ? rows[rows.length - 1].push(item) : rows.push([item]), rows), [])

function FavoritesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const items = useFavorites((state) => state.items)
  const remove = useFavorites((state) => state.remove)
  // Favourites are followed on the server (price drop / restock alerts) only
  // for a signed-in account, so the promise is shown only then.
  const signedIn = Boolean(useAuth((state) => state.user))
  const [segment, setSegment] = useState<Segment>('all')

  const shops = useMemo(() => {
    const groups: Array<{ key: string; name: string; items: FavoritesItem[] }> = []
    for (const item of items) {
      const key = item.shopId || item.shopName
      let group = groups.find((g) => g.key === key)
      if (!group) { group = { key, name: item.shopName, items: [] }; groups.push(group) }
      group.items.push(item)
    }
    return groups
  }, [items])

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/'))

  const tile = (item: FavoritesItem) => (
    <Pressable key={item.productId} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button" onPress={() => router.push(`/products/${item.productId}`)}>
      <View style={styles.media}>
        <ProductPhoto uri={item.image} categorySlug={item.categorySlug} categoryName={item.categoryName} style={styles.image} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('product.removeFromFavorites')}
          hitSlop={8}
          style={styles.fav}
          onPress={() => remove(item.productId)}
        >
          <Ionicons name="heart" size={17} color={colors.green} />
        </Pressable>
      </View>
      <View style={styles.body}>
        {item.categoryName ? <Text numberOfLines={1} style={styles.kicker}>{categoryLabel(t, item.categorySlug, item.categoryName)}</Text> : null}
        <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.shop}>{item.shopName}</Text>
        <Text style={styles.price}>{formatMoney(item.price, item.currency)}</Text>
      </View>
    </Pressable>
  )
  const grid = (list: FavoritesItem[]) => pairs(list).map((row) => (
    <View key={row.map((i) => i.productId).join('-')} style={styles.row}>
      {row.map(tile)}
      {row.length === 1 ? <View style={styles.cardSpacer} /> : null}
    </View>
  ))

  const segments: Array<{ value: Segment; label: string }> = [
    { value: 'all', label: t('browse.segAll') },
    { value: 'items', label: t('browse.segItems') },
    { value: 'shops', label: t('browse.segShops') },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Tabs.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <Pressable style={styles.back} onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={6}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.screenTitle} numberOfLines={1}>{t('browse.favoritesTitle')}</Text>
        {items.length > 0 ? <Text style={styles.count}>{t('browse.favCount', { count: items.length })}</Text> : null}
      </View>

      {items.length === 0 ? (
        <View style={styles.page}>
          <View style={styles.icon}><Ionicons name="heart-outline" size={32} color={colors.green}/></View>
          <Text style={styles.title}>{t('favorites.title')}</Text>
          <Text style={styles.text}>{t('favorites.body')}</Text>
          <Button variant="outline" title={t('cart.discover')} onPress={() => router.navigate('/')}/>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.segments} accessibilityRole="tablist">
            {segments.map((s) => (
              <Pressable
                key={s.value}
                accessibilityRole="tab"
                accessibilityState={{ selected: segment === s.value }}
                onPress={() => setSegment(s.value)}
                style={[styles.segment, segment === s.value && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, segment === s.value && styles.segmentTextOn]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
          {signedIn ? (
            <View style={styles.info}>
              <Ionicons name="notifications-outline" size={15} color={colors.gold} />
              <Text style={styles.infoText}>{t('browse.priceDropInfo')}</Text>
            </View>
          ) : null}
          {segment === 'shops'
            ? shops.map((group) => (
              <View key={group.key} style={styles.shopGroup}>
                <View style={styles.shopHead}>
                  <View style={styles.shopIcon}><Ionicons name="storefront-outline" size={17} color={colors.green} /></View>
                  <Text style={styles.shopName} numberOfLines={1}>{group.name || t('product.aSeller')}</Text>
                  <Text style={styles.shopCount}>{t('browse.favCount', { count: group.items.length })}</Text>
                </View>
                {grid(group.items)}
              </View>
            ))
            : grid(items)}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 6 },
  back: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { flex: 1, color: colors.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 20, letterSpacing: -0.3 },
  count: { color: colors.green, fontSize: 12.5, fontWeight: '700' },
  page: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  icon: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: colors.ink, textAlign: 'center' },
  text: { color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  list: { padding: spacing.md, paddingTop: 8, paddingBottom: 28, gap: 12 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  // Segmented pills: selected navy
  segments: { flexDirection: 'row', gap: 8 },
  segment: { height: 34, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentText: { color: colors.ink, fontSize: 12.5, fontWeight: '600' },
  segmentTextOn: { color: colors.onNavy },
  // Cyan-tinted info strip
  info: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.goldSoft },
  infoText: { flex: 1, color: colors.ink, fontSize: 12.5, fontWeight: '600' },
  shopGroup: { gap: 12 },
  shopHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  shopIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  shopName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  shopCount: { color: colors.green, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  // Reference favourite tile: white card, square photo, white heart badge
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  cardSpacer: { flex: 1 },
  media: { aspectRatio: 1, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  image: { width: '100%', height: '100%' },
  fav: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 10, paddingHorizontal: 10, paddingBottom: 12, gap: 3 },
  kicker: { ...kicker, fontSize: 9.5, color: colors.green },
  name: { color: colors.ink, fontWeight: '600', fontSize: 13.5, lineHeight: 18 },
  shop: { color: colors.muted, fontSize: 12 },
  price: { color: colors.green, fontFamily: fonts.display, fontWeight: '700', fontSize: 16, marginTop: 2 },
})

/** Large screens: the account column on the left (AccountShell). */
export default function FavoritesScreenRoute() {
  return <AccountShell><FavoritesScreen /></AccountShell>
}
