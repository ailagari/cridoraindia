import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CRIDORA_NOTIFICATION_NAVIGATE_MESSAGE_TYPE } from '@/lib/cridoraSwMessages'
import { useAuth } from '@/context/AuthContext'
import { resolveNotificationTapTarget, type NotificationTapPayload } from '@/lib/notificationTapTargets'

export function useWebPushTapBridge(): void {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } & NotificationTapPayload
      if (data?.type !== CRIDORA_NOTIFICATION_NAVIGATE_MESSAGE_TYPE) return
      if (loading) return
      const target = resolveNotificationTapTarget(data, Boolean(user))
      navigate(target)
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate, user, loading])
}
