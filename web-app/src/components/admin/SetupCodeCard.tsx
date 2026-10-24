import { useCallback, useEffect, useState } from 'react'
import { adminUsersApi } from '@/api/admin'
import { useT } from '@/store/i18n'
import { dateLocale } from '@/lib/format'

type Status = {
  issued: boolean
  issued_at?: string
  expires_at?: string
  from_server: boolean
  setup_is_open: boolean
}

/**
 * Issues the one-time code a new owner needs to claim the super admin account.
 * The code is shown once, right after it is generated: the server only keeps
 * its hash, so it cannot be read back here or anywhere else.
 */
export function SetupCodeCard() {
  const t = useT()
  const [status, setStatus] = useState<Status | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState<'issue' | 'revoke' | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await adminUsersApi.setupCodeStatus())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const issue = async () => {
    setBusy('issue')
    setError(null)
    setCopied(false)
    try {
      const res = await adminUsersApi.issueSetupCode()
      setCode(res.code)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const revoke = async () => {
    setBusy('revoke')
    setError(null)
    try {
      await adminUsersApi.revokeSetupCode()
      setCode(null)
      setConfirmingRevoke(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard refused (no permission, insecure origin): the code is on
      // screen anyway, so there is nothing to recover from.
    }
  }

  const until = (iso?: string) => iso ? new Date(iso).toLocaleString(dateLocale()) : ''

  return (
    <section style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 20, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true">🗝️</span> {t('admin.setupCode.title')}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            {t('admin.setupCode.intro')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            id="issue-setup-code-btn"
            onClick={() => void issue()}
            disabled={busy !== ''}
            style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy === 'issue' ? t('admin.setupCode.generating') : status?.issued ? t('admin.setupCode.regenerate') : t('admin.setupCode.generate')}
          </button>
          {status?.issued && (
            <button
              onClick={() => setConfirmingRevoke(true)}
              disabled={busy !== ''}
              style={{ backgroundColor: 'transparent', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              {t('admin.setupCode.revoke')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" style={{ marginTop: 14, backgroundColor: '#450a0a', border: '1px solid #991b1b', borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}

      {code && (
        <div style={{ marginTop: 16, backgroundColor: '#064e3b', border: '1px solid #10b981', borderRadius: 10, padding: 16 }}>
          <p style={{ margin: '0 0 10px', color: '#a7f3d0', fontSize: 12, fontWeight: 700 }}>{t('admin.setupCode.shownOnce')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <code style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.08em', color: '#ffffff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{code}</code>
            <button
              onClick={() => void copy()}
              style={{ backgroundColor: '#065f46', color: '#d1fae5', border: '1px solid #10b981', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {copied ? t('admin.setupCode.copied') : t('admin.setupCode.copy')}
            </button>
          </div>
          <p style={{ margin: '10px 0 0', color: '#a7f3d0', fontSize: 12, lineHeight: 1.5 }}>{t('admin.setupCode.handOver')}</p>
        </div>
      )}

      <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
        {status === null
          ? t('admin.setupCode.loading')
          : status.issued
            ? t('admin.setupCode.live', { expires: until(status.expires_at) })
            : status.from_server
              ? t('admin.setupCode.fromServer')
              : t('admin.setupCode.none')}
      </p>

      {confirmingRevoke && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}>
          <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 22, maxWidth: 420, width: '100%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{t('admin.setupCode.revokeTitle')}</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{t('admin.setupCode.revokeBody')}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmingRevoke(false)} style={{ backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={() => void revoke()} disabled={busy !== ''} style={{ backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer' }}>
                {t('admin.setupCode.revoke')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
