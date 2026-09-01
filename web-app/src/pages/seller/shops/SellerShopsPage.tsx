import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { useI18n } from '@/store/i18n'
import { inventoryApi, productApi, shopApi } from '@/api/seller'
import type { Product, Shop, UpdateShopRequest } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'
import { drcCityOptions } from '@/lib/drcLocations'
import type { TranslationKey } from '@/locales/fr'

interface ShopStats {
  productCount: number
  unitCount: number
  categories: string[]
}

interface PendingDelete {
  shop: Shop
  stats: ShopStats
}

export default function SellerShopsPage() {
  const { activeBusiness } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  const [shops, setShops] = useState<Shop[]>([])
  const [stats, setStats] = useState<Record<string, ShopStats>>({})
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')

  // Create shop form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', type: 'PHYSICAL', city: '', address: '', phone: '',
    supports_shop_delivery: false, shop_delivery_fee: 0,
    supports_partner_delivery: false, partner_delivery_fee: 0, partner_delivery_provider: '',
    delivery_city: '', delivery_address: '',
  })
  const [creating, setCreating] = useState(false)

  // Settings dialog (rename + delivery configuration)
  const [editing, setEditing] = useState<Shop | null>(null)
  const [editForm, setEditForm] = useState<UpdateShopRequest>({})
  const [editBusy, setEditBusy] = useState(false)

  // Delete dialog
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteOutcome, setDeleteOutcome] = useState('')

  useEffect(() => {
    if (activeBusiness) loadShops()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusiness?.id])

  async function loadShops() {
    if (!activeBusiness) return
    setLoading(true)
    try {
      const [shopData, products] = await Promise.all([
        shopApi.listByBusiness(activeBusiness.id),
        productApi.listByBusiness(activeBusiness.id),
      ])
      const list = Array.isArray(shopData) ? shopData : []
      setShops(list)

      const meta = new Map<string, Product>()
      for (const p of Array.isArray(products) ? products : []) meta.set(p.id, p)

      // Real per-Shop stats derived from that Shop's live stock rows.
      const entries = await Promise.all(
        list.map(async (shop) => {
          const rows = await inventoryApi.getShopInventory(shop.id).catch(() => [])
          const grouped = new Set<string>()
          let units = 0
          for (const raw of rows as unknown[]) {
            const item = (raw ?? {}) as Record<string, any>
            const inv = (item.inventory ?? item) as Record<string, any>
            if (!inv.product_id) continue
            grouped.add(inv.product_id)
            units += Number(inv.quantity ?? 0)
          }
          const categoryNames = new Set<string>()
          for (const pid of grouped) {
            const name = meta.get(pid)?.category_name
            if (name) categoryNames.add(name)
          }
          const s: ShopStats = {
            productCount: grouped.size,
            unitCount: units,
            categories: Array.from(categoryNames).sort(),
          }
          return [shop.id, s] as const
        })
      )
      setStats(Object.fromEntries(entries))
      setPageError('')
    } catch (err) {
      setPageError(err instanceof Error ? err.message : t('seller.shopPage.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    if (!activeBusiness || creating) return
    setCreating(true)
    setActionError('')
    try {
      await shopApi.create(activeBusiness.id, createForm)
      setShowCreate(false)
      setCreateForm({
        name: '', type: 'PHYSICAL', city: '', address: '', phone: '',
        supports_shop_delivery: false, shop_delivery_fee: 0,
        supports_partner_delivery: false, partner_delivery_fee: 0, partner_delivery_provider: '',
        delivery_city: '', delivery_address: '',
      })
      await loadShops()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.shopPage.createFailed'))
    } finally {
      setCreating(false)
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!editing || editBusy) return
    if (!editForm.name?.trim()) return
    setEditBusy(true)
    setActionError('')
    try {
      await shopApi.update(editing.id, { ...editForm, name: editForm.name.trim() })
      setEditing(null)
      await loadShops()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.shopPage.updateFailed'))
    } finally {
      setEditBusy(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteBusy) return
    setDeleteBusy(true)
    setActionError('')
    try {
      const res = await shopApi.delete(pendingDelete.shop.id)
      setPendingDelete(null)
      setDeleteOutcome(res?.action === 'archived' ? 'archived' : 'deleted')
      await loadShops()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.shopPage.deleteFailed'))
    } finally {
      setDeleteBusy(false)
    }
  }

  async function restoreShop(shop: Shop) {
    setActionError('')
    try {
      await shopApi.update(shop.id, { status: 'ACTIVE' })
      await loadShops()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('seller.shopPage.restoreFailed'))
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.shopPage.noBusinessSubtitle')}</p>
      </div>
    )
  }

  return (
    <div className="seller-shops">
      <div className="page-header">
        <div>
          <h1>{t('seller.shopPage.title')}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {t('seller.shopPage.desc')}
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>{t('seller.shopPage.createShop')}</Button>
      </div>

      {(pageError || actionError) && <ErrorBox error={actionError || pageError} />}

      {deleteOutcome && (
        <div className="card success-box" role="status">
          {deleteOutcome === 'archived'
            ? t('seller.shopPage.archivedOutcome')
            : t('seller.shopPage.deletedOutcome')}
        </div>
      )}

      {showCreate && (
        <Card style={{ marginBottom: 24 }}>
          <h3>{t('seller.shopPage.createTitle')}</h3>
          <form onSubmit={createShop}>
            <Field label={t('seller.shopPage.name')} name="name" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            <Field label={t('seller.shopPage.type')} name="type" required value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })} as="select" options={[
              { value: 'PHYSICAL', label: t('seller.shopPage.typePhysical') },
              { value: 'ONLINE', label: t('seller.shopPage.typeOnline') },
            ]} />
            <Field label={t('common.city')} name="city" as="select" required value={createForm.city} options={drcCityOptions()} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} />
            <Field label={t('common.address')} name="address" required value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
            <Field label={t('common.phone')} name="phone" required value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder={t('seller.shopPage.phonePlaceholder')} />

            <h4 style={{ marginTop: 16, marginBottom: 4 }}>{t('seller.shopPage.deliveryOptions')}</h4>
            <p className="small muted" style={{ marginTop: 0 }}>{t('seller.shopPage.deliveryOptionsDesc')}</p>

            <label className="checkbox-row">
              <input type="checkbox" checked={createForm.supports_shop_delivery} onChange={(e) => setCreateForm({ ...createForm, supports_shop_delivery: e.target.checked })} />
              {t('seller.shopPage.shopDeliversItself')}
            </label>
            {createForm.supports_shop_delivery && (
              <Field label={t('seller.shopPage.selfDeliveryFee')} name="shop_delivery_fee" type="number" value={createForm.shop_delivery_fee} onChange={(e) => setCreateForm({ ...createForm, shop_delivery_fee: Number(e.target.value) })} />
            )}

            <label className="checkbox-row">
              <input type="checkbox" checked={createForm.supports_partner_delivery} onChange={(e) => setCreateForm({ ...createForm, supports_partner_delivery: e.target.checked })} />
              {t('seller.shopPage.usesPartner')}
            </label>
            {createForm.supports_partner_delivery && (
              <>
                <Field label={t('seller.shopPage.partnerFee')} name="partner_delivery_fee" type="number" value={createForm.partner_delivery_fee} onChange={(e) => setCreateForm({ ...createForm, partner_delivery_fee: Number(e.target.value) })} />
                <Field label={t('seller.shopPage.partnerName')} name="partner_delivery_provider" value={createForm.partner_delivery_provider} onChange={(e) => setCreateForm({ ...createForm, partner_delivery_provider: e.target.value })} />
              </>
            )}
            {(createForm.supports_shop_delivery || createForm.supports_partner_delivery) && (
              <>
                <Field label={t('seller.shopPage.deliveryCity')} name="delivery_city" as="select" value={createForm.delivery_city} options={drcCityOptions()} onChange={(e) => setCreateForm({ ...createForm, delivery_city: e.target.value })} />
                <Field label={t('seller.shopPage.deliveryAddress')} name="delivery_address" value={createForm.delivery_address} onChange={(e) => setCreateForm({ ...createForm, delivery_address: e.target.value })} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button type="submit" disabled={creating}>{creating ? t('seller.shopPage.creating') : t('seller.shopPage.createSubmit')}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Settings dialog: rename + delivery configuration */}
      {editing && (
        <Card style={{ marginBottom: 24 }}>
          <h3>{t('seller.shopPage.shopSettingsTitle', { shop: editing.name })}</h3>
          <form onSubmit={saveSettings}>
            <Field
              label={t('seller.shopPage.name')}
              name="edit_name"
              required
              value={editForm.name ?? ''}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />

            <h4 style={{ marginTop: 16, marginBottom: 4 }}>{t('seller.shopPage.deliveryOptions')}</h4>

            <label className="checkbox-row">
              <input type="checkbox" checked={!!editForm.supports_shop_delivery} onChange={(e) => setEditForm({ ...editForm, supports_shop_delivery: e.target.checked })} />
              {t('seller.shopPage.shopDeliversItself')}
            </label>
            {editForm.supports_shop_delivery && (
              <Field label={t('seller.shopPage.selfDeliveryFee')} name="edit_shop_delivery_fee" type="number" value={editForm.shop_delivery_fee ?? 0} onChange={(e) => setEditForm({ ...editForm, shop_delivery_fee: Number(e.target.value) })} />
            )}

            <label className="checkbox-row">
              <input type="checkbox" checked={!!editForm.supports_partner_delivery} onChange={(e) => setEditForm({ ...editForm, supports_partner_delivery: e.target.checked })} />
              {t('seller.shopPage.usesPartner')}
            </label>
            {editForm.supports_partner_delivery && (
              <>
                <Field label={t('seller.shopPage.partnerFee')} name="edit_partner_delivery_fee" type="number" value={editForm.partner_delivery_fee ?? 0} onChange={(e) => setEditForm({ ...editForm, partner_delivery_fee: Number(e.target.value) })} />
                <Field label={t('seller.shopPage.partnerName')} name="edit_partner_delivery_provider" value={editForm.partner_delivery_provider ?? ''} onChange={(e) => setEditForm({ ...editForm, partner_delivery_provider: e.target.value })} />
              </>
            )}
            {(editForm.supports_shop_delivery || editForm.supports_partner_delivery) && (
              <>
                <Field label={t('seller.shopPage.deliveryCity')} name="edit_delivery_city" as="select" value={editForm.delivery_city ?? ''} options={drcCityOptions()} onChange={(e) => setEditForm({ ...editForm, delivery_city: e.target.value })} />
                <Field label={t('seller.shopPage.deliveryAddress')} name="edit_delivery_address" value={editForm.delivery_address ?? ''} onChange={(e) => setEditForm({ ...editForm, delivery_address: e.target.value })} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button type="submit" disabled={editBusy || !editForm.name?.trim()}>
                {editBusy ? t('seller.shopPage.saving') : t('common.save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Delete / Archive confirmation */}
      {pendingDelete && (
        <Card style={{ marginBottom: 24, borderColor: 'var(--color-danger)' }}>
          <h3>{t('seller.shopPage.deleteTitle', { shop: pendingDelete.shop.name })}</h3>
          <p className="small">
            {t('seller.shopPage.deleteBody', { products: pendingDelete.stats.productCount, units: pendingDelete.stats.unitCount })}
          </p>
          <p className="small muted">
            {t('seller.shopPage.deleteConsequence')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? t('seller.shopPage.working') : t('seller.shopPage.deleteArchiveShop')}
            </Button>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>{t('common.cancel')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingBlock label={t('seller.shopPage.loading')} />
      ) : shops.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <h3>{t('seller.shopPage.noShopsYet')}</h3>
            <p className="muted">{t('seller.shopPage.noShopsYetDesc')}</p>
            <Button onClick={() => setShowCreate(true)} size="lg">{t('seller.shopPage.emptyCta')}</Button>
          </div>
        </Card>
      ) : (
        <div className="shop-select-grid">
          {shops.map((shop) => {
            const s = stats[shop.id] ?? { productCount: 0, unitCount: 0, categories: [] }
            const archived = shop.status !== 'ACTIVE'
            return (
              <Card key={shop.id} className="seller-shop-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  {archived ? (
                    <h3 style={{ margin: 0 }}>{shop.name}</h3>
                  ) : (
                    <h3 style={{ margin: 0 }}>
                      <Link
                        to={`/seller/shops/${shop.id}/products`}
                        style={{ color: 'inherit' }}
                        title={t('seller.shopPage.openShopTitle', { shop: shop.name })}
                      >
                        {shop.name}
                      </Link>
                    </h3>
                  )}
                  <span className={`badge ${archived ? 'badge-muted' : 'badge-success'}`}>{t(`seller.shopStatus.${shop.status}` as TranslationKey)}</span>
                </div>
                <span className="small muted">
                  {[shop.city, shop.address].filter(Boolean).join(' — ') || shop.type}
                </span>

                {archived ? (
                  <div className="seller-shop-stats small">
                    {t('seller.shopPage.statsProducts', { count: s.productCount })} · {t('seller.shopPage.statsUnits', { count: s.unitCount })}
                  </div>
                ) : (
                  <Link to={`/seller/shops/${shop.id}/products`} className="seller-shop-stats small" style={{ color: 'inherit' }}>
                    {t('seller.shopPage.statsProducts', { count: s.productCount })} · {t('seller.shopPage.statsUnits', { count: s.unitCount })}
                  </Link>
                )}
                {s.categories.length > 0 && (
                  <div className="small muted">{s.categories.join(' • ')}</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
                  {!archived && (
                    <Button size="sm" onClick={() => navigate(`/seller/shops/${shop.id}/products`)}>
                      {t('seller.shopPage.openShop')}
                    </Button>
                  )}
                  <Link to={`/shops/${shop.id}`} target="_blank" rel="noreferrer" style={{ gridColumn: archived ? '1 / -1' : undefined }}>
                    <Button variant="outline" size="sm" block>{t('seller.shopPage.viewOnMarketplace')}</Button>
                  </Link>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {!archived ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditing(shop)
                          setEditForm({
                            name: shop.name,
                            supports_shop_delivery: shop.supports_shop_delivery,
                            shop_delivery_fee: shop.shop_delivery_fee,
                            supports_partner_delivery: shop.supports_partner_delivery,
                            partner_delivery_fee: shop.partner_delivery_fee,
                            partner_delivery_provider: shop.partner_delivery_provider ?? '',
                            delivery_city: shop.delivery_city ?? '',
                            delivery_address: shop.delivery_address ?? '',
                          })
                        }}
                      >
                        {t('seller.shopPage.settings')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => setPendingDelete({ shop, stats: s })}
                      >
                        {t('seller.shopPage.deleteArchive')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => restoreShop(shop)}
                    >
                      {t('seller.shopPage.restoreShop')}
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
