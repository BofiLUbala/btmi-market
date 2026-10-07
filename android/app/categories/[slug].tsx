import { useMemo } from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { ProductCard } from '../../src/components/ProductCard'
import { ErrorState, Loading } from '../../src/components/ui'
import { useProductGrid } from '../../src/lib/productGrid'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'

export default function CategoryProductsScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const { slug } = useLocalSearchParams<{ slug: string }>()
  // Four to six listings across on a desktop, two on a phone: a fixed two
  // columns made each card half the screen wide, with a square photo as tall.
  const { columns, cardStyle } = useProductGrid()
  const query = useQuery({ queryKey: ['marketplace', 'category', slug], queryFn: () => marketplaceApi.categoryProducts(slug!), enabled: Boolean(slug) })
  if (query.isLoading) return <Loading label={t('categories.productsLoading')}/>
  if (query.isError) return <ErrorState message={t('categories.unavailable')} retry={() => query.refetch()}/>
  return (
    <FlatList
      // A FlatList cannot change numColumns in place; a new key remounts it.
      key={`category-grid-${columns}`}
      data={query.data}
      numColumns={columns}
      style={styles.screen}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ProductCard product={item} style={cardStyle} onPress={() => router.push(`/products/${item.id}`)}/>}
    />
  )
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: { backgroundColor: colors.cream },
  list: { padding: spacing.md, paddingBottom: 28 },
  row: { gap: 12, marginBottom: 12 },
})
