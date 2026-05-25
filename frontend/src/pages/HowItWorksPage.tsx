import { Link } from 'react-router-dom'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'

type StepDef = {
  titleKey: MessageKey
  bodyKey: MessageKey
  icon: string
}

const CUSTOMER_STEPS: StepDef[] = [
  { titleKey: 'how.customerStep1Title', bodyKey: 'how.customerStep1Body', icon: '🏪' },
  { titleKey: 'how.customerStep2Title', bodyKey: 'how.customerStep2Body', icon: '💰' },
  { titleKey: 'how.customerStep3Title', bodyKey: 'how.customerStep3Body', icon: '📊' },
  { titleKey: 'how.customerStep4Title', bodyKey: 'how.customerStep4Body', icon: '✨' },
]

const JEWELLER_FEATURES: { key: MessageKey; icon: string }[] = [
  { key: 'how.jewellersFeature1', icon: '🧾' },
  { key: 'how.jewellersFeature2', icon: '📲' },
  { key: 'how.jewellersFeature3', icon: '⚡' },
  { key: 'how.jewellersFeature4', icon: '🏛️' },
  { key: 'how.jewellersFeature5', icon: '🔁' },
  { key: 'how.jewellersFeature6', icon: '📦' },
  { key: 'how.jewellersFeature7', icon: '🏬' },
]

const VAULT_CUSTOMER: MessageKey[] = [
  'how.vaultCustomer1',
  'how.vaultCustomer2',
  'how.vaultCustomer3',
  'how.vaultCustomer4',
]

const TRANSPARENCY: MessageKey[] = [
  'how.transparency1',
  'how.transparency2',
  'how.transparency3',
  'how.transparency4',
  'how.transparency5',
  'how.transparency6',
]

export function HowItWorksPage() {
  const { t } = usePublicLocale()

  return (
    <div className="how-page inner-narrow page enterprise-public" style={{ paddingTop: '2rem' }}>
      <header className="how-page__hero">
        <p className="enterprise-public__eyebrow">{t('how.eyebrow')}</p>
        <h1 className="enterprise-public__title">{t('how.heroTitle')}</h1>
        <p className="enterprise-public__lead" style={{ marginBottom: 0 }}>
          {t('how.heroLead')}
        </p>
      </header>

      <section className="how-page__section" aria-labelledby="how-customers">
        <h2 id="how-customers" className="how-page__section-head">
          {t('how.customersHeading')}
        </h2>
        <ol className="how-page__steps">
          {CUSTOMER_STEPS.map((s, i) => (
            <li key={s.titleKey} className="how-step-card">
              <div className="how-step-card__top">
                <span className="how-step-card__num" aria-hidden="true">
                  {String(i + 1)}
                </span>
                <span className="how-step-card__icon" aria-hidden="true">
                  {s.icon}
                </span>
              </div>
              <h3 className="how-step-card__title">{t(s.titleKey)}</h3>
              <p className="how-step-card__body">{t(s.bodyKey)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="how-page__section" aria-labelledby="how-jewellers">
        <h2 id="how-jewellers" className="how-page__section-head">
          {t('how.jewellersHeading')}
        </h2>
        <p className="how-page__section-lead">{t('how.jewellersIntro')}</p>
        <div className="how-page__jewel-grid">
          {JEWELLER_FEATURES.map((row) => (
            <article key={row.key} className="how-jewel-tile">
              <span className="how-jewel-tile__glyph" aria-hidden="true">
                {row.icon}
              </span>
              <p className="how-jewel-tile__text">{t(row.key)}</p>
            </article>
          ))}
        </div>
        <p className="how-page__jewel-foot">{t('how.jewellersClosing')}</p>
      </section>

      <section className="how-page__section how-page__vault-card" aria-labelledby="how-vault">
        <h2 id="how-vault" className="how-page__section-head" style={{ marginTop: 0 }}>
          {t('how.vaultHeading')}
        </h2>
        <div className="how-page__vault">
          <div>
            <p className="how-page__section-lead" style={{ marginBottom: '1rem' }}>
              {t('how.vaultIntro')}
            </p>
            <p className="how-page__section-lead" style={{ marginBottom: 0 }}>
              {t('how.vaultClosing')}
            </p>
          </div>
          <div>
            <p className="how-page__vault-side-title">{t('how.vaultCustomersHeading')}</p>
            <div className="how-page__pill-grid">
              {VAULT_CUSTOMER.map((key) => (
                <div key={key} className="how-page__pill">
                  <span className="how-page__pill-dot" aria-hidden="true" />
                  <span>{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="how-page__section how-page__vault-card" aria-labelledby="how-transparency">
        <h2 id="how-transparency" className="how-page__section-head" style={{ marginTop: 0 }}>
          {t('how.transparencyHeading')}
        </h2>
        <p className="how-page__truth-intro how-page__section-lead" style={{ marginBottom: '1rem' }}>
          {t('how.transparencyIntro')}
        </p>
        <div className="how-page__truth-grid">
          {TRANSPARENCY.map((key) => (
            <article key={key} className="how-truth-tile">
              <span className="how-truth-tile__mark" aria-hidden="true">
                ✓
              </span>
              <p className="how-truth-tile__text">{t(key)}</p>
            </article>
          ))}
        </div>
        <div className="how-page__truth-note">
          <p>{t('how.transparencyNote')}</p>
        </div>
      </section>

      <footer className="how-page__cta">
        <Link to="/jewellers" className="btn btn-primary">
          {t('how.ctaBrowse')}
        </Link>
        <Link to="/waitlist" className="btn btn-ghost">
          {t('how.ctaWaitlist')}
        </Link>
      </footer>
    </div>
  )
}
