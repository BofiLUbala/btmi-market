import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { get } from '@/api/client'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'
import { useT } from '@/store/i18n'

export default function SellerActivatePage() {
  const t = useT()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  const url = useMemo(
    () => `/auth/activate?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`,
    [email, token]
  )

  useEffect(() => {
    let mounted = true
    get<null>(url).then(
      () => {
        if (!mounted) return
        setState('ok')
        setMessage(t('seller.auth.activate.active'))
      },
      (err: unknown) => {
        if (!mounted) return
        setState('error')
        setMessage(err instanceof Error ? err.message : t('auth.activate.failed'))
      }
    )
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  if (state === 'loading') return <LoadingBlock label={t('seller.auth.activate.loading')} />

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>{state === 'ok' ? t('auth.activate.success') : t('auth.activate.failed')}</h1>
        {state === 'error' ? <ErrorBox error={message} /> : <p className="muted">{message}</p>}
        <Link to="/seller/login" className="btn btn-primary btn-block">{t('auth.register.goToSignIn')}</Link>
      </div>
    </div>
  )
}