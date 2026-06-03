import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type UserType } from '@/context/AuthContext'
import { getStoredAccess } from '@/lib/api'
import { dashboardLandingPath } from '@/lib/routes'

type Props = {
  allow: UserType | UserType[]
  children: ReactNode
}

export function ProtectedRoute({ allow, children }: Props) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  const allowed = Array.isArray(allow) ? allow : [allow]

  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }

  if (!user || !getStoredAccess()) {
    return <Navigate to="/login" state={{ from: loc }} replace />
  }

  if (!allowed.includes(user.user_type)) {
    return <Navigate to={dashboardLandingPath(user)} replace />
  }

  return <>{children}</>
}
