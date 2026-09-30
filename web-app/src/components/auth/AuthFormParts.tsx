import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/store/i18n'
import { getRememberedEmail, rememberLogin, type LoginSpace } from '@/lib/rememberedLogin'

/** "Se souvenir de moi" checkbox shared by every sign-in form. */
export function RememberMe({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const t = useT()
  return (
    <label className="auth-remember">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {t('auth.login.rememberMe')}
        <small>{t('auth.login.rememberMeHint')}</small>
      </span>
    </label>
  )
}

/**
 * Caps Lock detection for password fields: attach `onKeyUp` / `onKeyDown` to
 * the input and show `<CapsLockHint on={capsLock} />` under it.
 */
export function useCapsLock() {
  const [capsLock, setCapsLock] = useState(false)
  const onKey = useCallback((e: KeyboardEvent<Element>) => {
    setCapsLock(typeof e.getModifierState === 'function' && e.getModifierState('CapsLock'))
  }, [])
  return { capsLock, onKeyUp: onKey, onKeyDown: onKey }
}

export function CapsLockHint({ on }: { on: boolean }) {
  const t = useT()
  if (!on) return null
  return <p className="auth-capslock" role="status">⇪ {t('auth.login.capsLockOn')}</p>
}

/** Seconds left before an action may run again; `start()` arms it. */
export function useCooldown(seconds: number, startRunning = false) {
  const [left, setLeft] = useState(startRunning ? seconds : 0)
  useEffect(() => {
    if (left <= 0) return
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left])
  return { left, start: () => setLeft(seconds) }
}

/**
 * "Renvoyer l'e-mail" button with a cooldown, so the link can be requested
 * again right where it was sent (account creation, forgotten password) without
 * retyping the address — and without hammering the mail server.
 */
export function ResendEmailButton({
  onResend,
  label,
  initialCooldown = true,
}: {
  onResend: () => Promise<unknown>
  label: string
  /** Start with the cooldown running (an e-mail was just sent). */
  initialCooldown?: boolean
}) {
  const t = useT()
  const cooldown = useCooldown(60, initialCooldown)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function resend() {
    setState('sending')
    try {
      await onResend()
      setState('sent')
      cooldown.start()
    } catch {
      setState('error')
    }
  }

  return (
    <div className="auth-resend">
      <p className="small muted">{t('auth.resend.notReceived')}</p>
      <Button
        type="button"
        variant="outline"
        block
        loading={state === 'sending'}
        disabled={cooldown.left > 0 || state === 'sending'}
        onClick={() => void resend()}
      >
        {cooldown.left > 0 ? t('auth.resend.waitSeconds', { seconds: cooldown.left }) : label}
      </Button>
      {state === 'sent' && <p className="small success-text" role="status">✓ {t('auth.resend.sentAgain')}</p>}
      {state === 'error' && <p className="small danger-text" role="alert">{t('auth.resend.failed')}</p>}
    </div>
  )
}

/**
 * E-mail of the last sign-in in this space (when "remember me" was ticked) and
 * the checkbox state; call `persist(email)` after a successful sign-in.
 */
/**
 * Password manager bridge (Credential Management API, Chrome/Edge/Android).
 * The password never touches localStorage: the browser keeps it encrypted in
 * its own password manager, we only ask it to save and, next time, refill it.
 */
type PasswordCredentialCtor = new (data: { id: string; password: string; name?: string }) => Credential
function passwordCredentialCtor(): PasswordCredentialCtor | null {
  const ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor }).PasswordCredential
  return ctor && navigator.credentials ? ctor : null
}

export function useRememberedEmail(space: LoginSpace) {
  const [initial] = useState(() => getRememberedEmail(space))
  const [email, setEmail] = useState(initial)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(initial !== '')
  const [passwordPrefilled, setPasswordPrefilled] = useState(false)

  // Remembered account: ask the browser for the saved password so the user
  // only has to press "Se connecter".
  useEffect(() => {
    if (!initial || !passwordCredentialCtor()) return
    let alive = true
    navigator.credentials
      .get({ password: true, mediation: 'optional' } as CredentialRequestOptions)
      .then((cred) => {
        const c = cred as (Credential & { id: string; password?: string }) | null
        if (!alive || !c?.password) return
        setEmail((current) => current || c.id)
        setPassword((current) => current || c.password || '')
        setPasswordPrefilled(true)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [initial])

  return {
    email,
    setEmail,
    password,
    setPassword,
    remember,
    setRemember,
    /** True when the form opened pre-filled: focus the password instead. */
    prefilled: initial !== '',
    passwordPrefilled,
    persist: (value: string, pwd?: string) => {
      rememberLogin(space, value, remember)
      const Ctor = passwordCredentialCtor()
      if (remember && pwd && Ctor) {
        navigator.credentials.store(new Ctor({ id: value.trim().toLowerCase(), password: pwd })).catch(() => {})
      }
    },
  }
}

/**
 * "Mot de passe oublié ?" link target. What was typed travels in router state
 * (not the URL, so the e-mail never lands in history or server logs).
 */
export function forgotPasswordLink(account: 'seller' | 'employee' | 'courier' | undefined, identifier: string) {
  return {
    to: account ? `/forgot-password?account=${account}` : '/forgot-password',
    state: { identifier: identifier.trim() },
  }
}
