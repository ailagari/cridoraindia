import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui'
import { dashboardLandingPath } from '@/lib/routes'
import { HomePage } from '@/pages/HomePage'

/** App entry `/`: guests see marketing home; signed-in users go straight to portfolio dashboard. */
export function HomeOrDashboardRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-shell app-shell--centered">
        <Spinner label="Loading account" />
      </div>
    )
  }

  if (user) {
    return <Navigate to={dashboardLandingPath(user)} replace />
  }

  return <HomePage />
}
