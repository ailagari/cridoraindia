import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { postClientHeartbeat } from '@/lib/clientTelemetry'
import { useTrayPushState } from '@/hooks/useTrayPushState'

/** Periodic heartbeat for PWA/browser/native surface analytics. */
export function ClientTelemetryBridge() {
  const { user, loading } = useAuth()
  const { pushActive } = useTrayPushState()

  useEffect(() => {
    if (loading) return
    const send = () => {
      void postClientHeartbeat({ pushRegistered: pushActive })
    }
    send()
    const id = window.setInterval(send, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [loading, user, pushActive])

  return null
}
