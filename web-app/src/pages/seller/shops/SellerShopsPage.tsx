import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { inventoryApi, productApi, shopApi } from '@/api/seller'
import type { Product, Shop } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Field } from '@/components/ui/Field'

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
  const navigate = useNavigate()

  const [shops, setShops] = useState<Shop[]>([])
  const [stats, setStats] = useState<Record<string, ShopStats>>({})
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [actionError, setActionError] = useState('')

  // Create shop form
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', type: 'PHYSICAL', city: '', address: '', phone: '' })
  const [creating, setCreating] = useState(false)

  // Rename dialog
  const [renaming, setRenaming] = useState<Shop | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)

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
      setPageError(err instanceof Error ? err.message : 'Failed to load Shops.')
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
      setCreateForm({ name: '', type: 'PHYSICAL', city: '', address: '', phone: '' })
      await loadShops()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create the Shop.')
    } finally {
      setCreating(false)
    }
  }

  async function saveRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renaming || renameBusy) return
    if (!renameValue.trim()) return
    setRenameBusy(true)
    setActionError('')
    try {
      await shopApi.update(renaming.id, { name: renameValue.trim() })
      setRenaming(null)
      await loadShops()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to rename the Shop.')
    } finally {
      setRenameBusy(false)
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
      setActionError(err instanceof Error ? err.message : 'Failed to remove the Shop.')
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
      setActionError(err instanceof Error ? err.message : 'Failed to restore the Shop.')
    }
  }

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business to manage Shops.</p>
      </div>
    )
  }

  return (
    <div className="seller-shops">
      <div className="page-header">
        <div>
          <h1>Shops</h1>
          <p className="muted" style={{ margin: 0 }}>
            Each Shop keeps its own Products, stock and Marketplace presence.
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>+ Create Shop</Button>
      </div>

      {(pageError || actionError) && <ErrorBox error={actionError || pageError} />}

      {deleteOutcome && (
        <div className="card success-box" role="status">
          {deleteOutcome === 'archived'
            ? 'Shop archived. Its Products are no longer visible on the Marketplace and its history is preserved.'
            : 'Empty Shop deleted.'}
        </div>
      )}

      {showCreate && (
        <Card style={{ marginBottom: 24 }}>
          <h3>Create New Shop</h3>
          <form onSubmit={createShop}>
            <Field label="Shop Name" name="name" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
            <Field label="Type" name="type" required value={createForm.type} onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })} as="select" options={[
              { value: 'PHYSICAL', label: 'Retail Store' },
              { value: 'ONLINE', label: 'Online Only' },
            ]} />
            <Field label="City" name="city" required value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} />
            <Field label="Address" name="address" required value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
            <Field label="Phone" name="phone" required value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+243 …" />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create Shop'}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Rename dialog */}
      {renaming && (
        <Card style={{ marginBottom: 24 }}>
          <h3>Rename Shop</h3>
          <form onSubmit={saveRename}>
            <Field
              label="Shop Name"
              name="rename"
              required
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="submit" disabled={renameBusy || !renameValue.trim()}>
                {renameBusy ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Delete / Archive confirmation */}
      {pendingDelete && (
        <Card style={{ marginBottom: 24, borderColor: 'var(--color-danger)' }}>
          <h3>Delete {pendingDelete.shop.name}?</h3>
          <p className="small">
            This Shop currently contains{' '}
            <strong>{pendingDelete.stats.productCount} Products</strong> and{' '}
            <strong>{pendingDelete.stats.unitCount} units in stock</strong>.
          </p>
          <p className="small muted">
            Removing this Shop will also remove its active Marketplace visibility — its offers disappear from
            Search, Category pages and its public Shop page immediately. Historical transactions keep their
            reference to this Shop.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? 'Working…' : 'Delete / Archive Shop'}
            </Button>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <LoadingBlock label="Loading Shops…" />
      ) : shops.length === 0 ? (
        <Card>
          <div className="empty-state" style={{ padding: '48px 0', textAlign: 'center' }}>
            <h3>No Shops Yet</h3>
            <p className="muted">Create your first Shop to start selling.</p>
            <Button onClick={() => setShowCreate(true)} size="lg">Create Shop</Button>
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
                  <h3 style={{ margin: 0 }}>{shop.name}</h3>
                  <span className={`badge ${archived ? 'badge-muted' : 'badge-success'}`}>{shop.status}</span>
                </div>
                <span className="small muted">
                  {[shop.city, shop.address].filter(Boolean).join(' — ') || shop.type}
                </span>

                <div className="seller-shop-stats small">
                  <strong>{s.productCount}</strong> Products · <strong>{s.unitCount}</strong> units in stock
                </div>
                {s.categories.length > 0 && (
                  <div className="small muted">{s.categories.join(' • ')}</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
                  {!archived && (
                    <Button size="sm" onClick={() => navigate(`/seller/shops/${shop.id}/products`)}>
                      Open Shop
                    </Button>
                  )}
                  <Link to={`/shops/${shop.id}`} target="_blank" rel="noreferrer" style={{ gridColumn: archived ? '1 / -1' : undefined }}>
                    <Button variant="outline" size="sm" block>View on Marketplace</Button>
                  </Link>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {!archived ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setRenaming(shop)
                          setRenameValue(shop.name)
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => setPendingDelete({ shop, stats: s })}
                      >
                        Delete / Archive
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => restoreShop(shop)}
                    >
                      Restore Shop
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
