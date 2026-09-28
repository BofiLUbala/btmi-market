import { marketplaceApi } from '@/api/marketplace'
import { uuid } from '@/lib/format'

// Anonymous search analytics. The session id is random, lives only for the
// browser tab (sessionStorage) and is never linked to an account: it only lets
// the back office see that one query was quickly reformulated into another.
const SESSION_KEY = 'btmi.search-session'
const CLICK_KEY = 'btmi.search-click'
/** An add-to-cart counts as coming from a search within this delay of the click. */
const ATTRIBUTION_MS = 30 * 60 * 1000

let memorySession: string | undefined

export function searchSession(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id = uuid()
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    memorySession ??= uuid()
    return memorySession
  }
}

export type SearchResultType = 'PRODUCT' | 'SHOP' | 'CATEGORY' | 'SUBCATEGORY'

/**
 * Reports that a search result was opened. Fire and forget: analytics must
 * never slow down or break navigation. A click from autocomplete has no
 * search id yet, so it sends the typed query instead.
 */
export function reportSearchClick(click: { searchId?: string; query?: string; resultType: SearchResultType; resultId: string; position?: number }) {
  if (!click.searchId && !click.query?.trim()) return
  if (click.resultType === 'PRODUCT' && click.searchId) {
    try {
      sessionStorage.setItem(CLICK_KEY, JSON.stringify({ searchId: click.searchId, productId: click.resultId, at: Date.now() }))
    } catch {
      // Attribution is best effort.
    }
  }
  void marketplaceApi
    .searchEvent({
      search_id: click.searchId,
      query: click.searchId ? undefined : click.query,
      event_type: 'CLICK',
      result_type: click.resultType,
      result_id: click.resultId,
      position: click.position,
      session: searchSession(),
    })
    .catch(() => {})
}

/** Called on add-to-cart: attributes it to the search the product was opened from. */
export function reportSearchAddToCart(productId: string) {
  let click: { searchId?: string; productId?: string; at?: number } | undefined
  try {
    click = JSON.parse(sessionStorage.getItem(CLICK_KEY) || 'null') ?? undefined
  } catch {
    return
  }
  if (!click?.searchId || click.productId !== productId || !click.at || Date.now() - click.at > ATTRIBUTION_MS) return
  void marketplaceApi
    .searchEvent({ search_id: click.searchId, event_type: 'ADD_TO_CART', result_type: 'PRODUCT', result_id: productId, session: searchSession() })
    .catch(() => {})
}
