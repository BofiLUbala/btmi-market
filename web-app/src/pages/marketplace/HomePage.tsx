import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse, PublicProduct } from '@/api/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { SectionHead } from '@/components/ui/ShopCard'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { categoryLabel } from '@/lib/categoryLabels'
import { asArray } from '@/lib/format'
import { useI18n } from '@/store/i18n'

export default function HomePage() {
  const { t } = useI18n()
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([
      marketplaceApi.categories(),
      marketplaceApi.products({ page: 1, limit: 16, sort: 'relevance' })
    ]).then(([cats, prods]) => {
      if (!mounted) return
      if (cats.status === 'fulfilled') setCategories(asArray(cats.value))
      if (prods.status === 'fulfilled') setProducts(asArray(prods.value.products))
      if (cats.status === 'rejected' && prods.status === 'rejected') {
        setError(t('home.loadError'))
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <LoadingBlock label={t('home.loading')} />
  if (error) return <ErrorBox error={error} onRetry={() => window.location.reload()} />

  return (
    <div className="fade-in">
      <p className="home-kicker">{t('home.trustBanner')}</p>

      {categories.length > 0 && (
        <>
          <SectionHead title={t('home.categories')} linkTo="/categories" linkLabel={t('common.viewAll')} />
          <div className="category-rail">
            {categories.map((c) => {
              const visual = getCategoryVisual(c.slug)
              return (
                <Link key={c.id} to={`/categories/${c.slug}`} className="category-tile">
                  <span className="category-tile-media" style={{ background: visual.background }}>
                    <img src={visual.image} alt="" aria-hidden="true" loading="lazy" />
                  </span>
                  <span className="category-tile-name">{categoryLabel(t, c.slug, c.name)}</span>
                </Link>
              )
            })}
          </div>
        </>
      )}

      {products.length > 0 && (
        <>
          <SectionHead
            title={t('home.selectionForYou')}
            subtitle={t('home.selectionSubtitle')}
            linkTo="/search"
            linkLabel={t('common.viewAll')}
          />
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
