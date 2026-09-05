import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse } from '@/api/types'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { asArray } from '@/lib/format'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { categoryLabel, subcategoryLabel } from '@/lib/categoryLabels'
import { useI18n } from '@/store/i18n'

export default function CategoriesPage() {
  const { t } = useI18n()
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
        setError(e instanceof Error ? e.message : t('categories.loadError'))
        setLoading(false)
      }
    )
  }, [t])

  if (loading) return <LoadingBlock label={t('categories.loading')} />
  if (error) return <ErrorBox error={error} onRetry={() => window.location.reload()} />

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 8 }}>{t('categories.title')}</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        {t('categories.subtitle')}
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
                <img className="cat-image" src={visual.image} alt={t('categories.imageAlt', { name: categoryLabel(t, c.slug, c.name) })}
                  loading={index < 4 ? 'eager' : 'lazy'} decoding="async" />
              </div>
              <div className="cat-card-copy">
                <div className="bold" style={{ color: visual.accent }}>{categoryLabel(t, c.slug, c.name)}</div>
                {c.subcategories && c.subcategories.length > 0 && (
                  <div className="cat-sub small muted">
                    {c.subcategories.slice(0, 3).map((s) => subcategoryLabel(t, s.slug, s.name)).join(' · ')}
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
