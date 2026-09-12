import { ApiError } from './types'

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8080/api/v1'

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
  try {
    res = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...options, headers })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach TBK right now. Check your connection and try again.'
    )
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
    let message =
      res.status === 401
        ? 'Please sign in to continue.'
        : res.status === 403
          ? 'You do not have permission to access this resource.'
          : `Request failed (${res.status})`
    let extraData: Record<string, unknown> | undefined
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
      if (body?.error?.message && res.status !== 403) message = body.error.message
      // Capture structured MISSING_REQUIRED_ATTRIBUTES payload
      if (code === 'MISSING_REQUIRED_ATTRIBUTES' && body?.error) {
        extraData = {
          missing_keys: body.error.missing_keys ?? [],
          missing_labels_fr: body.error.missing_labels_fr ?? [],
          category_id: body.error.category_id,
          category_slug: body.error.category_slug,
          subcategory_slug: body.error.subcategory_slug,
        }
        // Build French message if labels are available
        if (body.error.missing_labels_fr && body.error.missing_labels_fr.length > 0) {
          message = `Complétez les caractéristiques obligatoires avant de publier : ${body.error.missing_labels_fr.join(', ')}.`
        } else if (body.error.missing_keys && body.error.missing_keys.length > 0) {
          const keys = body.error.missing_keys.join(', ')
          message = `Ce produit requiert ${keys}. Complétez les caractéristiques manquantes avant de publier.`
        } else if (message.startsWith('MISSING_REQUIRED_ATTRIBUTES:')) {
          const names = message.replace(/^MISSING_REQUIRED_ATTRIBUTES:\s*/, '')
          message = names
            ? `Ce produit requiert ${names}. Complétez les caractéristiques manquantes avant de publier.`
            : 'Certaines caractéristiques requises sont manquantes. Complétez-les avant de publier.'
        }
      }
    } catch {
      /* non-JSON error body */
    }
    // User-friendly error mapping
    if (code === 'ACCOUNT_NOT_ACTIVATED') {
      message = 'Your account has not been activated yet. Please check your email for the activation link.'
    } else if (code === 'ACCOUNT_ALREADY_ACTIVE') {
      message = 'This account is already active. You can sign in directly.'
    } else if (code === 'ACTIVATION_LINK_EXPIRED') {
      message = 'This activation link has expired. Activation links are valid for 24 hours.'
    } else if (code === 'ACTIVATION_LINK_ALREADY_USED') {
      message = 'This activation link has already been used.'
    } else if (code === 'ACTIVATION_LINK_INVALID') {
      message = 'This activation link is invalid.'
    } else if (code === 'PASSWORD_TOO_WEAK') {
      message = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
    } else if (code === 'PASSWORD_CONFIRMATION_MISMATCH') {
      message = 'Passwords do not match.'
    } else if (code === 'EMAIL_ALREADY_EXISTS') {
      message = 'An account already exists with this email.'
    } else if (code === 'PHONE_ALREADY_EXISTS') {
      message = 'An account already exists with this phone number.'
    } else if (code === 'INVALID_CREDENTIALS') {
      message = 'The email or password is incorrect.'
    } else if (code === 'BUYER_PROFILE_INCOMPLETE') {
      message = 'Add a phone number to your profile before placing an order.'
    } else if (code === 'DUPLICATE_VARIANT_COMBINATION') {
      message = 'Cette combinaison de caractéristiques existe déjà pour ce produit. Utilisez une combinaison différente.'
    }
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

export function del<T>(path: string) {
  return api<T>(path, { method: 'DELETE' })
}

export async function authenticatedBlob(path: string): Promise<Blob> {
  const headers = new Headers()
  const access = tokenStore.getAccess()
  if (access) headers.set('Authorization', `Bearer ${access}`)
  const response = await fetch(`${API_BASE}${path}`, { headers, cache: 'no-store' })
  if (!response.ok) throw new ApiError(response.status, 'DOWNLOAD_FAILED', `Download failed (${response.status})`)
  return response.blob()
}
