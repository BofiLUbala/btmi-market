import { useEffect, useState, type FormEvent } from 'react'
import { authApi } from '@/api/auth'
import { ApiError, type VerificationChannel, type WhatsAppChallenge } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { ErrorBox } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'
import { useCooldown } from './AuthFormParts'

let statusPromise: Promise<boolean> | null = null

/** Whether the server offers WhatsApp codes (an OpenWA gateway is configured). */
export function useWhatsAppEnabled() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let alive = true
    statusPromise ??= authApi.whatsappStatus().then((r) => !!r?.enabled).catch(() => {
      statusPromise = null
      return false
    })
    void statusPromise.then((v) => alive && setEnabled(v))
    return () => { alive = false }
  }, [])
  return enabled
}

/** "E-mail | WhatsApp" switch shown above the sign-in and sign-up forms. */
export function ChannelSwitch({
  value,
  onChange,
  label,
}: {
  value: VerificationChannel
  onChange: (value: VerificationChannel) => void
  label?: string
}) {
  const t = useT()
  return (
    <div className="auth-channel">
      {label && <span className="auth-channel-label small muted">{label}</span>}
      <div className="auth-channel-switch" role="radiogroup" aria-label={label ?? t('auth.whatsapp.channelLabel')}>
        {(['email', 'whatsapp'] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            className={value === c ? 'is-selected' : ''}
            onClick={() => onChange(c)}
            data-testid={`channel-${c}`}
          >
            {c === 'email' ? t('common.email') : 'WhatsApp'}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Message for the error codes of the WhatsApp endpoints. */
export function whatsappErrorMessage(err: unknown, t: ReturnType<typeof useT>): string {
  if (!(err instanceof ApiError)) return t('auth.login.failed')
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return t('auth.whatsapp.invalidCredentials')
    case 'OTP_INCORRECT':
      return t('auth.whatsapp.codeIncorrect')
    case 'OTP_EXPIRED':
    case 'OTP_INVALID':
      return t('auth.whatsapp.codeExpired')
    case 'OTP_ALREADY_USED':
      return t('auth.whatsapp.codeUsed')
    case 'OTP_TOO_MANY_ATTEMPTS':
      return t('auth.whatsapp.tooManyAttempts')
    case 'OTP_RESEND_TOO_SOON':
    case 'RATE_LIMITED':
      return t('auth.whatsapp.rateLimited')
    case 'WHATSAPP_UNAVAILABLE':
      return t('auth.whatsapp.unavailable')
    case 'WHATSAPP_DELIVERY_FAILED':
      return t('auth.whatsapp.deliveryFailed')
    case 'ACCOUNT_SUSPENDED':
      return t('auth.whatsapp.suspended')
  }
  return err.message
}

/** The challenge carried by a 502 WHATSAPP_DELIVERY_FAILED (the code can be resent). */
export function challengeFromError(err: unknown): WhatsAppChallenge | null {
  if (err instanceof ApiError && err.code === 'WHATSAPP_DELIVERY_FAILED' && typeof err.data?.challenge_id === 'string') {
    return err.data as unknown as WhatsAppChallenge
  }
  return null
}

/**
 * Six-digit code entry for a WhatsApp challenge, with a resend button.
 * `onVerify` receives the code and opens the session (throws on a bad code).
 */
export function WhatsAppCodeForm({
  challenge,
  onVerify,
  onBack,
  initialError = '',
}: {
  challenge: WhatsAppChallenge
  onVerify: (challengeId: string, code: string) => Promise<unknown>
  onBack?: () => void
  initialError?: string
}) {
  const t = useT()
  const [current, setCurrent] = useState(challenge)
  const [code, setCode] = useState('')
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState(false)
  const cooldown = useCooldown(45, !initialError)

  useEffect(() => setCurrent(challenge), [challenge])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onVerify(current.challenge_id, code.trim())
    } catch (err) {
      setError(whatsappErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setError('')
    setResent(false)
    try {
      const next = await authApi.whatsappResend(current.challenge_id)
      setCurrent(next)
      setCode('')
      setResent(true)
      cooldown.start()
    } catch (err) {
      const pending = challengeFromError(err)
      if (pending) setCurrent(pending)
      setError(whatsappErrorMessage(err, t))
    }
  }

  return (
    <form className="stack whatsapp-code-form" style={{ gap: '0.85rem' }} onSubmit={submit}>
      <div className="whatsapp-code-head">
        <span className="whatsapp-code-icon" aria-hidden>✆</span>
        <div>
          <strong>{t('auth.whatsapp.codeTitle')}</strong>
          <p className="small muted">{t('auth.whatsapp.codeSentTo', { phone: current.phone_masked })}</p>
        </div>
      </div>
      {error && <ErrorBox error={error} />}
      <Field
        label={t('auth.whatsapp.codeLabel')}
        name="otp"
        required
        autoFocus
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        className="whatsapp-code-input"
        hint={t('auth.whatsapp.codeValidity', { minutes: Math.round(current.expires_in / 60) })}
      />
      <Button type="submit" block size="lg" loading={busy} disabled={code.length !== 6}>
        {t('auth.whatsapp.verify')}
      </Button>
      <div className="auth-resend">
        <p className="small muted">{t('auth.whatsapp.notReceived')}</p>
        <Button type="button" variant="outline" block disabled={cooldown.left > 0} onClick={() => void resend()}>
          {cooldown.left > 0 ? t('auth.resend.waitSeconds', { seconds: cooldown.left }) : t('auth.whatsapp.resend')}
        </Button>
        {resent && <p className="small success-text" role="status">✓ {t('auth.whatsapp.resent')}</p>}
      </div>
      {onBack && (
        <button type="button" className="section-link small whatsapp-code-back" onClick={onBack}>
          ← {t('auth.whatsapp.back')}
        </button>
      )}
    </form>
  )
}
