import { Link } from 'react-router-dom'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'

const CUSTOMER_STEPS: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: 'how.customerStep1Title', bodyKey: 'how.customerStep1Body' },
  { titleKey: 'how.customerStep2Title', bodyKey: 'how.customerStep2Body' },
  { titleKey: 'how.customerStep3Title', bodyKey: 'how.customerStep3Body' },
  { titleKey: 'how.customerStep4Title', bodyKey: 'how.customerStep4Body' },
]

const JEWELLER_FEATURES: MessageKey[] = [
  'how.jewellersFeature1',
  'how.jewellersFeature2',
  'how.jewellersFeature3',
  'how.jewellersFeature4',
  'how.jewellersFeature5',
  'how.jewellersFeature6',
  'how.jewellersFeature7',
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
    <div className="container page enterprise-public" style={{ maxWidth: 760, paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <p className="enterprise-public__eyebrow">{t('how.eyebrow')}</p>
      <h1 className="enterprise-public__title">{t('how.heroTitle')}</h1>
      <p className="enterprise-public__lead">{t('how.heroLead')}</p>

      <section style={{ marginTop: '2.5rem' }}>
        <h2 className="cridora-section-title">{t('how.customersHeading')}</h2>
        <ol className="enterprise-public__steps">
          {CUSTOMER_STEPS.map((s) => (
            <li key={s.titleKey}>
              <h2>{t(s.titleKey)}</h2>
              <p>{t(s.bodyKey)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2 className="cridora-section-title">{t('how.jewellersHeading')}</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('how.jewellersIntro')}</p>
        <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
          {JEWELLER_FEATURES.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.6 }}>{t('how.jewellersClosing')}</p>
      </section>

      <section className="card" style={{ marginTop: '2.5rem', padding: '1.5rem', borderRadius: 20 }}>
        <h2 className="cridora-section-title" style={{ marginTop: 0 }}>{t('how.vaultHeading')}</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('how.vaultIntro')}</p>
        <p style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600 }}>{t('how.vaultCustomersHeading')}</p>
        <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
          {VAULT_CUSTOMER.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.6 }}>{t('how.vaultClosing')}</p>
      </section>

      <section className="card" style={{ marginTop: '2.5rem', padding: '1.5rem', borderRadius: 20 }}>
        <h2 className="cridora-section-title" style={{ marginTop: 0 }}>{t('how.transparencyHeading')}</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('how.transparencyIntro')}</p>
        <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
          {TRANSPARENCY.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.6, fontStyle: 'italic' }}>
          {t('how.transparencyNote')}
        </p>
      </section>

      <div className="enterprise-public__cta">
        <Link to="/jewellers" className="btn btn-primary">
          {t('how.ctaBrowse')}
        </Link>
        <Link to="/waitlist" className="btn btn-ghost">
          {t('how.ctaWaitlist')}
        </Link>
      </div>
    </div>
  )
}
