import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'
import { isNativeAndroid } from '@/lib/capacitorPlatform'

const SESSION_BOOT_REDIRECT_KEY = 'cridora_boot_portfolio_redirect'

/**
 * Android cold start only: first load at `/` sends signed-in users to portfolio once per session.
 * Later visits to `/` (e.g. “Public site”) show the marketing home — see HomePage on index route.
 */
export function NativeAppEntryRoute() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeAndroid() || loading || !user || pathname !== '/') return
    if (sessionStorage.getItem(SESSION_BOOT_REDIRECT_KEY) === '1') return

    sessionStorage.setItem(SESSION_BOOT_REDIRECT_KEY, '1')
    navigate(dashboardLandingPath(user), { replace: true })
  }, [loading, user, pathname, navigate])

  return null
}
