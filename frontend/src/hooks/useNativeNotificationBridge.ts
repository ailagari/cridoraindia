import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { initNativeNotificationBridge, setNativeNotificationNavigator } from '@/lib/nativeNotifications'
import { isNativeAndroid } from '@/lib/capacitorPlatform'
import {
  resolveNotificationTapTarget,
  type NotificationTapPayload,
} from '@/lib/notificationTapTargets'

function normalizeTapPayload(input: string | NotificationTapPayload): NotificationTapPayload {
  if (typeof input === 'string') {
    return { url: input }
  }
  return input
}

export function useNativeNotificationBridge(): void {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!isNativeAndroid()) return
    setNativeNotificationNavigator((input) => {
      if (loading) return
      const payload = normalizeTapPayload(input)
      const path = resolveNotificationTapTarget(payload, Boolean(user))
      navigate(path.startsWith('/') ? path : `/${path}`)
    })
    void initNativeNotificationBridge().catch(() => {
      /* non-fatal; user can enable alerts from the bell */
    })
  }, [navigate, user, loading])
}
