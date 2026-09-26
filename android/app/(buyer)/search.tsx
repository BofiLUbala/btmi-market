import { useEffect, useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { get } from '../../src/api/client'
import { ProductCard } from '../../src/components/ProductCard'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors, fonts } from '../../src/theme'
import type { TranslationKey } from '../../src/locales/fr'
import type { PublicProduct } from '../../src/types'

/** Same sorts and rating facets as web-app/src/pages/marketplace/SearchPage.tsx. */
const SORTS: Array<{ value: string; key: TranslationKey }> = [
  { value: 'relevance', key: 'search.sort.relevance' as TranslationKey },
  { value: 'price_asc', key: 'search.sort.priceAsc' as TranslationKey },
  { value: 'price_desc', key: 'search.sort.priceDesc' as TranslationKey },
  { value: 'seller_level', key: 'search.sort.topSellers' as TranslationKey },
]
const RATING_FILTERS = [4, 3]

export default function SearchScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('relevance')
  const [minRating, setMinRating] = useState<number | undefined>()
  const [sortOpen, setSortOpen] = useState(false)
  const params = useLocalSearchParams<{ q?: string }>()
  // The header search pushes here with ?q=, like the web /search?q=.
  useEffect(() => {
    if (params.q) { setDraft(params.q); setQ(params.q) }
  }, [params.q])

  const results = useQuery({
    queryKey: ['marketplace', 'search-page', q, sort, minRating],
    queryFn: async () => {
      const params = new URLSearchParams({ q, sort, page: '1', limit: '20' })
      if (minRating) params.set('min_rating', String(minRating))
      const data = await get<{ products?: PublicProduct[]; total?: number } | PublicProduct[]>(`/marketplace/search?${params}`)
      const products = Array.isArray(data) ? data : data?.products ?? []
      return { products, total: Array.isArray(data) ? data.length : data?.total ?? products.length }
    },
    enabled: q.length > 0,
  })
  const searched = q.length > 0 && results.isFetched
  const products = results.data?.products ?? []

  return (
    <FlatList
      data={products}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.head}>
          <Text style={styles.title}>{t('search.title' as TranslationKey)}</Text>
          <View style={styles.form}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => setQ(draft.trim())}
              placeholder={t('search.placeholder' as never)} numberOfLines={1}
              placeholderTextColor={colors.faint}
              returnKeyType="search"
              style={styles.input}
            />
            <Pressable style={styles.submit} accessibilityRole="button" onPress={() => setQ(draft.trim())}>
              <Text style={styles.submitText}>{t('nav.search' as TranslationKey)}</Text>
            </Pressable>
          </View>
          <View style={styles.facets}>
            <Text style={styles.small}>{t('search.customerRating' as TranslationKey)}</Text>
            {RATING_FILTERS.map((r) => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityState={{ selected: minRating === r }}
                onPress={() => setMinRating(minRating === r ? undefined : r)}
                style={[styles.facet, minRating === r && styles.facetOn]}
              >
                <Text style={[styles.facetText, minRating === r && styles.facetTextOn]}>{r}★ {t('search.andUp' as TranslationKey)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.rowBetween}>
            <Text style={[styles.small, styles.flex]}>
              {searched ? t('search.results' as TranslationKey, { total: results.data?.total ?? 0, query: q }) : t('search.typePrompt' as TranslationKey)}
            </Text>
            <Pressable style={styles.select} onPress={() => setSortOpen(true)} accessibilityRole="button">
              <Text style={styles.selectText}>{t(SORTS.find((s) => s.value === sort)!.key)}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.ink} />
            </Pressable>
          </View>
          {searched && products.length === 0 ? <Text style={styles.empty}>{t('search.noResultsQuery' as TranslationKey, { query: q })}</Text> : null}
          <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
            <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)}>
              <View style={styles.sheet}>
                {SORTS.map((s) => (
                  <Pressable key={s.value} style={styles.sheetItem} onPress={() => { setSort(s.value); setSortOpen(false) }}>
                    <Text style={[styles.sheetText, s.value === sort && styles.sheetTextOn]}>{t(s.key)}</Text>
                    {s.value === sort ? <Ionicons name="checkmark" size={18} color={colors.ink} /> : null}
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>
        </View>
      }
      renderItem={({ item }) => <ProductCard product={item} onPress={() => router.push(`/products/${item.id}`)} />}
    />
  )
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    page: { paddingBottom: 28, backgroundColor: c.cream, flexGrow: 1 },
    head: { padding: spacing.md, paddingTop: 24, gap: 12 },
    title: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 30, letterSpacing: -0.4 },
    form: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, paddingHorizontal: 14, color: c.ink, fontSize: 16 },
    submit: { height: 46, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: c.onGreen, fontWeight: '600', fontSize: 14 },
    facets: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    small: { color: c.muted, fontSize: 14 },
    facet: { borderWidth: 1, borderColor: c.border, backgroundColor: c.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    facetOn: { backgroundColor: c.ink, borderColor: c.ink },
    facetText: { color: c.ink, fontSize: 14, fontWeight: '500' },
    facetTextOn: { color: c.onGreen },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    flex: { flex: 1 },
    select: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, paddingHorizontal: 12 },
    selectText: { color: c.ink, fontSize: 15 },
    empty: { color: c.muted, paddingVertical: 32 },
    row: { paddingHorizontal: spacing.md, gap: 12, marginBottom: 12 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 28 },
    sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8 },
    sheetText: { color: c.ink, fontSize: 16 },
    sheetTextOn: { fontWeight: '600' },
  })
