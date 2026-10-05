import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { adminApi } from '@/api/admin'
import { useAuth } from '@/store/auth'
import { useAdminAuth } from '@/store/adminAuth'
import { LoadingBlock } from '@/components/ui/Feedback'
import { safeInternalPath } from '@/lib/returnTo'
import { useT } from '@/store/i18n'

/**
 * Landing route of every push notification click: /notif/:id?to=…&uid=…&kind=…&aud=…
 *
 * 1. No session → sign in first (the right sign-in page for the audience),
 *    then come back here.
 * 2. Signed in as another account → never open the screen; offer to switch.
 * 3. Otherwise mark the notification read and open its screen. That screen's
 *    own guards still check the role and access rights.
 */
export default function NotificationOpenPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const t = useT()
  const isAdmin = params.get('kind') === 'ADMIN'
  const audience = params.get('aud') ?? 'BUYER'
  const uid = params.get('uid') ?? ''
  const to = safeInternalPath(params.get('to'), isAdmin ? '/admin' : '/')
  const here = location.pathname + location.search

  const { user, loading: userLoading, logout } = useAuth()
  const { admin, loading: adminLoading, logout: adminLogout } = useAdminAuth()
  const loading = isAdmin ? adminLoading : userLoading
  const currentId = isAdmin ? admin?.id : user?.id
  const [switching, setSwitching] = useState(false)

  const matches = Boolean(currentId) && (!uid || currentId === uid)

  useEffect(() => {
    if (loading || !matches) return
    const mark = isAdmin
      ? adminApi(`/admin/notifications/${id}/read`, { method: 'POST' })
      : api(`/notifications/${id}/read`, { method: 'POST' })
    // Opening the screen matters more than the read mark.
    void mark.catch(() => undefined).finally(() => navigate(to, { replace: true }))
  }, [loading, matches, isAdmin, id, to, navigate])

  if (loading) return <LoadingBlock label={t('notificationsNotificationOpenPage.opening')} />

  if (!currentId) {
    if (isAdmin) return <Navigate to="/admin/login" state={{ from: location }} replace />
    if (audience === 'SELLER') return <Navigate to="/seller/login" state={{ from: here }} replace />
    if (audience === 'COURIER') return <Navigate to="/livreur/login" state={{ from: here }} replace />
    return <Navigate to={`/login?returnTo=${encodeURIComponent(here)}`} replace />
  }

  if (!matches) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: 'center' }}>
          <h1>{t('notificationsNotificationOpenPage.otherAccountTitle')}</h1>
          <p className="muted">
            {t('notificationsNotificationOpenPage.otherAccountBody')}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={switching}
            onClick={async () => {
              setSwitching(true)
              if (isAdmin) await adminLogout()
              else await logout()
            }}
          >
            {switching ? t('notificationsNotificationOpenPage.signingOut') : t('notificationsNotificationOpenPage.switchAccount')}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => navigate(isAdmin ? '/admin' : '/', { replace: true })}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    )
  }

  return <LoadingBlock label={t('notificationsNotificationOpenPage.opening')} />
}
