import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse } from '@/api/types'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { initials, asArray } from '@/lib/format'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    marketplaceApi.categories().then(
      (c) => {
        setCategories(asArray(c))
        setLoading(false)
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load categories')
        setLoading(false)
      }
    )
  }, [])

  if (loading) return <LoadingBlock label="Loading categories…" />
  if (error) return <ErrorBox error={error} onRetry={() => window.location.reload()} />

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>Categories</h1>
      <p className="muted small">Browse the marketplace by category.</p>
      <div className="cat-grid">
        {categories.map((c) => (
          <Link key={c.id} to={`/categories/${c.slug}`} className="cat-card card card-hover">
            <div className="cat-icon">{initials(c.name)}</div>
            <div className="bold">{c.name}</div>
            {c.subcategories && c.subcategories.length > 0 && (
              <div className="cat-sub small muted">
                {c.subcategories.slice(0, 3).map((s) => s.name).join(' · ')}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}