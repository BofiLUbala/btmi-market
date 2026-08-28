import { useAuth } from '@/store/auth'
import { productApi, productImageApi, inventoryApi, shopApi, categoryApi } from '@/api/seller'
import type { Product, ProductVariant, Shop, InventoryItem, CategoryResponse, ProductImageResponse } from '@/api/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { PlusIcon } from '@/components/ui/Icons'
import { extractSpecifications } from '@/lib/variants'
import { useEffect, useState, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'


export default function SellerProductDetailPage() {
  const { activeBusiness, activeShop } = useAuth()
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const scopedShopId = searchParams.get('shop') || ''
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [variantInventories, setVariantInventories] = useState<Record<string, InventoryItem[]>>({})
  const [images, setImages] = useState<ProductImageResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  // Edit Product / Category Form state
  const [showProductEditForm, setShowProductEditForm] = useState(false)
  const [productEditForm, setProductEditForm] = useState({
    name: '',
    sku: '',
    unit: 'PCS',
    unit_price: '',
    cost_price: '',
    description: '',
    category_id: '',
    subcategory_id: '',
  })
  const [categoryChangeWarning, setCategoryChangeWarning] = useState('')

  // Add Variant Modal/Form state
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [variantForm, setVariantForm] = useState({
    name: '',
    sku: '',
    sale_price: '',
    purchase_price: '',
    initial_stock: '0',
    shop_id: '',
  })
  // Structured attribute values for the new Variant, keyed by attribute name.
  // Buyers can only browse by an attribute when every Variant carries it, so
  // the form is driven by the attribute names this Product already uses.
  const [variantAttrs, setVariantAttrs] = useState<Record<string, string>>({})
  const [newAttrName, setNewAttrName] = useState('')


  // Promotion/Discount Config Form state
  const [showPromoForm, setShowPromoForm] = useState(false)
  const [promoForm, setPromoForm] = useState({
    discount_active: false,
    discount_type: 'PERCENTAGE',
    discount_value: '',
    discount_start: '',
    discount_end: '',
  })

  // Inline attribute repair for a single existing variant
  const [editingAttrsFor, setEditingAttrsFor] = useState<string | null>(null)
  const [editAttrs, setEditAttrs] = useState<Record<string, string>>({})

  // Quick stock addition per variant
  const [stockByVariant, setStockByVariant] = useState<Record<string, string>>({})
  const [targetShopByVariant, setTargetShopByVariant] = useState<Record<string, string>>({})
  const [stockMsg, setStockMsg] = useState('')

  useEffect(() => {
    if (activeBusiness && productId) {
      load()
    }
  }, [activeBusiness?.id, productId, scopedShopId])

  // Attribute names already in use by this Product's variants. New variants must
  // reuse them, otherwise the Marketplace cannot offer a consistent selector.
  const knownAttributeKeys = useMemo(() => {
    const keys: string[] = []
    for (const v of variants) {
      for (const key of Object.keys(v.attributes ?? {})) {
        if (!keys.includes(key)) keys.push(key)
      }
    }
    return keys
  }, [variants])

  // Variants saved without attributes cannot be selected by buyers.
  const variantsMissingAttributes = useMemo(
    () => variants.filter((v) => Object.keys(v.attributes ?? {}).length === 0),
    [variants]
  )

  // Attributes shared by every variant are product specifications, not selectors.
  const specifications = useMemo(
    () =>
      extractSpecifications(
        variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          attributes: (v.attributes || {}) as Record<string, string>,
          unit_price: v.sale_price,
          base_price: v.sale_price,
          stock: 'AVAILABLE',
          stock_quantity: 1,
        }))
      ),
    [variants]
  )

  // Prefill the attribute inputs whenever the form opens.
  useEffect(() => {
    if (!showVariantForm) return
    setVariantAttrs((prev) => {
      const next: Record<string, string> = {}
      for (const key of knownAttributeKeys) next[key] = prev[key] ?? ''
      return next
    })
  }, [showVariantForm, knownAttributeKeys])

  async function load() {
    if (!activeBusiness || !productId) return
    setLoading(true)
    setError('')
    try {
      const [p, vList, sList, catsData, imgList] = await Promise.all([
        productApi.get(activeBusiness.id, productId),
        productApi.listVariants(activeBusiness.id, productId),
        shopApi.listByBusiness(activeBusiness.id),
        categoryApi.list().catch(() => [] as CategoryResponse[]),
        productImageApi.list(activeBusiness.id, productId).catch(() => [] as ProductImageResponse[]),
      ])
      setProduct(p)
      setImages(Array.isArray(imgList) ? imgList : [])
      setCategories(Array.isArray(catsData) ? catsData : [])
      if (p) {
        const formatDateTimeLocal = (isoStr?: string | null) => {
          if (!isoStr) return ''
          const d = new Date(isoStr)
          if (isNaN(d.getTime())) return ''
          const pad = (n: number) => String(n).padStart(2, '0')
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        }
        setPromoForm({
          discount_active: p.discount_active || false,
          discount_type: p.discount_type || 'PERCENTAGE',
          discount_value: p.discount_value ? String(p.discount_value) : '',
          discount_start: formatDateTimeLocal(p.discount_start),
          discount_end: formatDateTimeLocal(p.discount_end),
        })
        setProductEditForm({
          name: p.name || '',
          sku: p.sku || '',
          unit: p.unit || 'PCS',
          unit_price: String(p.unit_price || ''),
          cost_price: p.cost_price ? String(p.cost_price) : '',
          description: p.description || '',
          category_id: p.category_id || '',
          subcategory_id: p.subcategory_id || '',
        })
      }
      const safeVariants = Array.isArray(vList) ? vList : []
      const safeShops = Array.isArray(sList) ? sList : []
      setVariants(safeVariants)
      setShops(safeShops)

      // Fetch inventories for each variant
      const invMap: Record<string, InventoryItem[]> = {}
      await Promise.all(
        safeVariants.map(async (v) => {
          try {
            const inv = await productApi.getVariantInventory(v.id)
            invMap[v.id] = (Array.isArray(inv) ? inv : []).filter(item => !scopedShopId || item.shop_id === scopedShopId)
          } catch {
            invMap[v.id] = []
          }
        })
      )
      setVariantInventories(invMap)

      // Set default target shops
      const defaultShop = scopedShopId || activeShop || (safeShops.length > 0 ? safeShops[0].id : '')
      setVariantForm((prev) => ({ ...prev, shop_id: defaultShop }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product details.')
    } finally {
      setLoading(false)
    }
  }

  function handleEditCategoryChange(newCatId: string) {
    if (product?.category_id && newCatId !== product.category_id) {
      const oldCat = categories.find((c) => c.id === product.category_id)?.name || 'current category'
      const newCat = categories.find((c) => c.id === newCatId)?.name || 'selected category'
      setCategoryChangeWarning(
        `Changing category from ${oldCat} to ${newCat} will update the catalog classification. Your existing product variants and inventory will NOT be deleted or reset.`
      )
    } else {
      setCategoryChangeWarning('')
    }
    setProductEditForm((prev) => ({ ...prev, category_id: newCatId, subcategory_id: '' }))
  }

  async function saveProductDetails(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness || !product) return
    const price = parseFloat(productEditForm.unit_price)
    if (isNaN(price) || price <= 0) {
      setActionError('Valid Sale Price (> 0 FC) is required.')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      const updated = await productApi.update(activeBusiness.id, product.id, {
        name: productEditForm.name.trim(),
        sku: productEditForm.sku.trim() || undefined,
        unit: productEditForm.unit.trim() || 'PCS',
        unit_price: price,
        cost_price: productEditForm.cost_price ? parseFloat(productEditForm.cost_price) : undefined,
        description: productEditForm.description.trim() || undefined,
        category_id: productEditForm.category_id || undefined,
        subcategory_id: productEditForm.subcategory_id || undefined,
      })
      setProduct(updated)
      setShowProductEditForm(false)
      setStockMsg('Product details and category updated successfully.')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update product details.')
    } finally {
      setBusy(false)
    }
  }

  async function togglePublish() {
    if (!activeBusiness || !product) return
    setBusy(true)
    setActionError('')
    try {
      const next = product.publication_status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
      const updated = await productApi.update(activeBusiness.id, product.id, { publication_status: next })
      setProduct(updated)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update publication status')
    } finally {
      setBusy(false)
    }
  }

  async function savePromotion(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness || !product) return
    setBusy(true)
    setActionError('')
    try {
      const discVal = parseFloat(promoForm.discount_value)
      if (promoForm.discount_active) {
        if (isNaN(discVal) || discVal <= 0) {
          throw new Error('Please enter a valid promotion discount value.')
        }
        if (promoForm.discount_type === 'PERCENTAGE' && discVal > 100) {
          throw new Error('Percentage discount cannot exceed 100%.')
        }
        if (promoForm.discount_type === 'FIXED' && discVal >= (product.unit_price || 0)) {
          throw new Error('Fixed discount cannot exceed or equal the base price.')
        }
        if (promoForm.discount_start && promoForm.discount_end) {
          if (new Date(promoForm.discount_end) <= new Date(promoForm.discount_start)) {
            throw new Error('Promotion end date must be after the start date.')
          }
        }
      }

      const updated = await productApi.update(activeBusiness.id, product.id, {
        discount_active: promoForm.discount_active,
        discount_type: promoForm.discount_type,
        discount_value: promoForm.discount_active ? discVal : 0,
        discount_start: promoForm.discount_active && promoForm.discount_start ? new Date(promoForm.discount_start).toISOString() : null,
        discount_end: promoForm.discount_active && promoForm.discount_end ? new Date(promoForm.discount_end).toISOString() : null,
      })
      setProduct(updated)
      setShowPromoForm(false)
      setStockMsg('Product promotion updated successfully.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save promotion settings.')
    } finally {
      setBusy(false)
    }
  }

  async function createVariant(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness || !productId) return
    const parsedAttrs: Record<string, string> = {}
    for (const [key, value] of Object.entries(variantAttrs)) {
      const k = key.trim()
      const v = value.trim()
      if (k && v) parsedAttrs[k] = v
    }

    // Without attributes a Variant cannot be selected by Buyers — it falls back
    // to a raw name in the Marketplace. Refuse rather than silently create one.
    if (knownAttributeKeys.length > 0) {
      const missing = knownAttributeKeys.filter((k) => !parsedAttrs[k])
      if (missing.length > 0) {
        setActionError(
          `Set a value for ${missing.join(', ')} so buyers can select this variant. Every variant of this product must define the same attributes.`
        )
        return
      }
    } else if (Object.keys(parsedAttrs).length === 0) {
      setActionError(
        'Add at least one attribute (e.g. Color, Size) so buyers can tell this variant apart from the others.'
      )
      return
    }

    setBusy(true)
    setActionError('')
    try {
      const newVar = await productApi.createVariant(activeBusiness.id, productId, {
        name: variantForm.name.trim() || Object.values(parsedAttrs).join(' / ') || undefined,
        sku: variantForm.sku.trim() || undefined,
        attributes: parsedAttrs,
        sale_price: parseFloat(variantForm.sale_price),
        purchase_price: variantForm.purchase_price ? parseFloat(variantForm.purchase_price) : undefined,
      })

      const initStock = parseInt(variantForm.initial_stock, 10)
      const shopId = scopedShopId || variantForm.shop_id || activeShop || (shops.length > 0 ? shops[0].id : '')
      if (initStock > 0 && shopId) {
        await inventoryApi.addStock(shopId, {
          variant_id: newVar.id,
          quantity: initStock,
          notes: 'Initial variant stock',
        })
      }

      setVariantForm({
        name: '',
        sku: '',
        sale_price: '',
        purchase_price: '',
        initial_stock: '0',
        shop_id: activeShop || (shops.length > 0 ? shops[0].id : ''),
      })
      setVariantAttrs({})
      setNewAttrName('')
      setShowVariantForm(false)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create variant')
    } finally {
      setBusy(false)
    }
  }


  async function assignImageVariant(imageId: string, variantId: string) {
    if (!activeBusiness || !productId) return
    setBusy(true)
    setActionError('')
    try {
      await productImageApi.assignVariant(activeBusiness.id, productId, imageId, variantId || null)
      setStockMsg(
        variantId
          ? 'Photo linked to that variant — buyers now see it when they select that option.'
          : 'Photo now applies to the whole product.'
      )
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to link the photo to that variant.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadImage(file: File) {
    if (!activeBusiness || !productId) return
    setBusy(true)
    setActionError('')
    try {
      await productImageApi.upload(activeBusiness.id, productId, file, images.length === 0)
      setStockMsg('Photo uploaded.')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to upload the photo.')
    } finally {
      setBusy(false)
    }
  }

  async function removeImage(imageId: string) {
    if (!activeBusiness || !productId) return
    if (!window.confirm('Remove this photo from the product?')) return
    setBusy(true)
    setActionError('')
    try {
      await productImageApi.delete(activeBusiness.id, productId, imageId)
      setStockMsg('Photo removed.')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove the photo.')
    } finally {
      setBusy(false)
    }
  }

  function openAttrEditor(variant: ProductVariant) {
    const current = (variant.attributes ?? {}) as Record<string, string>
    const seeded: Record<string, string> = {}
    // Offer every attribute this Product already uses, prefilled where set.
    for (const key of knownAttributeKeys) seeded[key] = current[key] ?? ''
    for (const [key, value] of Object.entries(current)) seeded[key] = value
    setEditAttrs(seeded)
    setEditingAttrsFor(variant.id)
  }

  async function saveVariantAttributes(variantId: string) {
    const attrs: Record<string, string> = {}
    for (const [key, value] of Object.entries(editAttrs)) {
      const k = key.trim()
      const v = value.trim()
      if (k && v) attrs[k] = v
    }
    if (Object.keys(attrs).length === 0) {
      setActionError('Enter at least one attribute value before saving.')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await productApi.updateVariant(variantId, { attributes: attrs })
      setEditingAttrsFor(null)
      setStockMsg('Variant attributes updated — buyers can now select it on the marketplace.')
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update variant attributes.')
    } finally {
      setBusy(false)
    }
  }

  async function addStock(variantId: string) {
    const shopId = scopedShopId || targetShopByVariant[variantId] || activeShop || (shops.length > 0 ? shops[0].id : '')
    if (!shopId) {
      setActionError('Please select a shop location to add stock.')
      return
    }
    const qty = parseInt(stockByVariant[variantId], 10)
    if (isNaN(qty) || qty <= 0) {
      setActionError('Enter a valid stock quantity (1 or greater).')
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await inventoryApi.addStock(shopId, { variant_id: variantId, quantity: qty, notes: 'Restock from product detail' })
      setStockByVariant((prev) => ({ ...prev, [variantId]: '' }))
      const shopObj = shops.find((s) => s.id === shopId)
      setStockMsg(`Added ${qty} units to ${shopObj ? shopObj.name : 'shop'} successfully.`)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add stock.')
    } finally {
      setBusy(false)
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <div className="empty-icon" style={{ fontSize: 64 }}>📦</div>
        <h2>No Business Selected</h2>
      </div>
    )
  }

  if (loading) return <LoadingBlock label="Loading product details…" />
  if (error) return <ErrorBox error={error} />
  if (!product) return <ErrorBox error="Product not found" />

  // Calculate physical total, reserved, and available stock across all variants and shops
  let totalProductAvailable = 0
  let totalProductQuantity = 0
  let totalProductReserved = 0
  Object.values(variantInventories).forEach((invList) => {
    invList.forEach((inv) => {
      const q = inv.quantity || 0
      const r = inv.reserved_quantity || 0
      totalProductQuantity += q
      totalProductReserved += r
      totalProductAvailable += Math.max(0, q - r)
    })
  })

  return (
    <div className="seller-product-detail">

      <div className="page-header">
        <div>
          <h1>{product.name}</h1>
          <p className="muted">Catalog item & real-time variant inventory{scopedShopId ? ` · ${shops.find(s => s.id === scopedShopId)?.name ?? 'Selected Shop'} only` : ''}</p>
        </div>
        <Link to={scopedShopId ? `/seller/shops/${scopedShopId}/products` : '/seller/products'}>
          <Button variant="ghost">← Back to Products</Button>
        </Link>
      </div>

      {actionError && <ErrorBox error={actionError} />}
      {stockMsg && (
        <div className="notice notice-success mb-4" role="status">
          ✓ {stockMsg}
        </div>
      )}

      {/* ── Product Overview Card ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className={`badge badge-${product.publication_status === 'PUBLISHED' ? 'success' : 'warning'}`}>
                {product.publication_status}
              </span>
              {product.sku && <span className="mono small muted">SKU: {product.sku}</span>}
              <span className="small muted">· Base Price: <strong>{Number(product.unit_price || 0).toLocaleString()} FC</strong></span>
              <span className="small muted">· Unit: <strong>{product.unit || 'PCS'}</strong></span>
              {product.category_id && (
                <span className="badge badge-outline" style={{ fontSize: '0.75rem' }}>
                  📁 {categories.find((c) => c.id === product.category_id)?.name || 'Category'}
                </span>
              )}
            </div>
            {product.description && <p className="muted" style={{ margin: '8px 0 0' }}>{product.description}</p>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <span className="small muted" style={{ display: 'block' }}>Inventory Status</span>
              <strong style={{ fontSize: '1.25rem', color: totalProductAvailable > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {totalProductAvailable} units available
              </strong>
              {totalProductReserved > 0 && (
                <span className="small muted" style={{ display: 'block' }}>
                  ({totalProductQuantity} total · {totalProductReserved} reserved)
                </span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProductEditForm(!showProductEditForm)}
            >
              {showProductEditForm ? 'Cancel Edit' : 'Edit Product Settings'}
            </Button>

            <Button
              variant={product.publication_status === 'PUBLISHED' ? 'outline' : 'primary'}
              onClick={togglePublish}
              disabled={busy}
            >
              {product.publication_status === 'PUBLISHED' ? 'Unpublish' : 'Publish to Marketplace'}
            </Button>
          </div>
        </div>

        {/* Inline Product & Category Edit Form */}
        {showProductEditForm && (
          <form onSubmit={saveProductDetails} className="inline-form">
            <h4 style={{ margin: '0 0 12px' }}>Edit Product & Category Settings</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <Field
                label="Product Name *"
                name="edit_name"
                required
                value={productEditForm.name}
                onChange={(e) => setProductEditForm({ ...productEditForm, name: e.target.value })}
              />
              <Field
                label="Sale Price (FC) *"
                name="edit_price"
                required
                type="number"
                min="1"
                step="any"
                value={productEditForm.unit_price}
                onChange={(e) => setProductEditForm({ ...productEditForm, unit_price: e.target.value })}
              />
              <Field
                label="SKU"
                name="edit_sku"
                value={productEditForm.sku}
                onChange={(e) => setProductEditForm({ ...productEditForm, sku: e.target.value })}
              />
              <Field
                label="Unit"
                name="edit_unit"
                value={productEditForm.unit}
                onChange={(e) => setProductEditForm({ ...productEditForm, unit: e.target.value })}
              />
              <Field
                label="Category"
                name="edit_category"
                as="select"
                value={productEditForm.category_id}
                onChange={(e) => handleEditCategoryChange(e.target.value)}
                options={[
                  { value: '', label: 'None' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              {categories.find((c) => c.id === productEditForm.category_id)?.subcategories?.length ? (
                <Field
                  label="Subcategory"
                  name="edit_subcategory"
                  as="select"
                  value={productEditForm.subcategory_id}
                  onChange={(e) => setProductEditForm({ ...productEditForm, subcategory_id: e.target.value })}
                  options={[
                    { value: '', label: 'None' },
                    ...(categories.find((c) => c.id === productEditForm.category_id)?.subcategories || []).map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              ) : null}
            </div>

            <div style={{ marginTop: 12 }}>
              <Field
                label="Description"
                name="edit_desc"
                as="textarea"
                rows={2}
                value={productEditForm.description}
                onChange={(e) => setProductEditForm({ ...productEditForm, description: e.target.value })}
              />
            </div>

            {categoryChangeWarning && (
              <div className="notice notice-warning mt-3">
                ℹ️ {categoryChangeWarning}
              </div>
            )}

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <Button type="submit" loading={busy}>Save Product Changes</Button>
              <Button type="button" variant="ghost" onClick={() => setShowProductEditForm(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      {/* ── Product Specifications Card (if any fixed/informational attributes exist) ── */}
      {specifications.length > 0 && (
        <Card style={{ marginTop: 24 }}>
          <h3 style={{ margin: '0 0 8px' }}>Product Specifications ({specifications.length})</h3>
          <p className="muted small" style={{ margin: '0 0 12px' }}>
            Fixed attributes shared across all product variations.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {specifications.map((spec) => (
              <div key={spec.key} style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
                <span className="small muted" style={{ display: 'block', fontSize: '0.75rem' }}>{spec.label}</span>
                <strong style={{ fontSize: '0.95rem' }}>{spec.value}</strong>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Product Promotion Card ── */}
      <Card style={{ marginTop: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Special Offer & Discount</h3>
            <p className="muted small" style={{ margin: '2px 0 0' }}>Configure a promotional discount for this catalog item.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowPromoForm(!showPromoForm)}>
            {showPromoForm ? 'Cancel' : 'Configure Promotion'}
          </Button>
        </div>

        {showPromoForm ? (
          <form onSubmit={savePromotion} className="inline-form">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                id="promo_discount_active"
                checked={promoForm.discount_active}
                onChange={(e) => setPromoForm({ ...promoForm, discount_active: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <label htmlFor="promo_discount_active" style={{ fontWeight: 600, cursor: 'pointer' }}>
                Enable Promotion / Sale Price
              </label>
            </div>

            {promoForm.discount_active && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
                <Field
                  label="Discount Type"
                  name="promo_discount_type"
                  as="select"
                  value={promoForm.discount_type}
                  onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value })}
                  options={[
                    { value: 'PERCENTAGE', label: 'Percentage Off (%)' },
                    { value: 'FIXED', label: 'Fixed Price Discount (FC)' }
                  ]}
                />
                <Field
                  label={promoForm.discount_type === 'PERCENTAGE' ? 'Discount Percentage (%)' : 'Discount Amount (FC)'}
                  name="promo_discount_value"
                  type="number"
                  min="1"
                  step="any"
                  placeholder={promoForm.discount_type === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 15000'}
                  value={promoForm.discount_value}
                  onChange={(e) => setPromoForm({ ...promoForm, discount_value: e.target.value })}
                />
                <Field
                  label="Start Date & Time (Optional)"
                  name="promo_discount_start"
                  type="datetime-local"
                  value={promoForm.discount_start}
                  onChange={(e) => setPromoForm({ ...promoForm, discount_start: e.target.value })}
                />
                <Field
                  label="End Date & Time (Optional)"
                  name="promo_discount_end"
                  type="datetime-local"
                  value={promoForm.discount_end}
                  onChange={(e) => setPromoForm({ ...promoForm, discount_end: e.target.value })}
                />
              </div>
            )}

            {promoForm.discount_active && product.unit_price && promoForm.discount_value && (
              <div style={{ marginTop: 12, marginBottom: 16, padding: 12, background: 'var(--color-accent-soft)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <span className="small muted" style={{ display: 'block', marginBottom: 4 }}>Promotion Live Preview</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {(() => {
                      const base = product.unit_price || 0
                      const val = parseFloat(promoForm.discount_value)
                      if (isNaN(base) || isNaN(val)) return '—'
                      if (promoForm.discount_type === 'PERCENTAGE') {
                        return (base * (1 - val / 100)).toLocaleString()
                      } else {
                        return Math.max(0, base - val).toLocaleString()
                      }
                    })()} FC
                  </span>
                  <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    {product.unit_price.toLocaleString()} FC
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '2px 6px' }}>
                    {promoForm.discount_type === 'PERCENTAGE' 
                      ? `${promoForm.discount_value}% OFF` 
                      : `${parseFloat(promoForm.discount_value).toLocaleString()} FC OFF`}
                  </span>
                </div>
              </div>
            )}

            <Button type="submit" loading={busy}>Save Promotion Settings</Button>
          </form>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {product.discount_active ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ padding: '8px 16px', background: 'var(--color-accent-soft)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <span className="small muted" style={{ display: 'block', marginBottom: 2 }}>Current Active Promotion</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                      {product.discount_type === 'PERCENTAGE' 
                        ? `${product.discount_value}% OFF` 
                        : `${(product.discount_value || 0).toLocaleString()} FC OFF`}
                    </strong>
                    {product.unit_price && (
                      <span className="small muted">
                        (Sale Price: <strong>{(() => {
                          const base = product.unit_price || 0
                          const val = product.discount_value || 0
                          if (product.discount_type === 'PERCENTAGE') return (base * (1 - val / 100)).toLocaleString()
                          return Math.max(0, base - val).toLocaleString()
                        })()} FC</strong> / normal: {product.unit_price.toLocaleString()} FC)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {product.discount_start && (
                    <span className="small muted">
                      📅 Starts: <strong>{new Date(product.discount_start).toLocaleString()}</strong>
                    </span>
                  )}
                  {product.discount_end && (
                    <span className="small muted">
                      📅 Ends: <strong>{new Date(product.discount_end).toLocaleString()}</strong>
                    </span>
                  )}
                  {!product.discount_start && !product.discount_end && (
                    <span className="small muted">📅 Active indefinitely</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>This product does not currently have any active promotions or discounts.</p>
            )}
          </div>
        )}
      </Card>

      {/* ── Product Photos Card ── */}
      <Card style={{ marginTop: 24 }}>
        <div className="row-between" style={{ marginBottom: 4 }}>
          <div>
            <h3 style={{ margin: 0 }}>Product Photos ({images.length})</h3>
            <p className="muted small" style={{ margin: '2px 0 0' }}>
              Link a photo to a variant so buyers see that exact colour or model when they select it.
              Photos left as “All variants” show for the whole product.
            </p>
          </div>
          {images.length < 10 && (
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              + Add Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadImage(file)
                  e.currentTarget.value = ''
                }}
              />
            </label>
          )}
        </div>

        {images.length === 0 ? (
          <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>
            No photos yet. Buyers are far more likely to order a product that shows a photo.
          </p>
        ) : (
          <div className="photo-grid">
            {images.map((img) => (
              <div key={img.id} className="photo-card">
                <div className="photo-card-media">
                  <img src={img.url} alt={img.file_name || product.name} />
                  {img.is_primary && <span className="badge badge-success">Primary</span>}
                </div>
                <div className="photo-card-body">
                  <label className="small muted" htmlFor={`img-variant-${img.id}`}>Shows variant</label>
                  <select
                    id={`img-variant-${img.id}`}
                    className="input input-sm"
                    value={img.variant_id ?? ''}
                    disabled={busy}
                    onChange={(e) => void assignImageVariant(img.id, e.target.value)}
                  >
                    <option value="">All variants (product-wide)</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {Object.values(v.attributes ?? {}).join(' / ') || v.name || v.sku || 'Variant'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-danger)', fontSize: '0.75rem' }}
                    disabled={busy}
                    onClick={() => void removeImage(img.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Variants & Stock Card ── */}
      <Card style={{ marginTop: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Variants & Inventory ({variants.length})</h3>
            <p className="muted small" style={{ margin: '2px 0 0' }}>Real inventory quantities per variant and shop.</p>
          </div>
          <Button size="sm" onClick={() => setShowVariantForm(!showVariantForm)}>
            {showVariantForm ? 'Cancel' : <><PlusIcon /> Add Variant</>}
          </Button>
        </div>

        {showVariantForm && (
          <form onSubmit={createVariant} className="inline-form">
            <h4 style={{ margin: '0 0 4px' }}>New Variant</h4>
            <p className="muted small" style={{ margin: '0 0 12px' }}>
              {knownAttributeKeys.length > 0
                ? <>Give this variant its own value for {knownAttributeKeys.join(' and ')}. Buyers pick a product by these attributes, so every variant must define the same ones.</>
                : <>Add the attributes that tell your variants apart (Color, Size, Storage…). Buyers use these as the selection buttons on the marketplace.</>}
            </p>

            {/* Structured attribute inputs — these become the buyer's selectors */}
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              {Object.keys(variantAttrs).map((key) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 8, alignItems: 'center' }}>
                  <label className="small bold" htmlFor={`vattr-${key}`}>{key}</label>
                  <input
                    id={`vattr-${key}`}
                    className="input"
                    value={variantAttrs[key]}
                    onChange={(e) => setVariantAttrs((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={`e.g. ${key === 'Color' ? 'Black' : key === 'Size' ? 'M' : 'value'}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title={`Remove ${key} from this variant`}
                    onClick={() =>
                      setVariantAttrs((prev) => {
                        const next = { ...prev }
                        delete next[key]
                        return next
                      })
                    }
                  >
                    ✕
                  </Button>
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 8, alignItems: 'center' }}>
                <label className="small muted" htmlFor="vattr-new">Add attribute</label>
                <input
                  id="vattr-new"
                  className="input"
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  placeholder="e.g. Color, Size, Storage"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const name = newAttrName.trim()
                      if (name && !(name in variantAttrs)) {
                        setVariantAttrs((prev) => ({ ...prev, [name]: '' }))
                        setNewAttrName('')
                      }
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!newAttrName.trim() || newAttrName.trim() in variantAttrs}
                  onClick={() => {
                    const name = newAttrName.trim()
                    if (name && !(name in variantAttrs)) {
                      setVariantAttrs((prev) => ({ ...prev, [name]: '' }))
                      setNewAttrName('')
                    }
                  }}
                >
                  + Add
                </Button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Field
                label="Variant Name *"
                name="vname"
                required
                value={variantForm.name}
                onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                placeholder="e.g. Black / 42"
              />
              <Field
                label="SKU"
                name="vsku"
                value={variantForm.sku}
                onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                placeholder="Optional SKU"
              />
              <Field
                label="Sale Price (FC) *"
                name="vsale"
                required
                type="number"
                min="1"
                step="any"
                value={variantForm.sale_price}
                onChange={(e) => setVariantForm({ ...variantForm, sale_price: e.target.value })}
                placeholder={String(product.unit_price || '')}
              />
              <Field
                label="Initial Stock Quantity"
                name="vstock"
                type="number"
                min="0"
                step="1"
                value={variantForm.initial_stock}
                onChange={(e) => setVariantForm({ ...variantForm, initial_stock: e.target.value })}
                placeholder="0"
              />
              {!scopedShopId && shops.length > 1 && (
                <Field
                  label="Stock Location"
                  name="vshop"
                  as="select"
                  value={variantForm.shop_id}
                  onChange={(e) => setVariantForm({ ...variantForm, shop_id: e.target.value })}
                  options={shops.map((s) => ({ value: s.id, label: `${s.name} (${s.city || ''})` }))}
                />
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <Button type="submit" loading={busy}>Save Variant</Button>
            </div>
          </form>
        )}

        {variantsMissingAttributes.length > 0 && (
          <div className="notice notice-warning mt-4 mb-4">
            ⚠️ {variantsMissingAttributes.length} variant
            {variantsMissingAttributes.length > 1 ? 's have' : ' has'} no attributes
            {' '}({variantsMissingAttributes.map((v) => v.name || v.sku || 'unnamed').join(', ')}).
            {' '}Buyers cannot select {variantsMissingAttributes.length > 1 ? 'them' : 'it'} by colour or size on the
            marketplace — only by raw name. Use <strong>Set attributes</strong> in the table below to fix
            {variantsMissingAttributes.length > 1 ? ' them' : ' it'}.
          </div>
        )}

        {variants.length === 0 ? (
          <p className="muted small" style={{ padding: 16, textAlign: 'center' }}>No variants found.</p>
        ) : (
          <div className="table-responsive" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Variant & Attributes</th>
                  <th>SKU</th>
                  <th>Sale Price</th>
                  <th>Available Stock</th>
                  <th>Stock By Shop</th>
                  <th style={{ minWidth: 220 }}>Add Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const invList = variantInventories[v.id] || []
                  const variantAvailable = invList.reduce((sum, i) => sum + Math.max(0, i.quantity - (i.reserved_quantity || 0)), 0)
                  const variantTotal = invList.reduce((sum, i) => sum + (i.quantity || 0), 0)
                  const variantReserved = invList.reduce((sum, i) => sum + (i.reserved_quantity || 0), 0)
                  const targetShop = scopedShopId || targetShopByVariant[v.id] || activeShop || (shops.length > 0 ? shops[0].id : '')
                  const attrs = v.attributes || {}
                  const attrEntries = Object.entries(attrs)

                  return (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.name || 'Default Variant'}</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' }}>
                          <span className={`badge badge-${v.status === 'ACTIVE' ? 'success' : 'muted'}`} style={{ fontSize: '0.7rem' }}>
                            {v.status}
                          </span>
                          {attrEntries.map(([k, val]) => (
                            <span key={k} className="attr-chip">
                              <strong>{k}:</strong> {val}
                            </span>
                          ))}
                          {attrEntries.length === 0 && (
                            <span className="small" style={{ color: 'var(--color-warning)', fontSize: '0.75rem' }}>
                              No attributes — not selectable by buyers
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                            onClick={() => (editingAttrsFor === v.id ? setEditingAttrsFor(null) : openAttrEditor(v))}
                          >
                            {editingAttrsFor === v.id ? 'Cancel' : attrEntries.length === 0 ? 'Set attributes' : 'Edit attributes'}
                          </button>
                        </div>

                        {editingAttrsFor === v.id && (
                          <div style={{ marginTop: 8, padding: 10, background: 'var(--color-surface-2)', borderRadius: 6, display: 'grid', gap: 6 }}>
                            {Object.keys(editAttrs).length === 0 && (
                              <span className="small muted">
                                This product has no attribute names yet. Add one below.
                              </span>
                            )}
                            {Object.keys(editAttrs).map((key) => (
                              <div key={key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6, alignItems: 'center' }}>
                                <label className="small bold" htmlFor={`edit-${v.id}-${key}`}>{key}</label>
                                <input
                                  id={`edit-${v.id}-${key}`}
                                  className="input input-sm"
                                  value={editAttrs[key]}
                                  onChange={(e) => setEditAttrs((prev) => ({ ...prev, [key]: e.target.value }))}
                                  placeholder={`e.g. ${key === 'Color' ? 'Black' : 'value'}`}
                                />
                              </div>
                            ))}
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input
                                className="input input-sm"
                                placeholder="New attribute name (e.g. Size)"
                                value={newAttrName}
                                onChange={(e) => setNewAttrName(e.target.value)}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!newAttrName.trim() || newAttrName.trim() in editAttrs}
                                onClick={() => {
                                  const name = newAttrName.trim()
                                  if (name && !(name in editAttrs)) {
                                    setEditAttrs((prev) => ({ ...prev, [name]: '' }))
                                    setNewAttrName('')
                                  }
                                }}
                              >
                                + Add
                              </Button>
                              <Button size="sm" disabled={busy} onClick={() => saveVariantAttributes(v.id)}>
                                Save
                              </Button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="mono small">{v.sku || '—'}</td>
                      <td><strong>{Number(v.sale_price || 0).toLocaleString()} FC</strong></td>
                      <td>
                        <div>
                          <span style={{ fontWeight: 700, color: variantAvailable > 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                            {variantAvailable} available
                          </span>
                          {variantReserved > 0 && (
                            <span className="small muted" style={{ display: 'block' }}>
                              ({variantTotal} total · {variantReserved} reserved)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {invList.length === 0 ? (
                          <span className="small muted">0 in all shops</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {invList.map((inv) => {
                              const sObj = shops.find((s) => s.id === inv.shop_id)
                              const avail = Math.max(0, inv.quantity - (inv.reserved_quantity || 0))
                              const res = inv.reserved_quantity || 0
                              return (
                                <span key={inv.id} className="small muted">
                                  🏪 {sObj ? sObj.name : 'Shop'}: <strong>{avail} avail</strong>
                                  {res > 0 && ` (${inv.quantity} total · ${res} res)`}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!scopedShopId && shops.length > 1 && (
                            <select
                              className="input input-sm"
                              value={targetShop}
                              onChange={(e) => setTargetShopByVariant((prev) => ({ ...prev, [v.id]: e.target.value }))}
                              style={{ width: 110, fontSize: '0.8rem' }}
                            >
                              {shops.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            className="input input-sm"
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={stockByVariant[v.id] ?? ''}
                            onChange={(e) => setStockByVariant((prev) => ({ ...prev, [v.id]: e.target.value }))}
                            style={{ width: 65 }}
                          />
                          <Button size="sm" disabled={busy} onClick={() => addStock(v.id)}>
                            + Add
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  )
}
