import { useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../../src/api'
import { resolveMediaUrl } from '../../../../src/api/client'
import { useAuth } from '../../../../src/store/auth'
import { Button, Loading } from '../../../../src/components/ui'
import { useI18n, type TranslationKey } from '../../../../src/store/i18n'
import { useColors } from '../../../../src/store/theme'
import { radius, type Colors } from '../../../../src/theme'
import type { InventoryItem, Product, ProductImageResponse, ProductVariant } from '../../../../src/types'

// Port of web-app/src/pages/seller/products/ShopProductsPage.tsx
// (/seller/shops/:shopId/products) — what "Open shop" leads to: one shop's
// stock grouped by product, with category / availability / search filters, a
// per-variant breakdown and restock, and a link to the product scoped to the shop.
type Availability = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
type StockState = 'out' | 'low' | 'in'
type Row = { inventory: InventoryItem['inventory'] & { low_stock_threshold?: number }; variant: ProductVariant; product: Product }
interface ShopProductRow { product: Product; variants: Row[]; image?: ProductImageResponse; total: number; reserved: number; available: number }
const stockStatus = (available: number, threshold: number): StockState => available <= 0 ? 'out' : available <= threshold ? 'low' : 'in'

export default function ShopProductsScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const { shopId = '' } = useLocalSearchParams<{ shopId: string }>()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const [category, setCategory] = useState('all')
  const [availability, setAvailability] = useState<Availability>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [restock, setRestock] = useState<Record<string, string>>({})
  const [busyVariant, setBusyVariant] = useState<string | null>(null)
  const [error, setError] = useState('')

  const shop = useQuery({ queryKey: ['seller', 'shop', shopId], queryFn: () => sellerApi.shop(shopId), enabled: Boolean(shopId) })
  const data = useQuery({
    queryKey: ['seller', 'inventory', shopId, 'shopProducts'],
    enabled: Boolean(activeBusiness && shopId),
    queryFn: async () => {
      const inventory = await sellerApi.shopInventory(shopId, { limit: 500 })
      const grouped = new Map<string, ShopProductRow>()
      for (const raw of inventory as unknown as Row[]) {
        if (!raw?.inventory?.product_id || !raw.product || !raw.variant) continue
        const current = grouped.get(raw.inventory.product_id) ?? { product: raw.product, variants: [], total: 0, reserved: 0, available: 0 }
        current.variants.push(raw)
        current.total += Number(raw.inventory.quantity || 0)
        current.reserved += Number(raw.inventory.reserved_quantity || 0)
        current.available += Number(raw.inventory.available)
        grouped.set(raw.inventory.product_id, current)
      }
      const list = Array.from(grouped.values())
      await Promise.all(list.map(async (row) => {
        const images = await sellerApi.productImages(activeBusiness!.id, row.product.id).catch(() => [])
        row.image = images.find((img) => img.is_primary) ?? images[0]
      }))
      return list
    },
  })
  const rows = data.data ?? []
  const threshold = useMemo(() => rows.flatMap((r) => r.variants.map((v) => v.inventory)).find((i) => i.low_stock_threshold != null)?.low_stock_threshold ?? 5, [rows])
  const categories = useMemo(() => Array.from(new Map(rows.filter((r) => r.product.category_id).map((r) => [r.product.category_id!, r.product.category_name || t('seller.shopProducts.categoryFallback')] as const)).entries()), [rows, t])
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (category !== 'all' && row.product.category_id !== category) return false
    if (availability === 'in_stock' && row.available <= threshold) return false
    if (availability === 'low_stock' && (row.available <= 0 || row.available > threshold)) return false
    if (availability === 'out_of_stock' && row.available > 0) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [row.product.name, row.product.sku, ...row.variants.flatMap((v) => [v.variant.sku, v.variant.name, ...Object.values(v.variant.attributes ?? {})])].some((value) => String(value ?? '').toLowerCase().includes(q))
  }), [rows, category, availability, search, threshold])

  const variantLabel = (variant: ProductVariant) => {
    const attrs = Object.entries(variant.attributes ?? {}).map(([key, value]) => `${key}: ${value}`)
    return attrs.length ? attrs.join(' / ') : variant.name || variant.sku || t('seller.shopProducts.defaultVariant')
  }
  const stateTint = (state: StockState) => state === 'out' ? { backgroundColor: colors.dangerSoft, color: colors.danger } : state === 'low' ? { backgroundColor: colors.warningSoft, color: colors.warning } : { backgroundColor: colors.successSoft, color: colors.success }

  async function addStock(row: Row) {
    const quantity = Number(restock[row.variant.id])
    if (!Number.isInteger(quantity) || quantity <= 0) { setError(t('seller.shopProducts.invalidQuantity')); return }
    setBusyVariant(row.variant.id); setError('')
    try {
      await sellerApi.addStock(shopId, { variant_id: row.variant.id, quantity, notes: t('seller.shopProducts.restockNote') })
      setRestock((prev) => ({ ...prev, [row.variant.id]: '' }))
      await queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] })
    } catch (err) { setError(err instanceof Error ? err.message : t('seller.shopProducts.addFailed')) }
    finally { setBusyVariant(null) }
  }

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.h2}>{t('seller.noBusinessSelected')}</Text></View>

  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={{ gap: 4, alignItems: 'flex-start' }}>
      <Pressable accessibilityRole="link" onPress={() => router.push('/seller/shops')}><Text style={styles.link}>{t('seller.shopProducts.backToShops')}</Text></Pressable>
      <Text style={styles.h1}>{t('seller.shopProducts.title', { shop: shop.data?.name ?? t('seller.shopProducts.shopFallback') })}</Text>
      <Text style={styles.muted}>{t('seller.shopProducts.subtitle')}{shop.data?.city ? ` · ${shop.data.city}` : ''}</Text>
      <Button dense title={t('seller.shopProducts.createProduct')} onPress={() => router.push({ pathname: '/seller/products/create', params: { shop: shopId } })} />
    </View>
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
    {data.isError ? <View style={styles.errorBox}><Text style={styles.errorText}>{data.error instanceof Error ? data.error.message : t('seller.shopProducts.loadFailed')}</Text></View> : null}

    <View style={[styles.card, { gap: 10 }]}>
      <TextInput style={styles.input} placeholder={t('seller.shopProducts.searchPlaceholder')} placeholderTextColor={colors.mutedLight} value={search} onChangeText={setSearch} />
      <View style={styles.chips}>
        <Chip label={t('seller.shopProducts.allCategories')} selected={category === 'all'} onPress={() => setCategory('all')} styles={styles} />
        {categories.map(([id, name]) => <Chip key={id} label={name} selected={category === id} onPress={() => setCategory(id)} styles={styles} />)}
      </View>
      <View style={styles.chips}>
        {([['all', t('seller.shopProducts.allAvailability')], ['in_stock', t('stock.inStock')], ['low_stock', t('stock.lowStock')], ['out_of_stock', t('stock.outOfStock')]] as const).map(([value, label]) => <Chip key={value} label={label} selected={availability === value} onPress={() => setAvailability(value)} styles={styles} />)}
      </View>
      <Button dense variant="outline" title={t('seller.shopProducts.refresh')} onPress={() => void data.refetch()} />
    </View>

    {data.isLoading ? <Loading label={t('seller.shopProducts.loading')} /> : visibleRows.length === 0 ? <View style={styles.card}>
      <Text style={styles.h3}>{t('seller.shopProducts.emptyTitle')}</Text>
      <Text style={styles.muted}>{t('seller.shopProducts.emptyBody')}</Text>
    </View> : visibleRows.map((row) => {
      const open = expanded.has(row.product.id)
      const status = stockStatus(row.available, threshold)
      return <View key={row.product.id} style={styles.card}>
        <View style={styles.mainRow}>
          <View style={styles.thumb}>{row.image ? <Image source={resolveMediaUrl(row.image.url)} style={styles.thumbImg} contentFit="cover" /> : <Text style={styles.thumbText}>{row.product.name.slice(0, 2).toUpperCase()}</Text>}</View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.rowBetween}>
              <Text style={[styles.h3, { flex: 1 }]}>{row.product.name}</Text>
              <Text style={[styles.badge, row.product.publication_status === 'PUBLISHED' ? { backgroundColor: colors.successSoft, color: colors.success } : { backgroundColor: colors.warningSoft, color: colors.warning }]}>{t(`seller.publicationStatus.${row.product.publication_status}` as TranslationKey)}</Text>
            </View>
            <Text style={styles.small}>{row.product.category_name || t('seller.shopProducts.uncategorized')} · SKU {row.product.sku || '—'}</Text>
          </View>
        </View>
        <View style={styles.metrics}>
          <Metric label={t('seller.shopProducts.total')} value={row.total} styles={styles} />
          <Metric label={t('seller.shopProducts.reserved')} value={row.reserved} styles={styles} />
          <Metric label={t('seller.shopProducts.available')} value={row.available} styles={styles} />
          <Text style={[styles.badge, stateTint(status)]}>{t(`stock.state.${status}` as TranslationKey)}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.small}>{t(row.variants.length === 1 ? 'seller.shopProducts.variantCount' : 'seller.shopProducts.variantCountPlural', { count: row.variants.length })}</Text>
          <View style={styles.chips}>
            <Button dense variant="outline" title={open ? t('seller.shopProducts.hideVariants') : t('seller.shopProducts.viewVariants')} onPress={() => setExpanded((prev) => { const next = new Set(prev); if (next.has(row.product.id)) next.delete(row.product.id); else next.add(row.product.id); return next })} />
            <Button dense variant="outline" title={t('seller.shopProducts.productDetail')} onPress={() => router.push({ pathname: '/seller/products/[id]', params: { id: row.product.id, shop: shopId } })} />
          </View>
        </View>
        {open ? row.variants.map((item) => {
          const av = Number(item.inventory.available)
          const state = stockStatus(av, threshold)
          return <View key={item.variant.id} style={styles.variantRow}>
            <View style={styles.rowBetween}>
              <Text style={[styles.bold, { flex: 1 }]}>{variantLabel(item.variant)}</Text>
              <Text style={[styles.badge, stateTint(state)]}>{t(`stock.state.${state}` as TranslationKey)}</Text>
            </View>
            <Text style={styles.small}>SKU {item.variant.sku || '—'} · {t('seller.shopProducts.total')} {item.inventory.quantity} · {t('seller.shopProducts.reserved')} {item.inventory.reserved_quantity} · {t('seller.shopProducts.available')} <Text style={styles.bold}>{av}</Text></Text>
            <View style={styles.chips}>
              <TextInput style={[styles.input, { width: 90 }]} placeholder={t('seller.shopProducts.qtyPlaceholder')} placeholderTextColor={colors.mutedLight} keyboardType="number-pad" value={restock[item.variant.id] ?? ''} onChangeText={(v) => setRestock((prev) => ({ ...prev, [item.variant.id]: v }))} />
              <Button dense title={t('seller.shopProducts.add')} disabled={busyVariant === item.variant.id} onPress={() => void addStock(item)} />
            </View>
          </View>
        }) : null}
      </View>
    })}
  </ScrollView>
}

type S = ReturnType<typeof makeStyles>

function Chip({ label, selected, onPress, styles }: { label: string; selected: boolean; onPress: () => void; styles: S }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text></Pressable>
}

function Metric({ label, value, styles }: { label: string; value: number; styles: S }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.bold}>{value}</Text></View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h2: { fontSize: 20, fontWeight: '700', color: c.ink },
  h3: { fontSize: 17, fontWeight: '700', color: c.ink },
  bold: { color: c.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: c.muted, fontSize: 15 },
  small: { color: c.muted, fontSize: 13 },
  link: { color: c.green, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 10, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger },
  errorText: { color: c.danger },
  input: { minHeight: 40, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: c.borderControl, backgroundColor: c.white, color: c.ink, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: c.borderControl, backgroundColor: c.white },
  chipOn: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.ink, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: c.onGreen },
  mainRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 80, height: 80, borderRadius: radius.sm, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 80, height: 80 },
  thumbText: { color: c.muted, fontWeight: '800', fontSize: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  metric: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: c.surface2 },
  metricLabel: { color: c.muted, fontSize: 11 },
  variantRow: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
})
