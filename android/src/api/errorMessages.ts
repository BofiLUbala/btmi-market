import { getLang, hasTranslation, translate, type TranslationKey } from '../store/i18n'

/**
 * Turns an API error into a sentence in the language the user picked.
 *
 * Same logic as web-app/src/api/errorMessages.ts — keep the two in sync.
 *
 * The backend answers with a stable `code` plus a `message` that is usually
 * English (a few handlers write French). The code is what we translate: every
 * code the backend can send has an `apiError.<CODE>` entry in the locales.
 *
 * Generic codes (VALIDATION_ERROR, FORBIDDEN, *_FAILED wrapping err.Error()…)
 * carry a more precise message than their code, so when that message is
 * already in the user's language it is kept as is.
 */

const GENERIC_CODES = new Set([
  'VALIDATION_ERROR', 'INVALID_REQUEST', 'INVALID_INPUT', 'INVALID_BODY', 'INVALID_QUERY', 'INVALID_ID',
  'INVALID_LOCATION', 'FORBIDDEN', 'NOT_FOUND', 'UNAUTHORIZED', 'INTERNAL_ERROR', 'FEATURE_DISABLED',
  'RATE_LIMITED', 'NOT_IMPLEMENTED', 'DELIVERY_FEE_ERROR', 'REQUEST_FAILED',
])

const FRENCH_HINT = /[àâçéèêëîïôûùœ]|\b(le|la|les|des|du|une|est|pas|vous|votre|veuillez|impossible|introuvable)\b/i

function messageLang(message: string): 'fr' | 'en' {
  return FRENCH_HINT.test(message) ? 'fr' : 'en'
}

function isGeneric(code: string): boolean {
  return GENERIC_CODES.has(code) || code.endsWith('_FAILED') || code.endsWith('_ERROR')
}

function statusFallback(status: number, lang: 'fr' | 'en'): string {
  if (status === 0) return translate('apiError.status.network', undefined, lang)
  if (status === 400 || status === 422) return translate('apiError.status.400', undefined, lang)
  if (status === 401 || status === 403 || status === 404 || status === 409 || status === 429) {
    return translate(`apiError.status.${status}` as TranslationKey, undefined, lang)
  }
  if (status >= 500) return translate('apiError.status.500', undefined, lang)
  return translate('apiError.status.other', { status }, lang)
}

export function localizeApiError(status: number, code: string, message?: string | null, lang: 'fr' | 'en' = getLang()): string {
  const raw = (message ?? '').trim()
  const rawIsCode = /^[A-Z][A-Z0-9_]+$/.test(raw)

  if (raw && !rawIsCode && isGeneric(code) && messageLang(raw) === lang) return raw
  // Some services return their code as the message (errors.New("QR_INVALID")),
  // often under a generic code: the precise one wins.
  const rawKey = `apiError.${raw}`
  if (rawIsCode && hasTranslation(rawKey)) return translate(rawKey, undefined, lang)
  const codeKey = `apiError.${code}`
  if (hasTranslation(codeKey)) return translate(codeKey, undefined, lang)
  if (raw && !rawIsCode && messageLang(raw) === lang) return raw
  return statusFallback(status, lang)
}
