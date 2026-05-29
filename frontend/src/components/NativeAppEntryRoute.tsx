import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import { dashboardLandingPath } from '@/lib/routes'
import { displayModeStandalone } from '@/lib/webPushApi'

const SESSION_BOOT_REDIRECT_KEY = 'cridora_boot_portfolio_redirect'

function shouldColdStartRedirect(): boolean {
  return isNativeAndroid() || displayModeStandalone()
}

/**
 * PWA / native cold start: first load at `/` sends signed-in users to portfolio once per session.
 * Later visits to `/` (e.g. “Public site”) show the marketing home — see HomePage on index route.
 * Guests stay on home.
 */
export function NativeAppEntryRoute() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!shouldColdStartRedirect() || loading || !user || pathname !== '/') return
    if (sessionStorage.getItem(SESSION_BOOT_REDIRECT_KEY) === '1') return

    sessionStorage.setItem(SESSION_BOOT_REDIRECT_KEY, '1')
    navigate(dashboardLandingPath(user), { replace: true })
  }, [loading, user, pathname, navigate])

  return null
}
