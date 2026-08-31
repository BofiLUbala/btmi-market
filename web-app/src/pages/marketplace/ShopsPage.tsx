import { useEffect, useState } from 'react'
import { marketplaceApi } from '@/api/marketplace'
import type { PublicShop } from '@/api/types'
import { ShopCard } from '@/components/ui/ShopCard'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { asArray } from '@/lib/format'
import { useI18n } from '@/store/i18n'

export default function ShopsPage() {
  const { t } = useI18n()
  const [shops, setShops] = useState<PublicShop[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPage(1)
  }, [city])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    marketplaceApi
      .shops({ page, limit: 12, city })
      .then(
        (response) => {
          if (!mounted) return
          const list = asArray(response.shops)
          setShops((prev) => (page === 1 ? list : [...prev, ...list]))
          setHasMore(response.pagination.has_more)
          setLoading(false)
        },
        (e: unknown) => {
          if (!mounted) return
          setError(e instanceof Error ? e.message : t('shops.loadError'))
          setLoading(false)
        }
      )
    return () => {
      mounted = false
    }
  }, [page, city, t])

  if (loading && page === 1) return <LoadingBlock label={t('shops.loading')} />
  if (error) return <ErrorBox error={error} onRetry={() => setPage(1)} />

  return (
    <div className="fade-in">
      <div className="row-between">
        <h1>{t('nav.shops')}</h1>
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder={t('shops.filterByCity')}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      {shops.length === 0 ? (
        <p className="muted" style={{ padding: '32px 0' }}>
          {city ? t('shops.noShopsInCity', { city }) : t('shops.noShops')}
        </p>
      ) : (
        <>
          <div className="shop-grid">
            {shops.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
          {hasMore && (
            <div className="load-more-wrap">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)} loading={loading}>
                {t('common.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
