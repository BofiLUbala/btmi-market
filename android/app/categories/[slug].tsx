import { FlatList, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { ProductCard } from '../../src/components/ProductCard'
import { ErrorState, Loading } from '../../src/components/ui'
import { spacing } from '../../src/theme'
export default function CategoryProductsScreen() {
  const { slug } = useLocalSearchParams<{slug:string}>()
  const query = useQuery({ queryKey: ['marketplace','category',slug], queryFn: () => marketplaceApi.categoryProducts(slug!), enabled: Boolean(slug) })
  if (query.isLoading) return <Loading label="Chargement des produits…"/>
  if (query.isError) return <ErrorState message="Cette catégorie n’est pas disponible pour le moment." retry={() => query.refetch()}/>
  return <FlatList data={query.data} numColumns={2} contentContainerStyle={styles.list} columnWrapperStyle={styles.row} keyExtractor={(item) => item.id} renderItem={({item}) => <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)}/>}/>
}
const styles = StyleSheet.create({ list: { padding: spacing.md }, row: { justifyContent: 'space-between', marginBottom: spacing.md } })
