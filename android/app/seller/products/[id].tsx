import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../../src/components/ui'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { spacing, type Colors } from '../../../src/theme'

export default function SellerProductDetailScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const { id: productId = '' } = useLocalSearchParams<{ id: string }>()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)

  const product = useQuery({ queryKey: ['seller', 'product', productId], queryFn: () => sellerApi.product(activeBusiness!.id, productId), enabled: Boolean(activeBusiness && productId) })
  const variants = useQuery({ queryKey: ['seller', 'variants', productId], queryFn: () => sellerApi.variants(activeBusiness!.id, productId), enabled: Boolean(activeBusiness && productId) })
  const inventory = useQuery({ queryKey: ['seller', 'inventory', activeShop], queryFn: () => sellerApi.shopInventory(activeShop!), enabled: Boolean(activeShop) })

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', sku: '', unit: 'PCS', unit_price: '', cost_price: '', description: '' })
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', sale_price: '', purchase_price: '', stock: '0' })
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!product.data) return
    setForm({
      name: product.data.name, sku: product.data.sku ?? '', unit: product.data.unit ?? 'PCS',
      unit_price: String(product.data.unit_price ?? ''), cost_price: product.data.cost_price ? String(product.data.cost_price) : '',
      description: product.data.description ?? '',
    })
  }, [product.data?.id])

  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: ['seller', 'product', productId] }); void queryClient.invalidateQueries({ queryKey: ['seller', 'variants', productId] }); void queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] }); void queryClient.invalidateQueries({ queryKey: ['seller', 'products'] }) }

  const save = useMutation({
    mutationFn: () => sellerApi.updateProduct(activeBusiness!.id, productId, {
      name: form.name.trim(), sku: form.sku.trim() || undefined, unit: form.unit.trim() || 'PCS',
      unit_price: parseFloat(form.unit_price), cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
      description: form.description.trim() || undefined,
    }),
    onMutate: () => setError(''),
    onSuccess: () => { setEditing(false); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.productDetail.updateFailed')),
  })

  const togglePublish = useMutation({
    mutationFn: () => sellerApi.updateProduct(activeBusiness!.id, productId, { publication_status: product.data!.publication_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED', status: product.data!.publication_status === 'PUBLISHED' ? undefined : 'ACTIVE' }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.productDetail.publishFailed')),
  })

  const addVariant = useMutation({
    mutationFn: async () => {
      const created = await sellerApi.createVariant(activeBusiness!.id, productId, {
        name: variantForm.name.trim(), sku: variantForm.sku.trim() || undefined,
        sale_price: parseFloat(variantForm.sale_price), purchase_price: variantForm.purchase_price ? parseFloat(variantForm.purchase_price) : undefined,
      })
      const stock = Math.max(0, parseInt(variantForm.stock, 10) || 0)
      if (activeShop && stock > 0) await sellerApi.addStock(activeShop, { variant_id: created.id, quantity: stock, notes: t('seller.productForm.initialStock') })
      return created
    },
    onMutate: () => setError(''),
    onSuccess: () => { setShowAddVariant(false); setVariantForm({ name: '', sku: '', sale_price: '', purchase_price: '', stock: '0' }); invalidate() },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('seller.productDetail.createVariantFailed')),
  })

  const addStock = useMutation({
    mutationFn: (variantId: string) => sellerApi.addStock(activeShop!, { variant_id: variantId, quantity: Math.max(0, parseInt(stockByVariant[variantId] ?? '0', 10) || 0), notes: t('seller.productDetail.noteRestock') }),
    onSuccess: (_r, variantId) => { setStockByVariant((prev) => ({ ...prev, [variantId]: '' })); invalidate() },
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.productDetail.addStockFailed')),
  })

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (product.isLoading) return <Loading label={t('seller.productDetail.loading')} />
  if (product.isError || !product.data) return <ErrorState message={t('seller.productDetail.notFound')} retry={() => void product.refetch()} />

  const p = product.data
  const stockByVariantId = new Map((inventory.data ?? []).map((i) => [i.inventory.variant_id, i]))

  return <ScrollView contentContainerStyle={styles.page}>
    <SectionTitle title={p.name} />
    {error ? <Text style={styles.error}>{error}</Text> : null}

    <Card>
      <View style={styles.row}>
        <Text style={[styles.badge, p.publication_status !== 'PUBLISHED' && styles.badgeMuted]}>{t(`seller.publicationStatus.${p.publication_status}` as any)}</Text>
        <Button dense variant={p.publication_status === 'PUBLISHED' ? 'outline' : 'primary'} loading={togglePublish.isPending} title={p.publication_status === 'PUBLISHED' ? t('seller.productDetail.unpublish') : t('seller.productDetail.publishToMarketplace')} onPress={() => togglePublish.mutate()} />
      </View>
      {!editing ? <>
        <Text style={styles.muted}>{t('seller.productDetail.basePrice', { price: (p.unit_price ?? 0).toLocaleString() })}</Text>
        <Text style={styles.muted}>{t('seller.productDetail.unitLabel', { unit: p.unit || 'PCS' })}</Text>
        {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
        <Button variant="outline" dense title={t('seller.productDetail.editSettings')} onPress={() => setEditing(true)} />
      </> : <>
        <Field label={t('seller.productDetail.productNameRequired')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
        <Field label={t('seller.productDetail.salePriceRequired')} value={form.unit_price} onChangeText={(v) => setForm((f) => ({ ...f, unit_price: v }))} keyboardType="numeric" />
        <Field label="SKU" value={form.sku} onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))} autoCapitalize="none" />
        <Field label={t('product.unit')} value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} autoCapitalize="characters" />
        <Field label={t('seller.productForm.costPriceOptional')} value={form.cost_price} onChangeText={(v) => setForm((f) => ({ ...f, cost_price: v }))} keyboardType="numeric" />
        <Field label={t('product.description')} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
        <Button title={t('seller.productDetail.saveProductChanges')} loading={save.isPending} onPress={() => save.mutate()} />
        <Button variant="outline" title={t('common.cancel')} onPress={() => setEditing(false)} />
      </>}
    </Card>

    <SectionTitle title={t('seller.productDetail.variantsInventoryDesc')} action={<Button dense title={showAddVariant ? t('common.cancel') : t('seller.productDetail.addVariant')} onPress={() => setShowAddVariant((v) => !v)} />} />

    {showAddVariant && <Card>
      <Field label={t('seller.productDetail.variantNameRequired')} value={variantForm.name} onChangeText={(v) => setVariantForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
      <Field label="SKU" value={variantForm.sku} onChangeText={(v) => setVariantForm((f) => ({ ...f, sku: v }))} autoCapitalize="none" />
      <Field label={t('seller.productDetail.salePriceRequired')} value={variantForm.sale_price} onChangeText={(v) => setVariantForm((f) => ({ ...f, sale_price: v }))} keyboardType="numeric" />
      <Field label={t('seller.productDetail.initialStockQty')} value={variantForm.stock} onChangeText={(v) => setVariantForm((f) => ({ ...f, stock: v }))} keyboardType="numeric" />
      <Button title={t('seller.productDetail.saveVariant')} loading={addVariant.isPending} onPress={() => addVariant.mutate()} />
    </Card>}

    {variants.isLoading ? <Loading label={t('common.loading')} /> : !variants.data?.length ? <Card><Text style={styles.muted}>{t('seller.productDetail.noVariantsFound')}</Text></Card> : variants.data.map((variant) => {
      const inv = stockByVariantId.get(variant.id)
      return <Card key={variant.id}>
        <Text style={styles.name}>{variant.name || t('seller.productDetail.defaultVariant')}</Text>
        <Text style={styles.muted}>{variant.sku || '—'} · {(variant.sale_price ?? 0).toLocaleString()} FC</Text>
        <Text style={styles.muted}>{activeShop ? t('seller.productList.availableLabel') + ': ' + (inv?.inventory.available ?? 0) : t('seller.productDetail.selectShopLocation')}</Text>
        {activeShop && <View style={styles.row}>
          <View style={styles.flex1}><Field label={t('seller.productDetail.qtyPlaceholder')} value={stockByVariant[variant.id] ?? ''} onChangeText={(v) => setStockByVariant((prev) => ({ ...prev, [variant.id]: v }))} keyboardType="numeric" /></View>
          <Button dense loading={addStock.isPending && addStock.variables === variant.id} title={t('seller.stockPage.add')} onPress={() => addStock.mutate(variant.id)} />
        </View>}
      </Card>
    })}
  </ScrollView>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  muted: { color: colors.muted },
  error: { color: colors.danger, fontWeight: '700' },
  desc: { color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  flex1: { flex: 1 },
  badge: { color: colors.green, fontWeight: '900', fontSize: 12 },
  badgeMuted: { color: colors.muted },
  name: { fontSize: 16, fontWeight: '900', color: colors.ink },
})
