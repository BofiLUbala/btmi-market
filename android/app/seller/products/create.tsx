import { useEffect, useMemo, useRef, useState } from 'react'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { sellerApi } from '../../../src/api'
import { ApiError } from '../../../src/api/client'
import { useAuth } from '../../../src/store/auth'
import { Button, Card, ErrorState, Field, Loading, SectionTitle } from '../../../src/components/ui'
import { useI18n } from '../../../src/store/i18n'
import { useColors } from '../../../src/store/theme'
import { spacing, radius, type Colors } from '../../../src/theme'
import { prepareProductImageUpload, type UploadFile } from '../../../src/lib/imageUpload'
import {
  getCategoryRequirements, getCategorySuggestions, missingRequiredAttributes,
  POPULAR_CUSTOM_CHARACTERISTICS,
  type AttributeClassification, type AttributeSuggestion,
} from '../../../src/lib/categorySuggestions'
import type { Category, Shop } from '../../../src/types'

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

const STEP_COUNT = 7
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
  const { t } = useI18n()
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const activeBusiness = useAuth((s) => s.activeBusiness)
  const activeShop = useAuth((s) => s.activeShop)
  const setActiveShop = useAuth((s) => s.setActiveShop)

  const [step, setStep] = useState(1)

  const categories = useQuery({ queryKey: ['seller', 'categories'], queryFn: sellerApi.categories })
  const shops = useQuery({
    queryKey: ['seller', 'shops', activeBusiness?.id],
    queryFn: () => sellerApi.shops(activeBusiness!.id),
    enabled: Boolean(activeBusiness),
  })

  /* Shop context. The list is always scoped to the active business, so a
     product can never be attached to another business's shop. */
  const [shopId, setShopId] = useState('')
  useEffect(() => {
    if (shopId || !shops.data?.length) return
    const restored = activeShop && shops.data.some((s: Shop) => s.id === activeShop) ? activeShop : ''
    if (restored) setShopId(restored)
  }, [shops.data, activeShop, shopId])

  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [form, setForm] = useState({
    name: '', sku: '', unit: 'PCS', unit_price: '', cost_price: '', description: '',
    discount_active: false, discount_type: 'PERCENTAGE', discount_value: '',
  })
  const [selfRating, setSelfRating] = useState(0)
  const [images, setImages] = useState<UploadFile[]>([])
  const [pickingImage, setPickingImage] = useState(false)
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

  /* DB API is the primary source of truth. Fallback to static client map only if offline or pending. */
  const categorySuggestions = useMemo<AttributeSuggestion[]>(() => {
    if (categoryAttributesQuery.data && categoryAttributesQuery.data.length > 0) {
      return categoryAttributesQuery.data.map((def) => ({
        name: def.key,
        recommendedType: (def.variant_attribute ? 'VARIANT' : 'INFO') as AttributeClassification,
      }))
    }
    if (!selectedCategory) return []
    if (selectedSubcategory) {
      const subs = getCategorySuggestions(selectedSubcategory.slug || selectedSubcategory.name)
      if (subs.length > 0) return subs
    }
    return getCategorySuggestions(selectedCategory.slug || selectedCategory.name)
  }, [categoryAttributesQuery.data, selectedCategory, selectedSubcategory])

  const categoryRequirements = useMemo(
    () => getCategoryRequirements(
      selectedCategory?.slug || selectedCategory?.name,
      selectedSubcategory?.slug || selectedSubcategory?.name,
    ),
    [selectedCategory, selectedSubcategory],
  )

  const requiredAttributeNames = useMemo(() => {
    if (categoryAttributesQuery.data && categoryAttributesQuery.data.length > 0) {
      const reqs = new Set<string>()
      for (const def of categoryAttributesQuery.data) {
        if (def.required) {
          reqs.add(def.key.toLowerCase())
          if (def.label_en) reqs.add(def.label_en.toLowerCase())
          if (def.label_fr) reqs.add(def.label_fr.toLowerCase())
        }
      }
      return reqs
    }
    return new Set([
      ...(categoryRequirements.allOf ?? []),
      ...(categoryRequirements.anyOf ?? []).flat(),
    ].map((n) => n.toLowerCase()))
  }, [categoryAttributesQuery.data, categoryRequirements])

  /* Combinations derived from VARIANT characteristics; INFO ones ride along on
     every combination as specifications. */
  const combos = useMemo<ComboRow[]>(() => {
    const variantAttrs = characteristics
      .filter((c) => c.type === 'VARIANT')
      .map((c) => ({ name: c.name.trim(), values: c.values.split(',').map((v) => v.trim()).filter(Boolean) }))
      .filter((c) => c.name && c.values.length > 0)

    const infoAttrs: Record<string, string> = {}
    for (const c of characteristics.filter((c) => c.type === 'INFO')) {
      const n = c.name.trim(); const v = c.values.trim()
      if (n && v) infoAttrs[n] = v
    }

    if (variantAttrs.length === 0) return []
    return cartesian(variantAttrs).map((attrSet) => {
      const label = Object.values(attrSet).join(' / ')
      return { key: label, label, attributes: { ...infoAttrs, ...attrSet }, price: form.unit_price, stock: '0' }
    })
  }, [characteristics, form.unit_price])

  useEffect(() => { setCombosState(combos) }, [combos])
  const activeCombos = combosState.length > 0 ? combosState : combos
  const isVariantMode = activeCombos.length > 0
  const totalUnits = isVariantMode
    ? activeCombos.reduce((sum, c) => sum + Math.max(0, parseInt(c.stock, 10) || 0), 0)
    : Math.max(0, parseInt(simpleStock, 10) || 0)

  /* The names the backend will see as "filled in" — the same union of variant
     attribute names it computes in requireCategoryAttributes. */
  const filledAttributeNames = useMemo(
    () => characteristics.filter((c) => c.name.trim() && c.values.trim()).map((c) => c.name),
    [characteristics],
  )
  const missingAttributes = useMemo(
    () => missingRequiredAttributes(categoryRequirements, filledAttributeNames, t),
    [categoryRequirements, filledAttributeNames, t],
  )

  /* ── Characteristics ── */
  function addSuggestion(s: AttributeSuggestion) {
    if (characteristics.some((c) => c.name.trim().toLowerCase() === s.name.toLowerCase())) return
    setCharacteristics((prev) => [...prev, { id: newRowId(), name: s.name, type: s.recommendedType, values: '', placeholder: s.placeholder }])
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
    if (images.length >= MAX_IMAGES) { Alert.alert(t('seller.productForm.maxPhotos')); return }
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
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, selectionLimit: MAX_IMAGES - images.length })
    if (result.canceled || !result.assets.length) return

    setPickingImage(true)
    try {
      // Normalise now rather than at upload time: a rejected photo should be
      // reported while the seller is still on the photo step.
      const prepared = await Promise.all(result.assets.slice(0, MAX_IMAGES - images.length).map((a) => prepareProductImageUpload(a)))
      setImages((prev) => [...prev, ...prepared].slice(0, MAX_IMAGES))
    } catch {
      Alert.alert(t('common.error'), t('seller.productForm.photoPrepareFailed'))
    } finally {
      setPickingImage(false)
    }
  }

  function pickImage() {
    Alert.alert(t('seller.productForm.addPhoto'), undefined, [
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

  /** What blocks moving on from the step currently on screen. */
  function stepBlocker(current: number): string {
    if (current === 1 && !form.name.trim()) return t('seller.productForm.validation.nameRequired')
    if (current === 2 && !categoryId) return t('seller.productForm.validation.selectCategory')
    if (current === 3) {
      const price = parseFloat(form.unit_price)
      if (isNaN(price) || price <= 0) return t('seller.productForm.validation.validPrice')
      if (selfRating < 1 || selfRating > 5) return t('seller.productForm.validation.selfRatingRequired')
      if (form.discount_active) {
        const discount = parseFloat(form.discount_value)
        if (isNaN(discount) || discount <= 0) return t('seller.productForm.validation.promoValue')
        if (form.discount_type === 'PERCENTAGE' && discount > 100) return t('seller.productForm.validation.percentMax')
        if (form.discount_type === 'FIXED' && discount >= price) return t('seller.productForm.validation.fixedMax')
      }
    }
    if (current === 6 && !shopId) return t('seller.productForm.validation.selectShop')
    return ''
  }

  function goNext() {
    const blocker = stepBlocker(step)
    if (blocker) { setError(blocker); return }
    setError('')
    setStep((s) => Math.min(STEP_COUNT, s + 1))
  }
  function goBack() {
    setError('')
    setStep((s) => Math.max(1, s - 1))
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
            const name = c.name.trim()
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

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <SectionTitle title={t('seller.productForm.title')} />

      <View style={styles.progressRow}>
        {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((n) => (
          <View key={n} style={[styles.progressDot, n <= step && styles.progressDotDone]} />
        ))}
      </View>
      <Text style={styles.stepCaption}>{t('seller.productForm.stepOf', { current: step, total: STEP_COUNT })}</Text>

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

      {/* Step 1 — Basic information */}
      {step === 1 && <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.productInfo')}</Text>
        <Field label={t('seller.productForm.productName')} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} autoCapitalize="words" />
        <Field label={t('seller.productForm.descriptionOptional')} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
        <Field label={t('seller.productForm.skuOptional')} value={form.sku} onChangeText={(v) => setForm((f) => ({ ...f, sku: v }))} autoCapitalize="none" />
        <Field label={t('product.unit')} value={form.unit} onChangeText={(v) => setForm((f) => ({ ...f, unit: v }))} autoCapitalize="characters" />
      </Card>}

      {/* Step 2 — Category */}
      {step === 2 && <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.categoryLabel')}</Text>
        <View style={styles.chipRow}>
          {(categories.data ?? []).map((c: Category) => <Pressable
            key={c.id}
            accessibilityRole="button"
            style={[styles.chip, categoryId === c.id && styles.chipActive]}
            onPress={() => { setCategoryId(c.id); setSubcategoryId(''); setCharacteristics([]) }}
          >
            <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
          </Pressable>)}
        </View>
        {subcategories.length > 0 && <>
          <Text style={styles.cardTitle}>{t('product.subcategory')}</Text>
          <View style={styles.chipRow}>
            {subcategories.map((s: Category) => <Pressable
              key={s.id}
              accessibilityRole="button"
              style={[styles.chip, subcategoryId === s.id && styles.chipActive]}
              onPress={() => setSubcategoryId(subcategoryId === s.id ? '' : s.id)}
            >
              <Text style={[styles.chipText, subcategoryId === s.id && styles.chipTextActive]}>{s.name}</Text>
            </Pressable>)}
          </View>
        </>}
        {requiredAttributeNames.size > 0 && <Text style={styles.notice}>
          {t('seller.productForm.categoryRequiresNotice', { attributes: Array.from(requiredAttributeNames).join(', ') })}
        </Text>}
      </Card>}

      {/* Step 3 — Pricing */}
      {step === 3 && <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.pricingTitle')}</Text>
        <Field label={t('seller.productForm.salePrice')} value={form.unit_price} onChangeText={(v) => setForm((f) => ({ ...f, unit_price: v }))} keyboardType="numeric" />
        <Field label={t('seller.productForm.costPriceOptional')} value={form.cost_price} onChangeText={(v) => setForm((f) => ({ ...f, cost_price: v }))} keyboardType="numeric" />

        <Text style={styles.cardTitle}>{t('seller.productForm.selfRatingLabel')}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => <Pressable key={n} accessibilityRole="button" onPress={() => setSelfRating(n)}>
            <Text style={[styles.star, n <= selfRating && styles.starActive]}>★</Text>
          </Pressable>)}
        </View>

        <Pressable accessibilityRole="switch" accessibilityState={{ checked: form.discount_active }} style={styles.toggleRow} onPress={() => setForm((f) => ({ ...f, discount_active: !f.discount_active }))}>
          <View style={[styles.checkbox, form.discount_active && styles.checkboxOn]} />
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
          <Text style={styles.muted}>{t('seller.productForm.promoPreview')}: {promoPrice.toLocaleString()} FC</Text>
        </>}
      </Card>}

      {/* Step 4 — Photos */}
      {step === 4 && <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.photosTitle')}</Text>
        <Text style={styles.muted}>{t('seller.productForm.photosDescMobile')}</Text>
        <View style={styles.photoGrid}>
          {images.map((img, index) => <View key={`${img.uri}-${index}`} style={styles.photoTile}>
            <Image source={img.uri} style={styles.photo} contentFit="cover" />
            {index === 0 ? <Text style={styles.primaryTag}>{t('seller.productForm.primary')}</Text> : null}
            <View style={styles.photoActions}>
              {index !== 0 ? <Button dense variant="outline" title={t('seller.productForm.setPrimary')} onPress={() => makePrimary(index)} /> : null}
              <Button dense variant="outline" title={t('common.delete')} onPress={() => removeImage(index)} />
            </View>
          </View>)}
        </View>
        <Button
          variant="outline"
          title={images.length >= MAX_IMAGES ? t('seller.productForm.maxPhotos') : t('seller.productForm.addPhoto')}
          loading={pickingImage}
          disabled={images.length >= MAX_IMAGES}
          onPress={pickImage}
        />
      </Card>}

      {/* Step 5 — Characteristics & variants */}
      {step === 5 && <>
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
                const required = requiredAttributeNames.has(s.name.toLowerCase())
                return <Pressable key={s.name} accessibilityRole="button" disabled={used} style={[styles.chip, used && styles.chipUsed, required && !used && styles.chipRequired]} onPress={() => addSuggestion(s)}>
                  <Text style={[styles.chipText, used && styles.chipTextUsed]}>{required ? `${s.name} *` : s.name}</Text>
                </Pressable>
              })}
            </View>
          </>}

          <Text style={styles.subLabel}>{t('seller.productForm.popularCharacteristics')}</Text>
          <View style={styles.chipRow}>
            {POPULAR_CUSTOM_CHARACTERISTICS.map((name) => <Pressable key={name} accessibilityRole="button" style={styles.chip} onPress={() => addCustomCharacteristic(name)}>
              <Text style={styles.chipText}>{name}</Text>
            </Pressable>)}
          </View>
          <Button variant="outline" dense title={t('seller.productForm.addCustomCharacteristic')} onPress={() => addCustomCharacteristic()} />
        </Card>

        {characteristics.map((c) => <Card key={c.id}>
          <Field label={t('seller.productForm.attributeName')} value={c.name} onChangeText={(v) => updateCharacteristic(c.id, 'name', v)} autoCapitalize="words" />
          <View style={styles.chipRow}>
            {(['VARIANT', 'INFO'] as const).map((type) => <Pressable
              key={type}
              accessibilityRole="button"
              style={[styles.chip, c.type === type && styles.chipActive]}
              onPress={() => updateCharacteristic(c.id, 'type', type)}
            >
              <Text style={[styles.chipText, c.type === type && styles.chipTextActive]}>
                {t(type === 'VARIANT' ? 'seller.productForm.variantChip' : 'seller.productForm.infoChip')}
              </Text>
            </Pressable>)}
          </View>
          <Field
            label={t(c.type === 'VARIANT' ? 'seller.productForm.valuesCommaSeparated' : 'seller.productForm.specValueLabel')}
            value={c.values}
            onChangeText={(v) => updateCharacteristic(c.id, 'values', v)}
            placeholder={c.placeholder}
          />
          <Button dense variant="outline" title={t('seller.productForm.removeCharacteristic')} onPress={() => removeCharacteristic(c.id)} />
        </Card>)}
      </>}

      {/* Step 6 — Shop & stock */}
      {step === 6 && <>
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
      </>}

      {/* Step 7 — Review */}
      {step === 7 && <Card>
        <Text style={styles.cardTitle}>{t('seller.productForm.reviewTitle')}</Text>
        <SummaryRow styles={styles} label={t('seller.productForm.productName')} value={form.name.trim() || '—'} />
        <SummaryRow styles={styles} label={t('seller.productForm.categoryLabel')} value={[selectedCategory?.name, selectedSubcategory?.name].filter(Boolean).join(' › ') || '—'} />
        <SummaryRow styles={styles} label={t('seller.productForm.salePrice')} value={`${price.toLocaleString()} FC`} />
        <SummaryRow styles={styles} label={t('seller.productForm.summaryImages')} value={String(images.length)} />
        <SummaryRow styles={styles} label={t('seller.productForm.summaryVariants')} value={String(isVariantMode ? activeCombos.length : 1)} />
        <SummaryRow styles={styles} label={t('seller.productForm.summaryStockHere')} value={String(totalUnits)} />
        <SummaryRow styles={styles} label={t('seller.productForm.shopTitle')} value={selectedShop?.name ?? '—'} />
        {missingAttributes.length > 0 && <Text style={styles.notice}>
          {t('seller.productForm.validation.missingAttributes', { attributes: missingAttributes.join(', ') })}
          {' '}{t('seller.productForm.validation.missingThem')}
        </Text>}
        {stepLabel ? <Text style={styles.muted}>{stepLabel}</Text> : null}
        <Button variant="outline" title={t('seller.productForm.saveDraft')} loading={busy} disabled={busy} onPress={() => submit('DRAFT')} />
        <Button title={t('seller.productForm.publishProduct')} loading={busy} disabled={busy} onPress={() => submit('PUBLISHED')} />
      </Card>}

      <View style={styles.navRow}>
        {step > 1 ? <View style={styles.flex1}><Button variant="outline" title={t('common.back')} disabled={busy} onPress={goBack} /></View> : null}
        {step < STEP_COUNT ? <View style={styles.flex1}><Button title={t('common.next')} disabled={busy} onPress={goNext} /></View> : null}
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
}

function SummaryRow({ styles, label, value }: { styles: ReturnType<typeof makeStyles>; label: string; value: string }) {
  return <View style={styles.summaryRow}>
    <Text style={styles.muted}>{label}</Text>
    <Text style={styles.summaryValue} numberOfLines={2}>{value}</Text>
  </View>
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  root: { flex: 1 },
  page: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  flex1: { flex: 1 },
  muted: { color: colors.muted },
  subLabel: { color: colors.ink, fontWeight: '700' },
  error: { color: colors.danger, fontWeight: '700' },
  notice: { color: colors.gold, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '900', color: colors.ink },
  progressRow: { flexDirection: 'row', gap: spacing.xs },
  progressDot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border },
  progressDotDone: { backgroundColor: colors.green },
  stepCaption: { color: colors.muted, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 40, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipRequired: { borderColor: colors.gold },
  chipUsed: { opacity: 0.45 },
  chipText: { color: colors.ink, fontWeight: '700' },
  chipTextActive: { color: colors.onGreen },
  chipTextUsed: { color: colors.muted },
  stars: { flexDirection: 'row', gap: spacing.xs },
  star: { fontSize: 34, color: colors.starEmpty },
  starActive: { color: colors.star },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.borderControl },
  checkboxOn: { backgroundColor: colors.green, borderColor: colors.green },
  toggleLabel: { color: colors.ink, fontWeight: '700', flex: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoTile: { width: 150, gap: spacing.xs },
  photo: { width: 150, height: 150, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  primaryTag: { color: colors.green, fontWeight: '900', fontSize: 12 },
  photoActions: { gap: spacing.xs },
  comboRow: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  comboLabel: { color: colors.ink, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  summaryValue: { color: colors.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  navRow: { flexDirection: 'row', gap: spacing.sm },
})
