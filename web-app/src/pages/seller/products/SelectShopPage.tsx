import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { shopApi } from '@/api/seller'
import type { Shop } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function SelectShopPage() {
  const t = useT()
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
        if (mounted) setError(err instanceof Error ? err.message : t('seller.products.loadShopsFailed'))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [activeBusiness?.id, t])

  if (!activeBusiness) {
    return (
      <div className="empty-state" style={{ padding: '64px 0', textAlign: 'center' }}>
        <h2>{t('seller.noBusinessSelected')}</h2>
        <p className="muted">{t('seller.products.noBusinessSubtitle')}</p>
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
          <h1>{t('seller.products.addProduct')}</h1>
          <p className="muted">{t('seller.products.selectShopDesc')}</p>
        </div>
        <Link to="/seller/products">
          <Button variant="ghost">{t('seller.products.backToProducts')}</Button>
        </Link>
      </div>

      {loading ? (
        <LoadingBlock label={t('seller.products.loadingShops')} />
      ) : error ? (
        <ErrorBox error={error} />
      ) : shops.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <h3>{t('seller.products.noShopYetTitle')}</h3>
          <p className="muted" style={{ margin: '8px 0 20px' }}>
            {t('seller.products.noShopYetDesc')}
          </p>
          <Link to="/seller/shops">
            <Button size="lg">{t('seller.products.createShop')}</Button>
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
                {t('seller.products.selectShop')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
