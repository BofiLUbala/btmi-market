import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { shopApi } from '@/api/seller'
import type { Shop } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

export default function SelectShopPage() {
  const { activeBusiness } = useAuth()
  const navigate = useNavigate()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!activeBusiness) return
    let mounted = true
    setLoading(true)
    shopApi
      .listByBusiness(activeBusiness.id)
      .then((data) => {
        if (mounted) setShops(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load your Shops.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [activeBusiness?.id])

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <h2>No Business Selected</h2>
        <p className="muted">Select a business before adding Products.</p>
      </div>
    )
  }

  function selectShop(shopId: string) {
    navigate(`/seller/shops/${shopId}/products`)
  }

  return (
    <div className="select-shop-page">
      <div className="page-header">
        <div>
          <h1>Add Product</h1>
          <p className="muted">Choose the Shop where you want to sell this Product.</p>
        </div>
        <Link to="/seller/products">
          <Button variant="ghost">← Back to Products</Button>
        </Link>
      </div>

      {loading ? (
        <LoadingBlock label="Loading Shops…" />
      ) : error ? (
        <ErrorBox error={error} />
      ) : shops.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <h3>You need to create a Shop before adding Products.</h3>
          <p className="muted" style={{ margin: '8px 0 20px' }}>
            Products are always created inside a Shop — that is where their stock and sales live.
          </p>
          <Link to="/seller/shops">
            <Button size="lg">Create Shop</Button>
          </Link>
        </div>
      ) : (
        <div className="shop-select-grid">
          {shops.map((shop) => (
            <div key={shop.id} className="card shop-select-card">
              <div className="shop-select-info">
                <span
                  className={`badge ${shop.status === 'ACTIVE' ? 'badge-success' : 'badge-muted'}`}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {shop.status}
                </span>
                <h3 style={{ margin: '8px 0 2px' }}>{shop.name}</h3>
                <span className="small muted">
                  {[shop.city, shop.address].filter(Boolean).join(' — ') || shop.type}
                </span>
              </div>
              <Button variant="primary" block onClick={() => selectShop(shop.id)}>
                Select Shop
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
