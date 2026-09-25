import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, type ActiveMode } from '@/store/auth'
import { LoadingBlock } from '@/components/ui/Feedback'
import { useI18n } from '@/store/i18n'
import type { ReactNode } from 'react'
import SellerEntryPage from '@/pages/seller/auth/SellerEntryPage'

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  if (loading) return <LoadingBlock label={t('feedback.checkingSession')} />
  if (!user) {
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }
  return children ?? <Outlet />
}

/**
 * Shown when a user holding both roles opens a page of the other space. The
 * user signed in as one role, so we ask before switching instead of mixing.
 */
function SwitchSpaceCard({ to }: { to: ActiveMode }) {
  const { switchMode } = useAuth()
  const [busy, setBusy] = useState(false)
  const current = to === 'buyer' ? 'vendeur' : 'acheteur'
  const target = to === 'buyer' ? 'acheteur' : 'vendeur'
  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <h1>Espace {target}</h1>
        <p className="muted">
          Vous êtes connecté comme <strong>{current}</strong>. Cette page appartient à l'espace {target}.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => { setBusy(true); void switchMode(to) }}
        >
          {busy ? 'Changement…' : `Passer à l'espace ${target}`}
        </button>
      </div>
    </div>
  )
}

export function RequireBuyer({ children }: { children?: ReactNode }) {
  const { user, loading, accountType, roles } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  if (loading) return <LoadingBlock label={t('feedback.checkingSession')} />
  if (!user) {
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    )
  }
  if (!(user.capabilities?.buyer || accountType === 'BUYER')) {
    if (roles.buyer) return <SwitchSpaceCard to="buyer" />
    if (accountType === 'COURIER' || user.capabilities?.courier) {
      return <Navigate to="/courier/dashboard" replace />
    }
    if (accountType === 'SELLER') {
      return <Navigate to="/seller/dashboard" replace />
    }
    if (accountType === 'EMPLOYEE') {
      return <Navigate to="/employee/dashboard" replace />
    }
    return <Navigate to="/" replace />
  }
  return children ?? <Outlet />
}

export function PublicOnly({ children }: { children?: ReactNode }) {
  const { user, loading, accountType } = useAuth()
  const { t } = useI18n()
  if (loading) return <LoadingBlock label={t('common.loading')} />
  if (user) {
    if (accountType === 'COURIER' || user.capabilities?.courier) return <Navigate to="/courier/dashboard" replace />
    if (accountType === 'SELLER') return <Navigate to="/seller/dashboard" replace />
    if (accountType === 'EMPLOYEE') return <Navigate to="/employee/dashboard" replace />
    return <Navigate to="/" replace />
  }
  return children ?? <Outlet />
}

export function SellerIndexRedirect() {
  const { user, loading, accountType, roles } = useAuth()
  const { t } = useI18n()
  if (loading) return <LoadingBlock label={t('feedback.checkingSession')} />
  if (!user) return <SellerEntryPage />
  if (accountType === 'COURIER' || user.capabilities?.courier) return <Navigate to="/courier/dashboard" replace />
  if (accountType === 'SELLER' || roles.seller) return <Navigate to="/seller/dashboard" replace />
  if (accountType === 'EMPLOYEE') return <Navigate to="/employee/dashboard" replace />
  return <SellerEntryPage />
}

export function RequireSeller({ children }: { children?: ReactNode }) {
  const { user, loading, accountType, roles } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  if (loading) return <LoadingBlock label={t('feedback.checkingSession')} />
  if (!user) {
    return <Navigate to="/seller/login" state={{ from: location.pathname }} replace />
  }
  if (!(user.capabilities?.seller || accountType === 'SELLER')) {
    if (roles.seller) return <SwitchSpaceCard to="seller" />
    if (accountType === 'COURIER' || user.capabilities?.courier) {
      return <Navigate to="/courier/dashboard" replace />
    }
    if (accountType === 'EMPLOYEE') {
      return <Navigate to="/employee/dashboard" replace />
    }
    return <Navigate to="/" replace />
  }
  return children ?? <Outlet />
}

export function RequireEmployee({ children }: { children?: ReactNode }) {
  const { user, loading, accountType } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  if (loading) return <LoadingBlock label={t('feedback.checkingSession')} />
  if (!user) {
    return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />
  }
  if (accountType === 'COURIER' || user.capabilities?.courier) {
    return <Navigate to="/courier/dashboard" replace />
  }
  if (!(user.capabilities?.employee || accountType === 'EMPLOYEE')) {
    return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />
  }
  return children ?? <Outlet />
}

export function RequireCourier({ children }: { children?: ReactNode }) {
  const { user, loading, accountType } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  if (loading) return <LoadingBlock label={t('feedback.checkingSession')} />
  if (!user) {
    return <Navigate to="/courier/login" state={{ from: location.pathname }} replace />
  }
  if (!(user.capabilities?.courier || accountType === 'COURIER')) {
    if (accountType === 'SELLER') {
      return <Navigate to="/seller/dashboard" replace />
    }
    if (accountType === 'EMPLOYEE') {
      return <Navigate to="/employee/dashboard" replace />
    }
    return <Navigate to="/" replace />
  }
  return children ?? <Outlet />
}
