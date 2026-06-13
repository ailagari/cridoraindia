import { useCallback, useEffect, useState } from 'react'
import { CRIDORA_PUSH_REFRESH_MESSAGE_TYPE } from '@/lib/cridoraSwMessages'
import {
  browserNotificationPermission,
  canSubscribeWebPush,
  claimPushSubscriptionForLoggedInUser,
  fetchWebPushServerStatus,
  getBrowserPushActive,
  isPushPermissionDenied,
  isPushSetupIncomplete,
  pushNotificationsSupported,
  registerWebPushSubscription,
} from '@/lib/webPushApi'

type TrayPushState = {
  serverReady: boolean
  pushActive: boolean
  pushBlocked: boolean
  pushSetupIncomplete: boolean
  checked: boolean
  busy: boolean
  error: string
  canEnable: boolean
  refresh: (opts?: { autoHeal?: boolean }) => Promise<void>
  activate: () => Promise<void>
  finishSetup: () => Promise<void>
  clearError: () => void
}

/**
 * Shared tray-push state for the activation banner, notification bell, and settings panel.
 */
export function useTrayPushState(): TrayPushState {
  const [serverReady, setServerReady] = useState(false)
  const [pushActive, setPushActive] = useState(false)
  const [pushBlocked, setPushBlocked] = useState(false)
  const [pushSetupIncomplete, setPushSetupIncomplete] = useState(false)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async (opts?: { autoHeal?: boolean }) => {
    if (!pushNotificationsSupported()) {
      setServerReady(false)
      setPushActive(false)
      setPushBlocked(false)
      setPushSetupIncomplete(false)
      setChecked(true)
      return
    }
    try {
      const status = await fetchWebPushServerStatus()
      setServerReady(status.configured)
      if (!status.configured) {
        setPushActive(false)
        setPushBlocked(false)
        setPushSetupIncomplete(false)
        setChecked(true)
        return
      }
      const [active, denied, incomplete] = await Promise.all([
        getBrowserPushActive(),
        isPushPermissionDenied(),
        isPushSetupIncomplete(),
      ])
      setPushActive(active)
      setPushBlocked(denied)
      setPushSetupIncomplete(incomplete)
      if (
        opts?.autoHeal !== false &&
        incomplete &&
        !denied &&
        canSubscribeWebPush() &&
        browserNotificationPermission() === 'granted'
      ) {
        try {
          const claimed = await claimPushSubscriptionForLoggedInUser()
          if (!claimed) {
            await registerWebPushSubscription()
          }
          const [healed, stillIncomplete] = await Promise.all([
            getBrowserPushActive(),
            isPushSetupIncomplete(),
          ])
          setPushActive(healed)
          setPushSetupIncomplete(stillIncomplete)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not finish tray setup.')
        }
      }
    } catch {
      setServerReady(false)
      setPushActive(false)
      setPushSetupIncomplete(false)
    } finally {
      setChecked(true)
    }
  }, [])

  const activate = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      await registerWebPushSubscription({ confirmTray: true })
      setPushActive(true)
      setPushBlocked(false)
      setPushSetupIncomplete(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.')
      const denied = await isPushPermissionDenied().catch(() => false)
      setPushBlocked(denied)
      const incomplete = await isPushSetupIncomplete().catch(() => false)
      setPushSetupIncomplete(incomplete)
    } finally {
      setBusy(false)
    }
  }, [])

  const finishSetup = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const claimed = await claimPushSubscriptionForLoggedInUser()
      if (!claimed) {
        await registerWebPushSubscription({ confirmTray: true })
      }
      setPushActive(true)
      setPushBlocked(false)
      setPushSetupIncomplete(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish tray setup.')
    } finally {
      setBusy(false)
    }
  }, [])

  const clearError = useCallback(() => setError(''), [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (ev: MessageEvent) => {
      const type =
        ev.data && typeof ev.data === 'object' ? (ev.data as { type?: string }).type : null
      if (type === CRIDORA_PUSH_REFRESH_MESSAGE_TYPE) void refresh({ autoHeal: false })
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [refresh])

  const canEnable = canSubscribeWebPush() && !pushBlocked && !pushActive && !pushSetupIncomplete

  return {
    serverReady,
    pushActive,
    pushBlocked,
    pushSetupIncomplete,
    checked,
    busy,
    error,
    canEnable,
    refresh,
    activate,
    finishSetup,
    clearError,
  }
}
