import { useState } from 'react'
import { adminQrApi } from '@/api/qr'
import type { OrderItemQRResolution } from '@/api/types'
import { formatMoney } from '@/lib/format'

/**
 * Admin console tool: resolve a scanned ORDER_ITEM token.
 *
 * It posts to POST /admin/qr/resolve, not the platform-user /qr/resolve — the
 * admin route carries its own privileges and returns the full operational
 * context, so the two are not interchangeable. The token is opaque here as
 * everywhere: it is sent verbatim and never parsed or logged.
 */
export function AdminOrderItemQRResolver() {
  const [token, setToken] = useState('')
  const [state, setState] = useState<'idle' | 'resolving' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<OrderItemQRResolution | null>(null)
  const [message, setMessage] = useState('')

  async function resolve() {
    const value = token.trim()
    if (!value || state === 'resolving') return
    setState('resolving')
    setMessage('')
    try {
      const resolution = await adminQrApi.resolve(value)
      setResult(resolution)
      setState('done')
    } catch (error) {
      const code = (error as { code?: string })?.code
      setMessage(
        code === 'QR_INVALID'
          ? 'Ce QR ne correspond pas à un article de commande.'
          : code === 'QR_FORBIDDEN'
            ? 'Résolution refusée pour ce compte.'
            : code === 'QR_NOT_READY'
              ? 'Article ou commande introuvable.'
              : 'Résolution impossible.'
      )
      setResult(null)
      setState('error')
    }
  }

  const price = result?.price
  const label = { fontSize: 11, color: '#64748b', fontWeight: 600 as const, textTransform: 'uppercase' as const }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Collez le jeton QR (tbk.oi.…)"
          autoComplete="off"
          spellCheck={false}
          style={{ flex: '1 1 260px', minHeight: 38, borderRadius: 6, border: '1px solid #1e293b', backgroundColor: '#0b1220', color: '#f8fafc', padding: '0 10px' }}
        />
        <button
          onClick={() => void resolve()}
          disabled={!token.trim() || state === 'resolving'}
          style={{ minHeight: 38, padding: '0 16px', borderRadius: 6, border: '1px solid #1e293b', backgroundColor: '#1e293b', color: '#f8fafc', fontWeight: 700, cursor: 'pointer' }}
        >
          {state === 'resolving' ? 'Résolution…' : 'Résoudre'}
        </button>
      </div>

      {state === 'idle' && <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 10 }}>Aucun résultat. Collez un jeton d’article.</div>}
      {state === 'error' && <div style={{ fontSize: 13, color: '#f87171', marginTop: 10 }} role="alert">{message}</div>}

      {state === 'done' && result && (
        <div style={{ marginTop: 12, display: 'grid', gap: 6, fontSize: 14, color: '#f8fafc' }}>
          <div><span style={label}>Rôle résolu</span> · {result.role}</div>
          <div><span style={label}>Référence</span> · {result.qr.reference} ({result.qr.status})</div>
          <div><span style={label}>Article</span> · {result.product.product_name} {result.product.variant_name ? `— ${result.product.variant_name}` : ''} × {result.product.quantity}</div>
          <div><span style={label}>Commande</span> · {result.order.order_number} · {result.order.order_status}{result.order.delivery_status ? ` · ${result.order.delivery_status}` : ''}</div>
          <div><span style={label}>Boutique</span> · {result.shop.shop_name}{result.shop.seller_name ? ` · ${result.shop.seller_name}` : ''}</div>
          {price && (
            <div>
              <span style={label}>Montants</span> · {formatMoney(price.item_total, price.currency)} (article) · {formatMoney(price.final_amount, price.currency)} (commande)
              {price.amount_to_collect
                ? ` · à encaisser ${formatMoney(price.amount_to_collect, price.currency)}`
                : ' · rien à encaisser'}
            </div>
          )}
          {result.buyer && (
            <div><span style={label}>Acheteur</span> · {[result.buyer.display_name, result.buyer.phone, result.buyer.email].filter(Boolean).join(' · ') || '—'}</div>
          )}
          {result.delivery_address && (
            <div>
              <span style={label}>Livraison</span> · {[result.delivery_address.recipient_name, result.delivery_address.street, result.delivery_address.commune, result.delivery_address.city, result.delivery_address.province].filter(Boolean).join(', ') || '—'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
