import { useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { ProductCard } from '../../src/components/ProductCard'
import { ErrorState, Loading, SectionTitle } from '../../src/components/ui'
import { colors, radius, spacing } from '../../src/theme'

export default function HomeScreen() {
  const [search, setSearch] = useState('')
  const products = useQuery({ queryKey: ['marketplace', 'products'], queryFn: marketplaceApi.products })
  const categories = useQuery({ queryKey: ['marketplace', 'categories'], queryFn: marketplaceApi.categories })
  const searchQuery = useQuery({ queryKey: ['marketplace', 'search', search.trim()], queryFn: () => marketplaceApi.search(search.trim()), enabled: search.trim().length >= 2 })
  const filtered = search.trim().length >= 2 ? (searchQuery.data ?? []) : (products.data ?? [])
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}><Text style={styles.brand}>BTMI Market</Text><Text style={styles.heroTitle}>Find what you need, from trusted shops.</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search products…" placeholderTextColor="#82928C" style={styles.search} returnKeyType="search"/></View>
    <SectionTitle title="Categories"/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.data?.map((category) => <Pressable key={category.id} onPress={() => router.push('/(buyer)/categories')} style={styles.chip}><Text style={styles.chipText}>{category.name}</Text></Pressable>)}</ScrollView>
    <SectionTitle title={search ? 'Search results' : 'Products for you'}/>
    {(products.isLoading || searchQuery.isFetching) ? <Loading label={search ? 'Searching…' : 'Loading products…'}/> : products.isError || searchQuery.isError ? <ErrorState message="Marketplace is temporarily unavailable." retry={() => search ? searchQuery.refetch() : products.refetch()}/> : <FlatList scrollEnabled={false} data={filtered} numColumns={2} columnWrapperStyle={styles.productRow} contentContainerStyle={styles.products} keyExtractor={(item) => item.id} renderItem={({item}) => <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)}/>}/>} 
  </ScrollView>
}
const styles = StyleSheet.create({ page: { paddingBottom: 32, gap: spacing.lg }, hero: { backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }, brand: { color: colors.gold, fontWeight: '900', fontSize: 17 }, heroTitle: { color: colors.white, fontWeight: '900', fontSize: 28, lineHeight: 34, maxWidth: 340 }, search: { marginTop: spacing.sm, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.white, paddingHorizontal: 18, fontSize: 16, color: colors.ink }, chips: { paddingHorizontal: spacing.md, gap: spacing.sm }, chip: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22 }, chipText: { color: colors.green, fontWeight: '800' }, products: { paddingHorizontal: spacing.md, gap: spacing.md }, productRow: { justifyContent: 'space-between', marginBottom: spacing.md }, pageTitle: { paddingHorizontal: spacing.md } })
