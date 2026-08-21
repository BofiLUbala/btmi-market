import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse } from '@/api/types'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { asArray } from '@/lib/format'
import { getCategoryVisual } from '@/lib/categoryVisuals'

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
      <h1 style={{ marginBottom: 8 }}>Categories</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        Browse products by category and find what you need.
      </p>
      <div className="cat-grid">
        {categories.map((c, index) => {
          const visual = getCategoryVisual(c.slug)
          return (
            <Link
              key={c.id}
              to={`/categories/${c.slug}`}
              className="cat-card card card-hover"
              style={{
                background: visual.background,
              }}
            >
              <div className="cat-image-wrap">
                <img className="cat-image" src={visual.image} alt={`${c.name} category`}
                  loading={index < 4 ? 'eager' : 'lazy'} decoding="async" />
              </div>
              <div className="cat-card-copy">
                <div className="bold" style={{ color: visual.accent }}>{c.name}</div>
                {c.subcategories && c.subcategories.length > 0 && (
                  <div className="cat-sub small muted">
                    {c.subcategories.slice(0, 3).map((s) => s.name).join(' · ')}
                  </div>
                )}
                </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
