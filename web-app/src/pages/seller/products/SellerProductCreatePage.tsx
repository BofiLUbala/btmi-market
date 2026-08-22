import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { productApi, productImageApi, inventoryApi, shopApi, categoryApi } from '@/api/seller'
import type { CategoryResponse, SubcategoryResponse, Shop } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

/* ── Types ── */

interface CharacteristicRow {
  id: string
  name: string
  values: string // comma-separated; >1 value generates variant combinations
}

interface ComboRow {
  key: string
  label: string
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

const CHARACTERISTIC_SUGGESTIONS = [
  'Color', 'Size', 'Material', 'Weight', 'Volume', 'Brand', 'Model',
  'Storage', 'RAM', 'Dimensions', 'Flavor', 'Packaging', 'Capacity',
  'Compatibility', 'Expiration Date',
]

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
  })

  /* Images */
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

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
          setShopError('This Shop does not belong to your current Business.')
          return
        }
        setShop(shopData)
        setCategories(Array.isArray(catsData) ? catsData : [])
      } catch (err) {
        if (mounted) setShopError(err instanceof Error ? err.message : 'Failed to load this Shop.')
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

  /* Derived variant combos (only when a characteristic has multiple values) */
  const combos: ComboRow[] = useMemo(() => {
    const parsed = characteristics
      .map((c) => ({
        name: c.name.trim(),
        values: c.values.split(',').map((v) => v.trim()).filter(Boolean),
      }))
      .filter((c) => c.name && c.values.length > 0)

    const multi = parsed.filter((p) => p.values.length > 1)
    if (multi.length === 0) return []

    const attributeSets = cartesian(parsed)
    return attributeSets.map((attributes) => {
      const label = Object.values(attributes).join(' / ')
      return {
        key: label,
        label,
        attributes,
        price: form.unit_price,
        stock: '0',
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characteristics])

  function updateCombo(key: string, field: 'price' | 'stock', value: string) {
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
  function addCharacteristic() {
    setCharacteristics((prev) => [...prev, { id: `ch-${Date.now()}`, name: '', values: '' }])
  }

  function updateCharacteristic(id: string, field: 'name' | 'values', value: string) {
    setCharacteristics((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  function removeCharacteristic(id: string) {
    setCharacteristics((prev) => prev.filter((c) => c.id !== id))
  }

  /* ── Validation ── */
  function validate(): string {
    if (!categoryId) return 'Please select a Category.'
    if (!form.name.trim()) return 'Product Name is required.'
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price <= 0) return 'A valid Sale Price (> 0 FC) is required.'
    if (isVariantMode) {
      for (const combo of activeCombos) {
        const p = parseFloat(combo.price || form.unit_price)
        if (isNaN(p) || p <= 0) return `Variant "${combo.label}" needs a valid Price (> 0 FC).`
        const s = parseInt(combo.stock, 10)
        if (isNaN(s) || s < 0) return `Variant "${combo.label}" stock must be 0 or more.`
      }
    } else {
      const s = parseInt(simpleStock, 10)
      if (isNaN(s) || s < 0) return 'Initial Stock must be 0 or more.'
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
        setStepLabel('Creating Product…')
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
        })
        productId = created.id
        createdProduct = created
        progress.productId = productId
      }

      /* Step 2 — Resolve variants */
      if (progress.resolvedVariants.length === 0) {
        setStepLabel('Configuring Variants…')
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
        setStepLabel('Uploading Images…')
        for (let i = progress.uploadedImages; i < imageFiles.length; i++) {
          await productImageApi.upload(activeBusiness.id, productId!, imageFiles[i], i === 0)
          progress.uploadedImages += 1
        }
      }

      /* Step 4 — Shop-scoped stock (always materialise the offer, even at 0,
         so the Product is traceable per Shop and shows OUT_OF_STOCK instead
         of disappearing from the Marketplace) */
      if (!progress.stockDone && progress.resolvedVariants.length > 0) {
        setStepLabel('Adding Stock…')
        for (const entry of progress.resolvedVariants) {
          await inventoryApi.addStock(shop.id, {
            variant_id: entry.variantId,
            quantity: entry.stock,
            notes: 'Initial stock',
          })
        }
        progress.stockDone = true
      }

      /* Step 5 — Publish (product stays consistent before it goes live) */
      if (publishIntentRef.current === 'PUBLISHED' && !progress.published) {
        setStepLabel('Publishing…')
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
        err instanceof Error ? err.message : 'Something went wrong. Please retry.'
      setPartialFailure({ stage: stepLabel || 'Processing…', message })
    } finally {
      setBusy(false)
      setStepLabel('')
    }
  }

  function handleSubmit(e: FormEvent, intent: 'DRAFT' | 'PUBLISHED') {
    e.preventDefault()
    if (busy) return
    publishIntentRef.current = intent
    const validationError = validate()
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
    setForm({ name: '', sku: '', unit: 'PCS', unit_price: '', cost_price: '', description: '' })
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
        <h2>No Business Selected</h2>
        <p className="muted">Select a business before creating Products.</p>
      </div>
    )
  }

  if (shopError) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <ErrorBox error={shopError} />
        <Link to="/seller/products/select-shop">
          <Button variant="outline" block>Choose another Shop</Button>
        </Link>
      </div>
    )
  }

  if (!shop) {
    return <LoadingBlock label="Loading Shop…" />
  }

  /* ── Success screen ── */
  if (summary) {
    return (
      <div className="seller-product-create">
        <Card style={{ padding: '32px 24px', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ color: 'var(--color-success)', fontSize: 48, marginBottom: 8 }}>✓</div>
          <h2>{summary.published ? 'Product published' : 'Draft saved'}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {summary.published
              ? <>Your Product is now available in <strong>{selectedCategory?.name}</strong> and at <strong>{shop.name}</strong>.</>
              : <>Save it to <strong>{shop.name}</strong> by adding stock, then publish when ready.</>}
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
            <div><span className="small muted">Shop</span><p><strong>{shop.name}</strong></p></div>
            <div><span className="small muted">Category</span><p><strong>{summary.categoryName}</strong></p></div>
            <div><span className="small muted">Variants</span><p><strong>{summary.variantCount}</strong></p></div>
            <div><span className="small muted">Stock here</span><p><strong>{summary.totalStock} units</strong></p></div>
            <div><span className="small muted">Images</span><p><strong>{summary.imageCount}</strong></p></div>
            <div>
              <span className="small muted">Status</span>
              <p>
                <span className={`badge badge-${summary.published ? 'success' : 'warning'}`}>
                  {summary.published ? 'PUBLISHED' : 'DRAFT'}
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Button size="lg" onClick={() => navigate(`/seller/shops/${shop.id}/products`)}>
              View in Shop
            </Button>
            {summary.published && (
              <Link to={`/products/${summary.productId}`}>
                <Button variant="outline" size="lg">View in Marketplace</Button>
              </Link>
            )}
            <Button variant="ghost" size="lg" onClick={resetForAnother}>
              + Add Another Product
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
          <h2>{partialFailure.stage.replace(/…$/, '')} could not be completed</h2>
          <p className="muted small">
            Your Product was saved. Retrying continues where it stopped — no duplicate will be created.
          </p>
          <ErrorBox error={partialFailure.message} />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <Button size="lg" onClick={handleRetry}>Retry</Button>
            <Link to={`/seller/products/${progressRef.current.productId}`}>
              <Button variant="outline" size="lg">Open Product Details</Button>
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
            <Link to="/seller/products" className="section-link">Products</Link>
            {' / '}
            <Link to={`/seller/shops/${shop.id}/products`} className="section-link">{shop.name}</Link>
          </p>
          <h1>Create Product</h1>
          <p className="muted" style={{ margin: 0 }}>
            Selling from:{' '}
            <strong>{shop.name}</strong>
            {shop.city ? ` — ${shop.city}` : ''}
            {' · '}
            <Link to="/seller/products/select-shop" className="section-link">Change Shop</Link>
          </p>
        </div>
      </div>

      {error && <ErrorBox error={error} />}

      <form onSubmit={(e) => handleSubmit(e, publishIntentRef.current)}>
        {/* STEP 1 — Category */}
        <Card style={{ marginBottom: 24 }}>
          <h3>What kind of Product is this?</h3>
          <p className="muted small" style={{ margin: '4px 0 12px' }}>
            The Category places your Product correctly in the Marketplace.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Field
              label="Category *"
              name="category_id"
              as="select"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setSubcategoryId('')
              }}
              options={[
                { value: '', label: 'Select Category…' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Field
              label="Subcategory"
              name="subcategory_id"
              as="select"
              disabled={subcategories.length === 0}
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              options={[
                { value: '', label: subcategories.length > 0 ? 'Select Subcategory…' : 'None for this Category' },
                ...subcategories.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        </Card>

        {/* STEP 2+ — Details appear only after Category selection */}
        {detailsVisible && (
          <>
            <Card style={{ marginBottom: 24 }} className="reveal-section">
              <h3>Product Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 12 }}>
                <Field
                  label="Product Name *"
                  name="name"
                  placeholder="e.g. Nivea Cream 400ml"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Field
                  label="Sale Price (FC) *"
                  name="unit_price"
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 8000"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                />
                <Field
                  label="SKU (optional)"
                  name="sku"
                  placeholder="e.g. NIV-400"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
                <Field
                  label="Unit"
                  name="unit"
                  placeholder="PCS, KG, L, BOX"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
                <Field
                  label="Cost Price (FC, optional)"
                  name="cost_price"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 5500"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <Field
                  label="Description (optional)"
                  name="description"
                  as="textarea"
                  rows={3}
                  placeholder="Key details Buyers should know…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </Card>

            {/* Images */}
            <Card style={{ marginBottom: 24 }} className="reveal-section">
              <h3>Product Photos</h3>
              <p className="muted small" style={{ margin: '4px 0 12px' }}>
                Add photos from different angles so Buyers can better understand your Product. The first photo is the primary one shown in the Marketplace.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {imagePreviews.map((url, idx) => (
                  <div key={url} className="image-thumb">
                    <img src={url} alt={`Preview ${idx + 1}`} />
                    {idx === 0 && <span className="badge badge-success image-primary-badge">Primary</span>}
                    <div className="image-thumb-actions">
                      {idx !== 0 && (
                        <button type="button" title="Set as primary" onClick={() => makePrimary(idx)}>★</button>
                      )}
                      <button type="button" title="Remove" onClick={() => removeImage(idx)}>✕</button>
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
                <p className="small muted" style={{ marginTop: 8 }}>Maximum of 10 photos reached.</p>
              )}
            </Card>

            {/* Optional characteristics */}
            <Card style={{ marginBottom: 24 }} className="reveal-section">
              <h3>Additional Product Details</h3>
              <p className="muted small" style={{ margin: '4px 0 12px' }}>
                Optional. Add only what matters for this Product. To create purchasable Variants, separate multiple values with commas (e.g. Color: Black, White).
              </p>

              {characteristics.length > 0 && (
                <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
                  {characteristics.map((ch) => (
                    <div key={ch.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr auto', gap: 12, alignItems: 'end' }}>
                      <div>
                        <label className="small bold" style={{ display: 'block', marginBottom: 4 }} htmlFor={`${ch.id}-name`}>Characteristic</label>
                        <input
                          id={`${ch.id}-name`}
                          className="input"
                          list="characteristic-suggestions"
                          placeholder="e.g. Color"
                          value={ch.name}
                          onChange={(e) => updateCharacteristic(ch.id, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="small bold" style={{ display: 'block', marginBottom: 4 }} htmlFor={`${ch.id}-values`}>Value(s), comma separated</label>
                        <input
                          id={`${ch.id}-values`}
                          className="input"
                          placeholder="e.g. Black, White — or 400 ml"
                          value={ch.values}
                          onChange={(e) => updateCharacteristic(ch.id, 'values', e.target.value)}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeCharacteristic(ch.id)}>
                        ✕
                      </Button>
                    </div>
                  ))}
                  <datalist id="characteristic-suggestions">
                    {CHARACTERISTIC_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={addCharacteristic}>
                + Add Characteristic
              </Button>

              {isVariantMode && activeCombos.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <h3>Variants & Stock per Variant</h3>
                  <p className="muted small" style={{ margin: '4px 0 12px' }}>
                    Stock belongs to <strong>{shop.name}</strong>. Total: <strong>{totalUnits} units</strong>.
                  </p>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Variant</th>
                          <th style={{ minWidth: 130 }}>Price (FC)</th>
                          <th style={{ minWidth: 110 }}>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeCombos.map((combo) => (
                          <tr key={combo.key}>
                            <td><strong>{combo.label}</strong></td>
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

              {!isVariantMode && characteristics.some((c) => c.name.trim() && c.values.trim()) && (
                <p className="small muted" style={{ marginTop: 12 }}>
                  These details will be listed as Specifications for this Product.
                </p>
              )}
            </Card>

            {/* Stock + Publication */}
            <Card style={{ marginBottom: 32 }} className="reveal-section">
              {!isVariantMode && (
                <div style={{ marginBottom: 24 }}>
                  <h3>Stock at: {shop.name}</h3>
                  <p className="muted small" style={{ margin: '4px 0 12px' }}>
                    This stock belongs only to <strong>{shop.name}</strong>. Other Shops keep their own stock.
                  </p>
                  <div style={{ maxWidth: 280 }}>
                    <Field
                      label="Initial Stock"
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
                  <strong>{form.name.trim() || 'This Product'}</strong>
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
                    {busy && publishIntentRef.current === 'DRAFT' ? stepLabel || 'Saving…' : 'Save Draft'}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={busy}
                    onClick={() => (publishIntentRef.current = 'PUBLISHED')}
                  >
                    {busy && publishIntentRef.current === 'PUBLISHED' ? stepLabel || 'Publishing…' : 'Publish Product'}
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
