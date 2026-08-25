import { FlatList, StyleSheet, Text } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { Card, ErrorState, Loading } from '../../src/components/ui'
import { colors, spacing } from '../../src/theme'
export default function CategoriesScreen() {
  const query = useQuery({ queryKey: ['marketplace','categories'], queryFn: marketplaceApi.categories })
  if (query.isLoading) return <Loading label="Chargement des catégories…"/>
  if (query.isError) return <ErrorState message="Impossible de charger les catégories." retry={() => query.refetch()}/>
  return <FlatList data={query.data} contentContainerStyle={styles.list} keyExtractor={(item) => item.id} renderItem={({item}) => <Card onPress={() => router.push(`/categories/${item.slug}`)}><Text style={styles.title}>{item.name}</Text><Text style={styles.subtitle}>Découvrir les produits</Text></Card>}/>
}
const styles = StyleSheet.create({ list: { padding: spacing.md, gap: spacing.sm }, title: { color: colors.ink, fontWeight: '900', fontSize: 18 }, subtitle: { color: colors.muted } })
