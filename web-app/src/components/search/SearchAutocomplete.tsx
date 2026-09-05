import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { marketplaceApi } from '@/api/marketplace'
import type { CategoryResponse, PublicProduct, PublicShop, SubcategoryResponse } from '@/api/types'
import { formatMoney, initials } from '@/lib/format'
import { getCategoryVisual } from '@/lib/categoryVisuals'
import { categoryLabel, subcategoryLabel } from '@/lib/categoryLabels'
import { CameraIcon, ImageIcon } from '@/components/ui/Icons'
import { useI18n } from '@/store/i18n'
import type { TranslationKey } from '@/locales/fr'

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
  const { t } = useI18n()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const captureInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const listId = useId()
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [imageStatus, setImageStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  /** Releases the camera. Runs on cancel, after a capture, and on unmount. */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  // The <video> only exists once the overlay has rendered, so the stream is
  // attached here rather than at the moment getUserMedia resolves.
  useEffect(() => {
    const video = videoRef.current
    if (!cameraOpen || !video || !streamRef.current) return
    video.srcObject = streamRef.current
    void video.play().catch(() => {})
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') stopCamera() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cameraOpen, stopCamera])

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
          const catLabel = categoryLabel(t, category.slug, category.name)
          if (category.name.toLocaleLowerCase().includes(needle) || catLabel.toLocaleLowerCase().includes(needle)) {
            categoryItems.push({ kind: 'category', id: category.id, label: catLabel, detail: t('search.kind.category'), href: `/categories/${category.slug}`, category })
          }
          for (const subcategory of category.subcategories ?? []) {
            const subLabel = subcategoryLabel(t, subcategory.slug, subcategory.name)
            if (subcategory.name.toLocaleLowerCase().includes(needle) || subLabel.toLocaleLowerCase().includes(needle)) {
              subcategoryItems.push({ kind: 'subcategory', id: subcategory.id, label: subLabel, detail: t('search.kind.inCategory', { category: catLabel }), href: `/categories/${category.slug}`, category, subcategory })
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
  }, [query, t])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const GROUP_LABELS: Record<Suggestion['kind'], TranslationKey> = {
    product: 'search.group.products',
    shop: 'search.group.shops',
    category: 'search.group.categories',
    subcategory: 'search.group.subcategories',
  }

  const groups = useMemo(() => {
    return (Object.keys(GROUP_LABELS) as Suggestion['kind'][]).map((kind) => ({
      kind,
      label: t(GROUP_LABELS[kind]),
      items: suggestions.filter((item) => item.kind === kind),
    })).filter((group) => group.items.length)
  }, [suggestions, t])

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

  /** Shared by the file picker and the camera: both end up with a File. */
  async function runImageSearch(file: File, fileName: string) {
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 6 * 1024 * 1024) {
      setImageStatus('error')
      return
    }
    setImageStatus('loading')
    setOpen(false)
    try {
      const result = await marketplaceApi.searchByImage(file)
      sessionStorage.setItem('btmi.visual-search', JSON.stringify({ products: result.products ?? [], fileName, createdAt: Date.now() }))
      setImageStatus('idle')
      navigate('/search?visual=1')
    } catch {
      setImageStatus('error')
    }
  }

  function searchImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void runImageSearch(file, file.name)
  }

  async function openCamera() {
    setCameraError(false)
    // `mediaDevices` is undefined on an insecure origin and on older browsers.
    // The `capture` input still hands the phone's own camera app the job.
    if (!navigator.mediaDevices?.getUserMedia) {
      captureInputRef.current?.click()
      return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      setOpen(false)
      setCameraOpen(true)
    } catch {
      setCameraError(true)
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        stopCamera()
        if (!blob) {
          setImageStatus('error')
          return
        }
        void runImageSearch(new File([blob], 'capture.jpg', { type: 'image/jpeg' }), 'capture.jpg')
      },
      'image/jpeg',
      0.82
    )
  }

  return (
    <div ref={rootRef} className={`search-autocomplete search-autocomplete--${variant} ${className}`.trim()}>
      <form className={variant === 'header' ? 'header-search' : 'search-autocomplete-form'} onSubmit={submit} role="search">
        <input ref={inputRef} className={variant === 'page' ? 'input' : undefined} value={query} onChange={(event) => setValue(event.target.value)} onFocus={() => query.trim().length >= 2 && setOpen(true)} onKeyDown={onKeyDown} placeholder={t('search.placeholder')} aria-label={t('search.autocompleteAria')} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} />
        {query && <button className="search-clear" type="button" aria-label={t('search.clear')} onClick={() => { setValue(''); setSuggestions([]); setOpen(false); inputRef.current?.focus() }}>×</button>}
        <input ref={imageInputRef} className="visual-search-input" type="file" accept="image/jpeg,image/png" onChange={searchImage} tabIndex={-1} />
        <input ref={captureInputRef} className="visual-search-input" type="file" accept="image/*" capture="environment" onChange={searchImage} tabIndex={-1} />
        <button className="visual-search-button" type="button" aria-label={t('search.byCamera')} title={t('search.byCamera')} disabled={imageStatus === 'loading'} onClick={openCamera}><CameraIcon width="19" height="19" /></button>
        <button className="visual-search-button" type="button" aria-label={t('search.byImage')} title={t('search.byImage')} disabled={imageStatus === 'loading'} onClick={() => imageInputRef.current?.click()}>{imageStatus === 'loading' ? <span className="spinner" /> : <ImageIcon width="19" height="19" />}</button>
        <button className="search-submit" type="submit">{t('common.search')}</button>
      </form>

      {imageStatus === 'error' && <div className="visual-search-error" role="alert">{t('search.imageError')}</div>}
      {cameraError && <div className="visual-search-error" role="alert">{t('search.cameraUnavailable')}</div>}

      {cameraOpen && (
        <div className="camera-capture" role="dialog" aria-modal="true" aria-label={t('search.byCamera')}>
          <div className="camera-capture-panel">
            <video ref={videoRef} className="camera-capture-video" playsInline muted autoPlay />
            <div className="camera-capture-actions">
              <button type="button" className="btn btn-outline" onClick={stopCamera}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={capturePhoto}>{t('search.capture')}</button>
            </div>
          </div>
        </div>
      )}

      {open && query.trim().length >= 2 && (
        <div id={listId} className="search-suggestions" role="listbox" aria-label={t('search.suggestionsAria')}>
          {status === 'loading' && <div className="search-message" role="status">{t('search.searching')}</div>}
          {status === 'error' && <div className="search-message search-message--error" role="alert">{t('search.suggestionsUnavailable')}</div>}
          {status === 'ready' && suggestions.length === 0 && <div className="search-message">{t('search.noMatches', { query: query.trim() })}</div>}
          {status === 'ready' && groups.map((group) => (
            <section className="search-suggestion-group" key={group.kind} aria-label={group.label}>
              <div className="search-suggestion-heading">{group.label}</div>
              {group.items.map((item) => {
                const index = suggestions.indexOf(item)
                return <SuggestionLink key={`${item.kind}-${item.id}`} item={item} index={index} listId={listId} active={activeIndex === index} onHover={() => setActiveIndex(index)} onSelect={() => setOpen(false)} />
              })}
            </section>
          ))}
          {status === 'ready' && <Link className="search-view-all" to={`/search?q=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)}>{t('search.viewAll', { query: query.trim() })}</Link>}
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
