import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { File, UploadType } from 'expo-file-system'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { tokenStore } from './tokenStore'
import { fr } from '../locales/fr'
import { en } from '../locales/en'

/** Stored language flag (same key as src/store/i18n.tsx). */
const LANGUAGE_STORAGE_KEY = 'btmi.lang'

/** Resolves a dictionary key against the stored language (French by default),
 *  mirroring the i18n fallback. Used only for user-visible error fallbacks. */
async function localized(key: keyof typeof fr): Promise<string> {
  let lang: string | null = null
  try {
    lang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  } catch {
    /* unreadable storage: stay on French */
  }
  return (lang === 'en' ? en[key] : undefined) ?? fr[key] ?? key
}

const emulatorDefault = Platform.OS === 'android'
  ? 'http://10.0.2.2:8080/api/v1'
  : 'http://localhost:8080/api/v1'

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/

function developmentApiUrl() {
  if (!__DEV__) return emulatorDefault
  const hostUri = Constants.expoConfig?.hostUri
  if (!hostUri) return emulatorDefault
  try {
    const hostname = new URL(`http://${hostUri}`).hostname
    // LAN discovery only makes sense when Metro's host is a bare LAN IP. In
    // tunnel mode (`expo start --tunnel`, needed when the phone is on a VPN
    // that breaks LAN reachability) hostUri is a public ngrok/exp.direct
    // domain that does NOT also serve the backend on :8080 -- constructing
    // that URL would silently target an address that was never listening,
    // and every request would fail with an unhelpful generic error. Warn
    // once and fall back instead of guessing wrong.
    if (!IPV4_RE.test(hostname)) {
      console.warn(
        '[TBK] Metro is running in tunnel mode (host: ' + hostname + '). ' +
        'The backend API is not reachable through the Metro tunnel -- run ' +
        '`npm run tunnel:api` in a second terminal and set EXPO_PUBLIC_API_URL ' +
        'in android/.env to the printed https URL + /api/v1, then restart Expo.'
      )
      return emulatorDefault
    }
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

const REQUEST_TIMEOUT_MS = 10_000
const UPLOAD_TIMEOUT_MS = 60_000

export class ApiError extends Error {
  /** `detail` carries the raw underlying failure (an OkHttp message, an
   *  unreadable file path, an abort) for a transport error, whose `message` is
   *  a generic localized line. Diagnostics only -- never shown on its own. */
  constructor(public status: number, public code: string, message: string, public detail?: string) { super(message) }
}

let refreshPromise: Promise<boolean> | null = null
const sessionListeners = new Set<() => void>()

export function onSessionInvalidated(listener: () => void) {
  sessionListeners.add(listener)
  return () => { sessionListeners.delete(listener) }
}

async function invalidateSession() {
  await tokenStore.clear()
  sessionListeners.forEach((listener) => listener())
}

async function refreshSession() {
  const refreshToken = await tokenStore.getRefresh()
  if (!refreshToken) return false
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) { await invalidateSession(); return false }
  const envelope = await response.json()
  // Auth endpoints return the token object directly, while marketplace
  // endpoints use the standard { data } envelope.
  const data = envelope.data ?? envelope
  if (!data?.access_token || !data?.refresh_token) { await invalidateSession(); return false }
  await tokenStore.set(data.access_token, data.refresh_token)
  return true
}

export async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const token = await tokenStore.getAccess()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let response: Response
  const controller = new AbortController()
  // A photo upload over a mobile connection routinely needs more than the
  // ten seconds a JSON call gets; aborting it surfaced as a generic network
  // failure with no request ever reaching the API.
  const timeout = setTimeout(() => controller.abort(), init.body instanceof FormData ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS)
  try {
    response = await fetch(`${API_URL}${path}`, { cache: 'no-store', ...init, headers, signal: controller.signal })
  } catch (cause) {
    throw new ApiError(0, 'NETWORK_ERROR', await localized('errors.network'), describeCause(cause))
  } finally {
    clearTimeout(timeout)
  }
  if (response.status === 401 && retry) {
    refreshPromise ??= refreshSession().finally(() => { refreshPromise = null })
    if (await refreshPromise) return request<T>(path, init, false)
  }
  if (!response.ok) {
    let code = 'REQUEST_FAILED'; let message = await localized('errors.generic')
    try { const body = await response.json(); code = body?.error?.code || code; message = body?.error?.message || message } catch {}
    throw new ApiError(response.status, code, await friendlyMessage(code, message))
  }
  const body = await response.json()
  return (body.data ?? body) as T
}

/** Rewrites the error codes whose raw API message is a machine string into a
 *  sentence a seller can act on. Mirrors the same mapping in the web client so
 *  a rejected publish reads identically on both platforms. */
async function friendlyMessage(code: string, message: string): Promise<string> {
  if (code !== 'MISSING_REQUIRED_ATTRIBUTES') return message
  // The API appends the missing names after the code: "MISSING_REQUIRED_ATTRIBUTES: Color, Size".
  const names = message.replace(/^MISSING_REQUIRED_ATTRIBUTES:\s*/, '').trim()
  if (!names || names === message) return await localized('errors.missingAttributesGeneric')
  return (await localized('errors.missingAttributes')).replace('{names}', names)
}

function describeCause(cause: unknown) {
  if (cause instanceof Error) return cause.name === 'AbortError' ? 'TIMEOUT' : `${cause.name}: ${cause.message}`
  return String(cause)
}

/** Parses the API envelope of a response body already read as text. */
async function unwrap<T>(status: number, text: string): Promise<T> {
  let body: { data?: unknown; error?: { code?: string; message?: string } }
  try { body = JSON.parse(text) } catch {
    throw new ApiError(status, 'REQUEST_FAILED', await localized('errors.generic'), `non-JSON body: ${text.slice(0, 200)}`)
  }
  if (status < 200 || status >= 300) {
    throw new ApiError(status, body?.error?.code || 'REQUEST_FAILED', body?.error?.message || await localized('errors.generic'))
  }
  return (body.data ?? body) as T
}

/** Uploads one picked photo as multipart/form-data through the native
 *  uploader instead of `fetch` + `FormData`.
 *
 *  React Native streams a FormData file part from an InputStream of unknown
 *  length, so the body goes out with `Transfer-Encoding: chunked` and no
 *  `Content-Length`, and a failure anywhere in that path collapses into a bare
 *  `0 NETWORK_ERROR` -- which is all the production avatar upload ever
 *  reported, with no matching request in the API log. This path instead reads
 *  the file natively, sends a measured `Content-Length`, and resolves with the
 *  real status and body even for a 4xx, so a rejected image says why rather
 *  than looking like a dead connection.
 *
 *  Note that the multipart `filename` is the name of the file on disk -- the
 *  native uploader has no way to override it -- so the caller controls it by
 *  choosing where it writes the temporary copy. */
export async function uploadFile<T>(
  path: string,
  file: { uri: string; type: string },
  options: { fieldName?: string; parameters?: Record<string, string> } = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = await tokenStore.getAccess()
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  let result: { status: number; body: string }
  try {
    result = await new File(file.uri).upload(`${API_URL}${path}`, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: options.fieldName ?? 'file',
      mimeType: file.type,
      parameters: options.parameters,
      headers,
      signal: controller.signal,
    })
  } catch (cause) {
    throw new ApiError(0, 'NETWORK_ERROR', await localized('errors.network'), describeCause(cause))
  } finally {
    clearTimeout(timeout)
  }

  if (result.status === 401 && retry) {
    refreshPromise ??= refreshSession().finally(() => { refreshPromise = null })
    if (await refreshPromise) return uploadFile<T>(path, file, options, false)
  }
  return unwrap<T>(result.status, result.body)
}

export const get = <T>(path: string) => request<T>(path)
export const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
export const postForm = <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body })
export const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })
export const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })
