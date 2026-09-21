import { post } from './client'
import { adminApi } from './admin'
import type { OrderItemQRResolution } from './types'

/**
 * ORDER_ITEM QR resolution for authenticated platform users (buyer, seller,
 * courier).
 *
 * The token is opaque: it is posted exactly as scanned and never parsed, decoded
 * or inspected client-side. The backend validates the signature, identifies the
 * caller from their session, derives their role against the order and returns
 * only the fields that role may see. There is deliberately no client-side role
 * masking — what arrives is what may be shown.
 */
export const qrApi = {
  resolve: (token: string) => post<OrderItemQRResolution>('/qr/resolve', { token }),
}

/**
 * Admin console resolution. A separate route with its own privileges: it returns
 * the full operational context, so it must not be swapped for `qrApi.resolve`.
 */
export const adminQrApi = {
  resolve: (token: string) =>
    adminApi<OrderItemQRResolution>('/admin/qr/resolve', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
}
