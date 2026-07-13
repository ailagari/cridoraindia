import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LEGAL_ROUTES } from '@/content/siteLegal'
import { hasCookieConsent, writeCookieConsent } from '@/lib/cookieConsent'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'

export function CookieConsentBanner() {
  const { t } = usePublicLocale()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!hasCookieConsent())
  }, [])

  if (!visible) return null

  const dismiss = (choice: 'accepted' | 'essential') => {
    writeCookieConsent(choice)
    setVisible(false)
  }

  return (
    <div className="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title" aria-live="polite">
      <div className="cookie-consent__inner">
        <p id="cookie-consent-title" className="cookie-consent__title">
          {t('cookie.title')}
        </p>
        <p className="cookie-consent__text">
          {t('cookie.body')}{' '}
          <Link className="cookie-consent__link" to={LEGAL_ROUTES.privacy}>
            {t('cookie.privacyLink')}
          </Link>
          .
        </p>
        <div className="cookie-consent__actions">
          <button type="button" className="btn btn-primary cookie-consent__btn" onClick={() => dismiss('accepted')}>
            {t('cookie.accept')}
          </button>
          <button type="button" className="btn btn-ghost cookie-consent__btn" onClick={() => dismiss('essential')}>
            {t('cookie.essential')}
          </button>
        </div>
      </div>
    </div>
  )
}
