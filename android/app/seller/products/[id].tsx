import { useEffect, useMemo, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { resolveMediaUrl } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, ErrorState, Field, Loading } from '../../../src/components/ui'
import { QRPanel } from '../../../src/components/OrderItemQRSection'
import { useI18n, type TranslationKey } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { radius, spacing, type Colors } from '../../../src/theme'
import { prepareProductImageUpload } from '../../../src/lib/imageUpload'
import { extractSpecifications } from '../../../src/lib/variants'
import { attributeLabel, canonicalizeAttributes, getAttributeValue, variantDisplayLabel, variantHasAttribute } from '../../../src/lib/categoryAttributes'
import type { CategoryAttributeDefinition, Product, ProductVariant } from '../../../src/types'
import { formatMoney } from '../../../src/lib/money'

// Port of web-app/src/pages/seller/products/SellerProductDetailPage.tsx at its
// narrow layout (the `.mobile-card-list` variant cards). Same loads (product,
// variants, shops, categories, images, product QR, DB attribute definitions and
// every variant's stock across shops), same actions: edit product + category,
// publish/unpublish (blocked while required attributes are missing), the
// missing-requirements panel with the completion editor, specifications,
// promotion, photos with their variant link, new variant with attributes and
// stock location, per-variant attribute editing and restock to a chosen shop.
// `?shop=` scopes stock to one shop, as web's ShopProductsPage link does.

const MAX_IMAGES = 10
const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const discounted = (base: number, type: string | undefined, value: number) => type === 'PERCENTAGE' ? base * (1 - value / 100) : Math.max(0, base - value)

export default function SellerProductDetailScreen() {
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const queryClient = useQueryClient()
  const { id: productId = '', shop: scopedShopParam } = useLocalSearchParams<{ id: string; shop?: string }>()
  const scopedShopId = typeof scopedShopParam === 'string' ? scopedShopParam : ''
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const enabled = Boolean(activeBusiness && productId)

  const product = useQuery({ queryKey: ['seller', 'product', productId], queryFn: () => sellerApi.product(activeBusiness!.id, productId), enabled })
  const variantsQ = useQuery({ queryKey: ['seller', 'variants', productId], queryFn: () => sellerApi.variants(activeBusiness!.id, productId), enabled })
  const shopsQ = useQuery({ queryKey: ['seller', 'shops', activeBusiness?.id], queryFn: () => sellerApi.shops(activeBusiness!.id), enabled: Boolean(activeBusiness) })
  const categoriesQ = useQuery({ queryKey: ['seller', 'categories'], queryFn: () => sellerApi.categories().catch(() => []) })
  const imagesQ = useQuery({ queryKey: ['seller', 'productImages', productId], queryFn: () => sellerApi.productImages(activeBusiness!.id, productId).catch(() => []), enabled })
  const qr = useQuery({ queryKey: ['seller', 'productQR', productId], queryFn: () => sellerApi.productQR(activeBusiness!.id, productId), enabled, retry: false })
  const variants = variantsQ.data ?? []
  const shops = shopsQ.data ?? []
  const categories = categoriesQ.data ?? []
  const images = imagesQ.data ?? []
  const variantIds = variants.map((v) => v.id).join(',')
  const inventories = useQuery({
    queryKey: ['seller', 'variantInventories', productId, variantIds, scopedShopId],
    queryFn: async () => {
      const map: Record<string, Awaited<ReturnType<typeof sellerApi.variantInventory>>> = {}
      await Promise.all(variants.map(async (v) => {
        try { map[v.id] = (await sellerApi.variantInventory(v.id)).filter((row) => !scopedShopId || row.shop_id === scopedShopId) }
        catch { map[v.id] = [] }
      }))
      return map
    },
    enabled: variants.length > 0,
  })
  const variantInventories = inventories.data ?? {}

  // DB-backed attribute definitions: for the product's category, or the one
  // just picked in the edit form (web reloads them on category change).
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const defsCategory = editCategoryId ?? product.data?.category_id ?? ''
  const defsQ = useQuery({
    queryKey: ['categoryAttributes', defsCategory, editCategoryId ? '' : product.data?.subcategory_id],
    queryFn: () => sellerApi.categoryAttributes(defsCategory, editCategoryId ? undefined : product.data?.subcategory_id || undefined).catch(() => []),
    enabled: Boolean(defsCategory),
  })
  const categoryAttrDefs: CategoryAttributeDefinition[] = defsCategory ? defsQ.data ?? [] : []

  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [stockMsg, setStockMsg] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', sku: '', unit: 'PCS', unit_price: '', cost_price: '', description: '', category_id: '', subcategory_id: '' })
  const [categoryChangeWarning, setCategoryChangeWarning] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [promo, setPromo] = useState({ discount_active: false, discount_type: 'PERCENTAGE', discount_value: '', discount_start: '', discount_end: '' })
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [variantForm, setVariantForm] = useState({ name: '', sku: '', sale_price: '', purchase_price: '', initial_stock: '0', shop_id: '' })
  const [variantAttrs, setVariantAttrs] = useState<Record<string, string>>({})
  const [newAttrName, setNewAttrName] = useState('')
  const [editingAttrsFor, setEditingAttrsFor] = useState<string | null>(null)
  const [editAttrs, setEditAttrs] = useState<Record<string, string>>({})
  const [showCompletion, setShowCompletion] = useState(false)
  const [completionAttrs, setCompletionAttrs] = useState<Record<string, Record<string, string>>>({})
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>({})
  const [targetShopByVariant, setTargetShopByVariant] = useState<Record<string, string>>({})

  useEffect(() => {
    const p = product.data
    if (!p) return
    setPromo({ discount_active: p.discount_active || false, discount_type: p.discount_type || 'PERCENTAGE', discount_value: p.discount_value ? String(p.discount_value) : '', discount_start: toLocalInput(p.discount_start), discount_end: toLocalInput(p.discount_end) })
    setEditForm({ name: p.name || '', sku: p.sku || '', unit: p.unit || 'PCS', unit_price: String(p.unit_price || ''), cost_price: p.cost_price ? String(p.cost_price) : '', description: p.description || '', category_id: p.category_id || '', subcategory_id: p.subcategory_id || '' })
  }, [product.data])

  useEffect(() => {
    const defaultShop = scopedShopId || activeShop || shops[0]?.id || ''
    setVariantForm((prev) => ({ ...prev, shop_id: prev.shop_id || defaultShop }))
  }, [scopedShopId, activeShop, shops[0]?.id])

  const knownAttributeKeys = useMemo(() => {
    const keys: string[] = []
    for (const v of variants) for (const key of Object.keys(v.attributes ?? {})) if (!keys.includes(key)) keys.push(key)
    return keys
  }, [variants])
  const variantsMissingAttributes = useMemo(() => variants.filter((v) => Object.keys(v.attributes ?? {}).length === 0), [variants])
  const specifications = useMemo(() => extractSpecifications(variants.map((v) => ({ id: v.id, sku: v.sku, name: v.name, attributes: (v.attributes || {}) as Record<string, string>, unit_price: v.sale_price, base_price: v.sale_price, stock: 'AVAILABLE', stock_quantity: 1 }) as never)), [variants])

  const missingRequirements = useMemo(() => {
    const p = product.data
    if (!p || p.publication_status === 'PUBLISHED' || categoryAttrDefs.length === 0) return []
    const missing: { def: CategoryAttributeDefinition; variants: ProductVariant[] }[] = []
    for (const def of categoryAttrDefs.filter((d) => d.required)) {
      if (def.variant_attribute) {
        if (variants.length === 0) missing.push({ def, variants: [] })
        else {
          const lacking = variants.filter((v) => !variantHasAttribute(v.attributes, def))
          if (lacking.length > 0) missing.push({ def, variants: lacking })
        }
      } else {
        const hasSpec = specifications.some((s) => s.key.toLowerCase() === def.key.toLowerCase() && s.value.trim())
        const onAll = variants.length > 0 && variants.every((v) => variantHasAttribute(v.attributes, def))
        if (!hasSpec && !onAll) missing.push({ def, variants: variants.filter((v) => !variantHasAttribute(v.attributes, def)) })
      }
    }
    return missing
  }, [product.data, categoryAttrDefs, variants, specifications])

  // web: when the variant form opens, seed one input per variant attribute definition
  useEffect(() => {
    if (!showVariantForm) return
    setVariantAttrs((prev) => {
      const next: Record<string, string> = {}
      const dbKeys = categoryAttrDefs.filter((d) => d.variant_attribute)
      for (const def of dbKeys) next[def.key] = getAttributeValue(prev, def) || prev[def.key] || ''
      if (dbKeys.length === 0) for (const key of knownAttributeKeys) next[key] = prev[key] ?? ''
      return next
    })
  }, [showVariantForm, knownAttributeKeys, categoryAttrDefs])

  const reload = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['seller', 'product', productId] }),
      queryClient.invalidateQueries({ queryKey: ['seller', 'variants', productId] }),
      queryClient.invalidateQueries({ queryKey: ['seller', 'productImages', productId] }),
      queryClient.invalidateQueries({ queryKey: ['seller', 'variantInventories', productId] }),
      queryClient.invalidateQueries({ queryKey: ['seller', 'inventory'] }),
      queryClient.invalidateQueries({ queryKey: ['seller', 'products'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
    ])
  }

  async function run(fn: () => Promise<unknown>, fallback: TranslationKey, success?: string) {
    setBusy(true); setActionError('')
    try { await fn(); if (success) setStockMsg(success); await reload(); return true }
    catch (err) { setActionError(err instanceof Error ? err.message : t(fallback)); return false }
    finally { setBusy(false) }
  }

  const sameCombination = (a: Record<string, string>, b: Record<string, string>) => {
    const ak = Object.keys(a), bk = Object.keys(b)
    return ak.length === bk.length && bk.every((k) => a[k] !== undefined && String(a[k]).trim().toLowerCase() === String(b[k]).trim().toLowerCase())
  }

  function onEditCategoryChange(newCatId: string) {
    const p = product.data
    if (p?.category_id && newCatId !== p.category_id) {
      const oldCat = categories.find((c) => c.id === p.category_id)?.name || t('seller.productDetail.currentCategory')
      const newCat = categories.find((c) => c.id === newCatId)?.name || t('seller.productDetail.selectedCategory')
      setCategoryChangeWarning(t('seller.productDetail.categoryChangeWarning', { from: oldCat, to: newCat }))
    } else setCategoryChangeWarning('')
    setEditForm((prev) => ({ ...prev, category_id: newCatId, subcategory_id: '' }))
    setEditCategoryId(newCatId)
  }

  async function saveProductDetails() {
    const price = parseFloat(editForm.unit_price)
    if (isNaN(price) || price <= 0) { setActionError(t('seller.productDetail.validSalePrice')); return }
    const ok = await run(() => sellerApi.updateProduct(activeBusiness!.id, productId, {
      name: editForm.name.trim(), sku: editForm.sku.trim() || undefined, unit: editForm.unit.trim() || 'PCS', unit_price: price,
      cost_price: editForm.cost_price ? parseFloat(editForm.cost_price) : undefined, description: editForm.description.trim() || undefined,
      category_id: editForm.category_id || undefined, subcategory_id: editForm.subcategory_id || undefined,
    }), 'seller.productDetail.updateFailed', t('seller.productDetail.updatedSuccess'))
    if (ok) { setShowEdit(false); setEditCategoryId(null) }
  }

  async function savePromotion() {
    const p = product.data!
    const value = parseFloat(promo.discount_value)
    if (promo.discount_active) {
      if (isNaN(value) || value <= 0) { setActionError(t('seller.productDetail.promoInvalidValue')); return }
      if (promo.discount_type === 'PERCENTAGE' && value > 100) { setActionError(t('seller.productDetail.promoMaxPercent')); return }
      if (promo.discount_type === 'FIXED' && value >= (p.unit_price || 0)) { setActionError(t('seller.productDetail.promoFixedTooHigh')); return }
      if (promo.discount_start && promo.discount_end && new Date(promo.discount_end) <= new Date(promo.discount_start)) { setActionError(t('seller.productDetail.promoEndBeforeStart')); return }
    }
    const ok = await run(() => sellerApi.updateProduct(activeBusiness!.id, productId, {
      discount_active: promo.discount_active, discount_type: promo.discount_type, discount_value: promo.discount_active ? value : 0,
      discount_start: promo.discount_active && promo.discount_start ? new Date(promo.discount_start).toISOString() : null,
      discount_end: promo.discount_active && promo.discount_end ? new Date(promo.discount_end).toISOString() : null,
    } as never), 'seller.productDetail.promoSaveFailed', t('seller.productDetail.promoSaved'))
    if (ok) setShowPromo(false)
  }

  async function createVariant() {
    const parsed = canonicalizeAttributes(Object.fromEntries(Object.entries(variantAttrs).map(([k, v]) => [k.trim(), v.trim()]).filter(([k, v]) => k && v)), categoryAttrDefs)
    if (knownAttributeKeys.length > 0) {
      const missing = knownAttributeKeys.filter((k) => !parsed[k])
      if (missing.length > 0) { setActionError(`Set a value for ${missing.join(', ')} so buyers can select this variant. Every variant of this product must define the same attributes.`); return }
    } else if (Object.keys(parsed).length === 0) { setActionError(t('seller.productDetail.atLeastOneAttr')); return }
    if (variants.some((v) => sameCombination(v.attributes || {}, parsed))) { setActionError('Une variante avec cette combinaison exacte d’attributs existe déjà pour ce produit.'); return }
    const ok = await run(async () => {
      const created = await sellerApi.createVariant(activeBusiness!.id, productId, {
        name: variantForm.name.trim() || Object.values(parsed).join(' / ') || undefined, sku: variantForm.sku.trim() || undefined, attributes: parsed,
        sale_price: parseFloat(variantForm.sale_price), purchase_price: variantForm.purchase_price ? parseFloat(variantForm.purchase_price) : undefined,
      })
      const initStock = parseInt(variantForm.initial_stock, 10)
      const shopId = scopedShopId || variantForm.shop_id || activeShop || shops[0]?.id || ''
      if (initStock > 0 && shopId) await sellerApi.addStock(shopId, { variant_id: created.id, quantity: initStock, notes: t('seller.productDetail.noteInitialVariantStock') })
    }, 'seller.productDetail.createVariantFailed')
    if (ok) {
      setVariantForm({ name: '', sku: '', sale_price: '', purchase_price: '', initial_stock: '0', shop_id: activeShop || shops[0]?.id || '' })
      setVariantAttrs({}); setNewAttrName(''); setShowVariantForm(false)
    }
  }

  function openAttrEditor(v: ProductVariant) {
    const current = canonicalizeAttributes((v.attributes ?? {}) as Record<string, string>, categoryAttrDefs)
    const seeded: Record<string, string> = { ...current }
    for (const def of categoryAttrDefs.filter((d) => d.variant_attribute)) seeded[def.key] = getAttributeValue(current, def)
    for (const key of knownAttributeKeys) if (seeded[key] === undefined) seeded[key] = current[key] ?? ''
    setEditAttrs(seeded); setNewAttrName(''); setEditingAttrsFor(v.id)
  }

  async function saveVariantAttributes(variantId: string) {
    const attrs = canonicalizeAttributes(Object.fromEntries(Object.entries(editAttrs).map(([k, v]) => [k.trim(), v.trim()]).filter(([k, v]) => k && v)), categoryAttrDefs)
    if (Object.keys(attrs).length === 0) { setActionError(t('seller.productDetail.enterAttrValue')); return }
    if (variants.some((v) => v.id !== variantId && sameCombination(v.attributes || {}, attrs))) { setActionError('Une autre variante possède déjà cette combinaison exacte d’attributs.'); return }
    const ok = await run(() => sellerApi.updateVariant(variantId, { attributes: attrs }), 'seller.productDetail.updateAttrsFailed', t('seller.productDetail.attrsUpdated'))
    if (ok) setEditingAttrsFor(null)
  }

  function openCompletion() {
    if (variants.length === 0) { setShowVariantForm(true); return }
    const seeded: Record<string, Record<string, string>> = {}
    for (const v of variants) {
      const current = canonicalizeAttributes((v.attributes || {}) as Record<string, string>, categoryAttrDefs)
      seeded[v.id] = { ...current }
      for (const def of categoryAttrDefs.filter((d) => d.required)) seeded[v.id][def.key] = getAttributeValue(current, def)
    }
    setCompletionAttrs(seeded); setShowCompletion(true)
  }

  async function saveCompletion(ids: string[], close = false) {
    const requiredDefs = categoryAttrDefs.filter((d) => d.required)
    for (const id of ids) {
      const empty = requiredDefs.find((def) => !getAttributeValue(completionAttrs[id] || {}, def))
      if (empty) { setActionError(`Renseignez ${empty.label_fr || empty.label_en || empty.key} avant d’enregistrer.`); return }
    }
    const saved = requiredDefs.filter((def) => ids.some((id) => !variantHasAttribute(variants.find((v) => v.id === id)?.attributes, def) && String(completionAttrs[id]?.[def.key] || '').trim())).map((def) => def.label_fr || def.label_en || def.key)
    const ok = await run(() => Promise.all(ids.map((id) => sellerApi.updateVariant(id, { attributes: canonicalizeAttributes(Object.fromEntries(Object.entries(completionAttrs[id] || {}).map(([k, v]) => [k.trim(), String(v).trim()]).filter(([k, v]) => k && v)), categoryAttrDefs) }))), 'seller.productDetail.updateAttrsFailed', `${saved.join(', ')} ${saved.length > 1 ? 'enregistrées' : 'enregistrée'}`)
    if (ok && close) setShowCompletion(false)
  }

  async function addStock(variantId: string) {
    const shopId = scopedShopId || targetShopByVariant[variantId] || activeShop || shops[0]?.id || ''
    if (!shopId) { setActionError(t('seller.productDetail.selectShopLocation')); return }
    const qty = parseInt(stockByVariant[variantId], 10)
    if (isNaN(qty) || qty <= 0) { setActionError(t('seller.productDetail.validStockQty')); return }
    const shopName = shops.find((s) => s.id === shopId)?.name ?? 'shop'
    const ok = await run(() => sellerApi.addStock(shopId, { variant_id: variantId, quantity: qty, notes: t('seller.productDetail.noteRestock') }), 'seller.productDetail.addStockFailed', `Added ${qty} units to ${shopName} successfully.`)
    if (ok) setStockByVariant((prev) => ({ ...prev, [variantId]: '' }))
  }

  async function addImage(source: 'camera' | 'library') {
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) { Alert.alert(t(source === 'camera' ? 'profile.cameraNeeded' : 'profile.photosNeeded'), t(source === 'camera' ? 'profile.cameraNeededBody' : 'profile.photosNeededBody')); return }
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, selectionLimit: 1 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    await run(async () => sellerApi.uploadProductImage(activeBusiness!.id, productId, await prepareProductImageUpload(asset), images.length === 0), 'seller.productDetail.uploadPhotoFailed', t('seller.productDetail.photoUploaded'))
  }

  function pickImage() {
    Alert.alert(t('seller.productForm.addPhoto'), undefined, [
      { text: t('profile.takePhoto'), onPress: () => void addImage('camera') },
      { text: t('profile.chooseFromGallery'), onPress: () => void addImage('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  function removeImage(imageId: string) {
    Alert.alert(t('seller.productDetail.removePhotoConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void run(() => sellerApi.deleteProductImage(activeBusiness!.id, productId, imageId), 'seller.productDetail.removePhotoFailed', t('seller.productDetail.photoRemoved')) },
    ])
  }

  if (!activeBusiness) return <View style={styles.center}><Text style={{ fontSize: 64 }}>📦</Text><Text style={styles.h2}>{t('seller.noBusinessSelected')}</Text></View>
  if (product.isLoading || variantsQ.isLoading) return <Loading label={t('seller.productDetail.loading')} />
  if (product.isError) return <ErrorState message={product.error instanceof Error ? product.error.message : t('seller.productDetail.loadFailed')} retry={() => void product.refetch()} />
  if (!product.data) return <ErrorState message={t('seller.productDetail.notFound')} />

  const p: Product & { currency?: string } = product.data
  const currency = p.currency
  let totalAvailable = 0, totalQuantity = 0, totalReserved = 0
  Object.values(variantInventories).forEach((rows) => rows.forEach((row) => {
    const q = row.quantity || 0, r = row.reserved_quantity || 0
    totalQuantity += q; totalReserved += r; totalAvailable += Math.max(0, q - r)
  }))
  const published = p.publication_status === 'PUBLISHED'
  const editCategory = categories.find((c) => c.id === editForm.category_id)
  const promoPreview = promo.discount_active && p.unit_price && promo.discount_value

  return <View style={styles.flex1}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.h1}>{p.name}</Text>
        <Text style={styles.muted}>{t('seller.productDetail.catalogSubtitle')}{scopedShopId ? t('seller.productDetail.shopOnly', { shop: shops.find((s) => s.id === scopedShopId)?.name ?? t('seller.productDetail.selectedShop') }) : ''}</Text>
        <Button dense variant="outline" title={t('seller.productDetail.backToProducts')} onPress={() => router.push(scopedShopId ? { pathname: '/seller/shops/[shopId]/products', params: { shopId: scopedShopId } } : '/seller/products')} />
      </View>

      {actionError ? <View style={styles.errorBox}><Text style={styles.errorText}>{actionError}</Text></View> : null}
      {stockMsg ? <View style={styles.successBox}><Text style={styles.successText}>✓ {stockMsg}</Text></View> : null}

      {/* ── Actionable draft requirements ── */}
      {!published && missingRequirements.length > 0 ? <View style={styles.warnBox} accessibilityRole="alert">
        <Text style={styles.h3}>⚠ {missingRequirements.length} caractéristique{missingRequirements.length > 1 ? 's' : ''} obligatoire{missingRequirements.length > 1 ? 's' : ''} manquante{missingRequirements.length > 1 ? 's' : ''}</Text>
        {missingRequirements.map((req) => {
          const label = attributeLabel(req.def, lang)
          return <View key={req.def.key} style={styles.reqItem}>
            <Text style={styles.bold}>{label} manquante</Text>
            {req.variants.length > 0 ? <Text style={styles.small}>Manquante sur : {req.variants.map((v) => `• ${variantDisplayLabel(v.attributes, categoryAttrDefs, v.name || v.sku || 'Variante')}`).join('  ')}</Text> : null}
            <Button dense variant="outline" title={`Compléter ${label}`} onPress={openCompletion} />
          </View>
        })}
        <Button dense title={variants.length === 0 ? 'Créer une variante' : 'Compléter toutes les variantes'} onPress={openCompletion} />
      </View> : null}
      {!published && categoryAttrDefs.some((d) => d.required) && missingRequirements.length === 0 ? <View style={styles.successBox}><Text style={styles.successText}>✓ Toutes les caractéristiques obligatoires sont complètes.</Text></View> : null}

      {/* ── Product QR ── */}
      {qr.data ? <QRPanel qr={qr.data} title="TBK Product QR" imagePath={`/businesses/${activeBusiness.id}/products/${p.id}/qr/label`} fields={[{ label: 'Produit', value: p.name }, { label: 'SKU', value: p.sku || '' }, { label: 'Boutique', value: activeBusiness.name || '' }]} /> : null}

      {/* ── Overview ── */}
      <View style={styles.card}>
        <View style={styles.wrapRow}>
          <Text style={[styles.badge, published ? styles.badgeOk : styles.badgeWarn]}>{t(`seller.publicationStatus.${p.publication_status}` as TranslationKey)}</Text>
          {p.sku ? <Text style={styles.mono}>{t('seller.productDetail.skuInfo', { sku: p.sku })}</Text> : null}
          <Text style={styles.small}>· {t('seller.productDetail.basePrice', { price: Number(p.unit_price || 0).toLocaleString() })}</Text>
          <Text style={styles.small}>· {t('seller.productDetail.unitLabel', { unit: p.unit || 'PCS' })}</Text>
          {p.category_id ? <Text style={styles.badgeOutline}>📁 {categories.find((c) => c.id === p.category_id)?.name || t('seller.productDetail.categoryFallback')}</Text> : null}
        </View>
        {p.description ? <Text style={styles.muted}>{p.description}</Text> : null}
        <View>
          <Text style={styles.small}>{t('seller.productDetail.inventoryStatus')}</Text>
          <Text style={[styles.bigStat, { color: totalAvailable > 0 ? colors.green : colors.muted }]}>{t('seller.productDetail.availableUnits', { count: totalAvailable })}</Text>
          {totalReserved > 0 ? <Text style={styles.small}>{t('seller.productDetail.reservedSummary', { total: totalQuantity, reserved: totalReserved })}</Text> : null}
        </View>
        <View style={styles.wrapRow}>
          <Button dense variant="outline" title={showEdit ? t('seller.productDetail.cancelEdit') : t('seller.productDetail.editSettings')} onPress={() => { setShowEdit((v) => !v); setEditCategoryId(null); setCategoryChangeWarning('') }} />
          <Button dense variant={published ? 'outline' : 'primary'} disabled={busy || (!published && missingRequirements.length > 0)} title={published ? t('seller.productDetail.unpublish') : t('seller.productDetail.publishToMarketplace')}
            onPress={() => void run(() => sellerApi.updateProduct(activeBusiness.id, p.id, { publication_status: published ? 'DRAFT' : 'PUBLISHED' }), 'seller.productDetail.publishFailed')} />
        </View>

        {showEdit ? <View style={styles.inlineForm}>
          <Text style={styles.h4}>{t('seller.productDetail.editTitle')}</Text>
          <Field label={t('seller.productDetail.productNameRequired')} value={editForm.name} onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))} />
          <Field label={t('seller.productDetail.salePriceRequired')} value={editForm.unit_price} onChangeText={(v) => setEditForm((f) => ({ ...f, unit_price: v }))} keyboardType="decimal-pad" />
          <Field label="SKU" value={editForm.sku} onChangeText={(v) => setEditForm((f) => ({ ...f, sku: v }))} autoCapitalize="none" />
          <Field label={t('product.unit')} value={editForm.unit} onChangeText={(v) => setEditForm((f) => ({ ...f, unit: v }))} autoCapitalize="characters" />
          <Text style={styles.label}>{t('product.category')}</Text>
          <View style={styles.chips}>
            <Chip label={t('seller.productDetail.noneOption')} selected={!editForm.category_id} onPress={() => onEditCategoryChange('')} styles={styles} />
            {categories.map((c) => <Chip key={c.id} label={c.name} selected={editForm.category_id === c.id} onPress={() => onEditCategoryChange(c.id)} styles={styles} />)}
          </View>
          {editCategory?.subcategories?.length ? <>
            <Text style={styles.label}>{t('product.subcategory')}</Text>
            <View style={styles.chips}>
              <Chip label={t('seller.productDetail.noneOption')} selected={!editForm.subcategory_id} onPress={() => setEditForm((f) => ({ ...f, subcategory_id: '' }))} styles={styles} />
              {editCategory.subcategories.map((s) => <Chip key={s.id} label={s.name} selected={editForm.subcategory_id === s.id} onPress={() => setEditForm((f) => ({ ...f, subcategory_id: s.id }))} styles={styles} />)}
            </View>
          </> : null}
          <Field label={t('product.description')} value={editForm.description} onChangeText={(v) => setEditForm((f) => ({ ...f, description: v }))} multiline />
          {categoryChangeWarning ? <View style={styles.warnBox}><Text style={styles.text}>ℹ️ {categoryChangeWarning}</Text></View> : null}
          <View style={styles.wrapRow}>
            <Button dense title={t('seller.productDetail.saveProductChanges')} loading={busy} onPress={() => void saveProductDetails()} />
            <Button dense variant="outline" title={t('common.cancel')} onPress={() => setShowEdit(false)} />
          </View>
        </View> : null}
      </View>

      {/* ── Specifications ── */}
      {specifications.length > 0 ? <View style={styles.card}>
        <Text style={styles.h3}>{t('seller.productDetail.specificationsTitle', { count: specifications.length })}</Text>
        <Text style={styles.small}>{t('seller.productDetail.specificationsDesc')}</Text>
        {specifications.map((spec) => <View key={spec.key} style={styles.specCell}><Text style={styles.tiny}>{spec.label}</Text><Text style={styles.bold}>{spec.value}</Text></View>)}
      </View> : null}

      {/* ── Promotion ── */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.flex1}><Text style={styles.h3}>{t('seller.productDetail.promotionTitle')}</Text><Text style={styles.small}>{t('seller.productDetail.promotionDesc')}</Text></View>
          <Button dense variant="outline" title={showPromo ? t('common.cancel') : t('seller.productDetail.configurePromotion')} onPress={() => setShowPromo((v) => !v)} />
        </View>
        {showPromo ? <View style={styles.inlineForm}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: promo.discount_active }} onPress={() => setPromo((f) => ({ ...f, discount_active: !f.discount_active }))} style={styles.checkRow}>
            <View style={[styles.checkbox, promo.discount_active && styles.checkboxOn]}>{promo.discount_active ? <Text style={styles.checkMark}>✓</Text> : null}</View>
            <Text style={styles.bold}>{t('seller.productDetail.enablePromotion')}</Text>
          </Pressable>
          {promo.discount_active ? <>
            <Text style={styles.label}>{t('seller.productDetail.discountType')}</Text>
            <View style={styles.chips}>
              <Chip label={t('seller.productDetail.discountPercentOff')} selected={promo.discount_type === 'PERCENTAGE'} onPress={() => setPromo((f) => ({ ...f, discount_type: 'PERCENTAGE' }))} styles={styles} />
              <Chip label={t('seller.productDetail.discountFixed')} selected={promo.discount_type === 'FIXED'} onPress={() => setPromo((f) => ({ ...f, discount_type: 'FIXED' }))} styles={styles} />
            </View>
            <Field label={promo.discount_type === 'PERCENTAGE' ? t('seller.productDetail.discountPercentLabel') : t('seller.productDetail.discountAmountLabel')} value={promo.discount_value} onChangeText={(v) => setPromo((f) => ({ ...f, discount_value: v }))} keyboardType="decimal-pad" placeholder={promo.discount_type === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 15000'} />
            <Field label={t('seller.productDetail.startDateOptional')} value={promo.discount_start} onChangeText={(v) => setPromo((f) => ({ ...f, discount_start: v }))} placeholder="AAAA-MM-JJTHH:MM" autoCapitalize="characters" />
            <Field label={t('seller.productDetail.endDateOptional')} value={promo.discount_end} onChangeText={(v) => setPromo((f) => ({ ...f, discount_end: v }))} placeholder="AAAA-MM-JJTHH:MM" autoCapitalize="characters" />
          </> : null}
          {promoPreview ? <View style={styles.previewBox}>
            <Text style={styles.small}>{t('seller.productDetail.promotionLivePreview')}</Text>
            <View style={styles.wrapRow}>
              <Text style={[styles.bigStat, { color: colors.green }]}>{isNaN(parseFloat(promo.discount_value)) ? '—' : formatMoney(discounted(p.unit_price || 0, promo.discount_type, parseFloat(promo.discount_value)), currency)}</Text>
              <Text style={styles.strike}>{formatMoney(p.unit_price, currency)}</Text>
              <Text style={[styles.badge, styles.badgeOk]}>{promo.discount_type === 'PERCENTAGE' ? `${promo.discount_value}% OFF` : `${formatMoney(parseFloat(promo.discount_value), currency)} OFF`}</Text>
            </View>
          </View> : null}
          <Button title={t('seller.productDetail.savePromotionSettings')} loading={busy} onPress={() => void savePromotion()} />
        </View> : p.discount_active ? <View style={{ gap: 6 }}>
          <View style={styles.previewBox}>
            <Text style={styles.small}>{t('seller.productDetail.currentActivePromotion')}</Text>
            <Text style={[styles.bigStat, { color: colors.green }]}>{p.discount_type === 'PERCENTAGE' ? `${p.discount_value}% OFF` : `${formatMoney(p.discount_value || 0, currency)} OFF`}</Text>
            {p.unit_price ? <Text style={styles.small}>(Sale Price: <Text style={styles.bold}>{formatMoney(discounted(p.unit_price || 0, p.discount_type, p.discount_value || 0), currency)}</Text> {t('seller.productDetail.normalPrice', { price: formatMoney(p.unit_price, currency) })})</Text> : null}
          </View>
          {p.discount_start ? <Text style={styles.small}>{t('seller.productDetail.startsAt', { date: new Date(p.discount_start).toLocaleString() })}</Text> : null}
          {p.discount_end ? <Text style={styles.small}>{t('seller.productDetail.endsAt', { date: new Date(p.discount_end).toLocaleString() })}</Text> : null}
          {!p.discount_start && !p.discount_end ? <Text style={styles.small}>{t('seller.productDetail.activeIndefinitely')}</Text> : null}
        </View> : <Text style={styles.small}>{t('seller.productDetail.noActivePromo')}</Text>}
      </View>

      {/* ── Photos ── */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.flex1}>
            <Text style={styles.h3}>Product Photos ({images.length})</Text>
            <Text style={styles.small}>Link a photo to a variant so buyers see that exact colour or model when they select it. Photos left as “All variants” show for the whole product.</Text>
          </View>
          {images.length < MAX_IMAGES ? <Button dense variant="outline" title="+ Add Photo" disabled={busy} onPress={pickImage} /> : null}
        </View>
        {images.length === 0 ? <Text style={[styles.small, { textAlign: 'center', padding: 16 }]}>No photos yet. Buyers are far more likely to order a product that shows a photo.</Text>
          : images.map((img) => <View key={img.id} style={styles.photoCard}>
            <View>
              <Image source={resolveMediaUrl(img.url)} style={styles.photo} contentFit="cover" accessibilityLabel={img.file_name || p.name} />
              {img.is_primary ? <Text style={[styles.badge, styles.badgeOk, styles.photoBadge]}>{t('seller.productDetail.primary')}</Text> : null}
            </View>
            <View style={[styles.flex1, { gap: 6 }]}>
              <Text style={styles.small}>{t('seller.productDetail.showsVariant')}</Text>
              <View style={styles.chips}>
                <Chip label={t('seller.productDetail.allVariants')} selected={!img.variant_id} disabled={busy} onPress={() => void run(() => sellerApi.assignImageVariant(activeBusiness.id, p.id, img.id, null), 'seller.productDetail.linkPhotoFailed', t('seller.productDetail.photoLinkedWhole'))} styles={styles} />
                {variants.map((v) => <Chip key={v.id} label={Object.values(v.attributes ?? {}).join(' / ') || v.name || v.sku || 'Variant'} selected={img.variant_id === v.id} disabled={busy} onPress={() => void run(() => sellerApi.assignImageVariant(activeBusiness.id, p.id, img.id, v.id), 'seller.productDetail.linkPhotoFailed', t('seller.productDetail.photoLinkedVariant'))} styles={styles} />)}
              </View>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => removeImage(img.id)}><Text style={styles.removeText}>Remove</Text></Pressable>
            </View>
          </View>)}
      </View>

      {/* ── Variants & Inventory ── */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.flex1}>
            <Text style={styles.h3}>Variants & Inventory ({variants.length})</Text>
            <Text style={styles.small}>{t('seller.productDetail.variantsInventoryDesc')}</Text>
          </View>
          <Button dense title={showVariantForm ? t('common.cancel') : `+ ${t('seller.productDetail.addVariant')}`} onPress={() => setShowVariantForm((v) => !v)} />
        </View>

        {showVariantForm ? <View style={styles.inlineForm}>
          <Text style={styles.h4}>{t('seller.productDetail.newVariant')}</Text>
          <Text style={styles.small}>{knownAttributeKeys.length > 0
            ? `Give this variant its own value for ${knownAttributeKeys.join(' and ')}. Buyers pick a product by these attributes, so every variant must define the same ones.`
            : 'Add the attributes that tell your variants apart (Color, Size, Storage…). Buyers use these as the selection buttons on the marketplace.'}</Text>
          {Object.keys(variantAttrs).map((key) => <View key={key} style={styles.attrRow}>
            <Text style={[styles.bold, styles.attrLabel]}>{attributeLabel(categoryAttrDefs.find((d) => d.key === key) || { key, label_fr: key, label_en: key }, lang)}</Text>
            <TextInput style={[styles.input, styles.flex1]} value={variantAttrs[key]} onChangeText={(v) => setVariantAttrs((prev) => ({ ...prev, [key]: v }))} placeholder={t('seller.productDetail.attrExample', { value: key === 'Color' ? t('seller.productDetail.attrBlack') : key === 'Size' ? t('seller.productDetail.attrSizeM') : t('seller.productDetail.attrValue') })} placeholderTextColor={colors.mutedLight} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${key} from this variant`} onPress={() => setVariantAttrs((prev) => { const next = { ...prev }; delete next[key]; return next })} style={styles.xBtn}><Text style={styles.text}>✕</Text></Pressable>
          </View>)}
          <View style={styles.attrRow}>
            <TextInput style={[styles.input, styles.flex1]} value={newAttrName} onChangeText={setNewAttrName} placeholder={t('seller.productDetail.attrPlaceholder')} placeholderTextColor={colors.mutedLight} accessibilityLabel={t('seller.productDetail.addAttribute')} />
            <Button dense variant="outline" title="+ Add" disabled={!newAttrName.trim() || newAttrName.trim() in variantAttrs} onPress={() => { const name = newAttrName.trim(); if (name && !(name in variantAttrs)) { setVariantAttrs((prev) => ({ ...prev, [name]: '' })); setNewAttrName('') } }} />
          </View>
          <Field label={t('seller.productDetail.variantNameRequired')} value={variantForm.name} onChangeText={(v) => setVariantForm((f) => ({ ...f, name: v }))} placeholder={t('seller.productDetail.variantNamePlaceholder')} />
          <Field label="SKU" value={variantForm.sku} onChangeText={(v) => setVariantForm((f) => ({ ...f, sku: v }))} placeholder={t('seller.productDetail.skuPlaceholder')} autoCapitalize="none" />
          <Field label={t('seller.productDetail.salePriceRequired')} value={variantForm.sale_price} onChangeText={(v) => setVariantForm((f) => ({ ...f, sale_price: v }))} keyboardType="decimal-pad" placeholder={String(p.unit_price || '')} />
          <Field label={t('seller.productDetail.initialStockQty')} value={variantForm.initial_stock} onChangeText={(v) => setVariantForm((f) => ({ ...f, initial_stock: v }))} keyboardType="number-pad" placeholder="0" />
          {!scopedShopId && shops.length > 1 ? <>
            <Text style={styles.label}>{t('seller.productDetail.stockLocation')}</Text>
            <View style={styles.chips}>{shops.map((s) => <Chip key={s.id} label={`${s.name} (${s.city || ''})`} selected={variantForm.shop_id === s.id} onPress={() => setVariantForm((f) => ({ ...f, shop_id: s.id }))} styles={styles} />)}</View>
          </> : null}
          <Button title={t('seller.productDetail.saveVariant')} loading={busy} onPress={() => void createVariant()} />
        </View> : null}

        {variantsMissingAttributes.length > 0 ? <View style={styles.warnBox}><Text style={styles.text}>⚠️ {t(variantsMissingAttributes.length > 1 ? 'seller.productDetail.noAttrsIntroP' : 'seller.productDetail.noAttrsIntroS', { count: variantsMissingAttributes.length })} {t('seller.productDetail.noAttrsNames', { names: variantsMissingAttributes.map((v) => v.name || v.sku || t('seller.productDetail.unnamedVariant')).join(', ') })} {t(variantsMissingAttributes.length > 1 ? 'seller.productDetail.noAttrsCannotP' : 'seller.productDetail.noAttrsCannotS')} {t(variantsMissingAttributes.length > 1 ? 'seller.productDetail.noAttrsFixP' : 'seller.productDetail.noAttrsFixS')}</Text></View> : null}

        {variants.length === 0 ? <Text style={[styles.small, { textAlign: 'center', padding: 16 }]}>{t('seller.productDetail.noVariantsFound')}</Text> : variants.map((v) => {
          const rows = variantInventories[v.id] || []
          const available = rows.reduce((sum, i) => sum + Math.max(0, i.quantity - (i.reserved_quantity || 0)), 0)
          const total = rows.reduce((sum, i) => sum + (i.quantity || 0), 0)
          const reserved = rows.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0)
          const targetShop = scopedShopId || targetShopByVariant[v.id] || activeShop || shops[0]?.id || ''
          const attrEntries = Object.entries(v.attributes || {})
          return <View key={v.id} style={styles.variantCard}>
            <View style={styles.rowBetween}>
              <View style={styles.flex1}>
                <Text style={styles.bold}>{v.name || t('seller.productDetail.defaultVariant')}</Text>
                {v.sku ? <Text style={styles.mono}>SKU: {v.sku}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.bold}>{formatMoney(Number(v.sale_price || 0), currency)}</Text>
                <Text style={[styles.badge, v.status === 'ACTIVE' ? styles.badgeOk : styles.badgeMuted]}>{v.status}</Text>
              </View>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>{t('seller.productDetail.variantAttrsHeader')}</Text>
              <Pressable accessibilityRole="button" onPress={() => (editingAttrsFor === v.id ? setEditingAttrsFor(null) : openAttrEditor(v))}><Text style={styles.linkSmall}>{editingAttrsFor === v.id ? t('common.cancel') : attrEntries.length === 0 ? t('seller.productDetail.setAttributes') : t('seller.productDetail.editAttributes')}</Text></Pressable>
            </View>
            <View style={styles.chips}>
              {attrEntries.map(([k, val]) => <Text key={k} style={styles.attrChip}><Text style={styles.bold}>{k}:</Text> {val}</Text>)}
              {attrEntries.length === 0 ? <Text style={[styles.tiny, { color: colors.warning }]}>Aucun attribut — non sélectionnable par les acheteurs</Text> : null}
            </View>
            {editingAttrsFor === v.id ? <View style={styles.inlineForm}>
              {Object.keys(editAttrs).length === 0 ? <Text style={styles.small}>This product has no attribute names yet. Add one below.</Text> : null}
              {Object.keys(editAttrs).map((key) => <View key={key} style={styles.attrRow}>
                <Text style={[styles.bold, styles.attrLabel]}>{key}</Text>
                <TextInput style={[styles.input, styles.flex1]} value={editAttrs[key]} onChangeText={(val) => setEditAttrs((prev) => ({ ...prev, [key]: val }))} />
              </View>)}
              <View style={styles.attrRow}>
                <TextInput style={[styles.input, styles.flex1]} value={newAttrName} onChangeText={setNewAttrName} placeholder={t('seller.productDetail.newAttrNamePlaceholder')} placeholderTextColor={colors.mutedLight} />
                <Button dense variant="outline" title="+ Add" disabled={!newAttrName.trim() || newAttrName.trim() in editAttrs} onPress={() => { const name = newAttrName.trim(); if (name && !(name in editAttrs)) { setEditAttrs((prev) => ({ ...prev, [name]: '' })); setNewAttrName('') } }} />
              </View>
              <Button dense title="Enregistrer" disabled={busy} onPress={() => void saveVariantAttributes(v.id)} />
            </View> : null}
            <View style={styles.rowBetween}>
              <Text style={styles.small}>{t('seller.productDetail.availableStock')}</Text>
              <Text style={[styles.bold, { color: available > 0 ? colors.green : colors.danger }]}>{available} dispo {reserved > 0 ? `(${total} tot · ${reserved} rés)` : ''}</Text>
            </View>
            {rows.length > 0 ? rows.map((row) => <Text key={row.id} style={styles.small}>🏪 {shops.find((s) => s.id === row.shop_id)?.name ?? 'Boutique'}: <Text style={styles.bold}>{Math.max(0, row.quantity - (row.reserved_quantity || 0))}</Text> dispo</Text>) : null}
            {!scopedShopId && shops.length > 1 ? <View style={styles.chips}>{shops.map((s) => <Chip key={s.id} label={s.name} selected={targetShop === s.id} onPress={() => setTargetShopByVariant((prev) => ({ ...prev, [v.id]: s.id }))} styles={styles} />)}</View> : null}
            <View style={styles.attrRow}>
              <TextInput style={[styles.input, { width: 90 }]} value={stockByVariant[v.id] ?? ''} onChangeText={(val) => setStockByVariant((prev) => ({ ...prev, [v.id]: val }))} placeholder={t('seller.productDetail.qtyPlaceholder')} placeholderTextColor={colors.mutedLight} keyboardType="number-pad" />
              <Button dense title="+ Stock" disabled={busy} onPress={() => void addStock(v.id)} />
            </View>
          </View>
        })}
      </View>
    </ScrollView>

    {/* ── Completion editor (web: .completion-modal) ── */}
    {showCompletion ? <View style={styles.modalOverlay}>
      <View style={styles.modal}>
        <View style={styles.rowBetween}>
          <View style={styles.flex1}><Text style={styles.h3}>Compléter les variantes</Text><Text style={styles.small}>Seules les caractéristiques obligatoires à compléter sont affichées.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setShowCompletion(false)} hitSlop={8}><Text style={styles.close}>×</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 8 }} keyboardShouldPersistTaps="handled">
          {variants.filter((v) => categoryAttrDefs.some((d) => d.required && !variantHasAttribute(v.attributes, d))).map((v, index) => {
            const missingDefs = categoryAttrDefs.filter((d) => d.required && !variantHasAttribute(v.attributes, d))
            return <View key={v.id} style={styles.variantCard}>
              <Text style={styles.bold}>{variantDisplayLabel(v.attributes, categoryAttrDefs, v.name || `Variante ${index + 1}`)}</Text>
              <Text style={styles.small}>SKU : {v.sku || '—'} · Prix : {formatMoney(Number(v.sale_price || 0), currency)}</Text>
              {missingDefs.map((def) => {
                const value = completionAttrs[v.id]?.[def.key] || getAttributeValue(v.attributes, def)
                const set = (val: string) => setCompletionAttrs((prev) => ({ ...prev, [v.id]: { ...prev[v.id], [def.key]: val } }))
                return <View key={def.key} style={{ gap: 4 }}>
                  <Text style={styles.label}>{attributeLabel(def, lang)} *</Text>
                  {def.allowed_values?.length ? <View style={styles.chips}>{def.allowed_values.map((option) => <Chip key={option} label={option} selected={value === option} onPress={() => set(option)} styles={styles} />)}</View>
                    : <TextInput style={styles.input} value={value} onChangeText={set} keyboardType={def.input_type === 'NUMBER' ? 'decimal-pad' : 'default'} placeholder={def.input_type === 'DATE' ? 'AAAA-MM-JJ' : undefined} placeholderTextColor={colors.mutedLight} />}
                </View>
              })}
              <Button dense variant="outline" title="Enregistrer cette variante" disabled={busy} onPress={() => void saveCompletion([v.id])} />
            </View>
          })}
        </ScrollView>
        <View style={[styles.wrapRow, { justifyContent: 'flex-end' }]}>
          <Button dense variant="outline" title="Annuler" onPress={() => setShowCompletion(false)} />
          <Button dense title="Enregistrer toutes les modifications" disabled={busy} onPress={() => void saveCompletion(variants.filter((v) => categoryAttrDefs.some((d) => d.required && !variantHasAttribute(v.attributes, d))).map((v) => v.id), true)} />
        </View>
      </View>
    </View> : null}
  </View>
}

type S = ReturnType<typeof makeStyles>

function Chip({ label, selected, onPress, disabled, styles }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; styles: S }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text></Pressable>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  flex1: { flex: 1 },
  page: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 28, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 8 },
  header: { gap: 6, alignItems: 'flex-start' },
  h1: { fontSize: 24, fontWeight: '700', color: c.ink },
  h2: { fontSize: 20, fontWeight: '700', color: c.ink },
  h3: { fontSize: 17, fontWeight: '700', color: c.ink },
  h4: { fontSize: 15, fontWeight: '700', color: c.ink },
  text: { color: c.ink, fontSize: 14 },
  bold: { color: c.ink, fontWeight: '700', fontSize: 14 },
  muted: { color: c.muted, fontSize: 15 },
  small: { color: c.muted, fontSize: 13 },
  tiny: { color: c.muted, fontSize: 12 },
  label: { color: c.ink, fontWeight: '700', fontSize: 13 },
  mono: { fontFamily: 'monospace', color: c.muted, fontSize: 12 },
  bigStat: { fontSize: 20, fontWeight: '700' },
  strike: { textDecorationLine: 'line-through', color: c.muted, fontSize: 14 },
  linkSmall: { color: c.green, fontSize: 12, fontWeight: '700' },
  removeText: { color: c.danger, fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: c.white, borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, gap: 12, boxShadow: '0px 1px 2px rgba(0,0,0,0.06)' },
  inlineForm: { gap: 10, padding: 12, borderRadius: radius.sm, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
  errorBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.dangerSoft, borderWidth: 1, borderColor: c.danger },
  errorText: { color: c.danger },
  successBox: { padding: 12, borderRadius: radius.sm, backgroundColor: c.successSoft, borderWidth: 1, borderColor: c.success },
  successText: { color: c.success, fontWeight: '600' },
  warnBox: { padding: 12, gap: 8, borderRadius: radius.sm, backgroundColor: c.warningSoft, borderWidth: 1, borderColor: c.warning },
  reqItem: { gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border, alignItems: 'flex-start' },
  previewBox: { padding: 12, gap: 4, borderRadius: 8, backgroundColor: c.goldSoft, borderWidth: 1, borderColor: c.border },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  badge: { fontSize: 12, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden' },
  badgeOk: { backgroundColor: c.successSoft, color: c.success },
  badgeWarn: { backgroundColor: c.warningSoft, color: c.warning },
  badgeMuted: { backgroundColor: c.surface2, color: c.muted },
  badgeOutline: { fontSize: 12, color: c.ink, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: c.border },
  specCell: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: c.borderControl, backgroundColor: c.white },
  chipOn: { backgroundColor: c.green, borderColor: c.green },
  chipText: { color: c.ink, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: c.onGreen },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: c.borderControl, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: c.green, borderColor: c.green },
  checkMark: { color: c.onGreen, fontWeight: '900', fontSize: 13 },
  input: { minHeight: 40, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: c.borderControl, backgroundColor: c.white, color: c.ink, fontSize: 14 },
  attrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attrLabel: { width: 90 },
  xBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  attrChip: { fontSize: 12, color: c.ink, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border },
  photoCard: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  photo: { width: 110, height: 110, borderRadius: radius.sm, backgroundColor: c.surfaceAlt },
  photoBadge: { position: 'absolute', top: 6, left: 6 },
  variantCard: { gap: 8, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.white },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 12, zIndex: 100 },
  modal: { backgroundColor: c.white, borderRadius: 16, padding: 16, gap: 8, maxHeight: '90%' },
  close: { fontSize: 26, color: c.muted, lineHeight: 28 },
})
