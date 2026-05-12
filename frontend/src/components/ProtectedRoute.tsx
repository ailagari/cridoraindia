import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type UserType } from '@/context/AuthContext'
import { userDashboardPath } from '@/lib/routes'

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

  if (!user) {
    return <Navigate to="/login" state={{ from: loc }} replace />
  }

  if (!allowed.includes(user.user_type)) {
    return <Navigate to={userDashboardPath(user)} replace />
  }

  return <>{children}</>
}
