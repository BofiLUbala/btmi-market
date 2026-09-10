import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '@/store/adminAuth'
import { defaultRouteForRole } from './adminNav'

/** Sends each role to the dashboard it actually owns, instead of assuming Direction. */
export function AdminHomeRedirect() {
  const { role, loading } = useAdminAuth()
  if (loading) return null
  return <Navigate to={defaultRouteForRole(role)} replace />
}
