import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { productApi, productImageApi, inventoryApi, shopApi, categoryApi } from '@/api/seller'
import type { CategoryResponse, SubcategoryResponse, Shop } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

import {
  getCategorySuggestions,
  getCategoryRequirements,
  missingRequiredAttributes,
  POPULAR_CUSTOM_CHARACTERISTICS,
  type AttributeClassification,
  type AttributeSuggestion,
} from '@/lib/categorySuggestions'

/* ── Types ── */

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
  sku?: string
  attributes: Record<string, string>
  price: string
  stock: string
}

interface PipelineProgress {
  productId?: string
  resolvedVariants: Array<{ variantId: string; stock: number }>
  uploadedImages: number
  stockDone: boolean
  published: boolean
}

/* ── Helpers ── */

function cartesian(attrs: Array<{ name: string; values: string[] }>): Array<Record<string, string>> {
  return attrs.reduce<Array<Record<string, string>>>(
    (acc, attr) =>
      acc.flatMap((combo) => attr.values.map((v) => ({ ...combo, [attr.name]: v.trim() }))),
    [{}]
  )
}


export default function SellerProductCreatePage() {
  const { shopId = '' } = useParams()
  const navigate = useNavigate()
  const { activeBusiness } = useAuth()
  const { t } = useI18n()

  /* Shop context */
  const [shop, setShop] = useState<Shop | null>(null)
  const [shopError, setShopError] = useState('')

  /* Category-first data */
  const [categories, setCategories] = useState<CategoryResponse[]>([])

  /* Form state */
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [form, setForm] = useState({
    name: '',
    sku: '',
    unit: 'PCS',
    unit_price: '',
    cost_price: '',
    description: '',
    discount_active: false,
    discount_type: 'PERCENTAGE',
    discount_value: '',
    discount_start: '',
    discount_end: '',
  })

  /* Images */
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  /* Category change notification */
  const [categoryNotice, setCategoryNotice] = useState('')

  /* Optional characteristics */
  const [characteristics, setCharacteristics] = useState<CharacteristicRow[]>([])

  /* Simple-product initial stock */
  const [simpleStock, setSimpleStock] = useState('0')

  /* Submission */
  const [busy, setBusy] = useState(false)
  const [stepLabel, setStepLabel] = useState('')
  const [error, setError] = useState('')
  const publishIntentRef = useRef<'DRAFT' | 'PUBLISHED'>('PUBLISHED')
  const progressRef = useRef<PipelineProgress>({
    resolvedVariants: [],
    uploadedImages: 0,
    stockDone: false,
    published: false,
  })
  const [partialFailure, setPartialFailure] = useState<{ stage: string; message: string } | null>(null)
  const [summary, setSummary] = useState<null | {
    productId: string
    productName: string
    categoryName: string
    variantCount: number
    totalStock: number
    imageCount: number
    published: boolean
  }>(null)

  /* ── Load shop + categories ── */
  useEffect(() => {
    if (!activeBusiness || !shopId) return
    let mounted = true

    async function load() {
      try {
        const [shopData, catsData] = await Promise.all([
          shopApi.get(shopId),
          categoryApi.list().catch(() => [] as CategoryResponse[]),
        ])
        if (!mounted) return
        if (shopData.business_id !== activeBusiness?.id) {
          setShopError(t('seller.productForm.thisShopNotYours'))
          return
        }
        setShop(shopData)
        setCategories(Array.isArray(catsData) ? catsData : [])
      } catch (err) {
        if (mounted) setShopError(err instanceof Error ? err.message : t('seller.productForm.loadShopFailed'))
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [activeBusiness?.id, shopId])

  /* Revoke preview URLs on unmount */
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  )
  const subcategories: SubcategoryResponse[] = selectedCategory?.subcategories ?? []
  const selectedSubcategory = useMemo(
    () => subcategories.find((s) => s.id === subcategoryId),
    [subcategories, subcategoryId]
  )

  const categorySuggestions = useMemo(() => {
    if (!selectedCategory) return []
    // A subcategory can be more specific than its parent (e.g. Fashion › Shoes
    // should suggest shoe attributes, not generic fashion ones). Prefer the
    // subcategory's own suggestions when they resolve to something; otherwise
    // fall back to the parent category.
    if (selectedSubcategory) {
      const subSuggestions = getCategorySuggestions(selectedSubcategory.slug || selectedSubcategory.name)
      if (subSuggestions.length > 0) return subSuggestions
    }
    return getCategorySuggestions(selectedCategory.slug || selectedCategory.name)
  }, [selectedCategory, selectedSubcategory])

  const categoryRequirements = useMemo(
    () =>
      getCategoryRequirements(
        selectedCategory?.slug || selectedCategory?.name,
        selectedSubcategory?.slug || selectedSubcategory?.name
      ),
    [selectedCategory, selectedSubcategory]
  )

  const requiredAttributeNames = useMemo(() => new Set([
    ...(categoryRequirements.allOf ?? []),
    ...(categoryRequirements.anyOf ?? []).flat(),
  ].map((name) => name.toLowerCase())), [categoryRequirements])

  function handleCategoryChange(newCatId: string) {
    if (categoryId && newCatId !== categoryId && characteristics.length > 0) {
      const hasValues = characteristics.some((c) => c.name.trim() || c.values.trim())
      if (hasValues) {
        const confirmed = window.confirm(t('seller.productForm.categoryChangePrompt'))
        if (!confirmed) return
      }
      const oldName = categories.find((c) => c.id === categoryId)?.name || t('seller.productForm.previousCategory')
      const newName = categories.find((c) => c.id === newCatId)?.name || t('seller.productForm.newCategory')
      const charList = characteristics.map((c) => c.name.trim()).filter(Boolean).join(', ')
      if (charList) {
        setCategoryNotice(
          t('seller.productForm.categoryChangedNoticeShort', { from: oldName, to: newName, chars: charList })
        )
      }
    } else {
      setCategoryNotice('')
    }
    setCategoryId(newCatId)
    setSubcategoryId('')
  }

  /* Derived variant combos (generated only from VARIANT characteristics) */
  const combos: ComboRow[] = useMemo(() => {
    const variantAttrs = characteristics
      .filter((c) => c.type === 'VARIANT')
      .map((c) => ({
        name: c.name.trim(),
        values: c.values.split(',').map((v) => v.trim()).filter(Boolean),
      }))
      .filter((c) => c.name && c.values.length > 0)

    const infoAttrs: Record<string, string> = {}
    characteristics
      .filter((c) => c.type === 'INFO')
      .forEach((c) => {
        const n = c.name.trim()
        const v = c.values.trim()
        if (n && v) infoAttrs[n] = v
      })

    if (variantAttrs.length === 0) return []

    const attributeSets = cartesian(variantAttrs)
    return attributeSets.map((attrSet, idx) => {
      const label = Object.values(attrSet).join(' / ')
      const skuVal = form.sku.trim() ? `${form.sku.trim()}-${idx + 1}` : ''
      return {
        key: label,
        label,
        sku: skuVal,
        attributes: { ...infoAttrs, ...attrSet },
        price: form.unit_price,
        stock: '0',
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characteristics, form.sku, form.unit_price])

  function updateCombo(key: string, field: 'price' | 'stock' | 'sku', value: string) {
    setCombosState((prev) => prev.map((c) => (c.key === key ? { ...c, [field]: value } : c)))
  }

  // Local editable copy of combos once rendered.
  const [combosState, setCombosState] = useState<ComboRow[]>([])
  useEffect(() => {
    setCombosState(combos)
  }, [combos])
  const activeCombos = combosState.length > 0 ? combosState : combos

  const isVariantMode = activeCombos.length > 0

  const totalUnits = isVariantMode
    ? activeCombos.reduce((sum, c) => sum + Math.max(0, parseInt(c.stock, 10) || 0), 0)
    : Math.max(0, parseInt(simpleStock, 10) || 0)

  /* ── Image handlers ── */
  function addImages(files: FileList | null) {
    if (!files) return
    const list = Array.from(files).slice(0, 10 - imageFiles.length)
    setImageFiles((prev) => [...prev, ...list])
    setImagePreviews((prev) => [...prev, ...list.map((f) => URL.createObjectURL(f))])
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index])
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  function makePrimary(index: number) {
    if (index === 0) return
    setImageFiles((prev) => {
      const copy = [...prev]
      const [img] = copy.splice(index, 1)
      return [img, ...copy]
    })
    setImagePreviews((prev) => {
      const copy = [...prev]
      const [url] = copy.splice(index, 1)
      return [url, ...copy]
    })
  }

  /* ── Characteristics handlers ── */
  function addSuggestion(s: AttributeSuggestion) {
    const exists = characteristics.some(
      (c) => c.name.trim().toLowerCase() === s.name.toLowerCase()
    )
    if (exists) return
    setCharacteristics((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: s.name,
        type: s.recommendedType,
        values: '',
        placeholder: s.placeholder,
      },
    ])
  }

  function addCustomCharacteristic() {
    setCharacteristics((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        type: 'VARIANT',
        values: '',
        placeholder: 'e.g. Value 1, Value 2',
      },
    ])
  }

  function updateCharacteristic<K extends keyof CharacteristicRow>(
    id: string,
    field: K,
    value: CharacteristicRow[K]
  ) {
    setCharacteristics((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  function removeCharacteristic(id: string) {
    setCharacteristics((prev) => prev.filter((c) => c.id !== id))
  }


  /* ── Validation ── */
  function validate(intent: 'DRAFT' | 'PUBLISHED'): string {
    if (!categoryId) return t('seller.productForm.validation.selectCategory')
    if (!form.name.trim()) return t('seller.productForm.validation.nameRequired')
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price <= 0) return t('seller.productForm.validation.validPrice')
    
    if (form.discount_active) {
      const discVal = parseFloat(form.discount_value)
      if (isNaN(discVal) || discVal <= 0) return t('seller.productDetail.promoInvalidValue')
      if (form.discount_type === 'PERCENTAGE' && discVal > 100) return t('seller.productDetail.promoMaxPercent')
      if (form.discount_type === 'FIXED' && discVal >= price) return t('seller.productDetail.promoFixedTooHigh')
      if (form.discount_start && form.discount_end) {
        if (new Date(form.discount_end) <= new Date(form.discount_start)) {
          return t('seller.productDetail.promoEndBeforeStart')
        }
      }
    }

    // A draft is a work in progress, so category rules only gate publication.
    if (intent === 'PUBLISHED') {
      const completed = characteristics
        .filter((c) => c.name.trim() && c.values.trim())
        .map((c) => c.name)
      const missing = missingRequiredAttributes(categoryRequirements, completed)
      if (missing.length > 0) {
        return (
          t('seller.productForm.validation.missingAttributes', { attributes: missing.join(', ') }) +
          ' ' +
          t(missing.length > 1
            ? 'seller.productForm.validation.missingThem'
            : 'seller.productForm.validation.missingIt')
        )
      }
    }

    if (isVariantMode) {
      for (const combo of activeCombos) {
        const p = parseFloat(combo.price || form.unit_price)
        if (isNaN(p) || p <= 0) return `Variant "${combo.label}" needs a valid Price (> 0 FC).`
        const s = parseInt(combo.stock, 10)
        if (isNaN(s) || s < 0) return `Variant "${combo.label}" stock must be 0 or more.`
      }
    } else {
      const s = parseInt(simpleStock, 10)
      if (isNaN(s) || s < 0) return t('seller.productForm.validation.stockNonNegative')
    }
    return ''
  }

  /* ── Submission pipeline (resumable — never duplicates the Product) ── */
  async function runPipeline() {
    if (!activeBusiness || !shop) return
    const progress = progressRef.current
    setError('')

    let createdProduct: { id: string; name: string } | null = null

    try {
      /* Step 1 — Create Product (always as DRAFT first) */
      let productId = progress.productId
      if (!productId) {
        setStepLabel(t('seller.productForm.stepCreatingProduct'))
        const created = await productApi.create(activeBusiness.id, {
          name: form.name.trim(),
          sku: form.sku.trim() || undefined,
          description: form.description.trim() || undefined,
          unit: form.unit.trim() || 'PCS',
          unit_price: parseFloat(form.unit_price),
          cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
          category_id: categoryId,
          subcategory_id: subcategoryId || undefined,
          publication_status: 'DRAFT',
          discount_active: form.discount_active,
          discount_type: form.discount_type,
          discount_value: form.discount_active ? parseFloat(form.discount_value) : 0,
          discount_start: form.discount_active && form.discount_start ? new Date(form.discount_start).toISOString() : undefined,
          discount_end: form.discount_active && form.discount_end ? new Date(form.discount_end).toISOString() : undefined,
        })
        productId = created.id
        createdProduct = created
        progress.productId = productId
      }

      /* Step 2 — Resolve variants */
      if (progress.resolvedVariants.length === 0) {
        setStepLabel(t('seller.productForm.stepConfiguringVariants'))
        const existing = await productApi.listVariants(activeBusiness.id, productId!)
        let defaultVariant = existing[0]
        if (!defaultVariant) {
          defaultVariant = await productApi.createVariant(activeBusiness.id, productId!, {
            name: form.name.trim(),
            sale_price: parseFloat(form.unit_price),
            unit: form.unit.trim() || 'PCS',
          })
        }

        if (!isVariantMode) {
          const attrs: Record<string, string> = {}
          for (const c of characteristics) {
            const name = c.name.trim()
            const value = c.values.split(',')[0]?.trim()
            if (name && value) attrs[name] = value
          }
          const updated = await productApi.updateVariant(defaultVariant.id, {
            sale_price: parseFloat(form.unit_price),
            purchase_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
            ...(Object.keys(attrs).length > 0 ? { attributes: attrs } : {}),
          })
          progress.resolvedVariants.push({
            variantId: updated.id,
            stock: Math.max(0, parseInt(simpleStock, 10) || 0),
          })
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
            let variantId: string
            if (i === 0 && defaultVariant) {
              const updated = await productApi.updateVariant(defaultVariant.id, payload)
              variantId = updated.id
            } else {
              const createdVar = await productApi.createVariant(activeBusiness.id, productId!, payload)
              variantId = createdVar.id
            }
            progress.resolvedVariants.push({
              variantId,
              stock: Math.max(0, parseInt(combo.stock, 10) || 0),
            })
          }
        }
      }

      /* Step 3 — Persist images (primary first) */
      if (progress.uploadedImages < imageFiles.length) {
        setStepLabel(t('seller.productForm.stepUploadingImages'))
        for (let i = progress.uploadedImages; i < imageFiles.length; i++) {
          await productImageApi.upload(activeBusiness.id, productId!, imageFiles[i], i === 0)
          progress.uploadedImages += 1
        }
      }

      /* Step 4 — Shop-scoped stock (always materialise the offer, even at 0,
         so the Product is traceable per Shop and shows OUT_OF_STOCK instead
         of disappearing from the Marketplace) */
      if (!progress.stockDone && progress.resolvedVariants.length > 0) {
        setStepLabel(t('seller.productForm.stepAddingStock'))
        for (const entry of progress.resolvedVariants) {
          await inventoryApi.addStock(shop.id, {
            variant_id: entry.variantId,
            quantity: entry.stock,
            notes: t('seller.productForm.initialStock'),
          })
        }
        progress.stockDone = true
      }

      /* Step 5 — Publish (product stays consistent before it goes live) */
      if (publishIntentRef.current === 'PUBLISHED' && !progress.published) {
        setStepLabel(t('seller.productForm.stepPublishing'))
        await productApi.update(activeBusiness.id, productId!, {
          publication_status: 'PUBLISHED',
        })
        progress.published = true
      }

      /* Success */
      setSummary({
        productId: productId!,
        productName: createdProduct?.name ?? form.name.trim(),
        categoryName: selectedCategory?.name ?? '',
        variantCount: progress.resolvedVariants.length,
        totalStock: totalUnits,
        imageCount: imageFiles.length,
        published: progress.published,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('seller.productForm.genericError')
      setPartialFailure({ stage: stepLabel || t('seller.productForm.processing'), message })
    } finally {
      setBusy(false)
      setStepLabel('')
    }
  }

  function handleSubmit(e: FormEvent, intent: 'DRAFT' | 'PUBLISHED') {
    e.preventDefault()
    if (busy) return
    publishIntentRef.current = intent
    const validationError = validate(intent)
    if (validationError) {
      setError(validationError)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setError('')
    setBusy(true)
    runPipeline()
  }

  function handleRetry() {
    setPartialFailure(null)
    setBusy(true)
    runPipeline()
  }

  function resetForAnother() {
    progressRef.current = { resolvedVariants: [], uploadedImages: 0, stockDone: false, published: false }
    setSummary(null)
    setCategoryId('')
    setSubcategoryId('')
    setForm({
      name: '',
      sku: '',
      unit: 'PCS',
      unit_price: '',
      cost_price: '',
      description: '',
      discount_active: false,
      discount_type: 'PERCENTAGE',
      discount_value: '',
      discount_start: '',
      discount_end: '',
    })
    setImageFiles([])
    setImagePreviews([])
    setCharacteristics([])
    setSimpleStock('0')
    setCombosState([])
  }

  /* ── Guard states ── */

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.productForm.noBusinessSubtitle')}</p>
      </div>
    )
  }

  if (shopError) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <ErrorBox error={shopError} />
        <Link to="/seller/products/select-shop">
          <Button variant="outline" block>{t('seller.productForm.chooseAnotherShop')}</Button>
        </Link>
      </div>
    )
  }

  if (!shop) {
    return <LoadingBlock label={t('seller.productForm.loadingShop')} />
  }

  /* ── Success screen ── */
  if (summary) {
    return (
      <div className="seller-product-create">
        <Card style={{ padding: '32px 24px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-success)', fontSize: 48, marginBottom: 8 }}>✓</div>
          <h2>{summary.published ? t('seller.productForm.published') : t('seller.productForm.draftSaved')}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {summary.published
              ? t('seller.productForm.publishedBody', { category: selectedCategory?.name ?? '', shop: shop.name })
              : t('seller.productForm.draftBody', { shop: shop.name })}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 12,
              margin: '24px 0',
              padding: 16,
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius)',
              textAlign: 'left',
            }}
          >
            <div><span className="small muted">{t('seller.productForm.summaryShop')}</span><p><strong>{shop.name}</strong></p></div>
            <div><span className="small muted">{t('seller.productForm.summaryCategory')}</span><p><strong>{summary.categoryName}</strong></p></div>
            <div><span className="small muted">{t('seller.productForm.summaryVariants')}</span><p><strong>{summary.variantCount}</strong></p></div>
            <div><span className="small muted">{t('seller.productForm.summaryStockHere')}</span><p><strong>{t('seller.productForm.summaryUnits', { count: summary.totalStock })}</strong></p></div>
            <div><span className="small muted">{t('seller.productForm.summaryImages')}</span><p><strong>{summary.imageCount}</strong></p></div>
            <div>
              <span className="small muted">{t('seller.productForm.summaryStatus')}</span>
              <p>
                <span className={`badge badge-${summary.published ? 'success' : 'warning'}`}>
                  {t(summary.published ? 'seller.publicationStatus.PUBLISHED' : 'seller.publicationStatus.DRAFT')}
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button size="lg" onClick={() => navigate(`/seller/shops/${shop.id}/products`)}>
              {t('seller.productForm.viewInShop')}
            </Button>
            {summary.published && (
              <Link to={`/products/${summary.productId}`}>
                <Button variant="outline" size="lg">{t('seller.productForm.viewInMarketplace')}</Button>
              </Link>
            )}
            <Button variant="ghost" size="lg" onClick={resetForAnother}>
              {t('seller.productForm.addAnotherProduct')}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  /* ── Partial failure screen (resumable, no duplicate Product) ── */
  if (partialFailure) {
    return (
      <div className="seller-product-create">
        <Card style={{ padding: '32px 24px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-warning)', fontSize: 48, marginBottom: 8 }}>⚠</div>
          <h2>{t('seller.productForm.couldNotComplete', { stage: partialFailure.stage.replace(/…$/, '') })}</h2>
          <p className="muted small">
            {t('seller.productForm.savedRetryDesc')}
          </p>
          <ErrorBox error={partialFailure.message} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <Button size="lg" onClick={handleRetry}>{t('common.retry')}</Button>
            <Link to={`/seller/products/${progressRef.current.productId}`}>
              <Button variant="outline" size="lg">{t('seller.productForm.openProductDetails')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  /* ── Main progressive form ── */
  const detailsVisible = Boolean(categoryId)

  return (
    <div className="seller-product-create">
      <div className="page-header">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            <Link to="/seller/products" className="section-link">{t('seller.productForm.breadcrumbProducts')}</Link>
            {' / '}
            <Link to={`/seller/shops/${shop.id}/products`} className="section-link">{shop.name}</Link>
          </p>
          <h1>{t('seller.productForm.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('seller.productForm.sellingFrom')}{' '}
            <strong>{shop.name}</strong>
            {shop.city ? ` — ${shop.city}` : ''}
            {' · '}
            <Link to="/seller/products/select-shop" className="section-link">{t('seller.productForm.changeShop')}</Link>
          </p>
        </div>
      </div>

      {error && <ErrorBox error={error} />}

      <form className="card-stack" onSubmit={(e) => handleSubmit(e, publishIntentRef.current)}>
        {/* STEP 1 — Category */}
        <Card>
          <h3>{t('seller.productForm.whatKindTitle')}</h3>
          <p className="muted small mt-1 mb-3">
            {t('seller.productForm.whatKindDesc')}
          </p>
          <div className="field-grid">
            <Field
              label={t('seller.productForm.categoryLabel')}
              name="category_id"
              as="select"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              options={[
                { value: '', label: t('seller.productForm.selectCategory') },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Field
              label={t('product.subcategory')}
              name="subcategory_id"
              as="select"
              disabled={subcategories.length === 0}
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              options={[
                { value: '', label: subcategories.length > 0 ? t('seller.productForm.selectSubcategory') : t('seller.productForm.noSubcategory') },
                ...subcategories.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          {categoryNotice && (
            <div className="notice notice-warning mt-4">ℹ️ {categoryNotice}</div>
          )}
        </Card>

        {/* STEP 2+ — Details appear only after Category selection */}
        {detailsVisible && (
          <>
            <Card className="reveal-section">
              <h3>{t('seller.productForm.productInfo')}</h3>
              <div className="field-grid mt-3">
                <Field
                  label={t('seller.productForm.productName')}
                  name="name"
                  placeholder={t('seller.productForm.namePlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Field
                  label={t('seller.productForm.salePrice')}
                  name="unit_price"
                  type="number"
                  min="1"
                  step="any"
                  placeholder={t('seller.productForm.salePricePlaceholder')}
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                />
                <Field
                  label={t('seller.productForm.skuOptional')}
                  name="sku"
                  placeholder={t('seller.productForm.skuPlaceholder')}
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
                <Field
                  label={t('product.unit')}
                  name="unit"
                  placeholder={t('seller.productForm.unitPlaceholder')}
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
                <Field
                  label={t('seller.productForm.costPriceOptional')}
                  name="cost_price"
                  type="number"
                  min="0"
                  step="any"
                  placeholder={t('seller.productForm.costPricePlaceholder')}
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <Field
                  label={t('seller.productForm.descriptionOptional')}
                  name="description"
                  as="textarea"
                  rows={3}
                  placeholder={t('seller.productForm.descriptionPlaceholder')}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </Card>

            {/* Promotion & Sale Price Card */}
            <Card className="reveal-section">
              <h3>{t('seller.productForm.promotionTitle')}</h3>
              <p className="muted small" style={{ margin: '4px 0 12px' }}>
                Set a discount price or percentage off. Discounted prices apply automatically during checkout.
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <input
                  type="checkbox"
                  id="discount_active"
                  checked={form.discount_active}
                  onChange={(e) => setForm({ ...form, discount_active: e.target.checked })}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="discount_active" style={{ fontWeight: 600, cursor: 'pointer' }}>
                  Enable Special Promotion / Sale Price
                </label>
              </div>

              {form.discount_active && (
                <div className="reveal-section field-grid">
                  <Field
                    label={t('seller.productDetail.discountType')}
                    name="discount_type"
                    as="select"
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                    options={[
                      { value: 'PERCENTAGE', label: t('seller.productDetail.discountPercentOff') },
                      { value: 'FIXED', label: t('seller.productDetail.discountFixed') }
                    ]}
                  />
                  <Field
                    label={form.discount_type === 'PERCENTAGE' ? t('seller.productDetail.discountPercentLabel') : t('seller.productDetail.discountAmountLabel')}
                    name="discount_value"
                    type="number"
                    min="1"
                    step="any"
                    placeholder={form.discount_type === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 15000'}
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  />
                  <Field
                    label={t('seller.productDetail.startDateOptional')}
                    name="discount_start"
                    type="datetime-local"
                    value={form.discount_start}
                    onChange={(e) => setForm({ ...form, discount_start: e.target.value })}
                  />
                  <Field
                    label={t('seller.productDetail.endDateOptional')}
                    name="discount_end"
                    type="datetime-local"
                    value={form.discount_end}
                    onChange={(e) => setForm({ ...form, discount_end: e.target.value })}
                  />
                </div>
              )}

              {form.discount_active && form.unit_price && form.discount_value && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--color-accent-soft)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <span className="small muted" style={{ display: 'block', marginBottom: 4 }}>{t('seller.productDetail.promotionLivePreview')}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {(() => {
                        const base = parseFloat(form.unit_price)
                        const val = parseFloat(form.discount_value)
                        if (isNaN(base) || isNaN(val)) return '—'
                        if (form.discount_type === 'PERCENTAGE') {
                          return (base * (1 - val / 100)).toLocaleString()
                        } else {
                          return Math.max(0, base - val).toLocaleString()
                        }
                      })()} FC
                    </span>
                    <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      {parseFloat(form.unit_price).toLocaleString()} FC
                    </span>
                    <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '2px 6px' }}>
                      {form.discount_type === 'PERCENTAGE' 
                        ? `${form.discount_value}% OFF` 
                        : `${parseFloat(form.discount_value).toLocaleString()} FC OFF`}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Images */}
            <Card className="reveal-section">
              <h3>{t('seller.productForm.photosTitle')}</h3>
              <p className="muted small" style={{ margin: '4px 0 12px' }}>
                Add photos from different angles so Buyers can better understand your Product. The first photo is the primary one shown in the Marketplace.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {imagePreviews.map((url, idx) => (
                  <div key={url} className="image-thumb">
                    <img src={url} alt={`Preview ${idx + 1}`} />
                    {idx === 0 && <span className="badge badge-success image-primary-badge">{t('seller.productDetail.primary')}</span>}
                    <div className="image-thumb-actions">
                      {idx !== 0 && (
                        <button type="button" title={t('seller.productForm.setPrimary')} onClick={() => makePrimary(idx)}>★</button>
                      )}
                      <button type="button" title={t('common.remove')} onClick={() => removeImage(idx)}>✕</button>
                    </div>
                  </div>
                ))}
                {imageFiles.length < 10 && (
                  <label className="btn btn-outline btn-sm image-add-btn" style={{ cursor: 'pointer' }}>
                    + Add Photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        addImages(e.target.files)
                        e.currentTarget.value = ''
                      }}
                    />
                  </label>
                )}
              </div>
              {imageFiles.length >= 10 && (
                <p className="small muted" style={{ marginTop: 8 }}>{t('seller.productForm.maxPhotos')}</p>
              )}
            </Card>

            {/* Variant Attributes & Product Specifications */}
            <Card className="reveal-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{t('seller.productForm.characteristicsTitle')}</h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    Select which attributes apply to this Product. You decide whether an attribute creates purchasable Variants (e.g. Color, Size, Flavor) or acts as Product Information (e.g. Material, Expiration Date).
                  </p>
                </div>
              </div>

              {/* Category-relevant suggestion chips */}
              {categorySuggestions.length > 0 && (
                <div style={{ margin: '16px 0 20px', padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius)' }}>
                  <div className="small bold" style={{ marginBottom: 8, color: 'var(--color-text)' }}>
                    💡 Suggested for {selectedSubcategory?.name || selectedCategory?.name || 'this category'} (click to add):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {categorySuggestions.map((sug) => {
                      const alreadyAdded = characteristics.some(
                        (c) => c.name.trim().toLowerCase() === sug.name.toLowerCase()
                      )
                      const isRequired = requiredAttributeNames.has(sug.name.toLowerCase())
                      return (
                        <button
                          key={sug.name}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addSuggestion(sug)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: '1px solid var(--color-border)',
                            background: alreadyAdded ? 'rgba(0,0,0,0.04)' : 'var(--color-surface)',
                            cursor: alreadyAdded ? 'default' : 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            opacity: alreadyAdded ? 0.6 : 1,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>{alreadyAdded ? '✓' : '+'}</span>
                          <span>{sug.name}</span>
                          {isRequired && <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>{t('seller.productForm.requiredBadge')}</span>}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '1px 6px',
                              borderRadius: 10,
                              background: sug.recommendedType === 'VARIANT' ? 'var(--color-info-soft)' : 'var(--color-surface-2)',
                              color: sug.recommendedType === 'VARIANT' ? 'var(--color-info)' : 'var(--color-text-muted)',
                              fontWeight: 700,
                            }}
                          >
                            {sug.recommendedType === 'VARIANT' ? 'Variant' : 'Info'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Characteristics Configuration List */}
              {characteristics.length > 0 && (
                <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
                  {characteristics.map((ch) => (
                    <div
                      key={ch.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(140px, 180px) minmax(180px, 220px) 1fr auto',
                        gap: 12,
                        alignItems: 'end',
                        padding: 12,
                        background: ch.type === 'VARIANT' ? 'rgba(30, 64, 175, 0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${ch.type === 'VARIANT' ? 'rgba(30, 64, 175, 0.2)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      <div>
                        <label className="small bold" style={{ display: 'block', marginBottom: 4 }} htmlFor={`${ch.id}-name`}>
                          Attribute Name
                        </label>
                        <input
                          id={`${ch.id}-name`}
                          className="input"
                          list="characteristic-suggestions"
                          placeholder={t('seller.productForm.attributeNamePlaceholder')}
                          value={ch.name}
                          onChange={(e) => updateCharacteristic(ch.id, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="small bold" style={{ display: 'block', marginBottom: 4 }} htmlFor={`${ch.id}-type`}>
                          Classification
                        </label>
                        <select
                          id={`${ch.id}-type`}
                          className="input"
                          value={ch.type}
                          onChange={(e) => updateCharacteristic(ch.id, 'type', e.target.value as AttributeClassification)}
                        >
                          <option value="VARIANT">{t('seller.productForm.variantAttribute')}</option>
                          <option value="INFO">{t('seller.productForm.infoAttribute')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="small bold" style={{ display: 'block', marginBottom: 4 }} htmlFor={`${ch.id}-values`}>
                          {ch.type === 'VARIANT' ? t('seller.productForm.valuesCommaSeparated') : t('seller.productForm.specValueLabel')}
                        </label>
                        <input
                          id={`${ch.id}-values`}
                          className="input"
                          placeholder={ch.type === 'VARIANT' ? (ch.placeholder || 'e.g. Black, White, Red') : (ch.placeholder || 'e.g. Genuine Leather, 2026-12-31')}
                          value={ch.values}
                          onChange={(e) => updateCharacteristic(ch.id, 'values', e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title={t('seller.productForm.removeCharacteristic')}
                        onClick={() => removeCharacteristic(ch.id)}
                        style={{ alignSelf: 'center', marginTop: 18 }}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                  <datalist id="characteristic-suggestions">
                    {POPULAR_CUSTOM_CHARACTERISTICS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button type="button" variant="outline" size="sm" onClick={addCustomCharacteristic}>
                  {t('seller.productForm.addCustomCharacteristic')}
                </Button>
                {characteristics.length === 0 && (
                  <span className="small muted">
                    {requiredAttributeNames.size > 0
                      ? t('seller.productForm.charHintRequired')
                      : t('seller.productForm.charHintOptional')}
                  </span>
                )}
              </div>

              {/* Generated Variants Table */}
              {isVariantMode && activeCombos.length > 0 && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{t('seller.productForm.generatedVariants', { count: activeCombos.length })}</h4>
                      <p className="muted small" style={{ margin: '2px 0 0' }}>
                        Review individual price, SKU, and initial stock at <strong>{shop.name}</strong> before publishing.
                      </p>
                    </div>
                    <div className="badge badge-primary" style={{ padding: '6px 12px' }}>
                      Total Stock: <strong>{totalUnits} units</strong>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t('seller.productForm.combination')}</th>
                          <th style={{ minWidth: 140 }}>SKU</th>
                          <th style={{ minWidth: 130 }}>{t('seller.productForm.salePriceFc')}</th>
                          <th style={{ minWidth: 110 }}>{t('seller.productForm.initialStock')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCombos.map((combo) => (
                          <tr key={combo.key}>
                            <td>
                              <strong>{combo.label}</strong>
                            </td>
                            <td>
                              <input
                                className="input input-sm"
                                type="text"
                                placeholder="SKU"
                                value={combo.sku || ''}
                                onChange={(e) => updateCombo(combo.key, 'sku', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="input input-sm"
                                type="number"
                                min="1"
                                step="any"
                                value={combo.price}
                                onChange={(e) => updateCombo(combo.key, 'price', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="input input-sm"
                                type="number"
                                min="0"
                                step="1"
                                value={combo.stock}
                                onChange={(e) => updateCombo(combo.key, 'stock', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!isVariantMode && characteristics.some((c) => c.type === 'INFO' && c.name.trim() && c.values.trim()) && (
                <div style={{ marginTop: 16, padding: 12, background: 'var(--color-surface-2)', borderRadius: 'var(--radius)' }}>
                  <span className="small bold" style={{ display: 'block', marginBottom: 6 }}>{t('seller.productForm.infoSpecsTitle')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {characteristics.filter((c) => c.type === 'INFO' && c.name.trim() && c.values.trim()).map((c) => (
                      <span key={c.id} className="small" style={{ background: 'var(--color-surface)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)' }}>
                        <strong>{c.name.trim()}:</strong> {c.values.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>


            {/* Stock + Publication */}
            <Card className="reveal-section">
              {!isVariantMode && (
                <div style={{ marginBottom: 24 }}>
                  <h3>Stock at: {shop.name}</h3>
                  <p className="muted small" style={{ margin: '4px 0 12px' }}>
                    This stock belongs only to <strong>{shop.name}</strong>. Other Shops keep their own stock.
                  </p>
                  <div style={{ maxWidth: 280 }}>
                    <Field
                      label={t('seller.productForm.initialStock')}
                      name="simple_stock"
                      type="number"
                      min="0"
                      step="1"
                      value={simpleStock}
                      onChange={(e) => setSimpleStock(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  paddingTop: 16,
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <div className="small muted">
                  <strong>{form.name.trim() || t('seller.productForm.thisProduct')}</strong>
                  {' · '}{selectedCategory?.name}{subcategoryId && subcategories.find((s) => s.id === subcategoryId) ? ` › ${subcategories.find((s) => s.id === subcategoryId)!.name}` : ''}
                  {' · '}{shop.name}
                  {' · '}{totalUnits} units
                  {imageFiles.length > 0 && ` · ${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''}`}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={busy}
                    onClick={() => (publishIntentRef.current = 'DRAFT')}
                  >
                    {busy && publishIntentRef.current === 'DRAFT' ? stepLabel || t('seller.productForm.saving') : t('seller.productForm.saveDraft')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={busy}
                    onClick={() => (publishIntentRef.current = 'PUBLISHED')}
                  >
                    {busy && publishIntentRef.current === 'PUBLISHED' ? stepLabel || t('seller.productForm.publishing') : t('seller.productForm.publishProduct')}
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}
      </form>
    </div>
  )
}
