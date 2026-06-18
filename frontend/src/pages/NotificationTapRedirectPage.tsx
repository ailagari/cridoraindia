import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { parseNotificationTapSearch, resolveNotificationTapTarget } from '@/lib/notificationTapTargets'

/** Resolves guest vs signed-in tap targets from push notification cold starts. */
export function NotificationTapRedirectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    const { guest, authenticated } = parseNotificationTapSearch(location.search)
    const target = resolveNotificationTapTarget(
      { url_guest: guest, url_authenticated: authenticated, url: guest },
      Boolean(user),
    )
    navigate(target, { replace: true })
  }, [loading, user, location.search, navigate])

  return (
    <div className="app-shell" style={{ display: 'grid', placeItems: 'center' }}>
      <p style={{ color: 'var(--text-muted)' }}>Opening…</p>
    </div>
  )
}
