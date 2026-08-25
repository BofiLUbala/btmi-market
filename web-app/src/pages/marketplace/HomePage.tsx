import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse, PublicProduct } from '@/api/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { SectionHead } from '@/components/ui/ShopCard'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { asArray } from '@/lib/format'

export default function HomePage() {
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
        setError('Could not load the marketplace. Is the API running?')
      }
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <LoadingBlock label="Loading marketplace…" />
  if (error) return <ErrorBox error={error} onRetry={() => window.location.reload()} />

  return (
    <div className="fade-in">
      <section className="home-trust" aria-label="Marketplace assurance">
        Achetez en toute confiance
      </section>

      {categories.length > 0 && (
        <>
          <SectionHead title="Categories" linkTo="/categories" linkLabel="All categories" />
          <div className="category-rail">
            {categories.map((c) => (
              <Link key={c.id} to={`/categories/${c.slug}`} className="category-chip">
                {c.name}
              </Link>
            ))}
          </div>
        </>
      )}

      {products.length > 0 && (
        <>
          <SectionHead title="Featured products" linkTo="/search" linkLabel="Search all" />
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
