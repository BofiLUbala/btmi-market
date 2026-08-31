import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { PublicProduct, SubcategoryResponse } from '@/api/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { asArray } from '@/lib/format'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { useI18n } from '@/store/i18n'

export default function CategoryBrowsePage() {
  const { t } = useI18n()
  const { slug = '' } = useParams()
  const [subs, setSubs] = useState<SubcategoryResponse[]>([])
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [sub, setSub] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const visual = getCategoryVisual(slug)
  const categoryName = slug.replace(/-/g, ' ')

  useEffect(() => {
    setSub('')
    setPage(1)
  }, [slug])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    marketplaceApi.subcategories(slug).then(
      (s) => mounted && setSubs(asArray(s)),
      () => mounted && setSubs([])
    )
    marketplaceApi.categoryProducts(slug, { page, limit: 20, subcategory: sub }).then(
      (res) => {
        if (!mounted) return
        const list = asArray(res.products)
        setProducts((prev) => (page === 1 ? list : [...prev, ...list]))
        setHasMore(res.pagination.has_more)
        setLoading(false)
      },
      (e: unknown) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : t('categoryBrowse.loadError'))
        setLoading(false)
      }
    )
    return () => {
      mounted = false
    }
  }, [slug, page, sub, t])

  function loadMore() {
    setPage((p) => p + 1)
  }

  if (loading && page === 1) return <LoadingBlock label={t('categoryBrowse.loading')} />
  if (error) return <ErrorBox error={error} onRetry={() => setPage(1)} />

  return (
    <div className="fade-in">
      <div className="row-between">
        <div>
          <div
            className="cat-detail-header"
            style={{
              background: visual.background,
            }}
          >
            <img className="cat-detail-image" src={visual.image} alt={t('categoryBrowse.imageAlt', { name: categoryName })} />
            <div>
              <h1 style={{ marginBottom: 4, color: visual.accent }}>
                {categoryName}
              </h1>
              <p className="muted small">
                {t('categoryBrowse.productSubtitle', { name: categoryName })}
              </p>
            </div>
          </div>
          <Link to="/categories" className="small section-link">
            {t('categoryBrowse.allCategories')}
          </Link>
        </div>
      </div>

      {subs.length > 0 && (
        <div className="category-rail" style={{ marginTop: 12 }}>
          <button type="button" className={`category-chip ${!sub ? 'selected' : ''}`} onClick={() => setSub('')}>
            {t('categoryBrowse.all')}
          </button>
          {subs.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`category-chip ${sub === s.slug ? 'selected' : ''}`}
              onClick={() => setSub(s.slug)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {products.length === 0 && !loading ? (
        <p className="muted" style={{ padding: '32px 0' }}>
          {t('categoryBrowse.noProducts')}
        </p>
      ) : (
        <>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {hasMore && (
            <div className="load-more-wrap">
              <Button variant="outline" onClick={loadMore} loading={loading}>
                {t('common.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
