import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { tokenStore } from './tokenStore'

const emulatorDefault = Platform.OS === 'android'
  ? 'http://10.0.2.2:8080/api/v1'
  : 'http://localhost:8080/api/v1'

function developmentApiUrl() {
  if (!__DEV__) return emulatorDefault
  const hostUri = Constants.expoConfig?.hostUri
  if (!hostUri) return emulatorDefault
  try {
    const hostname = new URL(`http://${hostUri}`).hostname
    return `http://${hostname}:8080/api/v1`
  } catch {
    return emulatorDefault
  }
}

function resolveApiUrl() {
  // An explicit build-time URL always wins. Preview and production APKs are
  // built with EXPO_PUBLIC_API_URL pointing at the public HTTPS API; Metro
  // host discovery is a development-only convenience.
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  // A release build with no explicit URL would silently fall back to the
  // emulator loopback alias, which no real device can reach. Say so loudly
  // rather than shipping a beta that fails every request.
  if (!__DEV__) {
    console.error(
      '[TBK] EXPO_PUBLIC_API_URL is not set in this release build. ' +
      'Requests will target ' + emulatorDefault + ', which is unreachable ' +
      'from a physical device. Rebuild with EXPO_PUBLIC_API_URL set to the ' +
      'public HTTPS API URL.'
    )
  }
  return developmentApiUrl()
}

export const API_URL = resolveApiUrl()
export const MEDIA_URL = API_URL.replace(/\/api\/v1\/?$/, '')
export const resolveMediaUrl = (value?: string) => !value ? undefined : value.startsWith('http') ? value : `${MEDIA_URL}${value.startsWith('/') ? '' : '/'}${value}`

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

let refreshPromise: Promise<boolean> | null = null

async function refreshSession() {
  const refreshToken = await tokenStore.getRefresh()
  if (!refreshToken) return false
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) { await tokenStore.clear(); return false }
  const envelope = await response.json()
  // Auth endpoints return the token object directly, while marketplace
  // endpoints use the standard { data } envelope.
  const data = envelope.data ?? envelope
  if (!data?.access_token || !data?.refresh_token) return false
  await tokenStore.set(data.access_token, data.refresh_token)
  return true
}

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = await tokenStore.getAccess()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  try { response = await fetch(`${API_URL}${path}`, { ...init, headers }) }
  catch { throw new ApiError(0, 'NETWORK_ERROR', 'Check your connection and try again.') }
  if (response.status === 401 && retry) {
    refreshPromise ??= refreshSession().finally(() => { refreshPromise = null })
    if (await refreshPromise) return request<T>(path, init, false)
  }
  if (!response.ok) {
    let code = 'REQUEST_FAILED'; let message = 'Something went wrong. Please try again.'
    try { const body = await response.json(); code = body?.error?.code || code; message = body?.error?.message || message } catch {}
    throw new ApiError(response.status, code, message)
  }
  const body = await response.json()
  return (body.data ?? body) as T
}

export const get = <T>(path: string) => request<T>(path)
export const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
export const postForm = <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body })
export const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
export const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })
