import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { HeroArabesqueBackground } from '@/components/HeroArabesqueBackground'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'
import { dashboardLandingPath } from '@/lib/routes'
import { IMAGES } from '@/content/images'

const HOW_STEPS: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: 'home.howStep1Title', bodyKey: 'home.howStep1Body' },
  { titleKey: 'home.howStep2Title', bodyKey: 'home.howStep2Body' },
  { titleKey: 'home.howStep3Title', bodyKey: 'home.howStep3Body' },
  { titleKey: 'home.howStep4Title', bodyKey: 'home.howStep4Body' },
]

const BEHAVIOUR_CARDS: { titleKey: MessageKey; bodyKey: MessageKey }[] = [
  { titleKey: 'home.behaviour1Title', bodyKey: 'home.behaviour1Body' },
  { titleKey: 'home.behaviour2Title', bodyKey: 'home.behaviour2Body' },
  { titleKey: 'home.behaviour3Title', bodyKey: 'home.behaviour3Body' },
  { titleKey: 'home.behaviour4Title', bodyKey: 'home.behaviour4Body' },
  { titleKey: 'home.behaviour5Title', bodyKey: 'home.behaviour5Body' },
]

const TRUST_POINTS: MessageKey[] = [
  'home.trustPoint1',
  'home.trustPoint2',
  'home.trustPoint3',
  'home.trustPoint4',
  'home.trustPoint5',
  'home.trustPoint6',
]

const JEWELLER_FEATURES: MessageKey[] = [
  'home.forJewellersFeature1',
  'home.forJewellersFeature2',
  'home.forJewellersFeature3',
  'home.forJewellersFeature4',
  'home.forJewellersFeature5',
  'home.forJewellersFeature6',
  'home.forJewellersFeature7',
]

function sd(index: number): CSSProperties {
  return { ['--reveal-delay' as string]: `${index * 0.06}s` }
}

export function HomePage() {
  const { user } = useAuth()
  const { t } = usePublicLocale()
  const startSavingHref = user ? dashboardLandingPath(user) : '/signup'

  const heroPoints: MessageKey[] = [
    'home.heroPoint1',
    'home.heroPoint2',
    'home.heroPoint3',
    'home.heroPoint4',
    'home.heroPoint5',
  ]

  let r = 0
  const d = () => r++

  return (
    <>
      <section className="home-hero">
        <HeroArabesqueBackground />
        <div className="container home-hero__content">
          <div className="grid-2">
            <div>
              <span className="pill cridora-reveal" style={sd(d())}>
                {t('home.tagline')}
              </span>
              <h1
                className="cridora-reveal"
                style={{
                  fontSize: 'clamp(2rem, 4.5vw, 3rem)',
                  lineHeight: 1.15,
                  margin: '1rem 0',
                  ...sd(d()),
                }}
              >
                {t('home.heroTitle')}
              </h1>
              <p
                className="cridora-reveal"
                style={{
                  margin: '0 0 1.25rem',
                  maxWidth: 'min(48ch, 100%)',
                  fontSize: '1.05rem',
                  lineHeight: 1.6,
                  color: 'var(--text-muted)',
                  ...sd(d()),
                }}
              >
                {t('home.heroSubheadline')}
              </p>
              <ul
                className="cridora-reveal"
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: '0.55rem',
                  maxWidth: 'min(46ch, 100%)',
                  fontSize: '0.95rem',
                  ...sd(d()),
                }}
              >
                {heroPoints.map((key) => (
                  <li
                    key={key}
                    style={{
                      display: 'flex',
                      gap: '0.55rem',
                      alignItems: 'flex-start',
                      lineHeight: 1.5,
                    }}
                  >
                    <span aria-hidden style={{ color: 'var(--gold-light)', flexShrink: 0 }}>
                      •
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{t(key)}</span>
                  </li>
                ))}
              </ul>
              <div
                className="cridora-reveal"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '1.75rem',
                  ...sd(d()),
                }}
              >
                <Link to={startSavingHref} className="btn btn-primary">
                  {t('home.ctaStartSaving')}
                </Link>
                <Link to="/jewellers" className="btn btn-ghost">
                  {t('home.ctaExploreJewellers')}
                </Link>
                <Link to="/jeweller/apply" className="btn btn-ghost">
                  {t('home.ctaApplyJeweller')}
                </Link>
              </div>
            </div>
            <div
              className="cridora-reveal cridora-card-motion media-frame media-frame--hero"
              style={{ position: 'relative', ...sd(d()) }}
            >
              <img
                src={IMAGES.heroGold}
                alt="Refined gold and precious metals"
                width={1400}
                height={933}
                className="media-fill"
                sizes="(max-width: 879px) 100vw, 50vw"
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, var(--veil-35) 0%, var(--navy-55) 100%)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="quote-banner inner">
          <blockquote className="qb-text cridora-quote cridora-card-motion" style={{ margin: 0, padding: 0, border: 'none', background: 'none' }}>
            “{t('home.positioning')}”
          </blockquote>
      </section>

      <section className="section-band inner">
        <div className="container grid-2">
          <div className="media-frame media-frame--section-split">
            <img
              src={IMAGES.heroJewellery}
              alt="Fine jewellery craftsmanship"
              width={1100}
              height={733}
              className="media-fill"
              sizes="(max-width: 879px) 100vw, 45vw"
            />
          </div>
          <div>
            <h2 className="cridora-section-title" style={{ marginTop: 0 }}>
              {t('home.whyExistsTitle')}
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('home.whyExistsIntro1')}</p>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('home.whyExistsIntro2')}</p>
            <p style={{ marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              {t('home.whyExistsCustomersHeading')}
            </p>
            <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
              {(['home.whyExistsCustomer1', 'home.whyExistsCustomer2', 'home.whyExistsCustomer3', 'home.whyExistsCustomer4', 'home.whyExistsCustomer5'] as const).map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <p style={{ marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              {t('home.whyExistsJewellersHeading')}
            </p>
            <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.4rem' }}>
              {(['home.whyExistsJeweller1', 'home.whyExistsJeweller2', 'home.whyExistsJeweller3', 'home.whyExistsJeweller4'] as const).map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section-sm inner">
        <h2 className="cridora-section-title cridora-reveal sh" style={{ textAlign: 'center', ...sd(d()) }}>
          {t('home.howTitle')}
        </h2>
        <ol
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
            padding: 0,
            listStyle: 'none',
          }}
        >
          {HOW_STEPS.map((step, idx) => (
            <li
              key={step.titleKey}
              className="card cridora-card-motion cridora-reveal"
              style={{ padding: '1.25rem', borderRadius: 18, ...sd(d()) }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--gold-soft)',
                  color: 'var(--gold-light)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  marginBottom: '0.65rem',
                }}
              >
                {idx + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{t(step.titleKey)}</h3>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                {t(step.bodyKey)}
              </p>
            </li>
          ))}
        </ol>
        <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/how-it-works" className="btn btn-ghost">
            {t('nav.howItWorks')}
          </Link>
        </p>
      </section>

      <section className="section-band">
        <div className="container">
          <h2 className="cridora-section-title" style={{ textAlign: 'center', marginTop: 0 }}>
            {t('home.behaviourTitle')}
          </h2>
        <div className="india-grid" style={{ marginTop: '1.5rem' }}>
            {BEHAVIOUR_CARDS.map((card) => (
              <div key={card.titleKey} className="india-card">
                <h3 className="ic-title" style={{ margin: 0, color: 'var(--gold-hi)' }}>
                  {t(card.titleKey)}
                </h3>
                <p className="ic-desc" style={{ margin: '0.5rem 0 0' }}>
                  {t(card.bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm inner">
        <h2 className="cridora-section-title" style={{ textAlign: 'center', marginTop: 0 }}>
          {t('home.trustTitle')}
        </h2>
        <ul className="trust-grid" style={{ marginTop: '1.5rem', listStyle: 'none', padding: 0 }}>
          {TRUST_POINTS.map((key) => (
            <li key={key} className="trust-cell">
              <span className="tc-desc" style={{ margin: 0 }}>
                {t(key)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section-band">
        <div className="container grid-2">
          <div>
            <h2 className="cridora-section-title" style={{ marginTop: 0 }}>
              {t('home.forJewellersTitle')}
            </h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{t('home.forJewellersBody')}</p>
            <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.1rem', display: 'grid', gap: '0.45rem' }}>
              {JEWELLER_FEATURES.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <Link to="/jeweller/apply" className="btn btn-primary" style={{ marginTop: '1.25rem' }}>
              {t('home.ctaApplyJeweller')}
            </Link>
          </div>
          <div className="media-frame media-frame--trust-strip">
            <img
              src={IMAGES.trustCollage}
              alt="Gold bars motif"
              width={900}
              height={600}
              className="media-fill"
              sizes="(max-width: 879px) 100vw, 45vw"
            />
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '3rem 0 4rem', textAlign: 'center' }}>
        <h2 className="cridora-section-title">{t('home.closingTitle')}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
          <Link to="/waitlist" className="btn btn-primary">
            {t('home.closingCtaWaitlist')}
          </Link>
          <Link to="/jewellers" className="btn btn-ghost">
            {t('home.closingCtaExplore')}
          </Link>
        </div>
      </section>
    </>
  )
}

