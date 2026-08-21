import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { get } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { ErrorBox, LoadingBlock } from '@/components/ui/Feedback'

export default function SellerActivatePage() {
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
        setMessage('Your seller account is now active. You can sign in.')
      },
      (err: unknown) => {
        if (!mounted) return
        setState('error')
        setMessage(err instanceof Error ? err.message : 'Activation failed')
      }
    )
    return () => {
      mounted = false
    }
  }, [url])

  if (state === 'loading') return <LoadingBlock label="Activating your seller account…" />

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>{state === 'ok' ? '🎉 Activated' : 'Activation failed'}</h1>
        {state === 'error' ? <ErrorBox error={message} /> : <p className="muted">{message}</p>}
        <Link to="/seller/login">
          <Button block>Go to sign in</Button>
        </Link>
      </div>
    </div>
  )
}