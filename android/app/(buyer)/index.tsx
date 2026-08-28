import { useState } from 'react'
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
import { colors, radius, spacing } from '../../src/theme'
import { categoryImage } from '../../src/lib/categoryVisuals'
import type { PublicProduct } from '../../src/types'

function ProductSkeleton() {
  return <View style={styles.skeletonCard}><View style={styles.skeletonMedia}/><View style={styles.skeletonLine}/><View style={styles.skeletonLineShort}/></View>
}

export default function HomeScreen() {
  const [search, setSearch] = useState('')
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
      Alert.alert('Caméra nécessaire', 'Autorisez l’accès à la caméra pour rechercher un produit à partir d’une photo.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .72 })
    if (result.canceled || !result.assets[0]) return
    await analyzeProductImage(result.assets[0])
  }
  const chooseProductImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photos nécessaires', 'Autorisez l’accès aux photos pour choisir l’image d’un objet à rechercher.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .72, selectionLimit: 1 })
    if (result.canceled || !result.assets[0]) return
    await analyzeProductImage(result.assets[0])
  }

  // Fixed header: logo and search only. Rendered outside the FlatList so it
  // stays put while the list scrolls.
  const stickyHeader = (
    <View style={styles.stickyHeader}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.push('/(buyer)')} accessibilityRole="button" accessibilityLabel="TBK — accueil">
          <View style={styles.logo}><Text style={styles.logoText}>TBK</Text></View>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => router.push('/(buyer)/profile')} accessibilityLabel="Ouvrir mon profil"><Ionicons name="person-outline" size={21} color={colors.green}/></Pressable>
      </View>
      <View style={styles.searchBox}><Ionicons name="search" size={20} color={colors.muted}/><TextInput value={search} onChangeText={(value) => { clearVisualSearch(); setSearch(value) }} placeholder="Produit, catégorie ou boutique" placeholderTextColor={colors.mutedLight} style={styles.searchInput} returnKeyType="search" clearButtonMode="while-editing"/>{search.length > 0 && <Pressable onPress={() => setSearch('')} accessibilityLabel="Effacer la recherche"><Ionicons name="close-circle" size={20} color={colors.mutedLight}/></Pressable>}<View style={styles.searchDivider}/><Pressable style={styles.cameraButton} onPress={takeProductPhoto} accessibilityRole="button" accessibilityLabel="Prendre une photo pour rechercher"><Ionicons name="camera-outline" size={22} color={colors.green}/></Pressable><Pressable style={styles.cameraButton} onPress={chooseProductImage} accessibilityRole="button" accessibilityLabel="Choisir une image dans la galerie"><Ionicons name="images-outline" size={21} color={colors.green}/></Pressable></View>
    </View>
  )

  const header = <>
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Catégories</Text><Pressable onPress={() => router.push('/(buyer)/categories')}><Text style={styles.link}>Tout voir</Text></Pressable></View>
      {categories.isLoading ? <View style={styles.chipLoading}><ActivityIndicator color={colors.green}/></View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.data?.slice(0, 8).map((category, index) => <Pressable key={category.id} onPress={() => router.push(`/categories/${category.slug}`)} style={styles.categoryChip}><Image source={categoryImage(category.slug, category.name)} style={styles.categoryImage} contentFit="cover" transition={140}/><Text style={styles.categoryText}>{category.name}</Text></Pressable>)}</ScrollView>}
    </View>

    <View style={styles.productsHead}><View><Text style={styles.sectionTitle}>{visualMode ? 'Produits similaires' : term ? 'Résultats' : 'Sélection pour vous'}</Text><Text style={styles.sectionSubtitle}>{visualMode ? 'Résultats trouvés à partir de votre photo' : term ? `Recherche : “${term}”` : 'Des produits proposés par nos boutiques'}</Text></View>{visualImage && <Pressable onPress={clearVisualSearch} style={styles.visualPreview} accessibilityLabel="Fermer la recherche par photo"><Image source={visualImage} style={styles.visualImage} contentFit="cover"/><View style={styles.previewClose}><Ionicons name="close" size={13} color={colors.white}/></View></Pressable>}</View>
  </>

  return <SafeAreaView style={styles.safe} edges={['top']}>
    {stickyHeader}
    <FlatList data={failed || loading ? [] : data} numColumns={2} keyExtractor={(item) => item.id} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.list} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" renderItem={({item}) => <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)}/>} ListEmptyComponent={loading ? <View style={styles.compactState}><View style={styles.stateIcon}><Ionicons name="scan-outline" size={27} color={colors.green}/></View><Text style={styles.stateTitle}>{visualMode ? 'Analyse de la photo…' : 'Chargement…'}</Text><Text style={styles.stateText}>{visualMode ? 'Nous comparons votre photo aux produits du marché.' : 'Nous préparons votre sélection.'}</Text><ActivityIndicator color={colors.green}/></View> : failed ? <View style={styles.compactState}><View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={27} color={colors.green}/></View><Text style={styles.stateTitle}>{visualMode ? 'Image non analysée' : 'Connexion impossible'}</Text><Text style={styles.stateText}>{visualMode ? 'Vérifiez la connexion au serveur, puis choisissez une autre image nette de l’objet.' : 'Vérifiez que le téléphone et le serveur TBK utilisent le même réseau, puis réessayez.'}</Text><Button title={visualMode ? 'Choisir une autre image' : 'Réessayer'} onPress={visualMode ? chooseProductImage : () => term ? searchQuery.refetch() : products.refetch()}/></View> : <View style={styles.compactState}><Ionicons name={visualMode ? 'images-outline' : 'search-outline'} size={30} color={colors.muted}/><Text style={styles.stateTitle}>Aucun produit trouvé</Text><Text style={styles.stateText}>{visualMode ? 'Essayez une image plus nette, avec l’objet bien centré et suffisamment éclairé.' : 'Essayez un autre nom ou parcourez les catégories.'}</Text></View>}/>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream }, list: { paddingBottom: 28 },
  stickyHeader: { backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 39, height: 39, borderRadius: 19.5, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.white }, logoText: { color: colors.white, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 }, iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  hero: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.md, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 17, gap: 10, overflow: 'hidden' }, kicker: { color: colors.muted, fontSize: 10, letterSpacing: 1.25, fontWeight: '900' }, searchBox: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 6 }, searchInput: { flex: 1, minWidth: 80, color: colors.ink, fontSize: 14, paddingVertical: 0 }, searchDivider: { width: 1, height: 27, backgroundColor: colors.border }, cameraButton: { width: 37, height: 39, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, cameraHint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  sectionBlock: { paddingTop: 24 }, sectionHead: { paddingHorizontal: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' }, sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 }, link: { color: colors.green, fontWeight: '800', fontSize: 13 }, chips: { paddingHorizontal: spacing.md, gap: 10 }, categoryChip: { width: 78, alignItems: 'center', gap: 7 }, categoryImage: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.greenSoft }, categoryText: { color: colors.ink, fontSize: 11, fontWeight: '700', textAlign: 'center' }, chipLoading: { height: 72, justifyContent: 'center' },
  productsHead: { paddingHorizontal: spacing.md, paddingTop: 27, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, visualPreview: { width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: colors.green, overflow: 'visible' }, visualImage: { width: '100%', height: '100%', borderRadius: 14 }, previewClose: { position: 'absolute', right: -6, top: -6, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }, productRow: { paddingHorizontal: spacing.md, gap: 12, marginBottom: 12 },
  skeletonGrid: { paddingHorizontal: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, skeletonCard: { width: '48%', height: 225, borderRadius: radius.md, backgroundColor: colors.white, paddingBottom: 12, overflow: 'hidden' }, skeletonMedia: { height: 150, backgroundColor: colors.surfaceAlt }, skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 12, marginTop: 14 }, skeletonLineShort: { width: '50%', height: 11, borderRadius: 6, backgroundColor: colors.surfaceAlt, marginHorizontal: 12, marginTop: 9 },
  compactState: { marginHorizontal: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: 10 }, stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, stateTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, stateText: { color: colors.muted, textAlign: 'center', lineHeight: 20, maxWidth: 310 },
})
