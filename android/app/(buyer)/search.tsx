import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router, Tabs, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { marketplaceApi } from '../../src/api'
import { resolveMediaUrl } from '../../src/api/client'
import { categoryLabel, subcategoryLabel } from '../../src/lib/categoryLabels'
import { categoryImage } from '../../src/lib/categoryVisuals'
import { normalizeSearch, searchSession } from '../../src/lib/search'
import { resolvePromotion } from '../../src/lib/promotion'
import { formatMoney } from '../../src/lib/money'
import { buildAttributeGroups, describeAttributes } from '../../src/lib/variants'
import { useCart } from '../../src/store/cart'
import { useI18n } from '../../src/store/i18n'
import { useColors } from '../../src/store/theme'
import { kicker, radius, shadow, spacing, type Colors, fonts } from '../../src/theme'
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
  // Blue field border while the search input has focus.
  const [focused, setFocused] = useState(false)
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
  const trackAdd = (product: PublicProduct, position: number) => {
    if (searchId) void marketplaceApi.searchEvent({ search_id: searchId, event_type: 'ADD_TO_CART', result_type: 'PRODUCT', result_id: product.id, position, session: searchSession() })
  }
  const submit = () => setQ(draft.trim())
  const goBack = () => (router.canGoBack() ? router.back() : router.push('/(buyer)'))
  const priceAscOn = sort === 'price_asc'

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Tabs.Screen options={{ headerShown: false }} />
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.head}>
            <View style={styles.form}>
              <Pressable style={styles.back} onPress={goBack} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={6}>
                <Ionicons name="chevron-back" size={20} color={colors.ink} />
              </Pressable>
              <View style={[styles.field, focused && styles.fieldFocused]}>
                <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel={t('nav.search' as TranslationKey)} hitSlop={6}>
                  <Ionicons name="search-outline" size={18} color={focused ? colors.green : colors.muted} />
                </Pressable>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={submit}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder={t('search.placeholder' as never)} numberOfLines={1}
                  placeholderTextColor={colors.faint}
                  returnKeyType="search"
                  accessibilityLabel={t('search.title' as TranslationKey)}
                  style={styles.input}
                />
                {draft ? <Pressable onPress={() => setDraft('')} hitSlop={8} accessibilityLabel={t('home.clearSearch')}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
              </View>
            </View>
		  {suggestionQuery.length >= 2 && (suggestions.isFetching || suggestions.data) ? (
			<View style={styles.suggestions} accessibilityRole="menu">
			  {suggestions.isFetching ? <Text style={styles.suggestionStatus}>{t('search.searching' as TranslationKey)}</Text> : null}
			  {(suggestions.data?.products ?? []).map((product, i) => <SuggestionRow key={`product-${product.id}`} icon="cube-outline" label={product.name} detail={product.shop_name} onPress={() => chooseProduct(product, i)} colors={colors} />)}
			  {(suggestions.data?.shops ?? []).map((shop, i) => <SuggestionRow key={`shop-${shop.id}`} icon="storefront-outline" label={shop.name} detail={shop.city} onPress={() => chooseShop(shop, i)} colors={colors} />)}
			  {(suggestions.data?.taxonomy ?? []).map(({ category, subcategory }, i) => <SuggestionRow key={`${subcategory ? 'sub' : 'cat'}-${subcategory?.id ?? category.id}`} icon="grid-outline" label={subcategory ? subcategoryLabel(t, subcategory.slug, subcategory.name) : categoryLabel(t, category.slug, category.name)} detail={subcategory ? categoryLabel(t, category.slug, category.name) : t('search.kind.category' as TranslationKey)} onPress={() => chooseCategory(category, subcategory, i)} colors={colors} />)}
			</View>
		  ) : null}
            {/* Chips: "Filtres" opens the sort + rating sheet; the others are shortcuts onto the same state. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.facets} keyboardShouldPersistTaps="handled">
              <Pressable style={styles.filtersChip} onPress={() => setSortOpen(true)} accessibilityRole="button">
                <Ionicons name="options-outline" size={14} color={colors.onNavy} />
                <Text style={styles.filtersChipText}>{t('browse.filters')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: priceAscOn }}
                onPress={() => setSort(priceAscOn ? 'relevance' : 'price_asc')}
                style={[styles.facet, priceAscOn && styles.facetOn]}
              >
                <Text style={[styles.facetText, priceAscOn && styles.facetTextOn]}>{t('browse.priceAsc')}</Text>
              </Pressable>
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
            </ScrollView>
            <Text style={styles.small}>
              {searched ? t('search.results' as TranslationKey, { total: results.data?.pagination?.total ?? products.length, query: q }) : t('search.typePrompt' as TranslationKey)}
            </Text>
            {q.length > 0 && results.isFetching ? <ActivityIndicator color={colors.green} /> : null}
            {searched && products.length > 0 && results.data?.match_mode === 'approximate' ? <Text style={styles.small}>{t('search.approximate' as TranslationKey, { query: q })}</Text> : null}
            {searched && products.length === 0 ? <Text style={styles.empty}>{t('search.noResultsQuery' as TranslationKey, { query: q })}</Text> : null}
            <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
              <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)}>
                <View style={styles.sheet}>
                  <View style={styles.sheetHandle} />
                  <Text style={styles.sheetTitle}>{t('browse.filters')}</Text>
                  {SORTS.map((s) => (
                    <Pressable key={s.value} style={styles.sheetItem} onPress={() => { setSort(s.value); setSortOpen(false) }}>
                      <Text style={[styles.sheetText, s.value === sort && styles.sheetTextOn]}>{t(s.key)}</Text>
                      {s.value === sort ? <Ionicons name="checkmark" size={18} color={colors.green} /> : null}
                    </Pressable>
                  ))}
                  <Text style={styles.sheetLabel}>{t('search.customerRating' as TranslationKey)}</Text>
                  <View style={styles.sheetChips}>
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
                </View>
              </Pressable>
            </Modal>
          </View>
        }
        renderItem={({ item, index }) => <SearchResultCard product={item} onOpen={() => openResult(item, index)} onAdded={() => trackAdd(item, index)} />}
        ListFooterComponent={searched ? (
          <Pressable style={({ pressed }) => [styles.alert, pressed && styles.pressed]} onPress={() => router.push('/(buyer)/categories')} accessibilityRole="button">
            <View style={styles.alertIcon}><Ionicons name="notifications-outline" size={18} color={colors.onGreen} /></View>
            <View style={styles.flex}>
              <Text style={styles.alertTitle}>{t('browse.cantFind')}</Text>
              <Text style={styles.alertBody}>{t('browse.cantFindBody')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.onNavyMuted} />
          </Pressable>
        ) : null}
      />
    </SafeAreaView>
  )
}

const productPhoto = (product: PublicProduct) => {
  const first = product.images?.[0]
  return resolveMediaUrl(product.primary_image_url || product.image_url || (typeof first === 'string' ? first : first?.url || first?.image_url))
}

/**
 * Reference result row: square thumb, blue kicker, name, shop, blue price and
 * a "+" that adds straight to the cart when the product has a single variant
 * with nothing to choose (the same rule as the product page); otherwise it
 * opens the product so the buyer picks the option there.
 */
function SearchResultCard({ product, onOpen, onAdded }: { product: PublicProduct; onOpen: () => void; onAdded: () => void }) {
  const { t } = useI18n()
  const c = useColors()
  const s = useMemo(() => makeCardStyles(c), [c])
  const queryClient = useQueryClient()
  const add = useCart((state) => state.add)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const image = productPhoto(product)
  const outOfStock = product.availability === 'OUT_OF_STOCK'
  const promotion = resolvePromotion(product, product.base_price || product.price || 0)
  const price = promotion.effectivePrice || product.sale_price || product.price || product.base_price || 0
  const onSale = promotion.phase === 'active' && promotion.discountPercent > 0

  const quickAdd = async () => {
    if (busy) return
    setBusy(true)
    try {
      const detail = await queryClient.fetchQuery({ queryKey: ['marketplace', 'product', product.id], queryFn: () => marketplaceApi.product(product.id) })
      const variants = detail.variants ?? []
      const only = variants.length === 1 && buildAttributeGroups(variants).length === 0 ? variants[0] : undefined
      const stock = only ? (only.stock_quantity ?? only.available_stock ?? only.stock_available ?? 0) : 0
      if (!only || stock <= 0) { onOpen(); return }
      const regular = only.base_price || only.price || detail.base_price || detail.price || 0
      const promo = resolvePromotion({ ...detail, seller_sale_price: only.sale_price ?? only.unit_price }, regular)
      const linePrice = promo.effectivePrice || only.sale_price || only.unit_price || only.price || detail.sale_price || detail.price || detail.base_price || 0
      add({
        productId: detail.id,
        variantId: only.id,
        name: detail.name,
        variantName: describeAttributes(only),
        shopId: detail.shop_id || product.shop_id || '',
        shopName: detail.shop_name || product.shop_name || '',
        price: linePrice,
        quantity: 1,
        image: image ?? undefined,
      })
      onAdded()
      setAdded(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setAdded(false), 1800)
    } catch {
      onOpen()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [s.card, pressed && s.pressed]} accessibilityRole="button">
      <Image source={image ?? categoryImage(product.category_slug, product.category_name)} style={[s.thumb, outOfStock && s.thumbOut]} contentFit="cover" transition={150} />
      <View style={s.body}>
        {product.category_name ? <Text numberOfLines={1} style={s.kicker}>{categoryLabel(t, product.category_slug, product.category_name)}</Text> : null}
        <Text numberOfLines={2} style={[s.name, outOfStock && s.muted]}>{product.name}</Text>
        <Text numberOfLines={1} style={s.shop}>{product.shop_name || t('product.aSeller')}</Text>
        {outOfStock ? <Text style={s.out}>{t('stock.outOfStock')}</Text> : null}
        <View style={s.priceRow}>
          <Text style={[s.price, onSale && s.salePrice, outOfStock && s.muted]}>{formatMoney(price, product.currency)}</Text>
          {onSale ? <Text style={s.strike}>{formatMoney(promotion.originalPrice, product.currency)}</Text> : null}
        </View>
      </View>
      {!outOfStock ? (
        <Pressable
          onPress={quickAdd}
          disabled={busy}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={added ? t('browse.addedToCart') : t('product.addToCart')}
          style={({ pressed }) => [s.plus, added && s.plusDone, pressed && s.pressed]}
        >
          {busy ? <ActivityIndicator size="small" color={c.onGreen} /> : <Ionicons name={added ? 'checkmark' : 'add'} size={18} color={c.onGreen} />}
        </Pressable>
      ) : null}
    </Pressable>
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

const makeCardStyles = (c: Colors) =>
  StyleSheet.create({
    card: { marginHorizontal: spacing.md, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: c.white, borderWidth: 1, borderColor: c.border, ...shadow.card },
    pressed: { opacity: 0.88 },
    thumb: { width: 84, height: 84, borderRadius: radius.sm, backgroundColor: c.surfaceAlt },
    thumbOut: { opacity: 0.5 },
    body: { flex: 1, minWidth: 0, gap: 2 },
    kicker: { ...kicker, fontSize: 9.5, color: c.green },
    name: { color: c.ink, fontSize: 14, fontWeight: '700', lineHeight: 18 },
    muted: { color: c.muted },
    shop: { color: c.muted, fontSize: 11.5 },
    out: { color: c.danger, fontSize: 11, fontWeight: '700' },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 },
    price: { color: c.green, fontFamily: fonts.display, fontWeight: '700', fontSize: 16 },
    salePrice: { color: c.danger },
    strike: { color: c.muted, fontSize: 11.5, textDecorationLine: 'line-through' },
    plus: { alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 10, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
    plusDone: { backgroundColor: c.success },
  })

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.cream },
    page: { paddingBottom: 28, flexGrow: 1 },
    pressed: { opacity: 0.88 },
    flex: { flex: 1, minWidth: 0 },
    head: { padding: spacing.md, paddingTop: 10, gap: 12 },
    form: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    back: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, alignItems: 'center', justifyContent: 'center' },
    // Reference search field: white rounded-12, blue border while focused
    field: { flex: 1, height: 44, borderRadius: radius.sm, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.white, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldFocused: { borderColor: c.green },
    input: { flex: 1, height: '100%', paddingVertical: 0, color: c.ink, fontSize: 15 },
		suggestions: { borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, backgroundColor: c.white, overflow: 'hidden', ...shadow.card },
		suggestionStatus: { color: c.muted, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
    // Filter chips: leading navy "Filtres" pill, then white chips (selected = navy)
    facets: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
    filtersChip: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: c.navy, paddingHorizontal: 13 },
    filtersChipText: { color: c.onNavy, fontSize: 12.5, fontWeight: '700' },
    small: { color: c.muted, fontSize: 12.5 },
    facet: { height: 34, justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.white, borderRadius: radius.pill, paddingHorizontal: 14 },
    facetOn: { backgroundColor: c.navy, borderColor: c.navy },
    facetText: { color: c.ink, fontSize: 12.5, fontWeight: '600' },
    facetTextOn: { color: c.onNavy },
    empty: { color: c.muted, paddingVertical: 12, textAlign: 'center' },
    // "Can't find it?" card: navy alert block like the reference
    alert: { marginHorizontal: spacing.md, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: c.navy },
    alertIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center' },
    alertTitle: { color: c.onNavy, fontSize: 13.5, fontWeight: '700' },
    alertBody: { color: c.onNavyMuted, fontSize: 12, lineHeight: 17, marginTop: 2 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.md, paddingBottom: 28 },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: 12 },
    sheetTitle: { color: c.ink, fontFamily: fonts.display, fontWeight: '700', fontSize: 18, marginBottom: 4 },
    sheetItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 4 },
    sheetText: { color: c.ink, fontSize: 15 },
    sheetTextOn: { fontWeight: '700', color: c.green },
    sheetLabel: { ...kicker, color: c.muted, marginTop: 10, marginBottom: 8 },
    sheetChips: { flexDirection: 'row', gap: 8 },
  })
