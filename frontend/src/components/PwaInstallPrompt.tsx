import { useCallback, useEffect, useState } from 'react'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { displayModeStandalone } from '@/lib/webPushApi'
import { isNativePlatform } from '@/lib/capacitorPlatform'
import { isAppleMobileOrTablet } from '@/lib/platformDetect'
import { postPwaInstalled } from '@/lib/clientTelemetry'
import { Button, Text } from '@/components/ui'

const DISMISS_KEY = 'cridora_pwa_install_dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isMobileWeb(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches
}

export function PwaInstallPrompt() {
  const { t } = usePublicLocale()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNativePlatform() || displayModeStandalone() || dismissed) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [dismissed])

  useEffect(() => {
    if (!displayModeStandalone()) return
    void postPwaInstalled()
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* private mode */
    }
    setDismissed(true)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    setBusy(true)
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        void postPwaInstalled()
        setDismissed(true)
      }
    } finally {
      setBusy(false)
      setDeferred(null)
    }
  }, [deferred])

  if (isNativePlatform() || displayModeStandalone() || dismissed) return null

  if (deferred && isMobileWeb()) {
    return (
      <div className="push-activation-bar" role="region" aria-label={t('pwa.promptRegion')}>
        <div className="push-activation-bar-inner card">
          <button
            type="button"
            className="push-activation-bar-close"
            aria-label={t('pwa.promptDismiss')}
            onClick={dismiss}
          >
            ✕
          </button>
          <div className="push-activation-bar-copy">
            <p className="push-activation-bar-title">{t('pwa.promptTitle')}</p>
            <Text tone="muted" size="sm">
              {t('pwa.promptDetail')}
            </Text>
          </div>
          <Button type="button" variant="primary" loading={busy} onClick={() => void install()}>
            {t('pwa.install')}
          </Button>
        </div>
      </div>
    )
  }

  if (isAppleMobileOrTablet() && isMobileWeb()) {
    return (
      <div className="push-activation-bar" role="region" aria-label={t('pwa.promptRegion')}>
        <div className="push-activation-bar-inner card">
          <button
            type="button"
            className="push-activation-bar-close"
            aria-label={t('pwa.promptDismiss')}
            onClick={dismiss}
          >
            ✕
          </button>
          <div className="push-activation-bar-copy">
            <p className="push-activation-bar-title">{t('pwa.iosTitle')}</p>
            <Text tone="muted" size="sm">
              {t('pwa.iosDetail')}
            </Text>
          </div>
        </div>
      </div>
    )
  }

  return null
}
