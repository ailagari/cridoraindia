import { useCallback, useEffect, useState } from 'react'
import { useOptionalPublicLocale } from '@/i18n/PublicLocaleProvider'
import { CRIDORA_PUSH_REFRESH_MESSAGE_TYPE } from '@/lib/cridoraSwMessages'
import { nativePushNotificationsSupported } from '@/lib/nativeNotifications'
import {
  browserNotificationPermission,
  canSubscribeWebPush,
  fetchWebPushServerStatus,
  getBrowserPushActive,
  getPushDeliveryLabel,
  isPushPermissionDenied,
  openNativeNotificationSettings,
  pushNotificationsSupported,
  pushPermissionBlockedHint,
  pushSetupHint,
  registerWebPushSubscription,
} from '@/lib/webPushApi'

/**
 * Prompts visitors and signed-in users to enable tray notifications until activated.
 * Hidden permanently once this device has an active push subscription.
 */
export function PushActivationPrompt() {
  const { t } = useOptionalPublicLocale()
  const [serverReady, setServerReady] = useState(false)
  const [pushActive, setPushActive] = useState(false)
  const [pushBlocked, setPushBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)

  const refresh = useCallback(async () => {
    if (!pushNotificationsSupported()) {
      setServerReady(false)
      setPushActive(false)
      setPushBlocked(false)
      setChecked(true)
      return
    }
    try {
      const status = await fetchWebPushServerStatus()
      setServerReady(status.configured)
      if (!status.configured) {
        setPushActive(false)
        setPushBlocked(false)
        setChecked(true)
        return
      }
      const [active, denied] = await Promise.all([getBrowserPushActive(), isPushPermissionDenied()])
      setPushActive(active)
      setPushBlocked(denied)
      if (!active && !denied && browserNotificationPermission() === 'granted') {
        try {
          await registerWebPushSubscription()
          const healed = await getBrowserPushActive()
          setPushActive(healed)
        } catch {
          /* show banner so user can retry */
        }
      }
    } catch {
      setServerReady(false)
      setPushActive(false)
    } finally {
      setChecked(true)
    }
  }, [])

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
      if (type === CRIDORA_PUSH_REFRESH_MESSAGE_TYPE) void refresh()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [refresh])

  const activate = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      await registerWebPushSubscription()
      setPushActive(true)
      setPushBlocked(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.')
      const denied = await isPushPermissionDenied().catch(() => false)
      setPushBlocked(denied)
    } finally {
      setBusy(false)
    }
  }, [])

  if (!checked || !serverReady || pushActive) return null

  const setupHint = pushSetupHint()
  const blockedHint = pushPermissionBlockedHint()
  const canEnable = canSubscribeWebPush() && !pushBlocked
  const showInstallHint = !canEnable && !pushBlocked && Boolean(setupHint)

  if (!canEnable && !pushBlocked && !showInstallHint) return null

  return (
    <div className="push-activation-bar" role="region" aria-label={t('notifications.promptRegion')}>
      <div className="push-activation-bar-inner card">
        <div className="push-activation-bar-copy">
          <p className="push-activation-bar-title">{t('notifications.promptTitle')}</p>
          {pushBlocked ? (
            <p className="push-activation-bar-detail">{blockedHint ?? t('notifications.blocked')}</p>
          ) : showInstallHint ? (
            <p className="push-activation-bar-detail">{setupHint}</p>
          ) : (
            <>
              <p className="push-activation-bar-detail">{t('notifications.promptBody')}</p>
              <p className="push-activation-bar-hint">{getPushDeliveryLabel()}</p>
            </>
          )}
          {error ? <p className="form-error push-activation-bar-err">{error}</p> : null}
        </div>
        <div className="push-activation-bar-actions">
          {pushBlocked && nativePushNotificationsSupported() ? (
            <button
              type="button"
              className="btn btn-primary push-activation-bar-btn"
              onClick={() => void openNativeNotificationSettings()}
            >
              {t('notifications.openSettings')}
            </button>
          ) : canEnable ? (
            <button
              type="button"
              className="btn btn-primary push-activation-bar-btn"
              disabled={busy}
              onClick={() => void activate()}
            >
              {busy ? t('notifications.turningOn') : t('notifications.promptActivate')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
