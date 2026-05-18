import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  initNativeNotificationBridge,
  registerNativePushSubscription,
  setNativeNotificationNavigator,
} from '@/lib/nativeNotifications'
import { isNativeAndroid } from '@/lib/capacitorPlatform'

export function useNativeNotificationBridge(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNativeAndroid()) return
    setNativeNotificationNavigator((path) => {
      navigate(path.startsWith('/') ? path : `/${path}`)
    })
    void initNativeNotificationBridge()
    void registerNativePushSubscription().catch(() => {
      /* user may deny permission on first launch */
    })
  }, [navigate])
}
