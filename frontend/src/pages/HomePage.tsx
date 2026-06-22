import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeoHead } from '@/components/SeoHead'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'
import { useRefLandingReveal } from '@/hooks/useRefLandingReveal'
import { dashboardLandingPath } from '@/lib/routes'
import { organizationJsonLd, PAGE_SEO, webSiteJsonLd } from '@/lib/seo'

function MlAccent({ accentKey, locale }: { accentKey: MessageKey; locale: string }) {
  const { t } = usePublicLocale()
  if (locale !== 'ml') return null
  const text = t(accentKey)
  if (!text) return null
  return <p className="idx-ml-accent reveal reveal-delay-1">{text}</p>
}

function SectionHeader({
  eyebrowKey,
  h2Key,
  subKey,
  accentKey,
  locale,
}: {
  eyebrowKey: MessageKey
  h2Key: MessageKey
  subKey: MessageKey
  accentKey?: MessageKey
  locale: string
}) {
  const { t } = usePublicLocale()
  return (
    <div className="center inner-narrow">
      <div className="eyebrow reveal">
        <div className="eyebrow-dot" aria-hidden />
        {t(eyebrowKey)}
      </div>
      <h2 className="sh reveal reveal-delay-1">{t(h2Key)}</h2>
      {accentKey ? <MlAccent accentKey={accentKey} locale={locale} /> : null}
      <p className="sh-sub reveal reveal-delay-2">{t(subKey)}</p>
    </div>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const { t, locale } = usePublicLocale()
  useRefLandingReveal(locale)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const homeSeo = PAGE_SEO['/']

  const homeJsonLd = useMemo(() => [organizationJsonLd(), webSiteJsonLd()], [])

  const WHAT_CARDS = useMemo(
    () => [
      { id: 'w1', icon: '🏛️', title: t('idx.what.c1title'), desc: t('idx.what.c1desc'), tag: t('idx.what.c1tag') },
      { id: 'w2', icon: '📊', title: t('idx.what.c2title'), desc: t('idx.what.c2desc'), tag: t('idx.what.c2tag'), d: 'reveal-delay-1' },
      { id: 'w3', icon: '💬', title: t('idx.what.c3title'), desc: t('idx.what.c3desc'), tag: t('idx.what.c3tag'), d: 'reveal-delay-2' },
      { id: 'w4', icon: '🔗', title: t('idx.what.c4title'), desc: t('idx.what.c4desc'), tag: t('idx.what.c4tag'), d: 'reveal-delay-1' },
      { id: 'w5', icon: '🛡️', title: t('idx.what.c5title'), desc: t('idx.what.c5desc'), tag: t('idx.what.c5tag'), d: 'reveal-delay-2' },
    ],
    [t],
  )

  const CUST_CARDS = useMemo(
    () => [
      { n: '01', title: t('idx.cust.c1title'), desc: t('idx.cust.c1desc') },
      { n: '02', title: t('idx.cust.c2title'), desc: t('idx.cust.c2desc') },
      { n: '03', title: t('idx.cust.c3title'), desc: t('idx.cust.c3desc') },
      { n: '04', title: t('idx.cust.c4title'), desc: t('idx.cust.c4desc') },
      { n: '05', title: t('idx.cust.c5title'), desc: t('idx.cust.c5desc') },
    ],
    [t],
  )

  const HOLD_CARDS = useMemo(
    () => [
      { icon: '💍', title: t('idx.hold.c1title'), desc: t('idx.hold.c1desc') },
      { icon: '🛒', title: t('idx.hold.c2title'), desc: t('idx.hold.c2desc') },
      { icon: '📥', title: t('idx.hold.c3title'), desc: t('idx.hold.c3desc') },
      { icon: '✨', title: t('idx.hold.c4title'), desc: t('idx.hold.c4desc') },
    ],
    [t],
  )

  const BILL_CARDS = useMemo(
    () => [
      { icon: '📄', title: t('idx.bills.c1title'), desc: t('idx.bills.c1desc') },
      { icon: '🔒', title: t('idx.bills.c2title'), desc: t('idx.bills.c2desc') },
      { icon: '📁', title: t('idx.bills.c3title'), desc: t('idx.bills.c3desc') },
    ],
    [t],
  )

  const NOTIF_CARDS = useMemo(
    () => [
      { icon: '📈', title: t('idx.notif.c1title'), desc: t('idx.notif.c1desc') },
      { icon: '🌱', title: t('idx.notif.c2title'), desc: t('idx.notif.c2desc') },
      { icon: '🪔', title: t('idx.notif.c3title'), desc: t('idx.notif.c3desc') },
      { icon: '🏪', title: t('idx.notif.c4title'), desc: t('idx.notif.c4desc') },
    ],
    [t],
  )

  const INTEGR_CARDS = useMemo(
    () => [
      { icon: '🪪', title: t('idx.integr.c1title'), desc: t('idx.integr.c1desc') },
      { icon: '🖥️', title: t('idx.integr.c2title'), desc: t('idx.integr.c2desc') },
      { icon: '📊', title: t('idx.integr.c3title'), desc: t('idx.integr.c3desc') },
      { icon: '✅', title: t('idx.integr.c4title'), desc: t('idx.integr.c4desc') },
    ],
    [t],
  )

  const MEMBER_ITEMS = useMemo(
    () => [t('idx.member.c1'), t('idx.member.c2'), t('idx.member.c3'), t('idx.member.c4')],
    [t],
  )

  const CUSTOMER_STEPS = useMemo(
    () => [
      { n: '1', title: t('idx.how.cs1title'), desc: t('idx.how.cs1desc') },
      { n: '2', title: t('idx.how.cs2title'), desc: t('idx.how.cs2desc') },
      { n: '3', title: t('idx.how.cs3title'), desc: t('idx.how.cs3desc') },
      { n: '4', title: t('idx.how.cs4title'), desc: t('idx.how.cs4desc') },
      { n: '5', title: t('idx.how.cs5title'), desc: t('idx.how.cs5desc') },
    ],
    [t],
  )

  const JEWELLER_STEPS = useMemo(
    () => [
      { n: '1', title: t('idx.how.js1title'), desc: t('idx.how.js1desc') },
      { n: '2', title: t('idx.how.js2title'), desc: t('idx.how.js2desc') },
      { n: '3', title: t('idx.how.js3title'), desc: t('idx.how.js3desc') },
      { n: '4', title: t('idx.how.js4title'), desc: t('idx.how.js4desc') },
      { n: '5', title: t('idx.how.js5title'), desc: t('idx.how.js5desc') },
    ],
    [t],
  )

  const JW_FEATURES = useMemo(
    () => [
      { icon: '🤝', title: t('idx.jw.f1title'), desc: t('idx.jw.f1desc') },
      { icon: '💬', title: t('idx.jw.f2title'), desc: t('idx.jw.f2desc') },
      { icon: '🔗', title: t('idx.jw.f3title'), desc: t('idx.jw.f3desc') },
      { icon: '✅', title: t('idx.jw.f4title'), desc: t('idx.jw.f4desc') },
      { icon: '🔔', title: t('idx.jw.f5title'), desc: t('idx.jw.f5desc') },
      { icon: '📱', title: t('idx.jw.f6title'), desc: t('idx.jw.f6desc') },
    ],
    [t],
  )

  const MODERN_CELLS = useMemo(
    () => [
      { icon: '🪪', title: t('idx.modern.t1title'), desc: t('idx.modern.t1desc') },
      { icon: '🏅', title: t('idx.modern.t2title'), desc: t('idx.modern.t2desc'), d: 'reveal-delay-1' },
      { icon: '🏢', title: t('idx.modern.t3title'), desc: t('idx.modern.t3desc'), d: 'reveal-delay-2' },
      { icon: '📋', title: t('idx.modern.t4title'), desc: t('idx.modern.t4desc'), d: 'reveal-delay-1' },
      { icon: '🔑', title: t('idx.modern.t5title'), desc: t('idx.modern.t5desc'), d: 'reveal-delay-2' },
      { icon: '📊', title: t('idx.modern.t6title'), desc: t('idx.modern.t6desc'), d: 'reveal-delay-3' },
    ],
    [t],
  )

  const FAQ_ITEMS = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7].map((i) => ({
        q: t(`idx.faq.q${String(i)}` as MessageKey),
        a: t(`idx.faq.a${String(i)}` as MessageKey),
      })),
    [t],
  )

  const CTA_STATS = useMemo(
    () => [
      ['✓', t('idx.cta.stat1label')],
      ['3 min', t('idx.cta.stat2label')],
      ['0', t('idx.cta.stat3label')],
      ['42+', t('idx.cta.stat4label')],
    ],
    [t],
  )

  const exploreHref = user ? dashboardLandingPath(user) : '/signup'

  const HERO_TRUST = useMemo(
    () =>
      [
        { icon: '🇸🇬', label: 'idx.hero.trust1' as MessageKey, sub: 'idx.hero.trust1sub' as MessageKey },
        { icon: '🔒', label: 'idx.hero.trust2' as MessageKey, sub: 'idx.hero.trust2sub' as MessageKey },
        { icon: '👁️', label: 'idx.hero.trust3' as MessageKey, sub: 'idx.hero.trust3sub' as MessageKey },
        { icon: '🛡️', label: 'idx.hero.trust4' as MessageKey, sub: 'idx.hero.trust4sub' as MessageKey },
      ] as const,
    [],
  )

  return (
    <div className="ref-landing">
      <SeoHead {...homeSeo} jsonLd={homeJsonLd} locale={locale} />
      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-inner">
          <div className="hero-trust-ticker reveal" role="region" aria-label={t('idx.hero.trustTitle')}>
            <div className="hero-trust-ticker__label">
              <span aria-hidden>🛡️</span>
              {t('idx.hero.trustTitle')}
            </div>
            <div className="hero-trust-ticker__viewport" aria-hidden>
              <div className="hero-trust-ticker__track">
                {[0, 1].map((copy) => (
                  <div key={copy} className="hero-trust-ticker__row">
                    {HERO_TRUST.map((item) => (
                      <span key={`${copy}-${item.label}`} className="hero-trust-ticker__item">
                        <span className="hero-trust-ticker__ico">{item.icon}</span>
                        {t(item.label)}
                        <span className="hero-trust-ticker__sep">·</span>
                        <span className="hero-trust-ticker__sub">{t(item.sub)}</span>
                        <span className="hero-trust-ticker__dot">◆</span>
                      </span>
                    ))}
                    <span className="hero-trust-ticker__item">
                      <span className="hero-trust-ticker__ico">🔐</span>
                      {t('idx.hero.trustNote')}
                      <span className="hero-trust-ticker__dot">◆</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <span className="sr-only">
              {HERO_TRUST.map((item) => `${t(item.label)}: ${t(item.sub)}`).join('. ')}. {t('idx.hero.trustNote')}
            </span>
          </div>

          <div>
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              {t('idx.hero.eyebrow')}
            </div>
            <h1 className="hero-h1 reveal reveal-delay-1">
              {t('idx.hero.h1')}
              <br />
              <em>{t('idx.hero.h1em')}</em>
            </h1>
            <MlAccent accentKey="idx.hero.mlAccent" locale={locale} />
            <p className="hero-sub reveal reveal-delay-2">{t('idx.hero.sub')}</p>
            <div className="hero-pills reveal reveal-delay-3">
              <span className="hero-pill">{t('idx.hero.pill1')}</span>
              <span className="hero-pill">{t('idx.hero.pill2')}</span>
              <span className="hero-pill">{t('idx.hero.pill3')}</span>
              <span className="hero-pill">{t('idx.hero.pill4')}</span>
              <span className="hero-pill">{t('idx.hero.pill5')}</span>
            </div>
            <div className="hero-btns reveal reveal-delay-4">
              <Link className="btn btn-primary btn-xl" to="/gold-rates/kerala">
                {t('idx.hero.ctaGoldRates')}
              </Link>
              <Link className="btn btn-ghost btn-lg" to="/gold-calculator">
                {t('nav.goldCalculator')}
              </Link>
              <Link className="btn btn-ghost btn-lg" to={exploreHref}>
                {t('idx.hero.cta1')}
              </Link>
              <Link className="btn btn-ghost btn-lg" to="/jeweller/apply">
                {t('idx.hero.cta2')}
              </Link>
            </div>
          </div>

          <div className="hero-visual reveal reveal-delay-2">
            <div className="hv-card">
              <div className="hv-card-eyebrow">{t('idx.hero.vaultLabel')}</div>
              <div className="hv-grams tn">
                14.820<span>g</span>
              </div>
              <div className="hv-inr">{t('idx.hero.boardRateNote')}</div>
              <div className="hv-sparkrow">
                <svg className="mini-spark" viewBox="0 0 300 48" preserveAspectRatio="none" style={{ height: 40, marginTop: 14 }}>
                  <defs>
                    <linearGradient id="hsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c9a840" stopOpacity=".2" />
                      <stop offset="100%" stopColor="#c9a840" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,40 C20,36 40,30 65,24 S110,14 140,12 S190,8 220,5 S265,3 300,2 L300,48 L0,48Z" fill="url(#hsg)" />
                  <path d="M0,40 C20,36 40,30 65,24 S110,14 140,12 S190,8 220,5 S265,3 300,2" fill="none" stroke="#c9a840" strokeWidth="1.8" />
                  <circle cx={300} cy={2} r={3.5} fill="#c9a840" />
                  <circle cx={300} cy={2} r={7} fill="#c9a840" fillOpacity=".2" />
                </svg>
              </div>
              <div className="hv-stats">
                <div className="hv-stat">
                  <div className="hv-stat-lbl">{t('idx.hero.unrealisedPL')}</div>
                  <div className="hv-stat-val text-ok tn">+₹11,332</div>
                </div>
                <div className="hv-stat">
                  <div className="hv-stat-lbl">{t('idx.hero.redeemable')}</div>
                  <div className="hv-stat-val text-gold tn">5.240 g</div>
                </div>
              </div>
            </div>

            <div className="hv-card-sm">
              <div className="hv-ico" style={{ background: 'rgba(35,197,94,.1)', border: '1px solid rgba(35,197,94,.2)' }} aria-hidden>
                🟢
              </div>
              <div>
                <div className="hv-sm-name">{t('idx.hero.txn1')}</div>
                <div className="hv-sm-detail">Malabar Gold, Kozhikode · INV-29481</div>
              </div>
              <div className="hv-sm-val">
                +0.420 g
                <br />
                <span style={{ fontSize: '0.65rem', color: 'var(--ink3)' }}>₹3,000</span>
              </div>
            </div>

            <div className="hv-card-sm">
              <div className="hv-ico" style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)' }} aria-hidden>
                📄
              </div>
              <div>
                <div className="hv-sm-name">{t('idx.hero.txn2')}</div>
                <div className="hv-sm-detail">Kalyan Jewellers, Thrissur · BILL-18241</div>
              </div>
              <div className="hv-sm-val">
                Stored
                <br />
                <span style={{ fontSize: '0.65rem', color: 'var(--ink3)' }}>Secure vault</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <div className="fstrip">
        <div className="fstrip-inner">
          {[
            { icon: '📊', bg: 'var(--gold-bg)', bd: 'var(--gold-bd)', title: 'idx.fstrip.f1title', sub: 'idx.fstrip.f1sub', d: '' },
            { icon: '📄', bg: 'rgba(35,197,94,.08)', bd: 'rgba(35,197,94,.18)', title: 'idx.fstrip.f2title', sub: 'idx.fstrip.f2sub', d: ' reveal-delay-1' },
            { icon: '🔔', bg: 'rgba(59,158,255,.08)', bd: 'rgba(59,158,255,.18)', title: 'idx.fstrip.f3title', sub: 'idx.fstrip.f3sub', d: ' reveal-delay-2' },
            { icon: '🤝', bg: 'rgba(201,168,64,.08)', bd: 'var(--gold-bd)', title: 'idx.fstrip.f4title', sub: 'idx.fstrip.f4sub', d: ' reveal-delay-3' },
          ].map((item) => (
            <div key={item.title} className={`fstrip-item reveal${item.d}`}>
              <div className="fs-ico" style={{ background: item.bg, border: `1px solid ${item.bd}` }}>
                {item.icon}
              </div>
              <div>
                <div className="fs-title">{t(item.title as MessageKey)}</div>
                <div className="fs-sub">{t(item.sub as MessageKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WHAT IS CRIDORA */}
      <section className="section" id="discover">
        <div className="inner">
          <SectionHeader
            eyebrowKey="idx.what.eyebrow"
            h2Key="idx.what.h2"
            subKey="idx.what.sub"
            accentKey="idx.what.mlAccent"
            locale={locale}
          />
          <div className="feat-grid" style={{ marginTop: 56 }}>
            {WHAT_CARDS.map((card) => (
              <div key={card.id} className={`feat-card reveal ${card.d ?? ''}`}>
                <div className="fc-ico">{card.icon}</div>
                <h3 className="fc-title">{card.title}</h3>
                <p className="fc-desc">{card.desc}</p>
                <span className="fc-tag">{card.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CUSTOMER BENEFITS */}
      <section className="section" id="customers" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)' }}>
        <div className="inner">
          <SectionHeader eyebrowKey="idx.cust.eyebrow" h2Key="idx.cust.h2" subKey="idx.cust.sub" locale={locale} />
          <div className="landing-india-grid" style={{ marginTop: 48 }}>
            {CUST_CARDS.map((card, ix) => (
              <div key={card.n} className={`landing-india-card${ix === 0 ? ' wide' : ''} reveal${ix > 0 ? ` reveal-delay-${ix}` : ''}`}>
                <div className="ic-num">{card.n}</div>
                <div>
                  <div className="ic-title">{card.title}</div>
                  <div className="ic-desc">{card.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONAL HOLDINGS */}
      <section className="section" id="holdings">
        <div className="inner">
          <SectionHeader
            eyebrowKey="idx.hold.eyebrow"
            h2Key="idx.hold.h2"
            subKey="idx.hold.sub"
            accentKey="idx.hold.mlAccent"
            locale={locale}
          />
          <div className="idx-benefit-grid" style={{ marginTop: 48 }}>
            {HOLD_CARDS.map((card, ix) => (
              <div key={`hold-${ix}`} className={`idx-benefit-card reveal${ix > 0 ? ` reveal-delay-${ix}` : ''}`}>
                <div className="idx-benefit-ico">{card.icon}</div>
                <div className="idx-benefit-title">{card.title}</div>
                <div className="idx-benefit-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BILL VAULT */}
      <section className="section" id="bills" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)' }}>
        <div className="inner">
          <SectionHeader
            eyebrowKey="idx.bills.eyebrow"
            h2Key="idx.bills.h2"
            subKey="idx.bills.sub"
            accentKey="idx.bills.mlAccent"
            locale={locale}
          />
          <div className="idx-benefit-grid idx-benefit-grid--3" style={{ marginTop: 48 }}>
            {BILL_CARDS.map((card, ix) => (
              <div key={`bill-${ix}`} className={`idx-benefit-card reveal${ix > 0 ? ` reveal-delay-${ix}` : ''}`}>
                <div className="idx-benefit-ico">{card.icon}</div>
                <div className="idx-benefit-title">{card.title}</div>
                <div className="idx-benefit-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NOTIFICATIONS */}
      <section className="section" id="notifications">
        <div className="inner">
          <SectionHeader
            eyebrowKey="idx.notif.eyebrow"
            h2Key="idx.notif.h2"
            subKey="idx.notif.sub"
            accentKey="idx.notif.mlAccent"
            locale={locale}
          />
          <div className="idx-benefit-grid" style={{ marginTop: 48 }}>
            {NOTIF_CARDS.map((card, ix) => (
              <div key={`notif-${ix}`} className={`idx-benefit-card reveal${ix > 0 ? ` reveal-delay-${ix}` : ''}`}>
                <div className="idx-benefit-ico">{card.icon}</div>
                <div className="idx-benefit-title">{card.title}</div>
                <div className="idx-benefit-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GOLD PORTFOLIO */}
      <section className="section" id="portfolio" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)', borderBottom: '1px solid var(--b0)' }}>
        <div className="inner">
          <SectionHeader eyebrowKey="idx.port.eyebrow" h2Key="idx.port.h2" subKey="idx.port.sub" locale={locale} />
          <div className="idx-portfolio-mock reveal" style={{ marginTop: 48 }}>
            <div className="idx-portfolio-card">
              <div className="idx-portfolio-label">{t('idx.port.vaultLabel')}</div>
              <div className="idx-portfolio-grams tn">
                14.820 <span>g</span>
              </div>
              <div className="idx-portfolio-inr tn">≈ ₹1,05,932</div>
              <svg viewBox="0 0 260 36" style={{ width: '100%', height: 36, marginTop: 16 }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a840" stopOpacity=".18" />
                    <stop offset="100%" stopColor="#c9a840" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,32 C20,28 40,22 70,18 S110,10 140,8 S190,5 220,3 S250,2 260,1 L260,36 L0,36Z" fill="url(#pg2)" />
                <path d="M0,32 C20,28 40,22 70,18 S110,10 140,8 S190,5 220,3 S250,2 260,1" fill="none" stroke="#c9a840" strokeWidth="1.6" />
              </svg>
              <div className="idx-portfolio-breakdown">
                <div className="idx-portfolio-chip">
                  <span>{t('idx.port.inHandLabel')}</span>
                  <strong className="tn">5.240 g</strong>
                </div>
                <div className="idx-portfolio-chip">
                  <span>{t('idx.port.purchasedLabel')}</span>
                  <strong className="tn">6.580 g</strong>
                </div>
                <div className="idx-portfolio-chip">
                  <span>{t('idx.port.importedLabel')}</span>
                  <strong className="tn">3.000 g</strong>
                </div>
                <div className="idx-portfolio-chip idx-portfolio-chip--gold">
                  <span>{t('idx.port.growthLabel')}</span>
                  <strong className="tn text-ok">+12.4%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SYSTEM INTEGRATION */}
      <section className="section" id="integration">
        <div className="inner">
          <SectionHeader
            eyebrowKey="idx.integr.eyebrow"
            h2Key="idx.integr.h2"
            subKey="idx.integr.sub"
            accentKey="idx.integr.mlAccent"
            locale={locale}
          />
          <div className="idx-benefit-grid" style={{ marginTop: 48 }}>
            {INTEGR_CARDS.map((card, ix) => (
              <div key={`integr-${ix}`} className={`idx-benefit-card reveal${ix > 0 ? ` reveal-delay-${ix}` : ''}`}>
                <div className="idx-benefit-ico">{card.icon}</div>
                <div className="idx-benefit-title">{card.title}</div>
                <div className="idx-benefit-desc">{card.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MEMBERSHIP SYSTEMS */}
      <section className="section idx-member-banner" id="membership">
        <div className="inner inner-mid">
          <div className="idx-member-inner reveal">
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              <div className="eyebrow-dot" aria-hidden />
              {t('idx.member.eyebrow')}
            </div>
            <h2 className="sh-md">{t('idx.member.h2')}</h2>
            <p className="sh-sub" style={{ marginTop: 10 }}>{t('idx.member.sub')}</p>
            <ul className="idx-member-list">
              {MEMBER_ITEMS.map((item, ix) => (
                <li key={`member-${ix}`}>{item}</li>
              ))}
            </ul>
            <div className="idx-row" style={{ marginTop: 24 }}>
              <Link className="btn btn-primary btn-lg" to="/jeweller/apply">
                {t('idx.hero.cta2')}
              </Link>
              <Link className="btn btn-ghost" to="/why-cridora">
                {t('idx.jw.cta2')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* JEWELLER BENEFITS */}
      <section className="section jw-section" id="jewellers">
        <div className="inner">
          <div className="jw-split">
            <div className="jw-mock reveal">
              <div className="jm-card">
                <div className="jm-header">
                  <div className="jm-av">MG</div>
                  <div>
                    <div className="jm-name">Malabar Gold &amp; Diamonds</div>
                    <div className="jm-city">
                      Kozhikode, Kerala · <span className="badge badge-ok">KYB Verified</span>
                    </div>
                  </div>
                </div>
                <div className="jm-rates">
                  <div className="jm-rate">
                    <label>{t('idx.jw.mockRate22k')}</label>
                    <span className="tn">₹7,142/g</span>
                  </div>
                  <div className="jm-rate">
                    <label>{t('idx.jw.mockBuyback')}</label>
                    <span className="gold tn">₹7,042/g</span>
                  </div>
                  <div className="jm-rate">
                    <label>{t('idx.jw.mockMaking')}</label>
                    <span className="tn">₹480/g</span>
                  </div>
                </div>
              </div>
              <div className="idx-jw-stats">
                <div className="idx-jw-stats-title">{t('idx.jw.mockDeskTitle')}</div>
                <div className="idx-jw-stats-grid">
                  {[
                    [t('idx.jw.mockCustomers'), '248'],
                    [t('idx.jw.mockNotifications'), '36 sent'],
                    [t('idx.jw.mockPortfolios'), '192 linked'],
                  ].map(([k, v]) => (
                    <div key={k} className="idx-jw-stat">
                      <div className="idx-jw-stat-lbl">{k}</div>
                      <div className="idx-jw-stat-val tn">{v}</div>
                    </div>
                  ))}
                  <div className="idx-jw-stat idx-jw-stat--gold">
                    <div className="idx-jw-stat-lbl">{t('idx.jw.mockNewCustomers')}</div>
                    <div className="idx-jw-stat-val tn">+7</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="eyebrow reveal">
                <div className="eyebrow-dot" aria-hidden />
                {t('idx.jw.eyebrow')}
              </div>
              <h2 className="sh-md reveal reveal-delay-1">{t('idx.jw.h2')}</h2>
              <MlAccent accentKey="idx.jw.mlAccent" locale={locale} />
              <p className="sh-sub reveal reveal-delay-2">{t('idx.jw.sub')}</p>
              <div className="jw-features">
                {JW_FEATURES.map((item, ix) => (
                  <div key={`jw-${ix}`} className={`jw-feat reveal reveal-delay-${Math.min(ix + 1, 5)}`}>
                    <div className="jf-ico">{item.icon}</div>
                    <div>
                      <div className="jf-title">{item.title}</div>
                      <div className="jf-desc">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="idx-row" style={{ marginTop: 28 }}>
                <Link className="btn btn-primary btn-lg" to="/jeweller/apply">
                  {t('idx.jw.cta1')}
                </Link>
                <Link className="btn btn-ghost" to="/why-cridora">
                  {t('idx.jw.cta2')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="inner">
          <SectionHeader eyebrowKey="idx.how.eyebrow" h2Key="idx.how.h2" subKey="idx.how.sub" locale={locale} />
          <div className="idx-dual-flow" style={{ marginTop: 48 }}>
            <div className="idx-flow-col reveal">
              <h3 className="idx-flow-title">{t('idx.how.customerTitle')}</h3>
              {CUSTOMER_STEPS.map((step, ix) => (
                <div key={step.n} className={`idx-step-card${ix > 0 ? ` reveal-delay-${ix}` : ''}`}>
                  <div className="idx-step-num">{step.n}</div>
                  <div>
                    <div className="idx-step-title">{step.title}</div>
                    <div className="idx-step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="idx-flow-col reveal reveal-delay-1">
              <h3 className="idx-flow-title">{t('idx.how.jewellerTitle')}</h3>
              {JEWELLER_STEPS.map((step, ix) => (
                <div key={step.n} className={`idx-step-card${ix > 0 ? ` reveal-delay-${ix}` : ''}`}>
                  <div className="idx-step-num">{step.n}</div>
                  <div>
                    <div className="idx-step-title">{step.title}</div>
                    <div className="idx-step-desc">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUSTED MODERNIZATION */}
      <section className="section" id="trust" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)' }}>
        <div className="inner">
          <SectionHeader eyebrowKey="idx.modern.eyebrow" h2Key="idx.modern.h2" subKey="idx.modern.sub" locale={locale} />
          <div className="landing-trust-grid" style={{ marginTop: 48 }}>
            {MODERN_CELLS.map((cell, ix) => (
              <div key={`modern-${ix}`} className={`landing-trust-cell reveal ${cell.d ?? ''}`}>
                <div className="tc-ico" aria-hidden>
                  {cell.icon}
                </div>
                <div>
                  <div className="tc-title">{cell.title}</div>
                  <div className="tc-desc">{cell.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="inner inner-narrow">
          <SectionHeader eyebrowKey="idx.faq.eyebrow" h2Key="idx.faq.h2" subKey="idx.faq.sub" locale={locale} />
          <div className="idx-faq-list reveal" style={{ marginTop: 40 }}>
            {FAQ_ITEMS.map((item, ix) => {
              const isOpen = openFaq === ix
              return (
                <div key={`faq-${ix}`} className="idx-faq-item">
                  <button
                    type="button"
                    className="idx-faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : ix)}
                  >
                    <span>{item.q}</span>
                    <span className="idx-faq-icon" aria-hidden>
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen ? <div className="idx-faq-a">{item.a}</div> : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" id="join">
        <div className="cta-inner">
          <div className="eyebrow reveal" style={{ margin: '0 auto 18px' }}>
            <div className="eyebrow-dot" aria-hidden />
            {t('idx.cta.eyebrow')}
          </div>
          <h2 className="sh reveal reveal-delay-1">{t('idx.cta.h2')}</h2>
          <MlAccent accentKey="idx.cta.mlAccent" locale={locale} />
          <p className="sh-sub reveal reveal-delay-2" style={{ margin: '12px auto 0' }}>
            {t('idx.cta.sub')}
          </p>

          <div className="cta-input-row reveal reveal-delay-2">
            <label htmlFor="idx-cta-placeholder" className="sr-only">
              {t('idx.cta.placeholder')}
            </label>
            <input id="idx-cta-placeholder" className="cta-input" type="tel" placeholder={t('idx.cta.placeholder')} />
            <Link className="btn btn-primary btn-lg" to="/signup">
              {t('idx.cta.btn')}
            </Link>
          </div>
          <div className="idx-row idx-row--center reveal reveal-delay-3" style={{ marginTop: 16, justifyContent: 'center' }}>
            <Link className="btn btn-ghost" to="/jeweller/apply">
              {t('idx.cta.btnJeweller')}
            </Link>
            <Link className="btn btn-ghost" to="/waitlist">
              {t('idx.cta.btnWaitlist')}
            </Link>
          </div>
          <div className="cta-note reveal reveal-delay-3">{t('idx.cta.note')}</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 40, flexWrap: 'wrap' }}>
            {CTA_STATS.map(([val, label], i, arr) => (
              <Fragment key={label}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--gold-hi)', fontVariantNumeric: 'tabular-nums' }}>{val}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink2)', marginTop: 3 }}>{label}</div>
                </div>
                {i < arr.length - 1 ? (
                  <div style={{ width: 1, background: 'var(--b0)', flexShrink: 0 }} aria-hidden />
                ) : null}
              </Fragment>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
