import { useEffect, useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { categoryLabel, subcategoryLabel } from '../../src/lib/categoryLabels'
import { normalizeSearch, searchSession } from '../../src/lib/search'
import { ProductCard } from '../../src/components/ProductCard'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { spacing, type Colors, fonts } from '../../src/theme'
import type { TranslationKey } from '../../src/locales/fr'
import type { Category, PublicProduct, SearchEvent, Shop } from '../../src/types'

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
	const [suggestionQuery, setSuggestionQuery] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('relevance')
  const [minRating, setMinRating] = useState<number | undefined>()
  const [sortOpen, setSortOpen] = useState(false)
  const params = useLocalSearchParams<{ q?: string }>()
  // The header search pushes here with ?q=, like the web /search?q=.
  useEffect(() => {
    if (params.q) { setDraft(params.q); setQ(params.q) }
  }, [params.q])

	useEffect(() => {
		const trimmed = draft.trim()
		if (trimmed.length < 2) { setSuggestionQuery(''); return }
		const timer = setTimeout(() => setSuggestionQuery(trimmed), 300)
		return () => clearTimeout(timer)
	}, [draft])

	// Same contract as the web autocomplete: one debounced request to
	// /search/suggest (react-query cancels the outdated one through `signal`),
	// merged with the cached taxonomy so translated labels match while typing.
	const suggestions = useQuery({
		queryKey: ['marketplace', 'search-suggestions', suggestionQuery],
		queryFn: async ({ signal }) => {
			const [server, categories] = await Promise.all([
				marketplaceApi.suggest(suggestionQuery, signal),
				marketplaceApi.categories().catch(() => [] as Category[]),
			])
			const needle = normalizeSearch(suggestionQuery)
			const taxonomy: Array<{ category: Category; subcategory?: Category }> = []
			const seen = new Set<string>()
			const add = (category: Category, subcategory?: Category) => {
				const key = subcategory ? `sub-${subcategory.id}` : `cat-${category.id}`
				if (seen.has(key)) return
				seen.add(key)
				taxonomy.push({ category, subcategory })
			}
			const byId = new Map(categories.map((category) => [category.id, category]))
			for (const match of server?.categories ?? []) { const category = byId.get(match.id); if (category) add(category) }
			for (const match of server?.subcategories ?? []) {
				const category = match.category_id ? byId.get(match.category_id) : undefined
				const subcategory = category?.subcategories?.find((sub) => sub.id === match.id)
				if (category && subcategory) add(category, subcategory)
			}
			for (const category of categories) {
				if (normalizeSearch(category.name).includes(needle) || normalizeSearch(categoryLabel(t, category.slug, category.name)).includes(needle)) add(category)
				for (const subcategory of category.subcategories ?? []) {
					if (normalizeSearch(subcategory.name).includes(needle) || normalizeSearch(subcategoryLabel(t, subcategory.slug, subcategory.name)).includes(needle)) add(category, subcategory)
				}
			}
			const products = server?.products ?? []
			const shops = server?.shops ?? []
			return {
				products: products.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index).slice(0, 4),
				shops: shops.filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index).slice(0, 2),
				taxonomy: taxonomy.slice(0, 4),
			}
		},
		enabled: suggestionQuery.length >= 2,
		staleTime: 60_000,
	})

	const track = (event: Omit<SearchEvent, 'event_type' | 'session'>) => { void marketplaceApi.searchEvent({ ...event, event_type: 'CLICK', session: searchSession() }) }
	const chooseProduct = (product: PublicProduct, position: number) => { track({ query: suggestionQuery, result_type: 'PRODUCT', result_id: product.id, position }); setSuggestionQuery(''); router.push(`/products/${product.id}`) }
	const chooseShop = (shop: Shop, position: number) => { track({ query: suggestionQuery, result_type: 'SHOP', result_id: shop.id, position }); setSuggestionQuery(''); router.push(`/shops/${shop.id}`) }
	const chooseCategory = (category: Category, subcategory: Category | undefined, position: number) => {
		track({ query: suggestionQuery, result_type: subcategory ? 'SUBCATEGORY' : 'CATEGORY', result_id: (subcategory ?? category).id, position })
		setSuggestionQuery('')
		router.push(`/categories/${category.slug}`)
	}

  const results = useQuery({
    queryKey: ['marketplace', 'search-page', q, sort, minRating],
    queryFn: ({ signal }) => marketplaceApi.searchPage({ q, sort, page: 1, limit: 20, min_rating: minRating, session: searchSession() }, signal),
    enabled: q.length > 0,
  })
  const searched = q.length > 0 && results.isFetched
  const products = results.data?.products ?? []
  const searchId = results.data?.search_id
  const openResult = (product: PublicProduct, position: number) => {
    if (searchId) void marketplaceApi.searchEvent({ search_id: searchId, event_type: 'CLICK', result_type: 'PRODUCT', result_id: product.id, position, session: searchSession() })
    router.push(`/products/${product.id}`)
  }

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
		  {suggestionQuery.length >= 2 && (suggestions.isFetching || suggestions.data) ? (
			<View style={styles.suggestions} accessibilityRole="menu">
			  {suggestions.isFetching ? <Text style={styles.suggestionStatus}>{t('search.searching' as TranslationKey)}</Text> : null}
			  {(suggestions.data?.products ?? []).map((product, i) => <SuggestionRow key={`product-${product.id}`} icon="cube-outline" label={product.name} detail={product.shop_name} onPress={() => chooseProduct(product, i)} colors={colors} />)}
			  {(suggestions.data?.shops ?? []).map((shop, i) => <SuggestionRow key={`shop-${shop.id}`} icon="storefront-outline" label={shop.name} detail={shop.city} onPress={() => chooseShop(shop, i)} colors={colors} />)}
			  {(suggestions.data?.taxonomy ?? []).map(({ category, subcategory }, i) => <SuggestionRow key={`${subcategory ? 'sub' : 'cat'}-${subcategory?.id ?? category.id}`} icon="grid-outline" label={subcategory ? subcategoryLabel(t, subcategory.slug, subcategory.name) : categoryLabel(t, category.slug, category.name)} detail={subcategory ? categoryLabel(t, category.slug, category.name) : t('search.kind.category' as TranslationKey)} onPress={() => chooseCategory(category, subcategory, i)} colors={colors} />)}
			</View>
		  ) : null}
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
              {searched ? t('search.results' as TranslationKey, { total: results.data?.pagination?.total ?? products.length, query: q }) : t('search.typePrompt' as TranslationKey)}
            </Text>
            <Pressable style={styles.select} onPress={() => setSortOpen(true)} accessibilityRole="button">
              <Text style={styles.selectText}>{t(SORTS.find((s) => s.value === sort)!.key)}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.ink} />
            </Pressable>
          </View>
          {searched && products.length > 0 && results.data?.match_mode === 'approximate' ? <Text style={styles.small}>{t('search.approximate' as TranslationKey, { query: q })}</Text> : null}
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
      renderItem={({ item, index }) => <ProductCard product={item} onPress={() => openResult(item, index)} />}
    />
  )
}

function SuggestionRow({ icon, label, detail, onPress, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail?: string; onPress: () => void; colors: Colors }) {
	return <Pressable accessibilityRole="menuitem" onPress={onPress} style={suggestionStyles.row}>
		<Ionicons name={icon} size={18} color={colors.muted} />
		<View style={suggestionStyles.copy}><Text numberOfLines={1} style={[suggestionStyles.label, { color: colors.ink }]}>{label}</Text><Text numberOfLines={1} style={[suggestionStyles.detail, { color: colors.muted }]}>{detail}</Text></View>
		<Ionicons name="chevron-forward" size={16} color={colors.faint} />
	</Pressable>
}

const suggestionStyles = StyleSheet.create({
	row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 7 },
	copy: { flex: 1 }, label: { fontSize: 14, fontWeight: '600' }, detail: { fontSize: 12, marginTop: 2 },
})

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    page: { paddingBottom: 28, backgroundColor: c.cream, flexGrow: 1 },
    head: { padding: spacing.md, paddingTop: 24, gap: 12 },
    title: { color: c.ink, fontFamily: fonts.display, fontWeight: '500', fontSize: 30, letterSpacing: -0.4 },
    form: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, paddingHorizontal: 14, color: c.ink, fontSize: 16 },
		suggestions: { borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.white, overflow: 'hidden' },
		suggestionStatus: { color: c.muted, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
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
