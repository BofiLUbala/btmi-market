import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { productApi, productImageApi, inventoryApi, shopApi, categoryApi } from '@/api/seller'
import { ApiError, type CategoryResponse, type SubcategoryResponse, type Shop, type CategoryAttributeDefinition } from '@/api/types'
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
import {
  attributeLabel,
  canonicalizeAttributes,
  getAttributeValue,
  matchesAttributeName,
  variantDisplayLabel,
  variantHasAttribute,
} from '@/lib/categoryAttributes'

/* ── Types ── */

interface CharacteristicRow {
  id: string
  name: string
  type: AttributeClassification
  values: string
  placeholder?: string
  definitionKey?: string
  inputType?: string
  allowedValues?: string[]
}

interface VariantDraft {
  clientId: string
  sku: string
  attributes: Record<string, string>
  price: string
  stock: string
}

interface MissingVariantIssue {
  key: string
  label: string
  variants: Array<{ clientId: string; label: string }>
}

interface PipelineProgress {
  productId?: string
  resolvedVariants: Array<{ variantId: string; stock: number }>
  uploadedImages: number
  stockDone: boolean
  published: boolean
}

/* ── Helpers ── */

function newDraftId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `vd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emptyVariantDraft(price = ''): VariantDraft {
  return { clientId: newDraftId(), sku: '', attributes: {}, price, stock: '0' }
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
  const [dbAttrDefs, setDbAttrDefs] = useState<CategoryAttributeDefinition[]>([])

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

  /* Product-level (non-variant) characteristics */
  const [characteristics, setCharacteristics] = useState<CharacteristicRow[]>([])

  /* One card per purchasable variant — required variant attributes live here */
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([emptyVariantDraft()])
  const [focusTarget, setFocusTarget] = useState<{ clientId: string; key: string } | null>(null)
  const [missingIssues, setMissingIssues] = useState<MissingVariantIssue[]>([])
  const [missingProductKeys, setMissingProductKeys] = useState<string[]>([])

  /* Simple-product initial stock */
  const [simpleStock, setSimpleStock] = useState('0')

  /* Seller's own compulsory 1-5 star self-rating for this product */
  const [selfRating, setSelfRating] = useState(0)

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
  /* One key per visit to this page. Retrying a create that the server already
     committed -- but whose response never arrived -- replays onto the same
     product instead of making a second one. */
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `pc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  )
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

  /* Fetch DB-backed attribute definitions whenever category or subcategory changes */
  useEffect(() => {
    if (!categoryId) {
      setDbAttrDefs([])
      return
    }
    let active = true
    categoryApi.getAttributes(categoryId, subcategoryId || undefined)
      .then((defs) => {
        if (active) setDbAttrDefs(Array.isArray(defs) ? defs : [])
      })
      .catch(() => {
        if (active) setDbAttrDefs([])
      })
    return () => {
      active = false
    }
  }, [categoryId, subcategoryId])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  )
  const subcategories: SubcategoryResponse[] = selectedCategory?.subcategories ?? []
  const selectedSubcategory = useMemo(
    () => subcategories.find((s) => s.id === subcategoryId),
    [subcategories, subcategoryId]
  )

  const variantAttrDefs = useMemo(
    () => dbAttrDefs.filter((d) => d.variant_attribute),
    [dbAttrDefs]
  )
  const productAttrDefs = useMemo(
    () => dbAttrDefs.filter((d) => !d.variant_attribute),
    [dbAttrDefs]
  )

  const categorySuggestions = useMemo(() => {
    if (productAttrDefs.length > 0) {
      return productAttrDefs.map((d) => ({
        name: d.label_fr || d.label_en || d.key,
        recommendedType: 'INFO' as AttributeClassification,
        placeholder: d.allowed_values && d.allowed_values.length > 0
          ? d.allowed_values.join(', ')
          : d.key,
        definitionKey: d.key,
      }))
    }
    if (!selectedCategory) return [] as Array<AttributeSuggestion & { definitionKey?: string }>
    const staticSuggestions = selectedSubcategory
      ? getCategorySuggestions(selectedSubcategory.slug || selectedSubcategory.name)
      : []
    const fallback = staticSuggestions.length > 0
      ? staticSuggestions
      : getCategorySuggestions(selectedCategory.slug || selectedCategory.name)
    return fallback.filter((s) => s.recommendedType === 'INFO')
  }, [productAttrDefs, selectedCategory, selectedSubcategory])

  const categoryRequirements = useMemo(
    () =>
      getCategoryRequirements(
        selectedCategory?.slug || selectedCategory?.name,
        selectedSubcategory?.slug || selectedSubcategory?.name
      ),
    [selectedCategory, selectedSubcategory]
  )

  const requiredProductAttrNames = useMemo(() => {
    const set = new Set<string>()
    for (const d of productAttrDefs.filter((x) => x.required)) {
      if (d.key) set.add(d.key.toLowerCase())
      if (d.label_fr) set.add(d.label_fr.toLowerCase())
      if (d.label_en) set.add(d.label_en.toLowerCase())
    }
    return set
  }, [productAttrDefs])

  useEffect(() => {
    setCharacteristics((prev) => {
      // Keep seller-defined custom rows and DB-backed rows that still belong to
      // the newly selected category.  Definitions from the previous category
      // must not remain visible or satisfy the new category's requirements.
      const next = prev.filter((row) => {
        if (!row.definitionKey) {
          return !variantAttrDefs.some((def) => matchesAttributeName(row.name, def))
        }
        return productAttrDefs.some(
          (def) => row.definitionKey === def.key || matchesAttributeName(row.name, def),
        )
      })
      // Every active non-variant definition is a product-level field. Optional
      // definitions are rendered too; `required` only controls validation.
      for (const def of productAttrDefs) {
        const exists = next.some((row) => matchesAttributeName(row.name, def) || row.definitionKey === def.key)
        if (exists) continue
        next.push({
          id: `ch-${def.key}`,
          name: attributeLabel(def),
          type: 'INFO',
          values: '',
          placeholder: def.allowed_values?.join(', ') || def.key,
          definitionKey: def.key,
          inputType: def.input_type,
          allowedValues: def.allowed_values,
        })
      }
      return next
    })
  }, [productAttrDefs, variantAttrDefs])

  useEffect(() => {
    setVariantDrafts((prev) => {
      const source = prev.length > 0 ? prev : [emptyVariantDraft(form.unit_price)]
      return source.map((draft) => ({
        ...draft,
        price: draft.price || form.unit_price,
        attributes: Object.fromEntries(
          variantAttrDefs.map((def) => [def.key, getAttributeValue(draft.attributes, def)])
        ),
      }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantAttrDefs.map((d) => d.key).join('|')])

  useEffect(() => {
    if (!focusTarget) return
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`variant-${focusTarget.clientId}-${focusTarget.key}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [focusTarget])

  const liveMissingIssues = useMemo((): MissingVariantIssue[] => {
    const requiredVariantDefs = variantAttrDefs.filter((d) => d.required)
    if (requiredVariantDefs.length === 0) return []
    const issues: MissingVariantIssue[] = []
    for (const def of requiredVariantDefs) {
      const lacking = variantDrafts.filter((draft) => !variantHasAttribute(draft.attributes, def))
      if (lacking.length === 0) continue
      issues.push({
        key: def.key,
        label: attributeLabel(def),
        variants: lacking.map((draft, index) => ({
          clientId: draft.clientId,
          label: (() => {
            const position = variantDrafts.indexOf(draft) + 1 || index + 1
            const base = t('seller.productForm.variantN', { n: position })
            const details = variantDisplayLabel(draft.attributes, variantAttrDefs, base)
            return details === base ? base : `${base} — ${details}`
          })(),
        })),
      })
    }
    return issues
  }, [variantAttrDefs, variantDrafts, t])

  useEffect(() => {
    setMissingIssues((prev) => (prev.length === 0 ? prev : liveMissingIssues))
    if (liveMissingIssues.length === 0) setError((current) => current === t('seller.productForm.validation.completeVariantAttrs') ? '' : current)
  }, [liveMissingIssues, t])

  function handleCategoryChange(newCatId: string) {
    if (categoryId && newCatId !== categoryId && (characteristics.length > 0 || variantDrafts.some((d) => Object.values(d.attributes).some(Boolean)))) {
      const hasValues = characteristics.some((c) => c.name.trim() || c.values.trim())
        || variantDrafts.some((d) => Object.values(d.attributes).some((v) => String(v).trim()))
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
    setVariantDrafts([emptyVariantDraft(form.unit_price)])
    setMissingIssues([])
    setMissingProductKeys([])
    setFocusTarget(null)
  }

  const isVariantMode = variantAttrDefs.length > 0 || variantDrafts.length > 1

  const totalUnits = isVariantMode
    ? variantDrafts.reduce((sum, c) => sum + Math.max(0, parseInt(c.stock, 10) || 0), 0)
    : Math.max(0, parseInt(simpleStock, 10) || 0)

  function infoAttributesPayload(): Record<string, string> {
    const attrs: Record<string, string> = {}
    for (const c of characteristics) {
      const name = c.definitionKey || c.name.trim()
      const value = c.values.trim()
      if (name && value) attrs[name] = value
    }
    return canonicalizeAttributes(attrs, dbAttrDefs)
  }

  function variantPayload(draft: VariantDraft, index: number) {
    const merged = canonicalizeAttributes(
      { ...infoAttributesPayload(), ...draft.attributes },
      dbAttrDefs
    )
    const label = variantDisplayLabel(merged, variantAttrDefs, t('seller.productForm.variantN', { n: index + 1 }))
    return {
      name: form.name.trim() ? `${form.name.trim()} — ${label}` : label,
      sku: draft.sku.trim() || (form.sku.trim() ? `${form.sku.trim()}-${index + 1}` : undefined),
      attributes: merged,
      sale_price: parseFloat(draft.price || form.unit_price),
      purchase_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
      unit: form.unit.trim() || 'PCS',
    }
  }

  function updateVariantDraft(clientId: string, patch: Partial<VariantDraft>) {
    setVariantDrafts((prev) => prev.map((d) => (d.clientId === clientId ? { ...d, ...patch } : d)))
  }

  function updateVariantAttribute(clientId: string, key: string, value: string) {
    setVariantDrafts((prev) =>
      prev.map((d) => (d.clientId === clientId ? { ...d, attributes: { ...d.attributes, [key]: value } } : d))
    )
  }

  function addVariantDraft() {
    setVariantDrafts((prev) => [...prev, emptyVariantDraft(form.unit_price)])
  }

  function removeVariantDraft(clientId: string) {
    setVariantDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.clientId !== clientId)))
  }

  function focusVariantField(clientId: string, key: string) {
    setFocusTarget({ clientId, key })
  }

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
  function addSuggestion(s: AttributeSuggestion & { definitionKey?: string }) {
    const exists = characteristics.some(
      (c) => c.name.trim().toLowerCase() === s.name.toLowerCase() || (s.definitionKey && c.definitionKey === s.definitionKey)
    )
    if (exists) return
    setCharacteristics((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: s.name,
        type: 'INFO',
        values: '',
        placeholder: s.placeholder,
        definitionKey: s.definitionKey,
      },
    ])
  }

  function addCustomCharacteristic() {
    setCharacteristics((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        type: 'INFO',
        values: '',
        placeholder: 'e.g. Genuine Leather, 2026-12-31',
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
    if (selfRating < 1 || selfRating > 5) return t('seller.productForm.validation.selfRatingRequired')

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
      if (liveMissingIssues.length > 0) {
        setMissingIssues(liveMissingIssues)
        const first = liveMissingIssues[0]
        focusVariantField(first.variants[0].clientId, first.key)
        return t('seller.productForm.validation.completeVariantAttrs')
      }

      const completed = characteristics
        .filter((c) => c.name.trim() && c.values.trim())
        .flatMap((c) => [c.name, c.definitionKey || ''].filter(Boolean))
      const missingProduct = dbAttrDefs.length > 0
        ? productAttrDefs.filter((d) => d.required && !characteristics.some((c) => c.values.trim() && (matchesAttributeName(c.name, d) || c.definitionKey === d.key))).map((d) => attributeLabel(d))
        : missingRequiredAttributes(categoryRequirements, completed)
      if (missingProduct.length > 0) {
        const keys = productAttrDefs
          .filter((d) => d.required && !characteristics.some((c) => c.values.trim() && (matchesAttributeName(c.name, d) || c.definitionKey === d.key)))
          .map((d) => d.key)
        setMissingProductKeys(keys)
        window.setTimeout(() => document.getElementById(`ch-${keys[0]}-values`)?.focus(), 0)
        return (
          t('seller.productForm.validation.missingAttributes', { attributes: missingProduct.join(', ') }) +
          ' ' +
          t(missingProduct.length > 1
            ? 'seller.productForm.validation.missingThem'
            : 'seller.productForm.validation.missingIt')
        )
      }
    }

    if (isVariantMode) {
      for (const [index, draft] of variantDrafts.entries()) {
        const p = parseFloat(draft.price || form.unit_price)
        const label = variantDisplayLabel(draft.attributes, variantAttrDefs, t('seller.productForm.variantN', { n: index + 1 }))
        if (isNaN(p) || p <= 0) return `Variant "${label}" needs a valid Price (> 0 FC).`
        const s = parseInt(draft.stock, 10)
        if (isNaN(s) || s < 0) return `Variant "${label}" stock must be 0 or more.`
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
          self_rating: selfRating,
          idempotency_key: idempotencyKeyRef.current,
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
          const attrs = infoAttributesPayload()
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
          for (let i = 0; i < variantDrafts.length; i++) {
            const payload = variantPayload(variantDrafts[i], i)
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
              stock: Math.max(0, parseInt(variantDrafts[i].stock, 10) || 0),
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

      /* Step 5 — Keep variant attributes in sync (covers retries after the
         seller fills missing Couleur / Pointure values). */
      if (isVariantMode && progress.resolvedVariants.length > 0) {
        for (let i = 0; i < Math.min(variantDrafts.length, progress.resolvedVariants.length); i++) {
          const payload = variantPayload(variantDrafts[i], i)
          await productApi.updateVariant(progress.resolvedVariants[i].variantId, {
            name: payload.name,
            sku: payload.sku,
            attributes: payload.attributes,
            sale_price: payload.sale_price,
            purchase_price: payload.purchase_price,
            unit: payload.unit,
          })
        }
      }

      /* Step 6 — Publish (product stays consistent before it goes live) */
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
      if (err instanceof ApiError && err.code === 'MISSING_REQUIRED_ATTRIBUTES') {
        setMissingIssues(liveMissingIssues)
        if (liveMissingIssues[0]) {
          focusVariantField(liveMissingIssues[0].variants[0].clientId, liveMissingIssues[0].key)
        }
      }
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
      if (intent !== 'PUBLISHED' || liveMissingIssues.length === 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
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
    setVariantDrafts([emptyVariantDraft()])
    setMissingIssues([])
    setFocusTarget(null)
    setSelfRating(0)
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
        <Card className="product-create-failure">
          <div className="product-create-failure-icon" aria-hidden>⚠</div>
          <h2>{t('seller.productForm.couldNotComplete', { stage: partialFailure.stage.replace(/…$/, '') })}</h2>
          <p className="muted product-create-failure-copy">
            {t('seller.productForm.savedRetryDesc')}
          </p>
          <ErrorBox error={partialFailure.message} />
          <div className="product-create-failure-actions">
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

      {error && liveMissingIssues.length === 0 && <ErrorBox error={error} />}
      {missingIssues.length > 0 && (
        <div className="missing-requirements notice notice-warning mb-4" role="alert">
          {missingIssues.map((issue) => (
            <section key={issue.key} className="missing-requirement-item">
              <div>
                <strong>{issue.label} manquante</strong>
                <div className="missing-variant-summary">
                  <span>{t('seller.productForm.missingOn')}</span>
                  {issue.variants.map((variant) => (
                    <span key={variant.clientId}>• {variant.label}</span>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => focusVariantField(issue.variants[0].clientId, issue.key)}
              >
                {issue.variants.length > 1
                  ? t('seller.productForm.completeVariants')
                  : t('seller.productForm.completeAttribute', { label: issue.label })}
              </Button>
            </section>
          ))}
        </div>
      )}
      {missingProductKeys.length > 0 && (
        <div className="missing-requirements notice notice-warning mb-4" role="alert">
          {missingProductKeys.map((key) => {
            const def = productAttrDefs.find((item) => item.key === key)
            const label = def ? attributeLabel(def) : key
            return (
              <section key={key} className="missing-requirement-item">
                <strong>{label} manquante</strong>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById(`ch-${key}-values`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el?.focus()
                  }}
                >
                  {t('seller.productForm.completeAttribute', { label })}
                </Button>
              </section>
            )
          })}
        </div>
      )}

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
                {
                  value: '',
                  // Three distinct states: no category picked yet, a category
                  // that genuinely has no subcategories, or one that does.
                  // Collapsing the first two claims "no subcategory" before the
                  // seller has chosen anything.
                  label: !categoryId
                    ? t('seller.productForm.chooseCategoryFirst')
                    : subcategories.length > 0
                      ? t('seller.productForm.selectSubcategory')
                      : t('seller.productForm.noSubcategory'),
                },
                ...subcategories.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          {categoryNotice && (
            <div className="notice notice-warning mt-4">{categoryNotice}</div>
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
              <div style={{ marginTop: 16 }}>
                <label className="small bold" style={{ display: 'block', marginBottom: 4 }}>
                  {t('seller.productForm.selfRatingLabel')} <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  {t('seller.productForm.selfRatingHint')}
                </p>
                <div role="radiogroup" aria-label={t('seller.productForm.selfRatingLabel')} style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={selfRating === n}
                      title={t('reviews.starsLabel', { count: n })}
                      onClick={() => setSelfRating(n)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.6rem',
                        lineHeight: 1,
                        padding: 2,
                        color: n <= selfRating ? 'var(--color-warning, #f5a623)' : 'var(--color-border)',
                      }}
                    >
                      ★
                    </button>
                  ))}
                  {selfRating > 0 && (
                    <span className="small muted" style={{ alignSelf: 'center', marginLeft: 6 }}>
                      {t('seller.productForm.selfRatingSelected', { count: selfRating })}
                    </span>
                  )}
                </div>
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

            {variantAttrDefs.length > 0 && (
              <Card className="reveal-section">
                <div id="variant-editor">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{t('seller.productForm.variantsTitle')}</h3>
                    <p className="muted small" style={{ margin: '4px 0 0' }}>
                      {t('seller.productForm.variantsDesc')}
                    </p>
                  </div>
                  <div className="badge badge-primary" style={{ padding: '6px 12px' }}>
                    {t('seller.productForm.totalStock')} <strong>{totalUnits} {t('seller.productForm.unitsPlural')}</strong>
                  </div>
                </div>

                <div className="variant-draft-list">
                  {variantDrafts.map((draft, index) => {
                    const title = variantDisplayLabel(
                      draft.attributes,
                      variantAttrDefs,
                      t('seller.productForm.variantN', { n: index + 1 })
                    )
                    return (
                      <section
                        key={draft.clientId}
                        id={`variant-draft-${draft.clientId}`}
                        className={`variant-draft-card${focusTarget?.clientId === draft.clientId ? ' variant-draft-card-focus' : ''}`}
                      >
                        <div className="variant-draft-header">
                          <h4>{t('seller.productForm.variantN', { n: index + 1 })}{title !== t('seller.productForm.variantN', { n: index + 1 }) ? ` — ${title}` : ''}</h4>
                          {variantDrafts.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeVariantDraft(draft.clientId)}>
                              {t('seller.productForm.removeVariant')}
                            </Button>
                          )}
                        </div>
                        <div className="variant-draft-fields">
                          {variantAttrDefs.map((def) => {
                            const label = attributeLabel(def)
                            const focused = focusTarget?.clientId === draft.clientId && focusTarget.key === def.key
                            const missing = def.required && !getAttributeValue(draft.attributes, def)
                            return (
                              <Field
                                key={def.key}
                                id={`variant-${draft.clientId}-${def.key}`}
                                label={`${label}${def.required ? ' *' : ''}`}
                                name={`variant-${draft.clientId}-${def.key}`}
                                value={draft.attributes[def.key] || ''}
                                className={focused || (missing && missingIssues.some((issue) => issue.key === def.key)) ? 'completion-input-focus' : ''}
                                placeholder={def.allowed_values?.[0] || label}
                                as={def.input_type === 'SELECT' || def.input_type === 'BOOLEAN' ? 'select' : 'input'}
                                type={def.input_type === 'DATE' ? 'date' : def.input_type === 'NUMBER' ? 'number' : undefined}
                                options={def.input_type === 'SELECT'
                                  ? [{ value: '', label: `— ${label} —` }, ...(def.allowed_values || []).map((value) => ({ value, label: value }))]
                                  : def.input_type === 'BOOLEAN'
                                    ? [{ value: '', label: `— ${label} —` }, { value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }]
                                    : undefined}
                                onFocus={() => setFocusTarget({ clientId: draft.clientId, key: def.key })}
                                onChange={(e) => updateVariantAttribute(draft.clientId, def.key, e.target.value)}
                              />
                            )
                          })}
                          <Field
                            label={t('seller.productForm.salePriceFc')}
                            name={`price-${draft.clientId}`}
                            type="number"
                            min="1"
                            step="any"
                            value={draft.price}
                            onChange={(e) => updateVariantDraft(draft.clientId, { price: e.target.value })}
                          />
                          <Field
                            label={t('seller.productForm.initialStock')}
                            name={`stock-${draft.clientId}`}
                            type="number"
                            min="0"
                            step="1"
                            value={draft.stock}
                            onChange={(e) => updateVariantDraft(draft.clientId, { stock: e.target.value })}
                          />
                          <Field
                            label="SKU"
                            name={`sku-${draft.clientId}`}
                            value={draft.sku}
                            placeholder="SKU"
                            onChange={(e) => updateVariantDraft(draft.clientId, { sku: e.target.value })}
                          />
                        </div>
                      </section>
                    )
                  })}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addVariantDraft}>
                  {t('seller.productForm.addVariant')}
                </Button>
                </div>
              </Card>
            )}

            {/* Product-level characteristics only (not Couleur / Pointure) */}
            <Card className="reveal-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{t('seller.productForm.characteristicsTitleProduct')}</h3>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>
                    {t('seller.productForm.characteristicsDescProduct')}
                  </p>
                </div>
              </div>

              {categorySuggestions.length > 0 && (
                <div style={{ margin: '16px 0 20px', padding: 14, background: 'var(--color-surface-2)', borderRadius: 'var(--radius)' }}>
                  <div className="small bold" style={{ marginBottom: 8, color: 'var(--color-text)' }}>
                    💡 {t('seller.productForm.suggestedFor', { name: selectedSubcategory?.name || selectedCategory?.name || t('seller.productForm.thisCategory') })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {categorySuggestions.map((sug) => {
                      const alreadyAdded = characteristics.some(
                        (c) => c.name.trim().toLowerCase() === sug.name.toLowerCase() || ('definitionKey' in sug && sug.definitionKey && c.definitionKey === sug.definitionKey)
                      )
                      const isRequired = requiredProductAttrNames.has(sug.name.toLowerCase())
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
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {characteristics.length > 0 && (
                <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
                  {characteristics.map((ch) => (
                    <div
                      key={ch.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(140px, 220px) 1fr auto',
                        gap: 12,
                        alignItems: 'end',
                        padding: 12,
                        background: 'rgba(0,0,0,0.02)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                      }}
                    >
                      <div>
                        <label className="small bold" style={{ display: 'block', marginBottom: 4 }} htmlFor={`${ch.id}-name`}>
                          {t('seller.productForm.attributeName')}
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
                        <label className="small bold" style={{ display: 'block', marginBottom: 4 }} htmlFor={`${ch.id}-values`}>
                          {t('seller.productForm.specValueLabel')}
                        </label>
                        {ch.inputType === 'SELECT' || ch.inputType === 'BOOLEAN' ? (
                          <select
                            id={`${ch.id}-values`}
                            className={`select ${missingProductKeys.includes(ch.definitionKey || '') ? 'completion-input-focus' : ''}`}
                            value={ch.values}
                            onChange={(e) => updateCharacteristic(ch.id, 'values', e.target.value)}
                          >
                            <option value="">— {ch.name} —</option>
                            {(ch.inputType === 'BOOLEAN' ? ['true', 'false'] : ch.allowedValues || []).map((value) => (
                              <option key={value} value={value}>{value}</option>
                            ))}
                          </select>
                        ) : (
                        <input
                          id={`${ch.id}-values`}
                          className={`input ${missingProductKeys.includes(ch.definitionKey || '') ? 'completion-input-focus' : ''}`}
                          type={ch.inputType === 'DATE' ? 'date' : ch.inputType === 'NUMBER' ? 'number' : 'text'}
                          placeholder={ch.placeholder || t('seller.productForm.valuesPlaceholderInfo')}
                          value={ch.values}
                          onChange={(e) => {
                            updateCharacteristic(ch.id, 'values', e.target.value)
                            if (ch.definitionKey && e.target.value.trim()) {
                              setMissingProductKeys((prev) => prev.filter((key) => key !== ch.definitionKey))
                            }
                          }}
                        />
                        )}
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
                  <span className="small muted">{t('seller.productForm.charHintOptional')}</span>
                )}
              </div>
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
