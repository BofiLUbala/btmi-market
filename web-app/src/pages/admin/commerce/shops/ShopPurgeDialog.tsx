import { useEffect, useState } from 'react'
import { adminCommerceApi } from '@/api/admin'
import type { ShopPurgePreview } from '@/api/types'
import { useT } from '@/store/i18n'

const CONFIRM_WORD = 'SUPPRIMER'

/** Permanent deletion of one or more shops: loads the real counts, then
 *  requires the operator to type SUPPRIMER before calling the server. */
export function ShopPurgeDialog({ shopIds, onClose, onDone }: {
  shopIds: string[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const t = useT()
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
      .catch((err) => { if (alive) setLoadError(err instanceof Error ? err.message : t('adminCommerceShopsShopPurgeDialog.errPreview')) })
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
      const kept = r.history_kept_shops > 0 ? ` ${t('adminCommerceShopsShopPurgeDialog.historyKept', { count: r.history_kept_shops })}` : ''
      onDone(`${t('adminCommerceShopsShopPurgeDialog.done', { shops: r.deleted_shops, products: r.deleted_products, images: r.deleted_images })}${kept}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('adminCommerceShopsShopPurgeDialog.errPurge'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('adminCommerceShopsShopPurgeDialog.ariaTitle')}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.7)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: 12, padding: 20, width: 'min(520px, 100%)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{t('adminCommerceShopsShopPurgeDialog.title', { count: shopIds.length })}</h3>

        {loadError ? (
          <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{loadError}</p>
        ) : !preview ? (
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>{t('adminCommerceShopsShopPurgeDialog.computing')}</p>
        ) : (
          <>
            <p style={{ fontSize: 14 }}>
              <strong>{t('adminCommerceShopsShopPurgeDialog.shopsCount', { count: preview.shop_count })}</strong> {t('adminCommerceShopsShopPurgeDialog.and')} <strong>{t('adminCommerceShopsShopPurgeDialog.productsCount', { count: preview.product_count })}</strong> {t('adminCommerceShopsShopPurgeDialog.summaryRest', { images: preview.image_count })}
            </p>
            <ul style={{ fontSize: 13, color: 'var(--admin-text-muted)', paddingLeft: 18, margin: '0 0 10px' }}>
              {preview.shops.map((s) => (
                <li key={s.id}>
                  {s.name} · {s.business_name} · {t('adminCommerceShopsShopPurgeDialog.productsCount', { count: s.product_count })}
                  {s.open_order_count > 0 && <span style={{ color: '#f87171' }}> · {t('adminCommerceShopsShopPurgeDialog.openOrders', { count: s.open_order_count })}</span>}
                  {s.keeps_history && ` · ${t('adminCommerceShopsShopPurgeDialog.historyKeptShort')}`}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 12, color: 'var(--admin-text-muted)' }}>
              {t('adminCommerceShopsShopPurgeDialog.keptNote')}
            </p>
            <p role="note" style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{t('adminCommerceShopsShopPurgeDialog.irreversible')}</p>

            {blocked ? (
              <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
                {t('adminCommerceShopsShopPurgeDialog.blocked', { shops: preview.blocked_shops.join(', ') })}
              </p>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }} htmlFor="purge-confirm">
                  {t('adminCommerceShopsShopPurgeDialog.typeBefore')} <strong>{CONFIRM_WORD}</strong> {t('adminCommerceShopsShopPurgeDialog.typeAfter')}
                </label>
                <input id="purge-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_WORD}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)', marginBottom: 10 }} />
                <textarea aria-label={t('adminCommerceShopsShopPurgeDialog.reasonLabel')} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t('adminCommerceShopsShopPurgeDialog.reasonPlaceholder')}
                  style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--admin-border)', background: 'var(--admin-surface-2)', color: 'var(--admin-text)' }} />
              </>
            )}
          </>
        )}

        {error && <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="admin-button" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
          <button className="admin-button admin-button-danger" onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? t('adminCommerceShopsShopPurgeDialog.deleting') : t('adminCommerceShopsShopPurgeDialog.deletePermanently')}
          </button>
        </div>
      </div>
    </div>
  )
}
