import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'

export function DashboardIndexRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={dashboardLandingPath(user)} replace />
}
