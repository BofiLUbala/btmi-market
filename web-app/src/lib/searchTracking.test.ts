import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const post = vi.fn()
vi.mock('@/api/client', () => ({ get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), del: vi.fn(), upload: vi.fn() }))

const store = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

const { marketplaceApi } = await import('@/api/marketplace')
const { reportSearchAddToCart, reportSearchClick, searchSession } = await import('./searchTracking')

beforeEach(() => {
  store.clear()
  get.mockReset().mockResolvedValue({})
  post.mockReset().mockResolvedValue({ recorded: true })
})

describe('marketplace search API contract', () => {
  it('asks the suggest endpoint once with the raw query', async () => {
    const signal = new AbortController().signal
    await marketplaceApi.suggest('Téléphone', signal)
    expect(get).toHaveBeenCalledWith('/marketplace/search/suggest', { q: 'Téléphone', limit: 4 }, { signal })
  })

  it('passes the session to the full search', async () => {
    await marketplaceApi.search({ q: 'frigo', session: 's-1', page: 2, limit: 20 })
    expect(get).toHaveBeenCalledWith('/marketplace/search', { q: 'frigo', session: 's-1', page: 2, limit: 20 }, { signal: undefined })
  })
})

describe('search tracking', () => {
  it('keeps one anonymous session id per tab', () => {
    const id = searchSession()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(searchSession()).toBe(id)
  })

  it('reports a result click with its search id', () => {
    reportSearchClick({ searchId: 'search-1', resultType: 'PRODUCT', resultId: 'p1', position: 3 })
    expect(post).toHaveBeenCalledWith('/marketplace/search/events', expect.objectContaining({
      search_id: 'search-1', event_type: 'CLICK', result_type: 'PRODUCT', result_id: 'p1', position: 3, query: undefined,
    }))
  })

  it('sends the query instead for autocomplete clicks, and nothing without either', () => {
    reportSearchClick({ query: 'sams', resultType: 'SHOP', resultId: 's1' })
    expect(post).toHaveBeenCalledWith('/marketplace/search/events', expect.objectContaining({ query: 'sams', search_id: undefined }))
    post.mockClear()
    reportSearchClick({ query: '  ', resultType: 'SHOP', resultId: 's1' })
    expect(post).not.toHaveBeenCalled()
  })

  it('attributes add-to-cart only to the product opened from search', () => {
    reportSearchClick({ searchId: 'search-1', resultType: 'PRODUCT', resultId: 'p1' })
    post.mockClear()
    reportSearchAddToCart('other-product')
    expect(post).not.toHaveBeenCalled()
    reportSearchAddToCart('p1')
    expect(post).toHaveBeenCalledWith('/marketplace/search/events', expect.objectContaining({ search_id: 'search-1', event_type: 'ADD_TO_CART', result_id: 'p1' }))
  })

  it('does not attribute a stale click', () => {
    store.set('btmi.search-click', JSON.stringify({ searchId: 'old', productId: 'p1', at: Date.now() - 31 * 60 * 1000 }))
    reportSearchAddToCart('p1')
    expect(post).not.toHaveBeenCalled()
  })

  it('never throws when the event request fails', async () => {
    post.mockRejectedValue(new Error('offline'))
    expect(() => reportSearchClick({ searchId: 'x', resultType: 'PRODUCT', resultId: 'p' })).not.toThrow()
  })
})
