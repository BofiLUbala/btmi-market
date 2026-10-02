import { useEffect, useState } from 'react'
import { adminCommerceApi } from '@/api/admin'
import type { ShopPurgePreview } from '@/api/types'

const CONFIRM_WORD = 'SUPPRIMER'

/** Permanent deletion of one or more shops: loads the real counts, then
 *  requires the operator to type SUPPRIMER before calling the server. */
export function ShopPurgeDialog({ shopIds, onClose, onDone }: {
  shopIds: string[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [preview, setPreview] = useState<ShopPurgePreview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    adminCommerceApi.previewShopPurge(shopIds)
      .then((p) => { if (alive) setPreview(p) })
      .catch((err) => { if (alive) setLoadError(err instanceof Error ? err.message : 'Préparation impossible') })
    return () => { alive = false }
  }, [shopIds])

  const blocked = (preview?.blocked_shops.length ?? 0) > 0
  const canSubmit = !!preview && !blocked && typed.trim() === CONFIRM_WORD && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const r = await adminCommerceApi.purgeShops(shopIds, typed.trim(), reason.trim())
      const kept = r.history_kept_shops > 0 ? ` L’historique des commandes de ${r.history_kept_shops} boutique(s) est conservé.` : ''
      onDone(`${r.deleted_shops} boutique(s), ${r.deleted_products} produit(s) et ${r.deleted_images} image(s) supprimés définitivement.${kept}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La suppression a échoué. Rien n’a été supprimé.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Supprimer définitivement les boutiques"
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.7)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: 12, padding: 20, width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Supprimer définitivement {shopIds.length} boutique(s)</h3>

        {loadError ? (
          <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{loadError}</p>
        ) : !preview ? (
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>Calcul des éléments concernés…</p>
        ) : (
          <>
            <p style={{ fontSize: 14 }}>
              <strong>{preview.shop_count} boutique(s)</strong> et <strong>{preview.product_count} produit(s)</strong> ({preview.image_count} image(s)) seront supprimés et disparaîtront immédiatement de la marketplace, de la recherche et du stockage.
            </p>
            <ul style={{ fontSize: 13, color: 'var(--admin-text-muted)', paddingLeft: 18, margin: '0 0 10px' }}>
              {preview.shops.map((s) => (
                <li key={s.id}>
                  {s.name} · {s.business_name} · {s.product_count} produit(s)
                  {s.open_order_count > 0 && <span style={{ color: '#f87171' }}> · {s.open_order_count} commande(s) en cours</span>}
                  {s.keeps_history && ' · historique des commandes conservé'}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
              Les produits encore vendus par une autre boutique de la même entreprise sont conservés pour celle-ci. Les commandes passées, paiements et commissions restent consultables (obligations légales).
            </p>
            <p role="note" style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>Cette action est irréversible.</p>

            {blocked ? (
              <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
                Suppression impossible : des commandes sont en cours dans {preview.blocked_shops.join(', ')}. Terminez-les ou annulez-les d’abord.
              </p>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }} htmlFor="purge-confirm">
                  Saisissez <strong>{CONFIRM_WORD}</strong> pour confirmer
                </label>
                <input id="purge-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_WORD}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)', marginBottom: 10 }} />
                <textarea aria-label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Motif (facultatif, journalisé)"
                  style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)' }} />
              </>
            )}
          </>
        )}

        {error && <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="admin-button" onClick={onClose} disabled={busy}>Annuler</button>
          <button className="admin-button admin-button-danger" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}
