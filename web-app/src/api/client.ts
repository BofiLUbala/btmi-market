import { ApiError, type SuccessEnvelope } from './types'

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
    tokenStore.clear()
    return false
  }
  const json = (await res.json()) as SuccessEnvelope<{ access_token: string; refresh_token: string }>
  const d = json.data
  if (!d?.access_token || !d?.refresh_token) {
    tokenStore.clear()
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
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const access = tokenStore.getAccess()
  if (access) headers.set('Authorization', `Bearer ${access}`)

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach BTMI Market right now. Check your connection and try again.'
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
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } }
      if (body?.error?.code) code = body.error.code
      if (body?.error?.message && res.status !== 403) message = body.error.message
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
    }
    throw new ApiError(res.status, code, message)
  }

  const json = (await res.json()) as SuccessEnvelope<T>
  return json.data
}

export function get<T>(
  path: string,
  params?: Record<string, unknown> | object
) {
  const qs = new URLSearchParams()
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
    }
  }
  const q = qs.toString()
  return api<T>(q ? `${path}?${q}` : path)
}

export function post<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body)
  })
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