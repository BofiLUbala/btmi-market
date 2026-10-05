import { useMemo, useState } from 'react'
import { Alert, ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { buyerApi, marketplaceApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { fetchBuyerUnreadCounts } from '../../src/api/communication'
import { ProductCard } from '../../src/components/ProductCard'
import { Button } from '../../src/components/ui'
import { BuyerMenu } from '../../src/components/BuyerMenu'
import { useI18n } from '../../src/store/i18n'
import { useAuth } from '../../src/store/auth'
import { useColors } from '../../src/store/theme'
import { kicker, radius, shadow, spacing, type Colors, fonts } from '../../src/theme'
import { categoryIcon } from '../../src/lib/categoryIcons'
import { categoryLabel } from '../../src/lib/categoryLabels'
import { categoryImage } from '../../src/lib/categoryVisuals'
import { canBuy } from '../../src/types'
import type { PublicProduct } from '../../src/types'
import { BrandLogo } from '../../src/components/BrandLogo'

function ProductSkeleton() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.skeletonCard}><View style={styles.skeletonMedia}/><View style={styles.skeletonLine}/><View style={styles.skeletonLineShort}/></View>
}

/** First photo the listing API sends for a product (same order as ProductCard). */
function productPhoto(product?: PublicProduct) {
  if (!product) return undefined
  const first = product.images?.[0]
  return resolveMediaUrl(product.primary_image_url || product.image_url || (typeof first === 'string' ? first : first?.url || first?.image_url))
}

export default function HomeScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const user = useAuth((state) => state.user)
  const isBuyer = Boolean(user) && canBuy(user)
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [visualResults, setVisualResults] = useState<PublicProduct[] | null>(null)
  const [visualImage, setVisualImage] = useState<string | null>(null)
  const [visualLoading, setVisualLoading] = useState(false)
  const [visualError, setVisualError] = useState(false)
  const term = search.trim()
  const products = useQuery({ queryKey: ['marketplace', 'products'], queryFn: marketplaceApi.products })
  const categories = useQuery({ queryKey: ['marketplace', 'categories'], queryFn: marketplaceApi.categories })
  const searchQuery = useQuery({ queryKey: ['marketplace', 'search', term], queryFn: () => marketplaceApi.search(term), enabled: term.length >= 2 })
  // Same cache entries as the cart / account screens: the delivery commune
  // and the unread notification badge in the header.
  const profile = useQuery({ queryKey: ['buyer', 'profile'], queryFn: buyerApi.profile, enabled: isBuyer })
  const unread = useQuery({ queryKey: ['buyer', 'unread-counts'], queryFn: fetchBuyerUnreadCounts, enabled: isBuyer, refetchInterval: 60_000 })
  const unreadNotifications = unread.data?.unread_notifications ?? 0
  const commune = profile.data?.commune?.trim()
  const deliveryPlace = commune ? [commune, profile.data?.city?.trim()].filter(Boolean).join(', ') : ''

  const visualMode = visualResults !== null || visualLoading || visualError
  const data = visualMode ? (visualResults ?? []) : term.length >= 2 ? (searchQuery.data ?? []) : (products.data ?? [])
  const loading = visualMode ? visualLoading : products.isLoading || searchQuery.isFetching
  const failed = visualMode ? visualError : products.isError || searchQuery.isError

  // Hero artwork: a real listing photo from the current selection.
  const heroProduct = products.data?.find((product) => productPhoto(product)) ?? products.data?.[0]
  const heroImage = productPhoto(heroProduct) ?? (heroProduct ? categoryImage(heroProduct.category_slug, heroProduct.category_name) : undefined)

  const clearVisualSearch = () => { setVisualResults(null); setVisualImage(null); setVisualError(false) }
  const analyzeProductImage = async (asset: ImagePicker.ImagePickerAsset) => {
    setSearch(''); setVisualImage(asset.uri); setVisualLoading(true); setVisualError(false); setVisualResults(null)
    try { setVisualResults(await marketplaceApi.searchByImage(asset)) }
    catch { setVisualError(true); setVisualResults([]) }
    finally { setVisualLoading(false) }
  }
  const takeProductPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(t('profile.cameraNeeded'), t('home.cameraNeededBody'))
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .72 })
    if (result.canceled || !result.assets[0]) return
    await analyzeProductImage(result.assets[0])
  }
  const chooseProductImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(t('profile.photosNeeded'), t('home.photosNeededBody'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .72, selectionLimit: 1 })
    if (result.canceled || !result.assets[0]) return
    await analyzeProductImage(result.assets[0])
  }
  const openSearchPage = () => router.push({ pathname: '/(buyer)/search', params: term ? { q: term } : {} })

  // Reference header: logo tile, delivery commune, account + notifications,
  // then a full-width search field with the blue filter button.
  const stickyHeader = (
    <View style={styles.stickyHeader}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.push('/(buyer)')} accessibilityRole="button" accessibilityLabel={t('home.logoAlt')}>
          <BrandLogo size={40} />
        </Pressable>
        <View style={styles.deliver}>
          {deliveryPlace ? <Pressable onPress={() => router.push('/profile-edit')} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.deliverKicker}>{t('browse.deliverTo')}</Text>
            <View style={styles.deliverRow}>
              <Text style={styles.deliverPlace} numberOfLines={1}>{deliveryPlace}</Text>
              <Ionicons name="chevron-down" size={14} color={colors.ink}/>
            </View>
          </Pressable> : null}
        </View>
        <Pressable style={styles.roundButton} onPress={() => router.push('/(buyer)/profile')} accessibilityRole="button" accessibilityLabel={t('nav.account')}>
          <Ionicons name="person-outline" size={19} color={colors.ink}/>
        </Pressable>
        <Pressable style={styles.roundButton} onPress={() => router.push(user ? '/notifications' : '/auth/login')} accessibilityRole="button" accessibilityLabel={t('notifications.title')}>
          <Ionicons name="notifications-outline" size={19} color={colors.ink}/>
          {unreadNotifications > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text></View> : null}
        </Pressable>
        <Pressable style={styles.roundButton} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel={t('nav.openMenu')}>
          <Ionicons name="menu" size={20} color={colors.ink}/>
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={colors.muted}/>
          <View style={styles.inputWrap}>{!search ? <Text style={styles.placeholder} numberOfLines={1} pointerEvents="none">{t('search.placeholder')}</Text> : null}<TextInput value={search} onChangeText={(value) => { clearVisualSearch(); setSearch(value) }} onSubmitEditing={openSearchPage} style={styles.searchInput} returnKeyType="search"/></View>
          {search.length > 0 && <Pressable onPress={() => setSearch('')} accessibilityLabel={t('home.clearSearch')} hitSlop={6}><Ionicons name="close" size={18} color={colors.muted}/></Pressable>}
          <Pressable style={styles.cameraButton} onPress={takeProductPhoto} accessibilityRole="button" accessibilityLabel={t('home.takePhotoSearch')}><Ionicons name="camera-outline" size={19} color={colors.muted}/></Pressable>
          <Pressable style={styles.cameraButton} onPress={chooseProductImage} accessibilityRole="button" accessibilityLabel={t('home.chooseImageSearch')}><Ionicons name="image-outline" size={19} color={colors.muted}/></Pressable>
        </View>
        <Pressable style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]} onPress={openSearchPage} accessibilityRole="button" accessibilityLabel={t('browse.filters')}>
          <Ionicons name="options-outline" size={20} color={colors.onGreen}/>
        </Pressable>
      </View>
      <BuyerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  )

  const header = <>
    <View style={styles.sectionBlock}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} pointerEvents="none"/>
        <View style={styles.heroGlowSmall} pointerEvents="none"/>
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>{t('home.trustBanner')}</Text>
          <Text style={styles.heroTitle}>{t('browse.heroTitle')}</Text>
          <Pressable style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]} onPress={() => router.push('/(buyer)/categories')} accessibilityRole="button">
            <Text style={styles.heroButtonText}>{t('browse.discover')}</Text>
          </Pressable>
        </View>
        {heroImage ? <Image source={heroImage} style={styles.heroImage} contentFit="cover"/> : null}
      </View>
      {categories.isLoading ? <View style={styles.chipLoading}><ActivityIndicator color={colors.green}/></View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.data?.slice(0, 8).map((category, index) => <Pressable key={category.id} onPress={() => router.push(`/categories/${category.slug}`)} style={styles.categoryChip}><View style={[styles.categoryImage, index === 0 && styles.categoryImageFirst]}><Ionicons name={categoryIcon(category.slug, category.name)} size={22} color={index === 0 ? colors.onNavy : colors.green}/></View><Text style={styles.categoryText} numberOfLines={1}>{categoryLabel(t, category.slug, category.name)}</Text></Pressable>)}</ScrollView>}
    </View>

    <View style={styles.productsHead}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{visualMode ? t('home.similarProducts') : term ? t('home.results') : t('home.pickedForYou')}</Text>
        <Text style={styles.sectionSubtitle}>{visualMode ? t('home.visualSubtitle') : term ? t('home.searchSubtitle', { term }) : t('home.featuredSubtitle')}</Text>
      </View>
      {visualImage ? <Pressable onPress={clearVisualSearch} style={styles.visualPreview} accessibilityLabel={t('home.closeVisualSearch')}><Image source={visualImage} style={styles.visualImage} contentFit="cover"/><View style={styles.previewClose}><Ionicons name="close" size={13} color={colors.onGreen}/></View></Pressable>
        : <Pressable onPress={() => router.push('/(buyer)/categories')} hitSlop={8}><Text style={styles.link}>{t('common.viewAll')}</Text></Pressable>}
    </View>
  </>

  return <SafeAreaView style={styles.safe} edges={['top']}>
    {stickyHeader}
    <FlatList data={failed || loading ? [] : data} numColumns={2} keyExtractor={(item) => item.id} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.list} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" renderItem={({item}) => <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)}/>} ListEmptyComponent={loading ? <View style={styles.compactState}><View style={styles.stateIcon}><Ionicons name="scan-outline" size={27} color={colors.green}/></View><Text style={styles.stateTitle}>{visualMode ? t('home.analyzingPhoto') : t('common.loading')}</Text><Text style={styles.stateText}>{visualMode ? t('home.visualAnalyzingHint') : t('home.preparingSelection')}</Text><ActivityIndicator color={colors.green}/></View> : failed ? <View style={styles.compactState}><View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={27} color={colors.green}/></View><Text style={styles.stateTitle}>{visualMode ? t('home.imageNotAnalyzed') : t('home.connectionFailed')}</Text><Text style={styles.stateText}>{visualMode ? t('home.visualFailedBody') : t('home.connectionFailedBody')}</Text><Button title={visualMode ? t('home.chooseAnotherImage') : t('common.retry')} onPress={visualMode ? chooseProductImage : () => term ? searchQuery.refetch() : products.refetch()}/></View> : <View style={styles.compactState}><Ionicons name={visualMode ? 'images-outline' : 'search-outline'} size={30} color={colors.muted}/><Text style={styles.stateTitle}>{t('home.noProductsFound')}</Text><Text style={styles.stateText}>{visualMode ? t('home.visualNoProductsBody') : t('home.searchNoProductsBody')}</Text></View>}/>
  </SafeAreaView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, list: { paddingBottom: 28 }, flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.88 },
  stickyHeader: { backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deliver: { flex: 1, minWidth: 0, paddingLeft: 2 },
  deliverKicker: { ...kicker, fontSize: 9.5, color: colors.muted },
  deliverRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  deliverPlace: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '700' },
  roundButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.green, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.onGreen, fontSize: 9, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 4 }, inputWrap: { flex: 1, minWidth: 60, justifyContent: 'center' }, placeholder: { position: 'absolute', left: 0, right: 0, color: colors.faint, fontSize: 14 }, searchInput: { color: colors.ink, fontSize: 14, paddingVertical: 0, paddingHorizontal: 0 }, cameraButton: { width: 32, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  filterButton: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  // Reference hero: blue rounded-18 banner, eyebrow + headline + white pill, photo right
  sectionBlock: { paddingTop: 16 },
  hero: { marginHorizontal: spacing.md, marginBottom: 18, minHeight: 150, borderRadius: 18, backgroundColor: colors.green, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden', ...shadow.raised },
  heroGlow: { position: 'absolute', right: -50, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroGlowSmall: { position: 'absolute', left: -30, bottom: -50, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  heroKicker: { ...kicker, fontSize: 9, color: colors.onGreen, opacity: 0.85 },
  heroTitle: { color: colors.onGreen, fontFamily: fonts.display, fontWeight: '700', fontSize: 19, lineHeight: 23, letterSpacing: -0.3 },
  heroButton: { alignSelf: 'flex-start', marginTop: 6, height: 32, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.onNavy, alignItems: 'center', justifyContent: 'center' },
  heroButtonText: { color: colors.navy, fontSize: 12.5, fontWeight: '700' },
  heroImage: { width: 108, height: 108, borderRadius: 16, transform: [{ rotate: '-6deg' }] },
  sectionTitle: { color: colors.ink, fontSize: 18, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 }, sectionSubtitle: { color: colors.muted, fontSize: 12.5, marginTop: 2 }, link: { color: colors.green, fontWeight: '700', fontSize: 13 },
  // Reference category shortcuts: 56px rounded-16 tiles, first one navy
  chips: { paddingHorizontal: spacing.md, gap: 10 }, categoryChip: { width: 68, alignItems: 'center', gap: 7 }, categoryImage: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card }, categoryImageFirst: { backgroundColor: colors.navy, borderColor: colors.navy }, categoryText: { color: colors.ink, fontSize: 11.5, fontWeight: '600', textAlign: 'center' }, chipLoading: { height: 72, justifyContent: 'center' },
  productsHead: { paddingHorizontal: spacing.md, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, visualPreview: { width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: colors.green, overflow: 'visible' }, visualImage: { width: '100%', height: '100%', borderRadius: 14 }, previewClose: { position: 'absolute', right: -6, top: -6, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, productRow: { paddingHorizontal: spacing.md, gap: 12, marginBottom: 12 },
  skeletonGrid: { paddingHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, skeletonCard: { width: '48%', height: 225, borderRadius: radius.md, backgroundColor: colors.white, paddingBottom: 12, overflow: 'hidden' }, skeletonMedia: { height: 150, backgroundColor: colors.surfaceAlt }, skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 12, marginTop: 14 }, skeletonLineShort: { width: '50%', height: 11, borderRadius: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 12, marginTop: 9 },
  compactState: { marginHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: 10, ...shadow.card }, stateIcon: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, stateTitle: { color: colors.ink, fontSize: 18, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3 }, stateText: { color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 310 },
})
