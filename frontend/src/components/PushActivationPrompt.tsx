import { useCallback, useState } from 'react'
import { useOptionalPublicLocale } from '@/i18n/PublicLocaleProvider'
import { useTrayPushState } from '@/hooks/useTrayPushState'
import { getPushDeliveryLabel, openNativeNotificationSettings, pushSetupHint, pushPermissionBlockedHint } from '@/lib/webPushApi'
import { nativePushNotificationsSupported } from '@/lib/nativeNotifications'

const SESSION_DISMISS_KEY = 'cridora_push_prompt_dismissed'

function isPushPromptDismissedThisSession(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function dismissPushPromptForSession(): void {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
  } catch {
    /* private mode */
  }
}

/**
 * Prompts visitors and signed-in users to enable tray notifications until activated.
 * Hidden permanently once this device has an active push subscription.
 */
export function PushActivationPrompt() {
  const { t } = useOptionalPublicLocale()
  const [dismissedThisSession, setDismissedThisSession] = useState(isPushPromptDismissedThisSession)
  const dismissForSession = useCallback(() => {
    dismissPushPromptForSession()
    setDismissedThisSession(true)
  }, [])
  const {
    serverReady,
    pushActive,
    pushBlocked,
    pushSetupIncomplete,
    checked,
    busy,
    error,
    canEnable,
    activate,
    finishSetup,
  } = useTrayPushState()

  if (dismissedThisSession || !checked || !serverReady || (pushActive && !pushSetupIncomplete)) return null

  const setupHint = pushSetupHint()
  const blockedHint = pushPermissionBlockedHint()
  const showInstallHint = !canEnable && !pushBlocked && !pushSetupIncomplete && Boolean(setupHint)

  if (!canEnable && !pushBlocked && !pushSetupIncomplete && !showInstallHint) return null

  return (
    <div className="push-activation-bar" role="region" aria-label={t('notifications.promptRegion')}>
      <div className="push-activation-bar-inner card">
        <button
          type="button"
          className="push-activation-bar-close"
          aria-label={t('notifications.promptDismiss')}
          onClick={dismissForSession}
        >
          ✕
        </button>
        <div className="push-activation-bar-copy">
          <p className="push-activation-bar-title">{t('notifications.promptTitle')}</p>
          {pushBlocked ? (
            <p className="push-activation-bar-detail">{blockedHint ?? t('notifications.blocked')}</p>
          ) : pushSetupIncomplete ? (
            <>
              <p className="push-activation-bar-detail">
                Notifications are allowed on this device but not linked for delivery yet. Finish setup to receive tray
                alerts.
              </p>
              <p className="push-activation-bar-hint">{getPushDeliveryLabel()}</p>
            </>
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
          ) : pushSetupIncomplete ? (
            <button
              type="button"
              className="btn btn-primary push-activation-bar-btn"
              disabled={busy}
              onClick={() => void finishSetup()}
            >
              {busy ? t('notifications.turningOn') : 'Finish setup'}
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
