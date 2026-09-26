import { useState } from 'react'
import { adminCommerceApi } from '@/api/admin'

export type EntityStatusTarget = {
  kind: 'BUSINESS' | 'SHOP'
  id: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED'
}

/** Confirms a suspend/reactivate with the mandatory audited reason. */
export function EntityStatusDialog({ target, onClose, onDone }: {
  target: EntityStatusTarget
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspending = target.status !== 'ACTIVE'
  const label = target.kind === 'BUSINESS' ? 'l’entreprise' : 'la boutique'

  const submit = async () => {
    if (reason.trim().length < 5) { setError('Motif obligatoire (5 caractères minimum).'); return }
    setBusy(true)
    setError(null)
    try {
      if (target.kind === 'BUSINESS') await adminCommerceApi.setBusinessStatus(target.id, target.status, reason.trim())
      else await adminCommerceApi.setShopStatus(target.id, target.status, reason.trim())
      onDone(`${target.name} : ${suspending ? 'suspendu(e)' : 'réactivé(e)'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${suspending ? 'Suspendre' : 'Réactiver'} ${target.name}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.7)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: 12, padding: 20, width: 'min(460px, 100%)' }}>
        <h3 style={{ marginTop: 0 }}>{suspending ? 'Suspendre' : 'Réactiver'} {label} « {target.name} »</h3>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>
          {suspending
            ? `Tant que ${label} est suspendu(e), ${target.kind === 'BUSINESS' ? 'ses boutiques et ses produits sont masqués' : 'elle est masquée'} de la marketplace. L’action est journalisée.`
            : `${label[0].toUpperCase()}${label.slice(1)} redevient visible sur la marketplace. L’action est journalisée.`}
        </p>
        <textarea aria-label="Motif" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Motif (obligatoire)"
          style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)' }} />
        {error && <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="admin-button" onClick={onClose} disabled={busy}>Annuler</button>
          <button className={`admin-button ${suspending ? 'admin-button-danger' : 'admin-button-primary'}`} onClick={() => void submit()} disabled={busy}>
            {busy ? '…' : suspending ? 'Suspendre' : 'Réactiver'}
          </button>
        </div>
      </div>
    </div>
  )
}
