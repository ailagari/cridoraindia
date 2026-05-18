import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { initNativeNotificationBridge, setNativeNotificationNavigator } from '@/lib/nativeNotifications'
import { isNativeAndroid } from '@/lib/capacitorPlatform'

export function useNativeNotificationBridge(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeAndroid()) return
    setNativeNotificationNavigator((path) => {
      navigate(path.startsWith('/') ? path : `/${path}`)
    })
    void initNativeNotificationBridge().catch(() => {
      /* non-fatal; user can enable alerts from the bell */
    })
  }, [navigate])
}
