import { useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { useAuth } from '../../../src/store/auth'
import { Button, Loading } from '../../../src/components/ui'
import { useI18n, type TranslationKey } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { radius, spacing, type Colors } from '../../../src/theme'
import type { Product, PublicationStatus } from '../../../src/types'
import { formatMoney } from '../../../src/lib/money'

// Port of web-app/src/pages/seller/products/SellerProductsPage.tsx. The list is
// scoped to the ACTIVE shop exactly like web: it is built from that shop's
// inventory (limit 500), with each product's available quantity summed over
// its variants, then filtered client-side by publication status and a 300 ms
// debounced search on name / SKU / description. "Send to marketplace" and
// "Sync" first open a 0-unit stock row for every variant in the active shop,
// then publish; "Unpublish" returns it to DRAFT; "Delete" archives it.
type Translate = ReturnType<typeof useI18n>['t']

const FILTERS: { label: TranslationKey; value: '' | PublicationStatus }[] = [
  { label: 'seller.productList.filterAll', value: '' },
  { label: 'seller.productList.filterPublished', value: 'PUBLISHED' },
  { label: 'seller.productList.filterDrafts', value: 'DRAFT' },
]

function publicationStatusLabel(status: string, t: Translate): string {
  const key = `seller.publicationStatus.${status}`
  const value = t(key as TranslationKey)
  return value === key ? status : value
}

export default function SellerProductsScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<'' | PublicationStatus>('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const inventory = useQuery({
    queryKey: ['seller', 'inventory', activeShop, 'productList'],
    queryFn: () => sellerApi.shopInventory(activeShop!, { limit: 500 }),
    enabled: Boolean(activeBusiness && activeShop),
  })

  const { products, availableByProduct } = useMemo(() => {
    const productsById = new Map<string, Product>()
    const stock: Record<string, number> = {}
    for (const row of inventory.data ?? []) {
      if (!row.product?.id || !row.inventory) continue
      productsById.set(row.product.id, row.product)
      stock[row.product.id] = (stock[row.product.id] || 0) + Math.max(0, row.inventory.available || 0)
    }
    const query = debouncedSearch.toLocaleLowerCase()
    const scoped = Array.from(productsById.values()).filter((product) => {
      if (status && product.publication_status !== status) return false
      if (!query) return true
      return [product.name, product.sku, product.description].some((value) => String(value || '').toLocaleLowerCase().includes(query))
    })
    return { products: scoped, availableByProduct: stock }
  }, [inventory.data, debouncedSearch, status])

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['seller', 'products'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
    ])
  }

  async function sendToMarketplace(product: Product) {
    if (!activeBusiness) return
    if (!activeShop) { setError(t('seller.productList.selectShopFirst')); return }
    setBusyId(product.id); setError('')
    try {
      const variants = await sellerApi.variants(activeBusiness.id, product.id)
      if (variants.length === 0) throw new Error(t('seller.productList.needVariant'))
      await Promise.all(variants.map((variant) => sellerApi.addStock(activeShop, { variant_id: variant.id, quantity: 0, notes: t('seller.productList.noteMarketplaceOffer') })))
      await sellerApi.updateProduct(activeBusiness.id, product.id, { publication_status: 'PUBLISHED', status: 'ACTIVE' })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.productList.sendFailed'))
    } finally { setBusyId('') }
  }

  async function unpublishProduct(product: Product) {
    if (!activeBusiness) return
    setBusyId(product.id); setError('')
    try {
      await sellerApi.updateProduct(activeBusiness.id, product.id, { publication_status: 'DRAFT' })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('seller.productList.unpublishFailed'))
    } finally { setBusyId('') }
  }

  function archiveProduct(product: Product) {
    if (!activeBusiness) return
    Alert.alert(t('seller.productList.delete'), t('seller.productList.archiveConfirm', { name: product.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('seller.productList.delete'), style: 'destructive', onPress: async () => {
        setBusyId(product.id); setError('')
        try {
          await sellerApi.updateProduct(activeBusiness.id, product.id, { status: 'INACTIVE', publication_status: 'ARCHIVED' })
          await reload()
        } catch (err) {
          setError(err instanceof Error ? err.message : t('seller.productList.deleteFailed'))
        } finally { setBusyId('') }
      } },
    ])
  }

  if (!activeBusiness) return <View style={styles.center}>
    <Text style={{ fontSize: 48 }}>📦</Text>
    <Text style={styles.h2}>{t('seller.noBusinessSelected')}</Text>
    <Text style={[styles.muted, styles.centerText]}>{t('seller.productList.noBusinessSubtitle')}</Text>
  </View>

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.head}>
      <Text style={styles.h1}>{t('seller.products')}</Text>
      <Text style={styles.muted}>{t('seller.productList.scopedDesc')}</Text>
      <Button title={t('seller.productList.createProduct')} onPress={() => router.push('/seller/products/create')} />
    </View>

    {!activeShop ? <View style={styles.card}><View style={styles.emptyInline}>
      <Text style={{ fontSize: 40 }}>🏪</Text>
      <Text style={styles.h3}>{t('seller.productList.selectShopTitle')}</Text>
      <Text style={[styles.muted, styles.centerText]}>{t('seller.productList.selectShopDesc')}</Text>
    </View></View> : <>
      <View style={styles.toolbar} accessibilityRole="search">
        <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder={t('seller.productList.searchPlaceholder')} placeholderTextColor={colors.mutedLight} accessibilityLabel={t('seller.productList.searchAria')} autoCapitalize="none" returnKeyType="search" />
        <View style={styles.filters} accessibilityLabel={t('seller.productList.filterAria')}>
          {FILTERS.map((f) => <Pressable key={f.value || 'all'} accessibilityRole="button" accessibilityState={{ selected: status === f.value }} style={[styles.filter, status === f.value && styles.filterActive]} onPress={() => setStatus(f.value)}>
            <Text style={[styles.filterText, status === f.value && styles.filterTextActive]}>{t(f.label)}</Text>
          </Pressable>)}
        </View>
      </View>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      {inventory.isError ? <View style={styles.errorBox}><Text style={styles.errorText}>{inventory.error instanceof Error ? inventory.error.message : t('seller.productList.loadFailed')}</Text></View> : null}

      {inventory.isLoading ? <Loading label={t('seller.productList.loading')} /> : products.length === 0 ? <View style={styles.card}><View style={styles.emptyInline}>
        <Text style={{ fontSize: 40, color: colors.muted }}>⌕</Text>
        <Text style={styles.h3}>{search || status ? t('seller.productList.noMatchTitle') : t('seller.productList.noProductsTitle')}</Text>
        <Text style={[styles.muted, styles.centerText]}>{search || status ? t('seller.productList.noMatchDesc') : t('seller.productList.noProductsDesc')}</Text>
      </View></View> : products.map((product) => {
        const available = availableByProduct[product.id] ?? 0
        const busy = busyId === product.id
        const published = product.publication_status === 'PUBLISHED'
        const base = product.unit_price || 0
        const val = product.discount_value || 0
        const discounted = product.discount_type === 'PERCENTAGE' ? base * (1 - val / 100) : Math.max(0, base - val)
        const currency = (product as Product & { currency?: string }).currency
        return <View key={product.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.badgeOutline} numberOfLines={1}>{product.category_name || t('seller.productList.generalCategory')}</Text>
            <Text style={[styles.badge, published ? { backgroundColor: colors.successSoft, color: colors.success } : { backgroundColor: colors.warningSoft, color: colors.warning }]}>{publicationStatusLabel(product.publication_status, t)}</Text>
          </View>
          <View>
            <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.mono}>{product.sku ? t('seller.productDetail.skuInfo', { sku: product.sku }) : t('seller.productList.noSku')}</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('common.price')}</Text>
              {product.discount_active ? <>
                <Text style={[styles.statValue, { color: colors.green }]}>{formatMoney(discounted, currency)}</Text>
                <Text style={styles.strike}>{formatMoney(Number(product.unit_price), currency)}</Text>
              </> : <Text style={styles.statValue}>{product.unit_price ? formatMoney(Number(product.unit_price), currency) : '—'}</Text>}
            </View>
            <View style={styles.stat}><Text style={styles.statLabel}>{t('seller.productList.availableLabel')}</Text><Text style={[styles.statValue, { color: available > 0 ? colors.success : colors.muted }]}>{available}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>{t('seller.productList.variantsLabel')}</Text><Text style={styles.statValue}>{product.variant_count || 1}</Text></View>
          </View>
          <View style={styles.actions}>
            <Button dense variant="outline" title={t('seller.productList.edit')} onPress={() => router.push(`/seller/products/${product.id}`)} />
            <Button dense title={published ? t('seller.productList.syncMarket') : t('seller.productList.sendToMarket')} disabled={busy} onPress={() => void sendToMarketplace(product)} />
            {published ? <Button dense variant="outline" title={t('seller.productList.unpublish')} disabled={busy} onPress={() => void unpublishProduct(product)} /> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => archiveProduct(product)} style={[styles.danger, busy && { opacity: 0.5 }]}><Text style={styles.dangerText}>{t('seller.productList.delete')}</Text></Pressable>
          </View>
        </View>
      })}
    </>}
  </ScrollView>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: 8 },
  centerText: { textAlign: 'center' },
  head: { gap: 8, alignItems: 'flex-start' },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h2: { fontSize: 20, fontWeight: '700', color: c.ink, textAlign: 'center' },
  h3: { fontSize: 17, fontWeight: '700', color: c.ink, textAlign: 'center' },
  muted: { color: c.muted, fontSize: 14 },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 12, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  emptyInline: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  toolbar: { gap: 10 },
  search: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.borderControl, backgroundColor: c.white, color: c.ink, fontSize: 15 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  filterActive: { backgroundColor: c.green, borderColor: c.green },
  filterText: { color: c.ink, fontWeight: '600', fontSize: 13 },
  filterTextActive: { color: c.onGreen },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger },
  errorText: { color: c.danger },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  badgeOutline: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: c.ink, paddingVertical: 2, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: c.border },
  name: { fontSize: 17, fontWeight: '700', color: c.ink },
  mono: { fontFamily: 'monospace', fontSize: 13, color: c.muted, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 2, padding: 10, borderRadius: 10, backgroundColor: c.surface2 },
  statLabel: { color: c.muted, fontSize: 12 },
  statValue: { color: c.ink, fontWeight: '700', fontSize: 15 },
  strike: { textDecorationLine: 'line-through', fontSize: 12.5, color: c.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  danger: { backgroundColor: c.danger, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 14 },
  dangerText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
})
