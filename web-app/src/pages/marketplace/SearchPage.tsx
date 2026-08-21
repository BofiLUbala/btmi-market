import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { PublicProduct } from '@/api/types'
import { ProductCard } from '@/components/ui/ProductCard'
import { ErrorBox } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { asArray } from '@/lib/format'
import { SearchAutocomplete } from '@/components/search/SearchAutocomplete'

const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'seller_level', label: 'Top sellers' }
]

export default function SearchPage() {
  const [params] = useSearchParams()
  const initialQ = params.get('q') ?? ''
  const [q, setQ] = useState(initialQ)
  const [sort, setSort] = useState('relevance')
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function runSearch(nextPage = 1, query = q, sortBy = sort) {
    setLoading(true)
    setError('')
    marketplaceApi
      .search({ q: query, sort: sortBy, page: nextPage, limit: 20 })
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
          setError(e instanceof Error ? e.message : 'Search failed')
          setLoading(false)
        }
      )
  }

  useEffect(() => {
    if (initialQ) runSearch(1, initialQ, 'relevance')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ])

  function changeSort(s: string) {
    setSort(s)
    setPage(1)
    runSearch(1, q, s)
  }

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 12 }}>Search</h1>
      <SearchAutocomplete
        variant="page"
        initialQuery={initialQ}
        onQueryChange={setQ}
        className="search-page-autocomplete"
      />

      <div className="row-between" style={{ marginBottom: 12 }}>
        <span className="small muted">
          {searched ? `${total} result${total === 1 ? '' : 's'}` : 'Type something to search'}
        </span>
        <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => changeSort(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBox error={error} />}

      {searched && products.length === 0 && !loading ? (
        <p className="muted" style={{ padding: '32px 0' }}>
          No products found for “{q}”.
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
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
