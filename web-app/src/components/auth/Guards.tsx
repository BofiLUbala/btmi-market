import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { LoadingBlock } from '@/components/ui/Feedback'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingBlock label="Checking session…" />
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

export function PublicOnly({ children }: { children?: ReactNode }) {
  const { user, loading, accountType } = useAuth()
  if (loading) return <LoadingBlock label="Loading…" />
  if (user) {
    if (accountType === 'SELLER') return <Navigate to="/seller/dashboard" replace />
    if (accountType === 'EMPLOYEE') return <Navigate to="/employee/dashboard" replace />
    return <Navigate to="/" replace />
  }
  return children ?? <Outlet />
}

export function SellerIndexRedirect() {
  const { user, loading, accountType } = useAuth()
  if (loading) return <LoadingBlock label="Checking session…" />
  if (!user) return <Navigate to="/seller/login" replace />
  if (accountType === 'SELLER') return <Navigate to="/seller/dashboard" replace />
  if (accountType === 'EMPLOYEE') return <Navigate to="/employee/dashboard" replace />
  return <Navigate to="/" replace />
}

export function RequireSeller({ children }: { children?: ReactNode }) {
  const { user, loading, accountType } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingBlock label="Checking session…" />
  if (!user) {
    return <Navigate to="/seller/login" state={{ from: location.pathname }} replace />
  }
  if (accountType !== 'SELLER') {
    if (accountType === 'EMPLOYEE') {
      return <Navigate to="/employee/dashboard" replace />
    }
    return <Navigate to="/" replace />
  }
  return children ?? <Outlet />
}

export function RequireEmployee({ children }: { children?: ReactNode }) {
  const { user, loading, accountType } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingBlock label="Checking session…" />
  if (!user) {
    return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />
  }
  if (accountType !== 'EMPLOYEE') {
    return <Navigate to="/employee/login" state={{ from: location.pathname }} replace />
  }
  return children ?? <Outlet />
}