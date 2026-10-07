import { useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { confirmAction } from '../../../src/lib/confirmAction'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { useAuth } from '../../../src/store/auth'
import { Button, Loading } from '../../../src/components/ui'
import { useI18n, type TranslationKey } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { radius, shadow, spacing, type Colors, fonts } from '../../../src/theme'
import type { Product, PublicationStatus } from '../../../src/types'
import { formatMoney } from '../../../src/lib/money'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image } from 'expo-image'
import { resolveMediaUrl } from '../../../src/api/client'

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
    confirmAction(t('seller.productList.delete'), t('seller.productList.archiveConfirm', { name: product.name }), [
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
    <View style={styles.emptyIcon}><Ionicons name="cube-outline" size={28} color={colors.green} /></View>
    <Text style={styles.h2}>{t('seller.noBusinessSelected')}</Text>
    <Text style={[styles.muted, styles.centerText]}>{t('seller.productList.noBusinessSubtitle')}</Text>
  </View>

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.head}>
      <Text style={styles.h1}>{t('seller.products')}</Text>
      <Text style={styles.muted}>{t('seller.productList.scopedDesc')}</Text>
      <Button style={styles.createBtn} title={t('seller.productList.createProduct')} onPress={() => router.push('/seller/products/create')} />
    </View>

    {!activeShop ? <View style={styles.card}><View style={styles.emptyInline}>
      <View style={styles.emptyIcon}><Ionicons name="storefront-outline" size={28} color={colors.green} /></View>
      <Text style={styles.h3}>{t('seller.productList.selectShopTitle')}</Text>
      <Text style={[styles.muted, styles.centerText]}>{t('seller.productList.selectShopDesc')}</Text>
    </View></View> : <>
      <View style={styles.toolbar} accessibilityRole="search">
        <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder={t('seller.productList.searchPlaceholder')} placeholderTextColor={colors.mutedLight} numberOfLines={1} multiline={false} accessibilityLabel={t('seller.productList.searchAria')} autoCapitalize="none" returnKeyType="search" />
        <View style={styles.filters} accessibilityLabel={t('seller.productList.filterAria')}>
          {FILTERS.map((f) => <Pressable key={f.value || 'all'} accessibilityRole="button" accessibilityState={{ selected: status === f.value }} style={[styles.filter, status === f.value && styles.filterActive]} onPress={() => setStatus(f.value)}>
            <Text style={[styles.filterText, status === f.value && styles.filterTextActive]}>{t(f.label)}</Text>
          </Pressable>)}
        </View>
      </View>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      {inventory.isError ? <View style={styles.errorBox}><Text style={styles.errorText}>{inventory.error instanceof Error ? inventory.error.message : t('seller.productList.loadFailed')}</Text></View> : null}

      {inventory.isLoading ? <Loading label={t('seller.productList.loading')} /> : products.length === 0 ? <View style={styles.card}><View style={styles.emptyInline}>
        <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>⌕</Text></View>
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
          {/* Article row: rounded thumb tile, name + SKU, status pill */}
          <View style={styles.itemRow}>
            <ProductThumb businessId={activeBusiness.id} productId={product.id} colors={colors} styles={styles} />
            <View style={styles.itemMain}>
              <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
              <Text style={styles.mono} numberOfLines={1}>{product.sku ? t('seller.productDetail.skuInfo', { sku: product.sku }) : t('seller.productList.noSku')}</Text>
              <Text style={styles.badgeOutline} numberOfLines={1}>{product.category_name || t('seller.productList.generalCategory')}</Text>
            </View>
            <Text style={[styles.badge, published ? styles.badgeOnline : styles.badgeDraft]}>{publicationStatusLabel(product.publication_status, t)}</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('common.price')}</Text>
              {product.discount_active ? <>
                <Text style={[styles.statValue, { color: colors.green }]}>{formatMoney(discounted, currency)}</Text>
                <Text style={styles.strike}>{formatMoney(Number(product.unit_price), currency)}</Text>
              </> : <Text style={[styles.statValue, { color: colors.green }]}>{product.unit_price ? formatMoney(Number(product.unit_price), currency) : '—'}</Text>}
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
  page: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: 8 },
  centerText: { textAlign: 'center' },
  head: { gap: 6, alignItems: 'stretch', marginBottom: 4 },
  h1: { fontSize: 22, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: c.ink },
  h2: { fontSize: 20, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: c.ink, textAlign: 'center' },
  h3: { fontSize: 16, fontWeight: '700', color: c.ink, textAlign: 'center' },
  muted: { color: c.muted, fontSize: 13.5, lineHeight: 19 },
  createBtn: { marginTop: 6 },
  // White rounded card with the reference's soft lift.
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: 14, gap: 12, ...shadow.card },
  emptyInline: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyIcon: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyGlyph: { fontSize: 28, color: c.green, fontWeight: '700' },
  toolbar: { gap: 10 },
  search: { minHeight: 48, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.white, color: c.ink, fontSize: 15, ...shadow.card },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  filterActive: { backgroundColor: c.navy, borderColor: c.navy },
  filterText: { color: c.ink, fontWeight: '600', fontSize: 13 },
  filterTextActive: { color: c.onNavy },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger },
  errorText: { color: c.danger },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  itemMain: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  badge: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden' },
  badgeOnline: { backgroundColor: c.successSoft, color: c.success },
  badgeDraft: { backgroundColor: c.surface2, color: c.muted },
  badgeOutline: { maxWidth: '100%', fontSize: 11.5, fontWeight: '600', color: c.muted, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: c.border, marginTop: 2 },
  name: { fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.1 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: c.muted },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 2, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: c.surface2 },
  statLabel: { color: c.muted, fontSize: 11.5 },
  statValue: { color: c.ink, fontWeight: '700', fontSize: 15 },
  strike: { textDecorationLine: 'line-through', fontSize: 12.5, color: c.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  danger: { backgroundColor: c.danger, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 14 },
  dangerText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
})

/** The product's primary photo (same query and cache entry as the dashboard's
 *  article rows); the cube icon only while there is none. */
function ProductThumb({ businessId, productId, colors, styles }: { businessId: string; productId: string; colors: Colors; styles: ReturnType<typeof makeStyles> }) {
  const images = useQuery({ queryKey: ['seller', 'productImages', productId], queryFn: () => sellerApi.productImages(businessId, productId).catch(() => []) })
  const main = (images.data ?? []).find((img) => img.is_primary) ?? images.data?.[0]
  return <View style={styles.thumb}>
    {main ? <Image source={resolveMediaUrl(main.url)} style={styles.thumbImg} contentFit="cover" /> : <Ionicons name="cube-outline" size={24} color={colors.green} />}
  </View>
}
