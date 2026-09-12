import { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError, resolveMediaUrl } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../../src/components/ui'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { spacing, radius, type Colors } from '../../../src/theme'
import { prepareProductImageUpload } from '../../../src/lib/imageUpload'
import {
  getCategoryRequirements, missingRequiredAttributes,
} from '../../../src/lib/categorySuggestions'
import type { Category, Shop } from '../../../src/types'

const MAX_IMAGES = 10

export default function SellerProductDetailScreen() {
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const { id: productId = '' } = useLocalSearchParams<{ id: string }>()
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveShop = useAuth((s) => s.setActiveShop)

  const product = useQuery({ queryKey: ['seller', 'product', productId], queryFn: () => sellerApi.product(activeBusiness!.id, productId), enabled: Boolean(activeBusiness && productId) })
  const variants = useQuery({ queryKey: ['seller', 'variants', productId], queryFn: () => sellerApi.variants(activeBusiness!.id, productId), enabled: Boolean(activeBusiness && productId) })
  const images = useQuery({ queryKey: ['seller', 'productImages', productId], queryFn: () => sellerApi.productImages(activeBusiness!.id, productId), enabled: Boolean(activeBusiness && productId) })
  const inventory = useQuery({ queryKey: ['seller', 'inventory', activeShop], queryFn: () => sellerApi.shopInventory(activeShop!), enabled: Boolean(activeShop) })
  const categories = useQuery({ queryKey: ['seller', 'categories'], queryFn: sellerApi.categories })
  // Stock is always shop-scoped, so the page needs a shop before it can show
  // or change any quantity. Offering the business's shops here means a product
  // opened straight from a notification is still actionable.
  const shops = useQuery({
    queryKey: ['seller', 'shops', activeBusiness?.id],
    queryFn: () => sellerApi.shops(activeBusiness!.id),
    enabled: Boolean(activeBusiness),
  })

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', sku: '', unit: 'PCS', unit_price: '', cost_price: '', description: '' })
  const [showAddVariant, setShowAddVariant] = useState(false)
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', sale_price: '', purchase_price: '', stock: '0' })
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    if (!product.data) return
    setForm({
      name: product.data.name, sku: product.data.sku ?? '', unit: product.data.unit ?? 'PCS',
      unit_price: String(product.data.unit_price ?? ''), cost_price: product.data.cost_price ? String(product.data.cost_price) : '',
      description: product.data.description ?? '',
    })
  }, [product.data?.id])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['seller', 'product', productId] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'variants', productId] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'productImages', productId] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] })
    void queryClient.invalidateQueries({ queryKey: ['seller', 'products'] })
    void queryClient.invalidateQueries({ queryKey: ['marketplace'] })
  }

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
    mutationFn: async () => {
      if (product.data!.publication_status !== 'PUBLISHED') {
        const category = categories.data?.find((c: Category) => c.id === product.data!.category_id)
        const subcategory = category?.subcategories?.find((s: Category) => s.id === product.data!.subcategory_id)
        const categoryRequirements = getCategoryRequirements(
          category?.slug || category?.name,
          subcategory?.slug || subcategory?.name
        )
        const presentAttributes = new Set<string>()
        variants.data?.forEach(v => Object.keys(v.attributes ?? {}).forEach(k => {
          if (v.attributes![k]?.trim()) presentAttributes.add(k)
        }))
        const missing = missingRequiredAttributes(categoryRequirements, Array.from(presentAttributes), t)
        if (missing.length > 0) {
          throw new Error(t('seller.productForm.validation.missingAttributes', { attributes: missing.join(', ') }) + ' ' + t(missing.length > 1 ? 'seller.productForm.validation.missingThem' : 'seller.productForm.validation.missingIt'))
        }
      }
      return sellerApi.updateProduct(activeBusiness!.id, productId, { publication_status: product.data!.publication_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED', status: product.data!.publication_status === 'PUBLISHED' ? undefined : 'ACTIVE' })
    },
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('seller.productDetail.publishFailed')),
  })

  const archive = useMutation({
    mutationFn: () => sellerApi.updateProduct(activeBusiness!.id, productId, { status: 'INACTIVE', publication_status: 'ARCHIVED' }),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.productList.deleteFailed')),
  })

  const addVariant = useMutation({
    mutationFn: async () => {
      const created = await sellerApi.createVariant(activeBusiness!.id, productId, {
        name: variantForm.name.trim(), sku: variantForm.sku.trim() || undefined,
        sale_price: parseFloat(variantForm.sale_price), purchase_price: variantForm.purchase_price ? parseFloat(variantForm.purchase_price) : undefined,
      })
      // The offer row is written even at zero, exactly as the create pipeline
      // does: the marketplace only lists variants that have inventory in a shop.
      if (activeShop) {
        await sellerApi.addStock(activeShop, {
          variant_id: created.id,
          quantity: Math.max(0, parseInt(variantForm.stock, 10) || 0),
          notes: t('seller.productForm.initialStock'),
        })
      }
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

  const [editingVariant, setEditingVariant] = useState<string | null>(null)
  const [variantEditForm, setVariantEditForm] = useState<Record<string, string>>({})
  const [newAttributeName, setNewAttributeName] = useState('')

  const saveVariantAttributes = useMutation({
    mutationFn: (variantId: string) => sellerApi.updateVariant(variantId, { attributes: variantEditForm }),
    onSuccess: () => { setEditingVariant(null); invalidate() },
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('common.error')),
  })

  const deleteImage = useMutation({
    mutationFn: (imageId: string) => sellerApi.deleteProductImage(activeBusiness!.id, productId, imageId),
    onSuccess: invalidate,
    onError: (e) => Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.productForm.genericError')),
  })

  async function addImage(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        t(source === 'camera' ? 'profile.cameraNeeded' : 'profile.photosNeeded'),
        t(source === 'camera' ? 'profile.cameraNeededBody' : 'profile.photosNeededBody'),
      )
      return
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, selectionLimit: 1 })
    if (result.canceled || !result.assets[0]) return

    setUploadingImage(true)
    try {
      const file = await prepareProductImageUpload(result.assets[0])
      await sellerApi.uploadProductImage(activeBusiness!.id, productId, file, (images.data?.length ?? 0) === 0)
      invalidate()
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof ApiError ? e.message : t('seller.productForm.photoPrepareFailed'))
    } finally {
      setUploadingImage(false)
    }
  }

  function pickImage() {
    if ((images.data?.length ?? 0) >= MAX_IMAGES) { Alert.alert(t('seller.productForm.maxPhotos')); return }
    Alert.alert(t('seller.productForm.addPhoto'), undefined, [
      { text: t('profile.takePhoto'), onPress: () => void addImage('camera') },
      { text: t('profile.chooseFromGallery'), onPress: () => void addImage('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (product.isLoading) return <Loading label={t('seller.productDetail.loading')} />
  if (product.isError || !product.data) return <ErrorState message={t('seller.productDetail.notFound')} retry={() => void product.refetch()} />

  const p = product.data
  const stockByVariantId = new Map((inventory.data ?? []).map((i) => [i.inventory.variant_id, i]))
  const category = categories.data?.find((c: Category) => c.id === p.category_id)
  const subcategory = category?.subcategories?.find((s: Category) => s.id === p.subcategory_id)
  const categoryPath = [category?.name, subcategory?.name].filter(Boolean).join(' › ')
  const currentShop = shops.data?.find((s: Shop) => s.id === activeShop)

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
        <Text style={styles.muted}>{t('seller.productForm.categoryLabel')}: {categoryPath || t('seller.productList.generalCategory')}</Text>
        {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
        <Button variant="outline" dense title={t('seller.productDetail.editSettings')} onPress={() => setEditing(true)} />
        {p.publication_status !== 'ARCHIVED' ? <Button
          variant="outline"
          dense
          loading={archive.isPending}
          title={t('seller.productList.delete')}
          onPress={() => Alert.alert(
            t('seller.productList.delete'),
            t('seller.productList.archiveConfirm', { name: p.name }),
            [{ text: t('common.cancel'), style: 'cancel' }, { text: t('seller.productList.delete'), style: 'destructive', onPress: () => archive.mutate() }],
          )}
        /> : null}
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

    <Card>
      <Text style={styles.cardTitle}>{t('seller.productForm.photosTitle')}</Text>
      {images.isLoading ? <Loading label={t('common.loading')} /> : !images.data?.length
        ? <Text style={styles.muted}>{t('seller.productDetail.noPhotosYet')}</Text>
        : <View style={styles.photoGrid}>
          {images.data.map((img) => <View key={img.id} style={styles.photoTile}>
            <Image source={resolveMediaUrl(img.url)} style={styles.photo} contentFit="cover" />
            {img.is_primary ? <Text style={styles.primaryTag}>{t('seller.productForm.primary')}</Text> : null}
            <Button dense variant="outline" loading={deleteImage.isPending && deleteImage.variables === img.id} title={t('common.delete')} onPress={() => deleteImage.mutate(img.id)} />
          </View>)}
        </View>}
      <Button variant="outline" loading={uploadingImage} title={t('seller.productForm.addPhoto')} onPress={pickImage} />
    </Card>

    {!activeShop && shops.data?.length ? <Card>
      <Text style={styles.cardTitle}>{t('seller.productForm.shopTitle')}</Text>
      <Text style={styles.muted}>{t('seller.productDetail.selectShopLocation')}</Text>
      <View style={styles.chipRow}>
        {shops.data.map((s: Shop) => <Pressable key={s.id} accessibilityRole="button" style={styles.chip} onPress={() => setActiveShop(s.id)}>
          <Text style={styles.chipText}>{s.name}</Text>
        </Pressable>)}
      </View>
    </Card> : null}

    <SectionTitle title={t('seller.productDetail.variantsInventoryDesc')} action={<Button dense title={showAddVariant ? t('common.cancel') : t('seller.productDetail.addVariant')} onPress={() => setShowAddVariant((v) => !v)} />} />
    {currentShop ? <Text style={styles.muted}>{t('seller.productForm.stockScopedDesc', { shop: currentShop.name })}</Text> : null}

    {showAddVariant && <Card>
      <Field label={t('seller.productDetail.variantNameRequired')} value={variantForm.name} onChangeText={(v) => setVariantForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
      <Field label="SKU" value={variantForm.sku} onChangeText={(v) => setVariantForm((f) => ({ ...f, sku: v }))} autoCapitalize="none" />
      <Field label={t('seller.productDetail.salePriceRequired')} value={variantForm.sale_price} onChangeText={(v) => setVariantForm((f) => ({ ...f, sale_price: v }))} keyboardType="numeric" />
      <Field label={t('seller.productDetail.initialStockQty')} value={variantForm.stock} onChangeText={(v) => setVariantForm((f) => ({ ...f, stock: v }))} keyboardType="numeric" />
      <Button title={t('seller.productDetail.saveVariant')} loading={addVariant.isPending} onPress={() => addVariant.mutate()} />
    </Card>}

    {variants.isLoading ? <Loading label={t('common.loading')} /> : !variants.data?.length ? <Card><Text style={styles.muted}>{t('seller.productDetail.noVariantsFound')}</Text></Card> : variants.data.map((variant) => {
      const inv = stockByVariantId.get(variant.id)
      const attributes = Object.entries(variant.attributes ?? {}).filter(([, v]) => v.trim())
      return <Card key={variant.id}>
        {editingVariant === variant.id ? (
          <View>
            <Text style={styles.cardTitle}>{t('seller.productList.edit')}</Text>
            {Object.entries(variantEditForm).map(([k, v]) => (
              <Field key={k} label={k} value={v} onChangeText={val => setVariantEditForm(f => ({ ...f, [k]: val }))} />
            ))}
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Field label={t('seller.productForm.attributeName')} value={newAttributeName} onChangeText={setNewAttributeName} />
              </View>
              <Button dense title={t('seller.stockPage.add')} onPress={() => { if (newAttributeName.trim()) { setVariantEditForm(f => ({ ...f, [newAttributeName.trim()]: '' })); setNewAttributeName('') } }} />
            </View>
            <View style={[styles.row, { marginTop: spacing.md }]}>
              <Button dense variant="outline" title={t('common.cancel')} onPress={() => setEditingVariant(null)} />
              <Button dense title={t('common.save')} loading={saveVariantAttributes.isPending && saveVariantAttributes.variables === variant.id} onPress={() => saveVariantAttributes.mutate(variant.id)} />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={styles.name}>{variant.name || t('seller.productDetail.defaultVariant')}</Text>
              <Button dense variant="outline" title={t('seller.productList.edit')} onPress={() => { setEditingVariant(variant.id); setVariantEditForm(variant.attributes ?? {}); setNewAttributeName('') }} />
            </View>
            <Text style={styles.muted}>{variant.sku || '—'} · {(variant.sale_price ?? 0).toLocaleString()} FC</Text>
            {attributes.length > 0 ? <Text style={styles.muted}>{attributes.map(([k, v]) => `${k}: ${v}`).join(' · ')}</Text> : null}
            <Text style={styles.muted}>{activeShop ? t('seller.productList.availableLabel') + ': ' + (inv?.inventory.available ?? 0) : t('seller.productDetail.selectShopLocation')}</Text>
            {activeShop && <View style={styles.row}>
              <View style={styles.flex1}><Field label={t('seller.productDetail.qtyPlaceholder')} value={stockByVariant[variant.id] ?? ''} onChangeText={(v) => setStockByVariant((prev) => ({ ...prev, [variant.id]: v }))} keyboardType="numeric" /></View>
              <Button dense loading={addStock.isPending && addStock.variables === variant.id} title={t('seller.stockPage.add')} onPress={() => addStock.mutate(variant.id)} />
            </View>}
          </>
        )}
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
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: { width: 150, gap: spacing.xs },
  photo: { width: 150, height: 150, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  primaryTag: { color: colors.green, fontWeight: '900', fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipText: { color: colors.ink, fontWeight: '700' },
})
