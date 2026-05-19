import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App } from '@capacitor/app'
import type { PluginListenerHandle } from '@capacitor/core'
import { useAuth } from '@/context/AuthContext'
import { dashboardLandingPath } from '@/lib/routes'
import { isNativeAndroid } from '@/lib/capacitorPlatform'

/**
 * On Android cold start the WebView often loads `#/` before any saved deep link.
 * After auth bootstrap, send signed-in users to portfolio if they are still on app entry.
 */
export function NativeAppEntryRoute() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeAndroid() || loading || !user) return

    let cancelled = false
    let listener: PluginListenerHandle | undefined

    const goPortfolioIfEntry = () => {
      if (cancelled || pathname !== '/') return
      navigate(dashboardLandingPath(user), { replace: true })
    }

    goPortfolioIfEntry()

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) goPortfolioIfEntry()
    }).then((handle) => {
      listener = handle
    })

    return () => {
      cancelled = true
      void listener?.remove()
    }
  }, [loading, user, pathname, navigate])

  return null
}
