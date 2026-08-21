import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse, PublicProduct, PublicShop } from '@/api/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { ShopCard } from '@/components/ui/ShopCard'
import { SectionHead } from '@/components/ui/ShopCard'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useAuth } from '@/store/auth'
import { asArray } from '@/lib/format'

export default function HomePage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [shops, setShops] = useState<PublicShop[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([
      marketplaceApi.categories(),
      marketplaceApi.products({ page: 1, limit: 8, sort: 'relevance' }),
      marketplaceApi.shops({ page: 1, limit: 6 })
    ]).then(([cats, prods, shps]) => {
      if (!mounted) return
      if (cats.status === 'fulfilled') setCategories(asArray(cats.value))
      if (prods.status === 'fulfilled') setProducts(asArray(prods.value.products))
      if (shps.status === 'fulfilled') setShops(asArray(shps.value))
      if (cats.status === 'rejected' && prods.status === 'rejected' && shps.status === 'rejected') {
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
      <section className="hero">
        <h1>Welcome{user ? ` back, ${user.first_name}` : ''} 👋</h1>
        <p>
          Buy from trusted local shops, pay cash on delivery, and earn points on every verified
          purchase.
        </p>
        <div className="hero-actions">
          <Link to="/search" className="btn btn-accent">
            Browse products
          </Link>
          <Link to="/shops" className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}>
            Explore shops
          </Link>
        </div>
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

      {shops.length > 0 && (
        <>
          <SectionHead title="Shops near you" linkTo="/shops" linkLabel="All shops" />
          <div className="shop-grid">
            {shops.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}