import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackGa4PageView } from '@/lib/googleAnalytics'

/**
 * Sends GA4 page_view on every React Router navigation.
 * The static gtag snippet in <head> only covers the initial HTML load;
 * Google's detector and Realtime reports need these SPA hits too.
 */
export function GoogleAnalytics() {
  const { pathname, search } = useLocation()
  const lastTracked = useRef('')

  useEffect(() => {
    const path = `${pathname}${search}`
    if (path === lastTracked.current) return
    lastTracked.current = path
    void trackGa4PageView(path)
  }, [pathname, search])

  return null
}
