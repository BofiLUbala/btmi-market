import { useMemo } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import Ionicons from '@expo/vector-icons/Ionicons'
import { marketplaceApi } from '../../src/api'
import { Card, ErrorState, Loading } from '../../src/components/ui'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors } from '../../src/theme'
import { categoryLabel, subcategoryLabel } from '../../src/lib/categoryLabels'
import { categoryIcon } from '../../src/lib/categoryIcons'
export default function CategoriesScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const query = useQuery({ queryKey: ['marketplace','categories'], queryFn: marketplaceApi.categories })
  if (query.isLoading) return <Loading label={t('categories.loading')}/>
  if (query.isError) return <ErrorState message={t('categories.loadFailed')} retry={() => query.refetch()}/>
  return <FlatList data={query.data} contentContainerStyle={styles.list} keyExtractor={(item) => item.id} renderItem={({item}) => {
    const subs = (item.subcategories ?? []).slice(0, 3).map((s) => subcategoryLabel(t, s.slug, s.name)).join(' · ')
    return <Card onPress={() => router.push(`/categories/${item.slug}`)}>
      <View style={styles.row}>
        <View style={styles.icon}><Ionicons name={categoryIcon(item.slug, item.name)} size={22} color={colors.ink}/></View>
        <View style={styles.copy}>
          <Text style={styles.title}>{categoryLabel(t, item.slug, item.name)}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subs || t('cart.discover')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted}/>
      </View>
    </Card>
  }}/>
}
const makeStyles = (colors: Colors) => StyleSheet.create({ list: { padding: spacing.md, gap: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft }, copy: { flex: 1, minWidth: 0 }, title: { color: colors.ink, fontWeight: '700', fontSize: 18 }, subtitle: { color: colors.muted } })
