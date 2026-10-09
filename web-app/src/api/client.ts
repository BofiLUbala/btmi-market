import { ApiError } from './types'
import { localizeApiError } from './errorMessages'
import { getLang, translate } from '@/store/i18n'

const configuredApiBase = import.meta.env.VITE_API_BASE as string | undefined

// The local gateway mirrors production's single-origin routing and forwards
// /api to Go. Ignore a machine-specific absolute API URL only on that origin;
// standalone Vite runs and deployed builds keep their configured API base.
export const API_BASE: string =
  typeof window !== 'undefined' && window.location.port === '5180'
    ? '/api/v1'
    : configuredApiBase ?? '/api/v1'

const ACCESS_KEY = 'btmi.access'
const REFRESH_KEY = 'btmi.refresh'

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }
}

const sessionListeners = new Set<() => void>()

export function onSessionInvalidated(listener: () => void) {
  sessionListeners.add(listener)
  return () => { sessionListeners.delete(listener) }
}

function invalidateSession() {
  tokenStore.clear()
  sessionListeners.forEach((listener) => listener())
}

let refreshPromise: Promise<boolean> | null = null

const REQUEST_TIMEOUT_MS = 45_000

async function refreshTokens(): Promise<boolean> {
  const refresh = tokenStore.getRefresh()
  if (!refresh) return false
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh })
  })
  if (!res.ok) {
    invalidateSession()
    return false
  }
  const json = (await res.json()) as unknown
  const d = (json && typeof json === 'object' && 'data' in json && (json as Record<string, unknown>).data)
    ? (json as Record<string, unknown>).data as { access_token: string; refresh_token: string }
    : (json as { access_token: string; refresh_token: string })
  if (!d?.access_token || !d?.refresh_token) {
    invalidateSession()
    return false
  }
  tokenStore.set(d.access_token, d.refresh_token)
  return true
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const access = tokenStore.getAccess()
  if (access) headers.set('Authorization', `Bearer ${access}`)

  let res: Response
  const timeoutController = options.signal ? null : new AbortController()
  const timeoutId = timeoutController
    ? window.setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
    : null
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: 'no-store',
      ...options,
      headers,
      signal: options.signal ?? timeoutController?.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (timeoutController?.signal.aborted) {
        throw new ApiError(
          0,
          'REQUEST_TIMEOUT',
          translate('apiError.REQUEST_TIMEOUT')
        )
      }
      throw error
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      translate('apiError.NETWORK_ERROR')
    )
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId)
  }

  if (res.status === 401 && allowRefresh) {
    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(() => {
        refreshPromise = null
      })
    }
    const ok = await refreshPromise
    if (ok) {
      return api<T>(path, options, false)
    }
  }

  if (!res.ok) {
    let code = res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'FORBIDDEN' : 'REQUEST_FAILED'
    let rawMessage = ''
    let extraData: Record<string, unknown> | undefined
    let missingNames = ''
    try {
      const body = (await res.json()) as {
        error?: {
          code?: string
          message?: string
          missing_keys?: string[]
          missing_labels_fr?: string[]
          category_id?: string
          category_slug?: string
          subcategory_slug?: string
        }
      }
      if (body?.error?.code) code = body.error.code
      if (body?.error?.message) rawMessage = body.error.message
      // Capture structured MISSING_REQUIRED_ATTRIBUTES payload
      if (code === 'MISSING_REQUIRED_ATTRIBUTES' && body?.error) {
        extraData = {
          missing_keys: body.error.missing_keys ?? [],
          missing_labels_fr: body.error.missing_labels_fr ?? [],
          category_id: body.error.category_id,
          category_slug: body.error.category_slug,
          subcategory_slug: body.error.subcategory_slug,
        }
        // French labels when the user reads French; the attribute keys otherwise.
        const labelsFr = body.error.missing_labels_fr ?? []
        const keys = body.error.missing_keys ?? []
        if (getLang() === 'fr' && labelsFr.length > 0) missingNames = labelsFr.join(', ')
        else if (keys.length > 0) missingNames = keys.join(', ')
        else missingNames = rawMessage.replace(/^MISSING_REQUIRED_ATTRIBUTES:\s*/, '').trim()
        if (missingNames === rawMessage) missingNames = ''
      }
    } catch {
      /* non-JSON error body */
    }
    const message = missingNames
      ? translate('apiError.missingAttributesNamed', { names: missingNames })
      : localizeApiError(res.status, code, rawMessage)
    const err = new ApiError(res.status, code, message, extraData)
    throw err
  }

  const json = (await res.json()) as unknown
  if (json && typeof json === 'object' && 'data' in json && (json as Record<string, unknown>).data !== undefined) {
    return (json as Record<string, unknown>).data as T
  }
  return json as T
}

export function get<T>(
  path: string,
  params?: Record<string, unknown> | object,
  options: RequestInit = {}
) {
  const qs = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
    }
  }
  const q = qs.toString()
  return api<T>(q ? `${path}?${q}` : path, options)
}

export function post<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

export function upload<T>(path: string, formData: FormData) {
  return api<T>(path, { method: 'POST', body: formData })
}

export function patch<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

export function put<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

export function del<T>(path: string, body?: unknown) {
  return api<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) })
}

export async function authenticatedBlob(path: string): Promise<Blob> {
  const headers = new Headers()
  const access = tokenStore.getAccess()
  if (access) headers.set('Authorization', `Bearer ${access}`)
  const response = await fetch(`${API_BASE}${path}`, { headers, cache: 'no-store' })
  if (!response.ok) throw new ApiError(response.status, 'DOWNLOAD_FAILED', `Download failed (${response.status})`)
  return response.blob()
}
