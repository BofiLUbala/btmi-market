import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/types'
import { orderItemQRErrorKey } from './qrErrors'

describe('orderItemQRErrorKey', () => {
  it('reads QR_INVALID as a wrong-kind code when the token was scanned', () => {
    // parse() is kind-bound server-side: a package token posted to the item
    // resolver comes back QR_INVALID rather than resolving into another flow.
    const error = new ApiError(422, 'QR_INVALID', 'QR INVALID')
    expect(orderItemQRErrorKey(error, { scanned: true })).toBe('itemQr.error.wrongKind')
    expect(orderItemQRErrorKey(error)).toBe('itemQr.error.invalid')
  })

  it('maps the outsider case to the permission message', () => {
    expect(orderItemQRErrorKey(new ApiError(403, 'QR_FORBIDDEN', 'QR FORBIDDEN'))).toBe('itemQr.error.forbidden')
    expect(orderItemQRErrorKey(new ApiError(403, 'FORBIDDEN', 'forbidden'))).toBe('itemQr.error.forbidden')
  })

  it('separates a missing item from a transport failure', () => {
    expect(orderItemQRErrorKey(new ApiError(404, 'QR_NOT_READY', 'QR NOT READY'))).toBe('itemQr.error.notFound')
    expect(orderItemQRErrorKey(new ApiError(0, 'NETWORK_ERROR', 'offline'))).toBe('itemQr.error.network')
    expect(orderItemQRErrorKey(new ApiError(0, 'REQUEST_TIMEOUT', 'slow'))).toBe('itemQr.error.network')
  })

  it('falls back for anything it does not recognise', () => {
    expect(orderItemQRErrorKey(new ApiError(500, 'BOOM', 'boom'))).toBe('itemQr.error.generic')
    expect(orderItemQRErrorKey(new Error('not an ApiError'))).toBe('itemQr.error.generic')
    expect(orderItemQRErrorKey(undefined)).toBe('itemQr.error.generic')
  })
})
