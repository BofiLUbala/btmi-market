import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse, PublicProduct, PublicShop, SubcategoryResponse } from '@/api/types'
import { formatMoney, initials } from '@/lib/format'
import { getCategoryVisual } from '@/lib/categoryVisuals'

type Suggestion =
  | { kind: 'product'; id: string; label: string; detail: string; href: string; product: PublicProduct }
  | { kind: 'shop'; id: string; label: string; detail: string; href: string; shop: PublicShop }
  | { kind: 'category'; id: string; label: string; detail: string; href: string; category: CategoryResponse }
  | { kind: 'subcategory'; id: string; label: string; detail: string; href: string; category: CategoryResponse; subcategory: SubcategoryResponse }

let taxonomyPromise: Promise<CategoryResponse[]> | undefined
function loadTaxonomy() {
  taxonomyPromise ??= marketplaceApi.categories().catch((error) => {
    taxonomyPromise = undefined
    throw error
  })
  return taxonomyPromise
}

export function SearchAutocomplete({
  variant = 'header',
  initialQuery = '',
  onQueryChange,
  className = ''
}: {
  variant?: 'header' | 'page'
  initialQuery?: string
  onQueryChange?: (query: string) => void
  className?: string
}) {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setSuggestions([])
      setStatus('idle')
      setOpen(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setStatus('loading')
      setOpen(true)
      try {
        const [products, shops, categories] = await Promise.all([
          marketplaceApi.search({ q: trimmed, sort: 'relevance', page: 1, limit: 4 }, controller.signal),
          marketplaceApi.shops({ q: trimmed, page: 1, limit: 3 }, controller.signal),
          loadTaxonomy()
        ])
        if (controller.signal.aborted) return
        const needle = trimmed.toLocaleLowerCase()
        const categoryItems: Suggestion[] = []
        const subcategoryItems: Suggestion[] = []
        for (const category of categories) {
          if (category.name.toLocaleLowerCase().includes(needle)) {
            categoryItems.push({ kind: 'category', id: category.id, label: category.name, detail: 'Category', href: `/categories/${category.slug}`, category })
          }
          for (const subcategory of category.subcategories ?? []) {
            if (subcategory.name.toLocaleLowerCase().includes(needle)) {
              subcategoryItems.push({ kind: 'subcategory', id: subcategory.id, label: subcategory.name, detail: `In ${category.name}`, href: `/categories/${category.slug}`, category, subcategory })
            }
          }
        }
        const uniqueProducts = (products.products ?? []).filter((product, index, all) => all.findIndex((candidate) => candidate.id === product.id) === index)
        const uniqueShops = (shops.shops ?? []).filter((shop, index, all) => all.findIndex((candidate) => candidate.id === shop.id) === index)
        const next: Suggestion[] = [
          ...uniqueProducts.slice(0, 3).map((product): Suggestion => ({ kind: 'product', id: product.id, label: product.name, detail: `${product.shop_name} · ${formatMoney(product.variants?.[0]?.unit_price ?? product.base_price)}`, href: `/products/${product.id}`, product })),
          ...uniqueShops.slice(0, 2).map((shop): Suggestion => ({ kind: 'shop', id: shop.id, label: shop.name, detail: shop.city || shop.business_name, href: `/shops/${shop.id}`, shop })),
          ...categoryItems.slice(0, 2),
          ...subcategoryItems.slice(0, 1)
        ].slice(0, 8)
        setSuggestions(next)
        setActiveIndex(-1)
        setStatus('ready')
      } catch (error) {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return
        setSuggestions([])
        setStatus('error')
      }
    }, 300)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const groups = useMemo(() => {
    const labels: Record<Suggestion['kind'], string> = { product: 'Products', shop: 'Shops', category: 'Categories', subcategory: 'Subcategories' }
    return (Object.keys(labels) as Suggestion['kind'][]).map((kind) => ({ kind, label: labels[kind], items: suggestions.filter((item) => item.kind === kind) })).filter((group) => group.items.length)
  }, [suggestions])

  function setValue(value: string) {
    setQuery(value)
    onQueryChange?.(value)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    setOpen(false)
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (!open || suggestions.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + delta + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      setOpen(false)
      navigate(suggestions[activeIndex].href)
    }
  }

  return (
    <div ref={rootRef} className={`search-autocomplete search-autocomplete--${variant} ${className}`.trim()}>
      <form className={variant === 'header' ? 'header-search' : 'search-autocomplete-form'} onSubmit={submit} role="search">
        <input ref={inputRef} className={variant === 'page' ? 'input' : undefined} value={query} onChange={(event) => setValue(event.target.value)} onFocus={() => query.trim().length >= 2 && setOpen(true)} onKeyDown={onKeyDown} placeholder="Search products, shops…" aria-label="Search products, shops and categories" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} />
        {query && <button className="search-clear" type="button" aria-label="Clear search" onClick={() => { setValue(''); setSuggestions([]); setOpen(false); inputRef.current?.focus() }}>×</button>}
        <button className="search-submit" type="submit">Search</button>
      </form>

      {open && query.trim().length >= 2 && (
        <div id={listId} className="search-suggestions" role="listbox" aria-label="Search suggestions">
          {status === 'loading' && <div className="search-message" role="status">Searching marketplace…</div>}
          {status === 'error' && <div className="search-message search-message--error" role="alert">Suggestions are unavailable. Press Search to try the full results.</div>}
          {status === 'ready' && suggestions.length === 0 && <div className="search-message">No matches for “{query.trim()}”.</div>}
          {status === 'ready' && groups.map((group) => (
            <section className="search-suggestion-group" key={group.kind} aria-label={group.label}>
              <div className="search-suggestion-heading">{group.label}</div>
              {group.items.map((item) => {
                const index = suggestions.indexOf(item)
                return <SuggestionLink key={`${item.kind}-${item.id}`} item={item} index={index} listId={listId} active={activeIndex === index} onHover={() => setActiveIndex(index)} onSelect={() => setOpen(false)} />
              })}
            </section>
          ))}
          {status === 'ready' && <Link className="search-view-all" to={`/search?q=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)}>View all results for “{query.trim()}”</Link>}
        </div>
      )}
    </div>
  )
}

function SuggestionLink({ item, index, listId, active, onHover, onSelect }: { item: Suggestion; index: number; listId: string; active: boolean; onHover: () => void; onSelect: () => void }) {
  const category = item.kind === 'category' || item.kind === 'subcategory' ? item.category : undefined
  return (
    <Link id={`${listId}-${index}`} role="option" aria-selected={active} className={`search-suggestion ${active ? 'active' : ''}`} to={item.href} onMouseEnter={onHover} onClick={onSelect}>
      {category ? <img className="search-suggestion-thumb" src={getCategoryVisual(category.slug).image} alt="" /> : <span className={`search-suggestion-thumb search-suggestion-initials search-suggestion-initials--${item.kind}`}>{initials(item.label)}</span>}
      <span className="search-suggestion-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
      <span aria-hidden>›</span>
    </Link>
  )
}
