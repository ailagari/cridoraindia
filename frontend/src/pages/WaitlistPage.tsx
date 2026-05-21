import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'

const CUSTOMER_POINTS: MessageKey[] = [
  'waitlist.customers1',
  'waitlist.customers2',
  'waitlist.customers3',
  'waitlist.customers4',
  'waitlist.customers5',
]

const JEWELLER_POINTS: MessageKey[] = [
  'waitlist.jewellers1',
  'waitlist.jewellers2',
  'waitlist.jewellers3',
  'waitlist.jewellers4',
  'waitlist.jewellers5',
]

export function WaitlistPage() {
  const { t } = usePublicLocale()

  return (
    <div className="container page enterprise-public" style={{ maxWidth: 800, paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <p className="enterprise-public__eyebrow">{t('waitlist.eyebrow')}</p>
      <h1 className="enterprise-public__title">{t('waitlist.heroTitle')}</h1>
      <p className="enterprise-public__lead">{t('waitlist.heroLead')}</p>

      <div
        style={{
          display: 'grid',
          gap: '1.25rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          marginTop: '2rem',
        }}
      >
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{t('waitlist.customersTitle')}</h2>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
            {CUSTOMER_POINTS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-faint)' }}>
            {t('waitlist.customerPlaceholder')}
          </p>
          <a
            className="btn btn-primary"
            style={{ display: 'inline-flex' }}
            href="mailto:waitlist.users@cridora.in?subject=Cridora%20user%20waitlist"
          >
            {t('waitlist.joinButton')}
          </a>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{t('waitlist.jewellersTitle')}</h2>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
            {JEWELLER_POINTS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-faint)' }}>
            {t('waitlist.jewellerPlaceholder')}
          </p>
          <a
            className="btn btn-primary"
            style={{ display: 'inline-flex' }}
            href="mailto:waitlist.jewellers@cridora.in?subject=Cridora%20jeweller%20waitlist"
          >
            {t('waitlist.joinButton')}
          </a>
        </div>
      </div>
    </div>
  )
}
