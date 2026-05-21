import { Link } from 'react-router-dom'
import { JewellerMarketplaceGrid } from '@/features/marketplace/JewellerMarketplaceGrid'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'

const WHY_JOIN: MessageKey[] = [
  'jewellers.whyJoin1',
  'jewellers.whyJoin2',
  'jewellers.whyJoin3',
  'jewellers.whyJoin4',
  'jewellers.whyJoin5',
]

const FEATURES: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: 'jewellers.feature1Title', bodyKey: 'jewellers.feature1Body' },
  { titleKey: 'jewellers.feature2Title', bodyKey: 'jewellers.feature2Body' },
  { titleKey: 'jewellers.feature3Title', bodyKey: 'jewellers.feature3Body' },
  { titleKey: 'jewellers.feature4Title', bodyKey: 'jewellers.feature4Body' },
  { titleKey: 'jewellers.feature5Title', bodyKey: 'jewellers.feature5Body' },
  { titleKey: 'jewellers.feature6Title', bodyKey: 'jewellers.feature6Body' },
  { titleKey: 'jewellers.feature7Title', bodyKey: 'jewellers.feature7Body' },
]

const MATTERS: MessageKey[] = [
  'jewellers.matters1',
  'jewellers.matters2',
  'jewellers.matters3',
  'jewellers.matters4',
]

const VERIFICATION: MessageKey[] = [
  'jewellers.verification1',
  'jewellers.verification2',
  'jewellers.verification3',
  'jewellers.verification4',
  'jewellers.verification5',
]

export function JewellerDirectoryPage() {
  const { t } = usePublicLocale()

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <section
        style={{
          position: 'relative',
          padding: '2.75rem 0 3rem',
          overflow: 'hidden',
          background: 'var(--gradient-hero-band)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'var(--radial-gold)',
          }}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <span className="pill">{t('jewellers.pill')}</span>
          <h1
            style={{
              fontSize: 'clamp(1.85rem, 4vw, 2.65rem)',
              margin: '0.75rem 0',
              fontWeight: 650,
              letterSpacing: '-0.02em',
            }}
          >
            {t('jewellers.heroTitle')}
          </h1>
          <p style={{ margin: 0, maxWidth: '52ch', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {t('jewellers.heroLead')}
          </p>
          <Link to="/jeweller/apply" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
            {t('nav.applyJeweller')}
          </Link>
        </div>
      </section>

      <div className="container" style={{ marginTop: '2.5rem' }}>
        <section>
          <h2 className="cridora-section-title">{t('jewellers.whyJoinTitle')}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('jewellers.whyJoinIntro')}</p>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
            {WHY_JOIN.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: '2.5rem' }}>
          <h2 className="cridora-section-title">{t('jewellers.featuresTitle')}</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            {FEATURES.map((f) => (
              <div key={f.titleKey} className="card" style={{ padding: '1.2rem', borderRadius: 18 }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--gold-light)' }}>{t(f.titleKey)}</h3>
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                  {t(f.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: '2.5rem' }}>
          <h2 className="cridora-section-title">{t('jewellers.mattersTitle')}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('jewellers.mattersIntro')}</p>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
            {MATTERS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.6 }}>{t('jewellers.mattersClosing')}</p>
        </section>

        <section style={{ marginTop: '2.5rem' }}>
          <h2 className="cridora-section-title">{t('jewellers.verificationTitle')}</h2>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
            {VERIFICATION.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: '2.5rem' }}>
          <h2 className="cridora-section-title">{t('jewellers.directoryTitle')}</h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {t('jewellers.directoryIntro')}
          </p>
          <JewellerMarketplaceGrid intro="" />
        </section>

        <section
          className="card"
          style={{ marginTop: '2.5rem', padding: '1.5rem', borderRadius: 20, textAlign: 'center' }}
        >
          <h2 className="cridora-section-title" style={{ marginTop: 0 }}>
            {t('jewellers.closingTitle')}
          </h2>
          <Link to="/jeweller/apply" className="btn btn-primary">
            {t('jewellers.closingCta')}
          </Link>
        </section>
      </div>
    </div>
  )
}
