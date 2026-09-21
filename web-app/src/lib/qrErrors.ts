import { ApiError } from '@/api/types'
import type { TranslationKey } from '@/locales/fr'

/**
 * Maps a failed ORDER_ITEM QR request to the message the user reads.
 *
 * The backend answers with a code, not prose: QR_INVALID (422) covers both a
 * forged signature and a token of the wrong kind — parse() is kind-bound, so a
 * package token posted to /qr/resolve lands here rather than resolving into
 * someone else's order. QR_FORBIDDEN (403) is the outsider case.
 */
export function orderItemQRErrorKey(error: unknown, opts: { scanned?: boolean } = {}): TranslationKey {
  const code = error instanceof ApiError ? error.code : ''
  switch (code) {
    case 'QR_INVALID':
      // A scanned code that does not validate is, from the scanner's point of
      // view, "not an order-item QR"; a code we fetched ourselves is just bad.
      return opts.scanned ? 'itemQr.error.wrongKind' : 'itemQr.error.invalid'
    case 'QR_FORBIDDEN':
    case 'QR_WRONG_COURIER':
    case 'FORBIDDEN':
      return 'itemQr.error.forbidden'
    case 'QR_NOT_READY':
    case 'NOT_FOUND':
      return 'itemQr.error.notFound'
    case 'NETWORK_ERROR':
    case 'REQUEST_TIMEOUT':
      return 'itemQr.error.network'
    default:
      return 'itemQr.error.generic'
  }
}
