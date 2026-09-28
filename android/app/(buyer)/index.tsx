import { useMemo, useState } from 'react'
import { Alert, ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { ProductCard } from '../../src/components/ProductCard'
import { Button } from '../../src/components/ui'
import { BuyerMenu } from '../../src/components/BuyerMenu'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { radius, spacing, type Colors, fonts } from '../../src/theme'
import { categoryIcon } from '../../src/lib/categoryIcons'
import { categoryLabel } from '../../src/lib/categoryLabels'
import type { PublicProduct } from '../../src/types'

function ProductSkeleton() {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.skeletonCard}><View style={styles.skeletonMedia}/><View style={styles.skeletonLine}/><View style={styles.skeletonLineShort}/></View>
}

export default function HomeScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
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
  const visualMode = visualResults !== null || visualLoading || visualError
  const data = visualMode ? (visualResults ?? []) : term.length >= 2 ? (searchQuery.data ?? []) : (products.data ?? [])
  const loading = visualMode ? visualLoading : products.isLoading || searchQuery.isFetching
  const failed = visualMode ? visualError : products.isError || searchQuery.isError

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

  // Same header as the web at phone width: logo pill, search pill with the
  // photo/gallery search, and the menu button that opens the drawer.
  const stickyHeader = (
    <View style={styles.stickyHeader}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.push('/(buyer)')} accessibilityRole="button" accessibilityLabel={t('home.logoAlt')}>
          <View style={styles.logo}><Text style={styles.logoText}>TBK</Text></View>
        </Pressable>
        <View style={styles.searchBox}>
          <View style={styles.inputWrap}>{!search ? <Text style={styles.placeholder} numberOfLines={1} pointerEvents="none">{t('search.placeholder' as never)}</Text> : null}<TextInput value={search} onChangeText={(value) => { clearVisualSearch(); setSearch(value) }} style={styles.searchInput} returnKeyType="search"/></View>
          {search.length > 0 && <Pressable onPress={() => setSearch('')} accessibilityLabel={t('home.clearSearch')} hitSlop={6}><Ionicons name="close" size={18} color={colors.muted}/></Pressable>}
          <Pressable style={styles.cameraButton} onPress={takeProductPhoto} accessibilityRole="button" accessibilityLabel={t('home.takePhotoSearch')}><Ionicons name="camera-outline" size={19} color={colors.muted}/></Pressable>
          <Pressable style={styles.cameraButton} onPress={chooseProductImage} accessibilityRole="button" accessibilityLabel={t('home.chooseImageSearch')}><Ionicons name="image-outline" size={19} color={colors.muted}/></Pressable>
        </View>
        <Pressable style={styles.menuButton} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel={t('nav.openMenu')}>
          <Ionicons name="menu" size={22} color={colors.ink}/>
        </Pressable>
      </View>
      <BuyerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  )

  const header = <>
    <View style={styles.sectionBlock}>
      <Text style={styles.kicker}>{t('home.trustBanner')}</Text>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{t('tabs.categories')}</Text><Pressable onPress={() => router.push('/(buyer)/categories')}><Text style={styles.link}>{t('common.viewAll')} →</Text></Pressable></View>
      {categories.isLoading ? <View style={styles.chipLoading}><ActivityIndicator color={colors.green}/></View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.data?.slice(0, 8).map((category) => <Pressable key={category.id} onPress={() => router.push(`/categories/${category.slug}`)} style={styles.categoryChip}><View style={styles.categoryImage}><Ionicons name={categoryIcon(category.slug, category.name)} size={30} color={colors.ink}/></View><Text style={styles.categoryText} numberOfLines={1}>{categoryLabel(t, category.slug, category.name)}</Text></Pressable>)}</ScrollView>}
    </View>

    <View style={styles.productsHead}><View><Text style={styles.sectionTitle}>{visualMode ? t('home.similarProducts') : term ? t('home.results') : t('home.pickedForYou')}</Text><Text style={styles.sectionSubtitle}>{visualMode ? t('home.visualSubtitle') : term ? t('home.searchSubtitle', { term }) : t('home.featuredSubtitle')}</Text></View>{visualImage && <Pressable onPress={clearVisualSearch} style={styles.visualPreview} accessibilityLabel={t('home.closeVisualSearch')}><Image source={visualImage} style={styles.visualImage} contentFit="cover"/><View style={styles.previewClose}><Ionicons name="close" size={13} color={colors.white}/></View></Pressable>}</View>
  </>

  return <SafeAreaView style={styles.safe} edges={['top']}>
    {stickyHeader}
    <FlatList data={failed || loading ? [] : data} numColumns={2} keyExtractor={(item) => item.id} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.list} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" renderItem={({item}) => <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)}/>} ListEmptyComponent={loading ? <View style={styles.compactState}><View style={styles.stateIcon}><Ionicons name="scan-outline" size={27} color={colors.green}/></View><Text style={styles.stateTitle}>{visualMode ? t('home.analyzingPhoto') : t('common.loading')}</Text><Text style={styles.stateText}>{visualMode ? t('home.visualAnalyzingHint') : t('home.preparingSelection')}</Text><ActivityIndicator color={colors.green}/></View> : failed ? <View style={styles.compactState}><View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={27} color={colors.green}/></View><Text style={styles.stateTitle}>{visualMode ? t('home.imageNotAnalyzed') : t('home.connectionFailed')}</Text><Text style={styles.stateText}>{visualMode ? t('home.visualFailedBody') : t('home.connectionFailedBody')}</Text><Button title={visualMode ? t('home.chooseAnotherImage') : t('common.retry')} onPress={visualMode ? chooseProductImage : () => term ? searchQuery.refetch() : products.refetch()}/></View> : <View style={styles.compactState}><Ionicons name={visualMode ? 'images-outline' : 'search-outline'} size={30} color={colors.muted}/><Text style={styles.stateTitle}>{t('home.noProductsFound')}</Text><Text style={styles.stateText}>{visualMode ? t('home.visualNoProductsBody') : t('home.searchNoProductsBody')}</Text></View>}/>
  </SafeAreaView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, list: { paddingBottom: 28 },
  // web .header: 64px, surface, hairline bottom border
  stickyHeader: { backgroundColor: colors.white, paddingHorizontal: spacing.md, height: 64, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // web .brand-mark: dark pill, Fraunces monogram
  logo: { minWidth: 44, height: 30, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, logoText: { color: colors.onGreen, fontSize: 13, fontFamily: fonts.display, fontWeight: '600', letterSpacing: 1 },
  // web .header-search: surface-2 pill
  searchBox: { flex: 1, height: 40, borderRadius: 999, backgroundColor: colors.surface2, flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 14, paddingRight: 4 }, inputWrap: { flex: 1, minWidth: 60, justifyContent: 'center' }, placeholder: { position: 'absolute', left: 0, right: 0, color: colors.faint, fontSize: 14 }, searchInput: { color: colors.ink, fontSize: 14, paddingVertical: 0, paddingHorizontal: 0 }, cameraButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  menuButton: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // web .home-kicker
  kicker: { paddingHorizontal: spacing.md, marginBottom: 16, color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionBlock: { paddingTop: 24 }, sectionHead: { paddingHorizontal: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 22, fontFamily: fonts.display, fontWeight: '500', letterSpacing: -0.3 }, sectionSubtitle: { color: colors.muted, fontSize: 14, marginTop: 2 }, link: { color: colors.ink, fontWeight: '600', fontSize: 14 },
  // web .category-tile: 72px circle, 14px label
  chips: { paddingHorizontal: spacing.md, gap: 8 }, categoryChip: { width: 84, alignItems: 'center', gap: 8 }, categoryImage: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, categoryText: { color: colors.ink, fontSize: 14, fontWeight: '500', textAlign: 'center' }, chipLoading: { height: 72, justifyContent: 'center' },
  productsHead: { paddingHorizontal: spacing.md, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, visualPreview: { width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: colors.green, overflow: 'visible' }, visualImage: { width: '100%', height: '100%', borderRadius: 14 }, previewClose: { position: 'absolute', right: -6, top: -6, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, productRow: { paddingHorizontal: spacing.md, gap: 12, marginBottom: 12 },
  skeletonGrid: { paddingHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, skeletonCard: { width: '48%', height: 225, borderRadius: radius.md, backgroundColor: colors.white, paddingBottom: 12, overflow: 'hidden' }, skeletonMedia: { height: 150, backgroundColor: colors.surfaceAlt }, skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 12, marginTop: 14 }, skeletonLineShort: { width: '50%', height: 11, borderRadius: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 12, marginTop: 9 },
  compactState: { marginHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: 10 }, stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, stateTitle: { color: colors.ink, fontSize: 19, fontFamily: fonts.display, fontWeight: '500' }, stateText: { color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 310 },
})