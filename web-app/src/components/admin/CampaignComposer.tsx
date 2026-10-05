import { useState, type FormEvent } from 'react'
import { adminApi } from '@/api/admin'
import { useT } from '@/store/i18n'

/**
 * Sends a marketing notification to buyers who explicitly opted in. The
 * server checks consent and the frequency caps for each buyer again, so the
 * number shown is an upper bound.
 */
export default function CampaignComposer() {
  const t = useT()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const payload = () => JSON.stringify({ title, body, target_path: target })

  async function preview() {
    setError(''); setMessage('')
    try {
      const res = await adminApi<{ recipients: number }>('/admin/commerce/notifications/campaigns', {
        method: 'POST', body: JSON.stringify({ title: title || 'Aperçu', body: body || 'Aperçu du message', target_path: target, dry_run: true })
      })
      setMessage(t('adminCampaignComposer.previewResult', { count: res.recipients }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!window.confirm(t('adminCampaignComposer.confirmSend'))) return
    setBusy(true); setError(''); setMessage('')
    try {
      const res = await adminApi<{ recipients: number }>('/admin/commerce/notifications/campaigns', { method: 'POST', body: payload() })
      setMessage(t('adminCampaignComposer.sent', { count: res.recipients }))
      setTitle(''); setBody(''); setTarget('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const input = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', fontSize: 13 } as const

  return (
    <form onSubmit={send} style={{ border: '1px solid #334155', borderRadius: 10, padding: 16, marginBottom: 20, display: 'grid', gap: 10 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('adminCampaignComposer.title')}</h3>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 12 }}>
          {t('adminCampaignComposer.intro')}
        </p>
      </div>
      <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('adminCampaignComposer.titlePlaceholder')} maxLength={80} required minLength={3} />
      <textarea style={{ ...input, minHeight: 70 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('adminCampaignComposer.bodyPlaceholder')} maxLength={240} required minLength={5} />
      <input style={input} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t('adminCampaignComposer.targetPlaceholder')} />
      {error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>}
      {message && <div style={{ color: '#a7f3d0', fontSize: 12 }}>{message}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => void preview()} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>
          {t('adminCampaignComposer.countRecipients')}
        </button>
        <button type="submit" disabled={busy} style={{ padding: '8px 12px', borderRadius: 8, border: 0, background: '#0ea5e9', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {busy ? t('adminCampaignComposer.sending') : t('adminCampaignComposer.send')}
        </button>
      </div>
    </form>
  )
}
