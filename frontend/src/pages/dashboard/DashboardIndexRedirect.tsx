import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'
import { Spinner } from '@/components/ui'

export function DashboardIndexRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="app-shell app-shell--centered">
        <Spinner label="Loading account" />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to={dashboardLandingPath(user)} replace />
}
