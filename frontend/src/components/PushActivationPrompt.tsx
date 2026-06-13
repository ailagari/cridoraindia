import { useOptionalPublicLocale } from '@/i18n/PublicLocaleProvider'
import { useTrayPushState } from '@/hooks/useTrayPushState'
import { getPushDeliveryLabel, openNativeNotificationSettings, pushSetupHint, pushPermissionBlockedHint } from '@/lib/webPushApi'
import { nativePushNotificationsSupported } from '@/lib/nativeNotifications'

/**
 * Prompts visitors and signed-in users to enable tray notifications until activated.
 * Hidden permanently once this device has an active push subscription.
 */
export function PushActivationPrompt() {
  const { t } = useOptionalPublicLocale()
  const { serverReady, pushActive, pushBlocked, checked, busy, error, canEnable, activate } =
    useTrayPushState()

  if (!checked || !serverReady || pushActive) return null

  const setupHint = pushSetupHint()
  const blockedHint = pushPermissionBlockedHint()
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
