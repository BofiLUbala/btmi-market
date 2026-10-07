import { useEffect, useMemo, useRef, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { confirmAction } from '../../../src/lib/confirmAction'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading } from '../../../src/components/ui'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { fonts, spacing, radius, shadow, type Colors } from '../../../src/theme'
import { prepareProductImageUpload, type UploadFile } from '../../../src/lib/imageUpload'
import { categoryLabel, subcategoryLabel } from '../../../src/lib/categoryLabels'
import { attributeLabel } from '../../../src/lib/attributeLabels'
import {
  POPULAR_CUSTOM_CHARACTERISTICS,
  type AttributeClassification, type AttributeSuggestion,
} from '../../../src/lib/categorySuggestions'
import type { Category, Shop } from '../../../src/types'
import { formatMoney } from '../../../src/lib/money'
import { DescriptionEditor } from '../../../src/components/DescriptionEditor'
import { OptionPicker } from '../../../src/components/OptionPicker'
import { attributeOptions, sameAttribute, splitValues, VARIANT_TYPE_NAMES } from '../../../src/lib/attributeOptions'

/* ── Types ──────────────────────────────────────────────── */

/** One seller-declared product characteristic. VARIANT ones multiply into
 *  purchasable combinations; INFO ones are copied onto every variant as plain
 *  specifications. Same split as the web create page. */
interface CharacteristicRow {
  id: string
  name: string
  type: AttributeClassification
  values: string
  placeholder?: string
  definitionKey?: string
}

interface ComboRow {
  key: string
  label: string
  attributes: Record<string, string>
  price: string
  stock: string
}

/** What the pipeline has already committed server-side. Retrying reads this
 *  and resumes, so a timeout on step 4 never creates a second product. */
interface PipelineProgress {
  productId?: string
  resolvedVariants: Array<{ variantId: string; stock: number }>
  uploadedImages: number
  stockDone: boolean
  published: boolean
}

const MAX_IMAGES = 10

function cartesian(attrs: Array<{ name: string; values: string[] }>): Array<Record<string, string>> {
  return attrs.reduce<Array<Record<string, string>>>(
    (acc, attr) => acc.flatMap((combo) => attr.values.map((v) => ({ ...combo, [attr.name]: v.trim() }))),
    [{}],
  )
}

const newRowId = () => `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

/* ── Screen ─────────────────────────────────────────────── */

export default function SellerProductCreateScreen() {
  const queryClient = useQueryClient()
  const { t, lang } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveShop = useAuth((s) => s.setActiveShop)


  const categories = useQuery({ queryKey: ['seller', 'categories'], queryFn: sellerApi.categories })
  const shops = useQuery({
    queryKey: ['seller', 'shops', activeBusiness?.id],
    queryFn: () => sellerApi.shops(activeBusiness!.id),
    enabled: Boolean(activeBusiness),
  })

  /* Shop context. The list is always scoped to the active business, so a
     product can never be attached to another business's shop. */
  // web: /seller/shops/:shopId/products/new pins the shop; `?shop=` is that on mobile
  const { shop: shopParam } = useLocalSearchParams<{ shop?: string }>()
  const [shopId, setShopId] = useState('')
  useEffect(() => {
    if (shopId || !shops.data?.length) return
    const preferred = typeof shopParam === 'string' && shopParam ? shopParam : activeShop
    const restored = preferred && shops.data.some((s: Shop) => s.id === preferred) ? preferred : ''
    if (restored) setShopId(restored)
  }, [shops.data, activeShop, shopId, shopParam])

  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [form, setForm] = useState({
    name: '', sku: '', unit: 'PCS', unit_price: '', cost_price: '', description: '',
    discount_active: false, discount_type: 'PERCENTAGE', discount_value: '',
  })
  const [selfRating, setSelfRating] = useState(0)
  const [images, setImages] = useState<UploadFile[]>([])
  const [pickingImage, setPickingImage] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const [characteristics, setCharacteristics] = useState<CharacteristicRow[]>([])
  const [combosState, setCombosState] = useState<ComboRow[]>([])
  const [simpleStock, setSimpleStock] = useState('0')

  const [busy, setBusy] = useState(false)
  const [stepLabel, setStepLabel] = useState('')
  const [error, setError] = useState('')
  const publishIntentRef = useRef<'DRAFT' | 'PUBLISHED'>('PUBLISHED')
  const progressRef = useRef<PipelineProgress>({ resolvedVariants: [], uploadedImages: 0, stockDone: false, published: false })
  /* One key per visit to this screen. The JSON timeout is short enough that a
     slow create can abort after the server committed it; replaying the same
     key returns that product instead of making a second one. */
  const idempotencyKeyRef = useRef(`pc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  const [partialFailure, setPartialFailure] = useState<{ stage: string; message: string } | null>(null)

  const selectedShop = shops.data?.find((s: Shop) => s.id === shopId)
  const selectedCategory = categories.data?.find((c: Category) => c.id === categoryId)
  const subcategories = selectedCategory?.subcategories ?? []
  const selectedSubcategory = subcategories.find((s: Category) => s.id === subcategoryId)

  const categoryAttributesQuery = useQuery({
    queryKey: ['categoryAttributes', categoryId, subcategoryId],
    queryFn: () => sellerApi.categoryAttributes(categoryId, subcategoryId),
    enabled: Boolean(categoryId),
  })

  /* The DB API is the sole source of category fields and requirements. */
  const categorySuggestions = useMemo<Array<AttributeSuggestion & { definitionKey?: string }>>(() => {
    return (categoryAttributesQuery.data ?? []).map((def) => ({
      name: lang === 'fr'
        ? (def.label_fr || def.label_en || def.key)
        : (def.label_en || def.label_fr || def.key),
      recommendedType: (def.variant_attribute ? 'VARIANT' : 'INFO') as AttributeClassification,
      placeholder: def.allowed_values?.join(', ') || undefined,
      definitionKey: def.key,
    }))
  }, [categoryAttributesQuery.data, lang])

  const requiredAttributeAliases = useMemo(() => {
    const reqs = new Set<string>()
    for (const def of categoryAttributesQuery.data ?? []) {
      if (def.required) {
        reqs.add(def.key.toLowerCase())
        if (def.label_en) reqs.add(def.label_en.toLowerCase())
        if (def.label_fr) reqs.add(def.label_fr.toLowerCase())
      }
    }
    return reqs
  }, [categoryAttributesQuery.data])

  const requiredAttributeLabels = useMemo(() => {
    return (categoryAttributesQuery.data ?? [])
      .filter((def) => def.required)
      .map((def) => lang === 'fr'
        ? (def.label_fr || def.label_en || def.key)
        : (def.label_en || def.label_fr || def.key))
  }, [categoryAttributesQuery.data, lang])

  useEffect(() => {
    const definitions = categoryAttributesQuery.data
    if (!definitions) return
    setCharacteristics((previous) => definitions.map((def) => {
      const existing = previous.find((row) => row.definitionKey === def.key)
      return {
        id: existing?.id ?? `ch-${def.key}`,
        name: lang === 'fr' ? (def.label_fr || def.label_en || def.key) : (def.label_en || def.label_fr || def.key),
        type: def.variant_attribute ? 'VARIANT' : 'INFO',
        values: existing?.values ?? '',
        placeholder: def.allowed_values?.join(', ') || undefined,
        definitionKey: def.key,
      }
    }))
  }, [categoryAttributesQuery.data, lang])

  /* Combinations derived from VARIANT characteristics; INFO ones ride along on
     every combination as specifications. */
  const combos = useMemo<ComboRow[]>(() => {
    const variantAttrs = characteristics
      .filter((c) => c.type === 'VARIANT')
      .map((c) => ({ name: c.definitionKey || c.name.trim(), values: [...new Set(c.values.split(',').map((v) => v.trim()).filter(Boolean))] }))
      .filter((c) => c.name && c.values.length > 0)

    const infoAttrs: Record<string, string> = {}
    for (const c of characteristics.filter((c) => c.type === 'INFO')) {
      const n = c.definitionKey || c.name.trim(); const v = c.values.trim()
      if (n && v) infoAttrs[n] = v
    }

    if (variantAttrs.length === 0) return []
    return cartesian(variantAttrs).map((attrSet) => {
      const label = Object.values(attrSet).join(' / ')
      return { key: label, label, attributes: { ...infoAttrs, ...attrSet }, price: form.unit_price, stock: '0' }
    })
  }, [characteristics, form.unit_price])

  // Recomputing the combinations (a characteristic or the product price
  // changed) must not wipe what the seller typed: keep each surviving
  // combination's stock, and its price unless it still follows the product
  // price.
  const lastUnitPrice = useRef(form.unit_price)
  useEffect(() => {
    const previousDefault = lastUnitPrice.current
    lastUnitPrice.current = form.unit_price
    setCombosState((prev) => {
      const byKey = new Map(prev.map((c) => [c.key, c]))
      return combos.map((combo) => {
        const old = byKey.get(combo.key)
        if (!old) return combo
        const followsProductPrice = !old.price.trim() || old.price === previousDefault
        return { ...combo, stock: old.stock, price: followsProductPrice ? combo.price : old.price }
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combos])
  const activeCombos = combosState.length > 0 ? combosState : combos
  const isVariantMode = activeCombos.length > 0
  const totalUnits = isVariantMode
    ? activeCombos.reduce((sum, c) => sum + Math.max(0, parseInt(c.stock, 10) || 0), 0)
    : Math.max(0, parseInt(simpleStock, 10) || 0)

  /* The names the backend will see as "filled in" — the same union of variant
     attribute names it computes in requireCategoryAttributes. */
  const missingAttributes = useMemo(() => (categoryAttributesQuery.data ?? [])
    .filter((def) => def.required && !characteristics.some((row) =>
      row.values.trim() && row.definitionKey === def.key))
    .map((def) => lang === 'fr' ? (def.label_fr || def.label_en || def.key) : (def.label_en || def.label_fr || def.key)),
  [categoryAttributesQuery.data, characteristics, lang])

  /* ── Characteristics ── */
  function addSuggestion(s: AttributeSuggestion & { definitionKey?: string }) {
    if (characteristics.some((c) => c.name.trim().toLowerCase() === s.name.toLowerCase())) return
    setCharacteristics((prev) => [...prev, { id: newRowId(), name: s.name, type: s.recommendedType, values: '', placeholder: s.placeholder, definitionKey: s.definitionKey }])
  }
  function addCustomCharacteristic(name = '') {
    setCharacteristics((prev) => [...prev, { id: newRowId(), name, type: 'VARIANT', values: '' }])
  }
  function updateCharacteristic<K extends keyof CharacteristicRow>(id: string, field: K, value: CharacteristicRow[K]) {
    setCharacteristics((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }
  function removeCharacteristic(id: string) {
    setCharacteristics((prev) => prev.filter((c) => c.id !== id))
  }
  function updateCombo(key: string, field: 'price' | 'stock', value: string) {
    setCombosState((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)))
  }

  /* ── Images ── */
  async function addImageFrom(source: 'camera' | 'library') {
    if (images.length >= MAX_IMAGES) { confirmAction(t('seller.productForm.maxPhotos')); return }
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      confirmAction(
        t(source === 'camera' ? 'profile.cameraNeeded' : 'profile.photosNeeded'),
        t(source === 'camera' ? 'profile.cameraNeededBody' : 'profile.photosNeededBody'),
      )
      return
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, selectionLimit: MAX_IMAGES - images.length })
    if (result.canceled || !result.assets.length) return

    setPickingImage(true)
    try {
      // Normalise now rather than at upload time: a rejected photo should be
      // reported while the seller is still on the photo step.
      const prepared = await Promise.all(result.assets.slice(0, MAX_IMAGES - images.length).map((a) => prepareProductImageUpload(a)))
      setImages((prev) => [...prev, ...prepared].slice(0, MAX_IMAGES))
    } catch {
      confirmAction(t('common.error'), t('seller.productForm.photoPrepareFailed'))
    } finally {
      setPickingImage(false)
    }
  }

  function pickImage() {
    confirmAction(t('seller.productForm.addPhoto'), undefined, [
      { text: t('profile.takePhoto'), onPress: () => void addImageFrom('camera') },
      { text: t('profile.chooseFromGallery'), onPress: () => void addImageFrom('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }
  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }
  function makePrimary(index: number) {
    if (index === 0) return
    setImages((prev) => { const copy = [...prev]; const [img] = copy.splice(index, 1); return [img, ...copy] })
  }

  /* ── Validation ──
     Mirrors validate() on the web create page, including the rule that a draft
     is a work in progress so category requirements only gate publication. */
  function validate(intent: 'DRAFT' | 'PUBLISHED'): string {
    if (!shopId) return t('seller.productForm.validation.selectShop')
    if (!categoryId) return t('seller.productForm.validation.selectCategory')
    if (!form.name.trim()) return t('seller.productForm.validation.nameRequired')
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price <= 0) return t('seller.productForm.validation.validPrice')
    if (selfRating < 1 || selfRating > 5) return t('seller.productForm.validation.selfRatingRequired')

    if (form.discount_active) {
      const discount = parseFloat(form.discount_value)
      if (isNaN(discount) || discount <= 0) return t('seller.productForm.validation.promoValue')
      if (form.discount_type === 'PERCENTAGE' && discount > 100) return t('seller.productForm.validation.percentMax')
      if (form.discount_type === 'FIXED' && discount >= price) return t('seller.productForm.validation.fixedMax')
    }

    if (intent === 'PUBLISHED' && missingAttributes.length > 0) {
      return t('seller.productForm.validation.missingAttributes', { attributes: missingAttributes.join(', ') })
        + ' ' + t(missingAttributes.length > 1 ? 'seller.productForm.validation.missingThem' : 'seller.productForm.validation.missingIt')
    }
    if (intent === 'PUBLISHED' && categoryAttributesQuery.isError) {
      return t('seller.productForm.requirementsUnavailable')
    }

    if (isVariantMode) {
      for (const combo of activeCombos) {
        const p = parseFloat(combo.price || form.unit_price)
        if (isNaN(p) || p <= 0) return t('seller.productForm.validation.variantPrice', { label: combo.label })
        const s = parseInt(combo.stock, 10)
        if (isNaN(s) || s < 0) return t('seller.productForm.validation.variantStock', { label: combo.label })
      }
    } else if (isNaN(parseInt(simpleStock, 10)) || parseInt(simpleStock, 10) < 0) {
      return t('seller.productForm.validation.stockNonNegative')
    }
    return ''
  }

  /* ── Submission pipeline ──
     The same five backend calls, in the same order, as the web create page.
     Every stage records what it committed in `progressRef`, so Retry resumes
     instead of re-creating anything. */
  async function runPipeline() {
    if (!activeBusiness || !shopId) return
    const progress = progressRef.current
    setError('')
    setPartialFailure(null)

    try {
      /* Step 1 — Create the Product, always as DRAFT first. */
      let productId = progress.productId
      if (!productId) {
        setStepLabel(t('seller.productForm.stepCreatingProduct'))
        const created = await sellerApi.createProduct(activeBusiness.id, {
          name: form.name.trim(),
          sku: form.sku.trim() || undefined,
          description: form.description.trim() || undefined,
          unit: form.unit.trim() || 'PCS',
          unit_price: parseFloat(form.unit_price),
          cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
          category_id: categoryId,
          subcategory_id: subcategoryId || undefined,
          publication_status: 'DRAFT',
          self_rating: selfRating,
          idempotency_key: idempotencyKeyRef.current,
          discount_active: form.discount_active,
          discount_type: form.discount_type,
          discount_value: form.discount_active ? parseFloat(form.discount_value) : 0,
        })
        productId = created.id
        progress.productId = productId
      }

      /* Step 2 — Resolve variants. createProduct already made a default one
         server-side, so it is updated rather than duplicated. */
      if (progress.resolvedVariants.length === 0) {
        setStepLabel(t('seller.productForm.stepConfiguringVariants'))
        const existing = await sellerApi.variants(activeBusiness.id, productId!)
        let defaultVariant = existing[0]
        if (!defaultVariant) {
          defaultVariant = await sellerApi.createVariant(activeBusiness.id, productId!, {
            name: form.name.trim(), sale_price: parseFloat(form.unit_price), unit: form.unit.trim() || 'PCS',
          })
        }

        if (!isVariantMode) {
          const attrs: Record<string, string> = {}
          for (const c of characteristics) {
            const name = c.definitionKey || c.name.trim()
            const value = c.values.split(',')[0]?.trim()
            if (name && value) attrs[name] = value
          }
          const updated = await sellerApi.updateVariant(defaultVariant.id, {
            sale_price: parseFloat(form.unit_price),
            purchase_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
            ...(Object.keys(attrs).length > 0 ? { attributes: attrs } : {}),
          })
          progress.resolvedVariants.push({ variantId: updated.id, stock: Math.max(0, parseInt(simpleStock, 10) || 0) })
        } else {
          for (let i = 0; i < activeCombos.length; i++) {
            const combo = activeCombos[i]
            const payload = {
              name: `${form.name.trim()} — ${combo.label}`,
              sku: form.sku.trim() ? `${form.sku.trim()}-${i + 1}` : undefined,
              attributes: combo.attributes,
              sale_price: parseFloat(combo.price || form.unit_price),
              purchase_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
              unit: form.unit.trim() || 'PCS',
            }
            const variant = i === 0 && defaultVariant
              ? await sellerApi.updateVariant(defaultVariant.id, payload)
              : await sellerApi.createVariant(activeBusiness.id, productId!, payload)
            progress.resolvedVariants.push({ variantId: variant.id, stock: Math.max(0, parseInt(combo.stock, 10) || 0) })
          }
        }
      }

      /* Step 3 — Persist images, primary first. */
      if (progress.uploadedImages < images.length) {
        setStepLabel(t('seller.productForm.stepUploadingImages'))
        for (let i = progress.uploadedImages; i < images.length; i++) {
          await sellerApi.uploadProductImage(activeBusiness.id, productId!, images[i], i === 0)
          progress.uploadedImages += 1
        }
      }

      /* Step 4 — Shop-scoped stock. The offer row is always written, even at
         zero: the marketplace only lists a Product that has inventory in one
         of its business's shops, so skipping this publishes a Product nobody
         can find. */
      if (!progress.stockDone && progress.resolvedVariants.length > 0) {
        setStepLabel(t('seller.productForm.stepAddingStock'))
        for (const entry of progress.resolvedVariants) {
          await sellerApi.addStock(shopId, { variant_id: entry.variantId, quantity: entry.stock, notes: t('seller.productForm.initialStock') })
        }
        progress.stockDone = true
      }

      /* Step 5 — Publish only once the product is complete. The backend
         re-validates and is the authority; a rejection leaves it a DRAFT. */
      if (publishIntentRef.current === 'PUBLISHED' && !progress.published) {
        setStepLabel(t('seller.productForm.stepPublishing'))
        await sellerApi.updateProduct(activeBusiness.id, productId!, { status: 'ACTIVE', publication_status: 'PUBLISHED' })
        progress.published = true
      }

      await queryClient.invalidateQueries({ queryKey: ['seller', 'products'] })
      if (progress.published) {
        // The buyer tab remains mounted while the seller creates a product.
        // Force its cached catalog to reload when the seller returns to Market.
        await queryClient.invalidateQueries({ queryKey: ['marketplace'] })
      }

      setActiveShop(shopId)
      router.replace(`/seller/products/${productId}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('seller.productForm.genericError')
      setPartialFailure({ stage: stepLabel || t('seller.productForm.processing'), message })
    } finally {
      setBusy(false)
      setStepLabel('')
    }
  }

  function submit(intent: 'DRAFT' | 'PUBLISHED') {
    if (busy) return
    publishIntentRef.current = intent
    const validationError = validate(intent)
    if (validationError) { setError(validationError); return }
    setError('')
    setBusy(true)
    void runPipeline()
  }

  /* ── Render ── */
  if (!activeBusiness) return <View style={styles.center}><Text style={styles.muted}>{t('seller.noBusinessSelected')}</Text></View>
  if (categories.isLoading || shops.isLoading) return <Loading label={t('common.loading')} />
  if (categories.isError) return <ErrorState message={t('seller.productForm.loadShopFailed')} retry={() => void categories.refetch()} />

  const price = parseFloat(form.unit_price) || 0
  const discountValue = parseFloat(form.discount_value) || 0
  const promoPrice = !form.discount_active ? price
    : form.discount_type === 'PERCENTAGE' ? Math.max(0, price - (price * discountValue) / 100)
      : Math.max(0, price - discountValue)

  const atMax = images.length >= MAX_IMAGES
  // Values chosen on the VARIANT characteristics, shown as the reference's
  // "Pointures / variantes disponibles" chips.
  const variantValueChips = characteristics
    .filter((c) => c.type === 'VARIANT')
    .flatMap((c) => splitValues(c.values).map((value) => ({ key: `${c.id}-${value}`, value })))

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {/* ── Header (reference 10): X close + bold title ── */}
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/seller/products'))}
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.topTitle} numberOfLines={1}>{t('sellerUi.publishItem')}</Text>
    </View>

    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {partialFailure ? <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.couldNotComplete', { stage: partialFailure.stage })}</Text>
        <Text style={styles.muted}>{partialFailure.message}</Text>
        <Text style={styles.muted}>{t('seller.productForm.savedRetryDesc')}</Text>
        <Button title={t('common.retry')} loading={busy} onPress={() => { setBusy(true); void runPipeline() }} />
        {progressRef.current.productId ? <Button
          variant="outline"
          title={t('seller.productForm.openProductDetails')}
          onPress={() => router.replace(`/seller/products/${progressRef.current.productId}`)}
        /> : null}
      </Card> : null}

      {/* ── Photo slots: 84px rounded tiles, PRINCIPALE badge on the first,
          then dashed blue "Photo" (camera) and "Ajouter" (gallery) slots ── */}
      <View style={styles.block}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoGrid}>
          {images.map((img, index) => <View key={`${img.uri}-${index}`} style={styles.photoTile}>
            <View>
              <Image source={img.uri} style={styles.photo} contentFit="cover" accessibilityLabel={index === 0 ? t('seller.productForm.primary') : undefined} />
              {index === 0 ? <Text style={styles.primaryTag} numberOfLines={1}>{t('sellerUi.mainPhoto')}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={6} onPress={() => removeImage(index)} style={styles.photoRemoveBtn}>
                <Ionicons name="close" size={13} color="#FFFFFF" />
              </Pressable>
            </View>
            {index !== 0 ? <Pressable accessibilityRole="button" hitSlop={4} onPress={() => makePrimary(index)}><Text style={styles.photoLink} numberOfLines={2}>{t('seller.productForm.setPrimary')}</Text></Pressable> : null}
          </View>)}
          {!atMax ? <>
            <Pressable accessibilityRole="button" disabled={pickingImage} onPress={() => void addImageFrom('camera')} style={({ pressed }) => [styles.addSlot, pickingImage && styles.addSlotDisabled, pressed && styles.addSlotPressed]}>
              <Ionicons name="camera-outline" size={22} color={colors.green} />
              <Text style={styles.addSlotText} numberOfLines={1}>{pickingImage ? t('common.oneMoment') : t('sellerUi.photo')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('seller.productForm.addPhoto')} disabled={pickingImage} onPress={pickImage} style={({ pressed }) => [styles.addSlot, styles.addSlotPlain, pickingImage && styles.addSlotDisabled, pressed && styles.addSlotPressed]}>
              <Ionicons name="add" size={22} color={colors.green} />
              <Text style={styles.addSlotText} numberOfLines={1}>{t('sellerUi.add')}</Text>
            </Pressable>
          </> : null}
        </ScrollView>
        {atMax ? <Text style={styles.hint}>{t('seller.productForm.maxPhotos')}</Text> : <Text style={styles.hint}>{t('seller.productForm.photosDescMobile')}</Text>}
      </View>

      {/* ── Name, price ($) + category select ── */}
      <View style={styles.block}>
        <Text style={styles.fieldLabel}>{t('sellerUi.itemName')}</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
          autoCapitalize="words"
          placeholderTextColor={colors.mutedLight}
          accessibilityLabel={t('seller.productForm.productName')}
        />

        <View style={styles.twoCol}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>{t('sellerUi.price')}</Text>
            <View style={styles.priceBox}>
              <TextInput
                style={styles.priceInput}
                value={form.unit_price}
                onChangeText={(v) => setForm((f) => ({ ...f, unit_price: v }))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.mutedLight}
                accessibilityLabel={t('seller.productForm.salePrice')}
              />
              <Text style={styles.priceSuffix}>$</Text>
            </View>
          </View>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>{t('sellerUi.category')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: categoryOpen }}
              accessibilityLabel={t('seller.productForm.categoryLabel')}
              onPress={() => setCategoryOpen((open) => !open)}
              style={[styles.select, categoryOpen && styles.selectOpen]}
            >
              <Text style={[styles.selectText, !selectedCategory && styles.selectPlaceholder]} numberOfLines={1}>
                {selectedCategory ? categoryLabel(t, selectedCategory.slug, selectedCategory.name) : t('sellerUi.chooseCategory')}
              </Text>
              <Ionicons name={categoryOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {categoryOpen ? <View style={styles.selectList}>
          {(categories.data ?? []).map((c: Category) => <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityState={{ selected: categoryId === c.id }}
            style={({ pressed }) => [styles.selectOption, categoryId === c.id && styles.selectOptionActive, pressed && styles.selectOptionPressed]}
            onPress={() => { setCategoryId(c.id); setSubcategoryId(''); setCharacteristics([]); setCategoryOpen(false) }}
          >
            <Text style={[styles.selectOptionText, categoryId === c.id && styles.selectOptionTextActive]}>{categoryLabel(t, c.slug, c.name)}</Text>
            {categoryId === c.id ? <Ionicons name="checkmark" size={18} color={colors.green} /> : null}
          </Pressable>)}
        </View> : null}

        {subcategories.length > 0 && <>
          <Text style={styles.fieldLabel}>{t('product.subcategory')}</Text>
          <View style={styles.chipRow}>
            {subcategories.map((s: Category) => <Pressable
              key={s.id}
              accessibilityRole="button"
              style={[styles.chip, subcategoryId === s.id && styles.chipActive]}
              onPress={() => { setSubcategoryId(subcategoryId === s.id ? '' : s.id); setCharacteristics([]) }}
            >
              <Text style={[styles.chipText, subcategoryId === s.id && styles.chipTextActive]}>{subcategoryLabel(t, s.slug, s.name)}</Text>
            </Pressable>)}
          </View>
        </>}
        {requiredAttributeLabels.length > 0 && <Text style={styles.notice}>
          {t('seller.productForm.categoryRequiresNotice', { attributes: requiredAttributeLabels.join(', ') })}
        </Text>}
      </View>

      {/* The rest depends on the category (web `detailsVisible`). */}
      {categoryId ? <>
      {/* ── Pointures / variantes disponibles ── */}
      <View style={styles.block}>
        <Text style={styles.fieldLabel}>{t('sellerUi.variantsAvailable')}</Text>
        <View style={styles.chipRow}>
          {variantValueChips.map((chip) => <View key={chip.key} style={styles.valueChip}><Text style={styles.valueChipText}>{chip.value}</Text></View>)}
          <Pressable accessibilityRole="button" onPress={() => addCustomCharacteristic()} style={({ pressed }) => [styles.addChip, pressed && styles.addSlotPressed]}>
            <Text style={styles.addChipText}>+ {t('sellerUi.add')}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Description ── */}
      <DescriptionEditor categorySlug={selectedCategory?.slug} value={form.description} onChange={(description) => setForm((f) => ({ ...f, description }))} />

      {/* ── Product details (SKU, unit) ── */}
      <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.productInfo')}</Text>
        <Field label={t('seller.productForm.skuOptional')} value={form.sku} onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))} autoCapitalize="none" />
        <Field label={t('product.unit')} value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} autoCapitalize="characters" />
      </Card>

      {/* ── Pricing extras: cost, self-rating, promotion ── */}
      <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.pricingTitle')}</Text>
        <Field label={t('seller.productForm.costPriceOptional')} value={form.cost_price} onChangeText={(v) => setForm((f) => ({ ...f, cost_price: v }))} keyboardType="numeric" />

        <Text style={styles.subLabel}>{t('seller.productForm.selfRatingLabel')}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} accessibilityRole="button" onPress={() => setSelfRating(n)}>
            <Text style={[styles.star, n <= selfRating && styles.starActive]}>★</Text>
          </Pressable>)}
        </View>

        <Pressable accessibilityRole="switch" accessibilityState={{ checked: form.discount_active }} style={styles.toggleRow} onPress={() => setForm((f) => ({ ...f, discount_active: !f.discount_active }))}>
          <View style={[styles.checkbox, form.discount_active && styles.checkboxOn]}>{form.discount_active ? <Ionicons name="checkmark" size={16} color={colors.onGreen} /> : null}</View>
          <Text style={styles.toggleLabel}>{t('seller.productForm.enablePromotion')}</Text>
        </Pressable>
        {form.discount_active && <>
          <View style={styles.chipRow}>
            {(['PERCENTAGE', 'FIXED'] as const).map((type) => <Pressable
              key={type}
              accessibilityRole="button"
              style={[styles.chip, form.discount_type === type && styles.chipActive]}
              onPress={() => setForm((f) => ({ ...f, discount_type: type }))}
            >
              <Text style={[styles.chipText, form.discount_type === type && styles.chipTextActive]}>
                {t(type === 'PERCENTAGE' ? 'seller.productForm.percentageOff' : 'seller.productForm.fixedDiscount')}
              </Text>
            </Pressable>)}
          </View>
          <Field
            label={t(form.discount_type === 'PERCENTAGE' ? 'seller.productForm.discountPercentage' : 'seller.productForm.discountAmount')}
            value={form.discount_value}
            onChangeText={(v) => setForm((f) => ({ ...f, discount_value: v }))}
            keyboardType="numeric"
          />
          <Text style={styles.muted}>{t('seller.productForm.promoPreview')}: {formatMoney(promoPrice)}</Text>
        </>}
      </Card>

      {/* ── Characteristics & variants ── */}
      <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.characteristicsTitle')}</Text>
        <Text style={styles.muted}>{t('seller.productForm.characteristicsDescMobile')}</Text>
        {missingAttributes.length > 0 && <Text style={styles.notice}>
          {t('seller.productForm.validation.missingAttributes', { attributes: missingAttributes.join(', ') })}
        </Text>}

        {categorySuggestions.length > 0 && <>
          <Text style={styles.subLabel}>{t('seller.productForm.suggestedForCategory')}</Text>
          <View style={styles.chipRow}>
            {categorySuggestions.map((s) => {
              const used = characteristics.some((c) => c.name.trim().toLowerCase() === s.name.toLowerCase())
              const required = requiredAttributeAliases.has(s.name.toLowerCase())
              return <Pressable key={s.name} accessibilityRole="button" disabled={used} style={[styles.chip, used && styles.chipUsed, required && !used && styles.chipRequired]} onPress={() => addSuggestion(s)}>
                <Text style={[styles.chipText, used && styles.chipTextUsed]}>{required ? `${s.name} *` : s.name}</Text>
              </Pressable>
            })}
          </View>
        </>}

        <Text style={styles.subLabel}>{t('seller.productForm.variantChip')}</Text>
        <View style={styles.chipRow}>
          {VARIANT_TYPE_NAMES.filter((name) => !characteristics.some((c) => sameAttribute(c.name, name) || sameAttribute(c.definitionKey ?? '', name))).map((name) => <Pressable key={name} accessibilityRole="button" style={styles.addChip} onPress={() => addCustomCharacteristic(name)}>
            <Text style={styles.addChipText}>+ {name}</Text>
          </Pressable>)}
        </View>

        <Text style={styles.subLabel}>{t('seller.productForm.popularCharacteristics')}</Text>
        <View style={styles.chipRow}>
          {POPULAR_CUSTOM_CHARACTERISTICS.map((name) => <Pressable key={name} accessibilityRole="button" style={styles.chip} onPress={() => addCustomCharacteristic(attributeLabel(t, name))}>
            <Text style={styles.chipText}>{attributeLabel(t, name)}</Text>
          </Pressable>)}
        </View>
        <Button variant="outline" dense title={t('seller.productForm.addCustomCharacteristic')} onPress={() => addCustomCharacteristic()} />
      </Card>

      {characteristics.map((c) => <Card key={c.id}>
        <Field label={t('seller.productForm.attributeName')} value={c.name} onChangeText={(v) => updateCharacteristic(c.id, 'name', v)} autoCapitalize="words" editable={!c.definitionKey} />
        <View style={styles.chipRow}>
          {(['VARIANT', 'INFO'] as const).map((type) => <Pressable
            key={type}
            accessibilityRole="button"
            disabled={Boolean(c.definitionKey)}
            style={[styles.chip, c.type === type && styles.chipActive]}
            onPress={() => updateCharacteristic(c.id, 'type', type)}
          >
            <Text style={[styles.chipText, c.type === type && styles.chipTextActive]}>
              {t(type === 'VARIANT' ? 'seller.productForm.variantChip' : 'seller.productForm.infoChip')}
            </Text>
          </Pressable>)}
        </View>
        {(() => {
          // Pick, don't type: variants take several values, info one.
          const picker = attributeOptions({ key: c.definitionKey || c.name, label_fr: c.name }, selectedCategory?.slug, splitValues(c.values))
          if (!picker) {
            return <Field
              label={t(c.type === 'VARIANT' ? 'seller.productForm.valuesCommaSeparated' : 'seller.productForm.specValueLabel')}
              value={c.values}
              onChangeText={(v) => updateCharacteristic(c.id, 'values', v)}
              placeholder={c.placeholder}
            />
          }
          return <OptionPicker
            label={c.name || t('seller.productForm.specValueLabel')}
            options={picker.values}
            swatch={picker.swatch}
            multiple={c.type === 'VARIANT'}
            value={c.type === 'VARIANT' ? splitValues(c.values) : c.values}
            onChange={(next) => updateCharacteristic(c.id, 'values', Array.isArray(next) ? next.join(', ') : next)}
          />
        })()}
        {!c.definitionKey ? <Button dense variant="outline" title={t('seller.productForm.removeCharacteristic')} onPress={() => removeCharacteristic(c.id)} /> : null}
      </Card>)}

      {/* ── Shop & stock ── */}
      <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.shopTitle')}</Text>
        {!shops.data?.length ? <>
          <Text style={styles.muted}>{t('seller.productForm.noShopYet')}</Text>
          <Button variant="outline" title={t('seller.shops')} onPress={() => router.push('/seller/shops')} />
        </> : <View style={styles.chipRow}>
          {shops.data.map((s: Shop) => <Pressable
            key={s.id}
            accessibilityRole="button"
            style={[styles.chip, shopId === s.id && styles.chipActive]}
            onPress={() => setShopId(s.id)}
          >
            <Text style={[styles.chipText, shopId === s.id && styles.chipTextActive]}>{s.name}</Text>
          </Pressable>)}
        </View>}
        {selectedShop ? <Text style={styles.muted}>{t('seller.productForm.stockScopedDesc', { shop: selectedShop.name })}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.stockTitle')}</Text>
        {!isVariantMode
          ? <Field label={t('seller.productForm.initialStock')} value={simpleStock} onChangeText={setSimpleStock} keyboardType="numeric" />
          : activeCombos.map((combo) => <View key={combo.key} style={styles.comboRow}>
            <Text style={styles.comboLabel}>{combo.label}</Text>
            <Field label={t('seller.productForm.salePriceFc')} value={combo.price} onChangeText={(v) => updateCombo(combo.key, 'price', v)} keyboardType="numeric" />
            <Field label={t('seller.productForm.initialStock')} value={combo.stock} onChangeText={(v) => updateCombo(combo.key, 'stock', v)} keyboardType="numeric" />
          </View>)}
        <Text style={styles.muted}>{t('seller.productForm.totalStock')} {totalUnits} {t('seller.productForm.unitsPlural')}</Text>
      </Card>

      {/* ── Review ── */}
      <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.reviewTitle')}</Text>
        <SummaryRow styles={styles} label={t('seller.productForm.productName')} value={form.name.trim() || '—'} />
        <SummaryRow styles={styles} label={t('seller.productForm.categoryLabel')} value={[
          selectedCategory ? categoryLabel(t, selectedCategory.slug, selectedCategory.name) : '',
          selectedSubcategory ? subcategoryLabel(t, selectedSubcategory.slug, selectedSubcategory.name) : '',
        ].filter(Boolean).join(' › ') || '—'} />
        <SummaryRow styles={styles} label={t('seller.productForm.salePrice')} value={`${formatMoney(price)}`} />
        <SummaryRow styles={styles} label={t('seller.productForm.summaryImages')} value={String(images.length)} />
        <SummaryRow styles={styles} label={t('seller.productForm.summaryVariants')} value={String(isVariantMode ? activeCombos.length : 1)} />
        <SummaryRow styles={styles} label={t('seller.productForm.summaryStockHere')} value={String(totalUnits)} />
        <SummaryRow styles={styles} label={t('seller.productForm.shopTitle')} value={selectedShop?.name ?? '—'} />
        {missingAttributes.length > 0 && <Text style={styles.notice}>
          {t('seller.productForm.validation.missingAttributes', { attributes: missingAttributes.join(', ') })}
          {' '}{t('seller.productForm.validation.missingThem')}
        </Text>}
      </Card>
      </> : null}
    </ScrollView>

    {/* ── Bottom bar: "Brouillon" (outline, saves a DRAFT) + "Publier" ── */}
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {stepLabel ? <Text style={styles.stepText}>{stepLabel}</Text> : null}
      {/* Repeated by the buttons: the top copy is off-screen on a long form. */}
      {error ? <Text style={styles.error} accessibilityRole="alert" numberOfLines={3}>{error}</Text> : null}
      <View style={styles.bottomRow}>
        <Button style={styles.flex1} variant="outline" title={t('sellerUi.draft')} loading={busy && publishIntentRef.current === 'DRAFT'} disabled={busy} onPress={() => submit('DRAFT')} />
        <Button style={styles.flex1} title={t('sellerUi.publish')} loading={busy && publishIntentRef.current === 'PUBLISHED'} disabled={busy || missingAttributes.length > 0 || categoryAttributesQuery.isError || categoryAttributesQuery.isLoading} onPress={() => submit('PUBLISHED')} />
      </View>
    </View>
  </KeyboardAvoidingView>
}

function SummaryRow({ styles, label, value }: { styles: ReturnType<typeof makeStyles>; label: string; value: string }) {
  return <View style={styles.summaryRow}>
    <Text style={styles.muted}>{label}</Text>
    <Text style={styles.summaryValue} numberOfLines={2}>{value}</Text>
  </View>
}

/* Reference 10 "Publier un article": white page, X + bold title, photo slots,
   filled labelled inputs, blue-bordered price, select, chips, bottom bar. */
const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  topTitle: { flex: 1, fontSize: 20, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.3, color: colors.ink },
  page: { padding: spacing.md, gap: 18, paddingBottom: spacing.xl, backgroundColor: colors.white },
  block: { gap: 8 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  flex1: { flex: 1 },
  muted: { color: colors.muted },
  hint: { color: colors.muted, fontSize: 12 },
  subLabel: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  fieldLabel: { color: colors.ink, fontWeight: '600', fontSize: 13, marginTop: 2 },
  error: { color: colors.danger, fontWeight: '700' },
  notice: { color: colors.gold, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontFamily: fonts.display, fontWeight: '700', letterSpacing: -0.2, color: colors.ink },

  // Filled inputs like the shared `Field`; the price gets the blue border.
  input: { minHeight: 50, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, color: colors.ink, fontSize: 15 },
  twoCol: { flexDirection: 'row', gap: 10 },
  priceBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.green, borderRadius: radius.sm, paddingHorizontal: 14 },
  priceInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 16, fontWeight: '700' },
  priceSuffix: { color: colors.green, fontSize: 15, fontWeight: '700', marginLeft: 6 },
  select: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14 },
  selectOpen: { borderColor: colors.green },
  selectText: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' },
  selectPlaceholder: { color: colors.mutedLight, fontWeight: '400' },
  selectList: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, backgroundColor: colors.white, overflow: 'hidden', ...shadow.card },
  selectOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  selectOptionActive: { backgroundColor: colors.greenSoft },
  selectOptionPressed: { backgroundColor: colors.surface2 },
  selectOptionText: { color: colors.ink, fontSize: 14.5, fontWeight: '600' },
  selectOptionTextActive: { color: colors.green, fontWeight: '700' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipRequired: { borderColor: colors.gold },
  chipUsed: { opacity: 0.45 },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.onNavy },
  chipTextUsed: { color: colors.muted },
  // Chosen variant values: filled navy pills; "+ Ajouter": outlined blue.
  valueChip: { minHeight: 34, minWidth: 40, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.navy },
  valueChipText: { color: colors.onNavy, fontWeight: '700', fontSize: 13 },
  addChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.green, backgroundColor: colors.white },
  addChipText: { color: colors.green, fontWeight: '700', fontSize: 13 },

  stars: { flexDirection: 'row', gap: spacing.xs },
  star: { fontSize: 32, color: colors.starEmpty },
  starActive: { color: colors.star },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.borderControl, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.green, borderColor: colors.green },
  toggleLabel: { color: colors.ink, fontWeight: '700', flex: 1 },

  // Photo slots: 84px rounded-14 tiles.
  photoGrid: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  photoTile: { width: 84, gap: 4 },
  photo: { width: 84, height: 84, borderRadius: 14, backgroundColor: colors.surfaceAlt },
  primaryTag: { position: 'absolute', left: 5, top: 5, maxWidth: 74, overflow: 'hidden', backgroundColor: colors.green, color: colors.onGreen, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6 },
  photoRemoveBtn: { position: 'absolute', right: 5, top: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  photoLink: { color: colors.green, fontWeight: '700', fontSize: 11, textAlign: 'center' },
  addSlot: { width: 84, height: 84, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.green, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  addSlotPlain: { backgroundColor: colors.white },
  addSlotDisabled: { opacity: 0.5 },
  addSlotPressed: { opacity: 0.75 },
  addSlotText: { color: colors.green, fontWeight: '700', fontSize: 11, textAlign: 'center' },

  comboRow: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  comboLabel: { color: colors.ink, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  summaryValue: { color: colors.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' },

  // Sticky bottom action bar.
  bottomBar: { gap: 8, paddingHorizontal: spacing.md, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, ...shadow.card },
  bottomRow: { flexDirection: 'row', gap: 10 },
  stepText: { color: colors.muted, fontSize: 12 },
})
