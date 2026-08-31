import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { PublicProduct } from '@/api/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { ErrorBox } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { asArray } from '@/lib/format'
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

const SORTS: { value: string; key: TranslationKey }[] = [
  { value: 'relevance', key: 'search.sort.relevance' },
  { value: 'price_asc', key: 'search.sort.priceAsc' },
  { value: 'price_desc', key: 'search.sort.priceDesc' },
  { value: 'seller_level', key: 'search.sort.topSellers' }
]

const RATING_FILTERS = [4, 3]

export default function SearchPage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const visualSearch = params.get('visual') === '1'
  const [q, setQ] = useState(initialQ)
  const [sort, setSort] = useState('relevance')
  const [minRating, setMinRating] = useState<number | undefined>()
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [visualFileName, setVisualFileName] = useState('')

  function runSearch(nextPage = 1, query = q, sortBy = sort, rating = minRating) {
    setLoading(true)
    setError('')
    marketplaceApi
      .search({ q: query, sort: sortBy, page: nextPage, limit: 20, min_rating: rating })
      .then(
        (res) => {
          const list = asArray(res.products)
          setProducts((prev) => (nextPage === 1 ? list : [...prev, ...list]))
          setHasMore(res.pagination.has_more)
          setTotal(res.pagination.total)
          setSearched(true)
          setLoading(false)
        },
        (e: unknown) => {
          setError(e instanceof Error ? e.message : t('search.failed'))
          setLoading(false)
        }
      )
  }

  useEffect(() => {
    if (visualSearch) {
      try {
        const saved = JSON.parse(sessionStorage.getItem('btmi.visual-search') || '{}') as { products?: PublicProduct[]; fileName?: string }
        const list = asArray(saved.products)
        setProducts(list)
        setTotal(list.length)
        setHasMore(false)
        setSearched(true)
        setVisualFileName(saved.fileName || t('search.selectedImage'))
      } catch {
        setError(t('search.imageResultsExpired'))
      }
    } else if (initialQ) runSearch(1, initialQ, 'relevance')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ, visualSearch])

  function changeSort(s: string) {
    setSort(s)
    setPage(1)
    runSearch(1, q, s)
  }

  function changeRating(value?: number) {
    const next = minRating === value ? undefined : value
    setMinRating(next)
    setPage(1)
    runSearch(1, q, sort, next)
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>{t('search.title')}</h1>
      <SearchAutocomplete
        variant="page"
        initialQuery={initialQ}
        onQueryChange={setQ}
        className="search-page-autocomplete"
      />

      {visualSearch && visualFileName && <div className="visual-search-banner"><span aria-hidden>📷</span><div><strong>{t('search.similarProductsTitle')}</strong><small>{visualFileName}</small></div></div>}

      {!visualSearch && (
        <div className="search-facets" role="group" aria-label={t('search.filterResults')}>
          <span className="small muted">{t('search.customerRating')}</span>
          {RATING_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              className={`facet-chip ${minRating === r ? 'selected' : ''}`}
              aria-pressed={minRating === r}
              onClick={() => changeRating(r)}
            >
              {r}★ {t('search.andUp')}
            </button>
          ))}
          {minRating !== undefined && (
            <button type="button" className="facet-chip facet-clear" onClick={() => changeRating(undefined)}>
              {t('search.clearFilter')}
            </button>
          )}
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 12 }}>
        <span className="small muted">
          {searched ? (visualSearch ? t('search.resultsFoundFromImage', { total }) : t('search.results', { total, query: q })) : t('search.typePrompt')}
        </span>
        <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => changeSort(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.key)}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBox error={error} />}

      {searched && products.length === 0 && !loading ? (
        <p className="muted" style={{ padding: '32px 0' }}>
          {visualSearch ? t('search.noResultsImage') : t('search.noResultsQuery', { query: q })}
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
              <Button
                variant="outline"
                onClick={() => {
                  const np = page + 1
                  setPage(np)
                  runSearch(np, q, sort)
                }}
                loading={loading}
              >
                {t('common.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
