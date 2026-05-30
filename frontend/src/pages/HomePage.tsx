import { Fragment, useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { usePublicLocale } from '@/i18n/PublicLocaleProvider'
import { useRefLandingReveal } from '@/hooks/useRefLandingReveal'
import { dashboardLandingPath } from '@/lib/routes'

export function HomePage() {
  const { user } = useAuth()
  const { t } = usePublicLocale()
  useRefLandingReveal()

  const [investTab, setInvestTab] = useState(0)
  const goInvestTab = useCallback((i: number) => setInvestTab(i), [])

  const INVEST_TABS = useMemo(
    () => [
      {
        key: 'all',
        label: t('idx.inv.tab0label'),
        hint: t('idx.inv.tab0hint'),
        lead: t('idx.inv.tab0lead'),
      },
      {
        key: 'fractional',
        label: t('idx.inv.tab1label'),
        hint: t('idx.inv.tab1hint'),
        lead: t('idx.inv.tab1lead'),
      },
      {
        key: 'deposit',
        label: t('idx.inv.tab2label'),
        hint: t('idx.inv.tab2hint'),
        lead: t('idx.inv.tab2lead'),
      },
      {
        key: 'purchase',
        label: t('idx.inv.tab3label'),
        hint: t('idx.inv.tab3hint'),
        lead: t('idx.inv.tab3lead'),
      },
    ],
    [t],
  )

  const INVEST_METHODS = useMemo(
    () => [
      {
        tabIndex: 1 as const,
        num: t('idx.inv.m1num'),
        title: t('idx.inv.m1title'),
        desc: t('idx.inv.m1desc'),
        tag: t('idx.inv.m1tag'),
        highlights: [t('idx.inv.m1h1'), t('idx.inv.m1h2'), t('idx.inv.m1h3')] as const,
      },
      {
        tabIndex: 2 as const,
        num: t('idx.inv.m2num'),
        title: t('idx.inv.m2title'),
        desc: t('idx.inv.m2desc'),
        tag: t('idx.inv.m2tag'),
        highlights: [t('idx.inv.m2h1'), t('idx.inv.m2h2'), t('idx.inv.m2h3')] as const,
      },
      {
        tabIndex: 3 as const,
        num: t('idx.inv.m3num'),
        title: t('idx.inv.m3title'),
        desc: t('idx.inv.m3desc'),
        tag: t('idx.inv.m3tag'),
        highlights: [t('idx.inv.m3h1'), t('idx.inv.m3h2'), t('idx.inv.m3h3')] as const,
      },
    ],
    [t],
  )

  const HOW_STEPS = useMemo(
    () => [
      { n: '1', title: t('idx.how.s1title'), desc: t('idx.how.s1desc') },
      { n: '2', title: t('idx.how.s2title'), desc: t('idx.how.s2desc') },
      { n: '3', title: t('idx.how.s3title'), desc: t('idx.how.s3desc') },
      { n: '4', title: t('idx.how.s4title'), desc: t('idx.how.s4desc') },
    ],
    [t],
  )

  const TRUST_CELLS = useMemo(
    () => [
      { icon: '🪪', title: t('idx.trust.t1title'), desc: t('idx.trust.t1desc') },
      { icon: '🏅', title: t('idx.trust.t2title'), desc: t('idx.trust.t2desc'), d: 'reveal-delay-1' },
      { icon: '🏢', title: t('idx.trust.t3title'), desc: t('idx.trust.t3desc'), d: 'reveal-delay-2' },
      { icon: '📋', title: t('idx.trust.t4title'), desc: t('idx.trust.t4desc'), d: 'reveal-delay-1' },
      { icon: '🔑', title: t('idx.trust.t5title'), desc: t('idx.trust.t5desc'), d: 'reveal-delay-2' },
      { icon: '📊', title: t('idx.trust.t6title'), desc: t('idx.trust.t6desc'), d: 'reveal-delay-3' },
    ],
    [t],
  )

  const JW_FEATURES = useMemo(
    () => [
      { icon: '💳', title: t('idx.jw.f1title'), desc: t('idx.jw.f1desc') },
      { icon: '📦', title: t('idx.jw.f2title'), desc: t('idx.jw.f2desc') },
      { icon: '👥', title: t('idx.jw.f3title'), desc: t('idx.jw.f3desc') },
      { icon: '🏪', title: t('idx.jw.f4title'), desc: t('idx.jw.f4desc') },
    ],
    [t],
  )

  const CTA_STATS = useMemo(
    () => [
      ['₹10', t('idx.cta.stat1label')],
      ['3 min', t('idx.cta.stat2label')],
      ['0%', t('idx.cta.stat3label')],
      ['42+', t('idx.cta.stat4label')],
    ],
    [t],
  )

  const visibleInvestMethods = useMemo(
    () => (investTab === 0 ? INVEST_METHODS : INVEST_METHODS.filter((m) => m.tabIndex === investTab)),
    [investTab, INVEST_METHODS],
  )

  const activeInvestLead = INVEST_TABS[investTab]?.lead ?? INVEST_TABS[0].lead

  const startHref = user ? dashboardLandingPath(user) : '/signup'

  return (
    <div className="ref-landing">
      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-inner">
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
            <p className="hero-sub reveal reveal-delay-2">{t('idx.hero.sub')}</p>
            <div className="hero-pills reveal reveal-delay-3">
              <span className="hero-pill">{t('idx.hero.pill1')}</span>
              <span className="hero-pill">{t('idx.hero.pill2')}</span>
              <span className="hero-pill">{t('idx.hero.pill3')}</span>
              <span className="hero-pill">{t('idx.hero.pill4')}</span>
              <span className="hero-pill">{t('idx.hero.pill5')}</span>
            </div>
            <div className="hero-btns reveal reveal-delay-4">
              <Link className="btn btn-primary btn-xl" to={startHref}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width={15} height={15}>
                  <circle cx="10" cy="10" r="8" />
                  <path d="M10 6v4l3 2" />
                </svg>
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
                  <path
                    d="M0,40 C20,36 40,30 65,24 S110,14 140,12 S190,8 220,5 S265,3 300,2 L300,48 L0,48Z"
                    fill="url(#hsg)"
                  />
                  <path
                    d="M0,40 C20,36 40,30 65,24 S110,14 140,12 S190,8 220,5 S265,3 300,2"
                    fill="none"
                    stroke="#c9a840"
                    strokeWidth="1.8"
                  />
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
                  <div className="hv-stat-val text-gold tn">12.340 g</div>
                </div>
              </div>
            </div>

            <div className="hv-card-sm">
              <div
                className="hv-ico"
                style={{ background: 'rgba(35,197,94,.1)', border: '1px solid rgba(35,197,94,.2)' }}
                aria-hidden
              >
                🟢
              </div>
              <div>
                <div className="hv-sm-name">{t('idx.hero.txn1')}</div>
                <div className="hv-sm-detail">Malabar Gold, Kozhikode · FR-29481-05</div>
              </div>
              <div className="hv-sm-val">
                +0.420 g
                <br />
                <span style={{ fontSize: '0.65rem', color: 'var(--ink3)' }}>₹3,000</span>
              </div>
            </div>

            <div className="hv-card-sm">
              <div className="hv-ico" style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)' }} aria-hidden>
                🏦
              </div>
              <div>
                <div className="hv-sm-name">{t('idx.hero.txn2')}</div>
                <div className="hv-sm-detail">Kalyan Jewellers, Thrissur · DP-18241</div>
              </div>
              <div className="hv-sm-val">
                +5.000 g
                <br />
                <span style={{ fontSize: '0.65rem', color: 'var(--ink3)' }}>₹34,800</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <div className="fstrip">
        <div className="fstrip-inner">
          <div className="fstrip-item reveal">
            <div className="fs-ico" style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-bd)' }}>
              🪙
            </div>
            <div>
              <div className="fs-title">{t('idx.fstrip.f1title')}</div>
              <div className="fs-sub">{t('idx.fstrip.f1sub')}</div>
            </div>
          </div>
          <div className="fstrip-item reveal reveal-delay-1">
            <div className="fs-ico" style={{ background: 'rgba(35,197,94,.08)', border: '1px solid rgba(35,197,94,.18)' }}>
              📦
            </div>
            <div>
              <div className="fs-title">{t('idx.fstrip.f2title')}</div>
              <div className="fs-sub">{t('idx.fstrip.f2sub')}</div>
            </div>
          </div>
          <div className="fstrip-item reveal reveal-delay-2">
            <div className="fs-ico" style={{ background: 'rgba(59,158,255,.08)', border: '1px solid rgba(59,158,255,.18)' }}>
              💳
            </div>
            <div>
              <div className="fs-title">{t('idx.fstrip.f3title')}</div>
              <div className="fs-sub">{t('idx.fstrip.f3sub')}</div>
            </div>
          </div>
          <div className="fstrip-item reveal reveal-delay-3">
            <div className="fs-ico" style={{ background: 'rgba(240,71,71,.07)', border: '1px solid rgba(240,71,71,.15)' }}>
              🔐
            </div>
            <div>
              <div className="fs-title">{t('idx.fstrip.f4title')}</div>
              <div className="fs-sub">{t('idx.fstrip.f4sub')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* DISCOVER */}
      <section className="section" id="discover">
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              {t('idx.disc.eyebrow')}
            </div>
            <h2 className="sh reveal reveal-delay-1">{t('idx.disc.h2')}</h2>
            <p className="sh-sub reveal reveal-delay-2">{t('idx.disc.sub')}</p>
          </div>

          <div className="feat-grid" style={{ marginTop: 56 }}>
            <div className="feat-card feat-card-large reveal">
              <div>
                <div className="fc-ico">🏛️</div>
                <h3 className="fc-title">{t('idx.disc.c1title')}</h3>
                <p className="fc-desc">{t('idx.disc.c1desc')}</p>
                <span className="fc-tag">{t('idx.disc.c1tag')}</span>
              </div>
              <div>
                <div
                  style={{
                    background: 'var(--s1)',
                    border: '1px solid var(--b0)',
                    borderRadius: 'var(--r2)',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--ink3)',
                      marginBottom: 10,
                    }}
                  >
                    {t('idx.disc.vaultLabel')}
                  </div>
                  <div
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 900,
                      color: 'var(--gold-hi)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    14.820 <span style={{ fontSize: '0.8rem', color: 'var(--ink2)', fontWeight: 600 }}>g</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink2)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                    ≈ ₹1,05,932
                  </div>
                  <svg viewBox="0 0 260 36" style={{ width: '100%', height: 30, marginTop: 12 }} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c9a840" stopOpacity=".18" />
                        <stop offset="100%" stopColor="#c9a840" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,32 C20,28 40,22 70,18 S110,10 140,8 S190,5 220,3 S250,2 260,1 L260,36 L0,36Z"
                      fill="url(#cg2)"
                    />
                    <path
                      d="M0,32 C20,28 40,22 70,18 S110,10 140,8 S190,5 220,3 S250,2 260,1"
                      fill="none"
                      stroke="#c9a840"
                      strokeWidth="1.6"
                    />
                  </svg>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                    <div
                      style={{
                        background: 'var(--s2)',
                        border: '1px solid var(--b0)',
                        borderRadius: 'var(--r1)',
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.56rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ink3)',
                          marginBottom: 3,
                        }}
                      >
                        {t('idx.disc.fractionalLabel')}
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                        9.340 g
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'var(--s2)',
                        border: '1px solid var(--b0)',
                        borderRadius: 'var(--r1)',
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.56rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ink3)',
                          marginBottom: 3,
                        }}
                      >
                        {t('idx.disc.depositLabel')}
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                        5.000 g
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="feat-card reveal reveal-delay-1">
              <div className="fc-ico" style={{ background: 'rgba(35,197,94,.08)', borderColor: 'rgba(35,197,94,.18)' }}>
                📈
              </div>
              <h3 className="fc-title">{t('idx.disc.c2title')}</h3>
              <p className="fc-desc">{t('idx.disc.c2desc')}</p>
              <span className="fc-tag">{t('idx.disc.c2tag')}</span>
            </div>

            <div className="feat-card reveal reveal-delay-2">
              <div className="fc-ico" style={{ background: 'rgba(59,158,255,.08)', borderColor: 'rgba(59,158,255,.18)' }}>
                🔄
              </div>
              <h3 className="fc-title">{t('idx.disc.c3title')}</h3>
              <p className="fc-desc">{t('idx.disc.c3desc')}</p>
              <span className="fc-tag">{t('idx.disc.c3tag')}</span>
            </div>

            <div className="feat-card reveal reveal-delay-1">
              <div className="fc-ico">💍</div>
              <h3 className="fc-title">{t('idx.disc.c4title')}</h3>
              <p className="fc-desc">{t('idx.disc.c4desc')}</p>
              <span className="fc-tag">{t('idx.disc.c4tag')}</span>
            </div>

            <div className="feat-card reveal reveal-delay-2">
              <div className="fc-ico" style={{ background: 'rgba(240,71,71,.07)', borderColor: 'rgba(240,71,71,.15)' }}>
                🛡️
              </div>
              <h3 className="fc-title">{t('idx.disc.c5title')}</h3>
              <p className="fc-desc">{t('idx.disc.c5desc')}</p>
              <span className="fc-tag">{t('idx.disc.c5tag')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <div className="quote-banner">
        <div className="inner-mid">
          <blockquote className="qb-text reveal">{t('idx.quote.text')}</blockquote>
          <div className="qb-source reveal reveal-delay-1">{t('idx.quote.source')}</div>
        </div>
      </div>

      {/* HOW */}
      <section className="section" id="how">
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              {t('idx.how.eyebrow')}
            </div>
            <h2 className="sh reveal reveal-delay-1">{t('idx.how.h2')}</h2>
            <p className="sh-sub reveal reveal-delay-2">{t('idx.how.sub')}</p>
          </div>

          <div className="idx-steps">
            {HOW_STEPS.map((step, idx) => (
              <div key={step.n} className={`idx-step-card reveal${idx > 0 ? ` reveal-delay-${idx}` : ''}`}>
                <div className="idx-step-num">{step.n}</div>
                <div>
                  <div className="idx-step-title">{step.title}</div>
                  <div className="idx-step-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INVEST */}
      <section className="section" id="invest" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)', borderBottom: '1px solid var(--b0)' }}>
        <div className="inner">
          <div className="inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              {t('idx.inv.eyebrow')}
            </div>
            <h2 className="sh reveal reveal-delay-1">{t('idx.inv.h2')}</h2>
            <p className="sh-sub reveal reveal-delay-2">{t('idx.inv.sub')}</p>
          </div>

          <div className="invest-tabs-wrap reveal" style={{ marginTop: 36 }}>
            <div className="invest-tabs" role="tablist" aria-label={t('idx.inv.ariaLabel')}>
              {INVEST_TABS.map((tab, i) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={investTab === i}
                  id={`invest-tab-${String(i)}`}
                  aria-controls="invest-methods-panel"
                  tabIndex={investTab === i ? 0 : -1}
                  className={`it-btn${investTab === i ? ' on' : ''}`}
                  onClick={() => goInvestTab(i)}
                >
                  <span className="it-btn__label">{tab.label}</span>
                  <span className="it-btn__hint">{tab.hint}</span>
                </button>
              ))}
            </div>
            <p id="invest-panel-lead" className="invest-panel-lead">
              {activeInvestLead}
            </p>
            <p className="invest-panel-lead" style={{ marginTop: '0.65rem', fontSize: '0.92rem', opacity: 0.88 }}>
              {t('idx.inv.insightsNote')}
            </p>
          </div>

          <div
            id="invest-methods-panel"
            role="tabpanel"
            aria-labelledby={`invest-tab-${String(investTab)}`}
            aria-describedby="invest-panel-lead"
            className={`invest-grid reveal reveal-delay-1${investTab === 0 ? ' invest-grid--all' : ' invest-grid--focused'}`}
          >
            {visibleInvestMethods.map((m) => (
              <div key={m.num} className={`invest-card${investTab !== 0 ? ' invest-card--featured' : ''}`}>
                <div className="invc-num">{m.num}</div>
                <div className="invc-title">{m.title}</div>
                <div className="invc-desc">{m.desc}</div>
                <ul className="invc-highlights">
                  {m.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <span className="invc-tag">{m.tag}</span>
              </div>
            ))}
            <div className="invest-card invest-card--redemption" style={{ background: 'var(--s1)' }}>
              <div className="invc-num">{t('idx.inv.redNum')}</div>
              <div className="invc-title">{t('idx.inv.redTitle')}</div>
              <div className="invc-desc">
                <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>{t('idx.inv.redCash')}</strong>
                {t('idx.inv.redCashDesc')}
                <br />
                <br />
                <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>{t('idx.inv.redTransfer')}</strong>
                {t('idx.inv.redTransferDesc')}
                <br />
                <br />
                <strong style={{ color: 'var(--ink)', display: 'block', marginBottom: 4 }}>{t('idx.inv.redLoan')}</strong>
                {t('idx.inv.redLoanDesc')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BUILT FOR INDIA */}
      <section className="section">
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              {t('idx.india.eyebrow')}
            </div>
            <h2 className="sh reveal reveal-delay-1">{t('idx.india.h2')}</h2>
            <p className="sh-sub reveal reveal-delay-2">{t('idx.india.sub')}</p>
          </div>

          <div className="landing-india-grid">
            <div className="landing-india-card wide reveal">
              <div className="ic-num">01</div>
              <div>
                <div className="ic-title">{t('idx.india.c1title')}</div>
                <div className="ic-desc">{t('idx.india.c1desc')}</div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-1">
              <div className="ic-num">02</div>
              <div>
                <div className="ic-title">{t('idx.india.c2title')}</div>
                <div className="ic-desc">{t('idx.india.c2desc')}</div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-2">
              <div className="ic-num">03</div>
              <div>
                <div className="ic-title">{t('idx.india.c3title')}</div>
                <div className="ic-desc">{t('idx.india.c3desc')}</div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-1">
              <div className="ic-num">04</div>
              <div>
                <div className="ic-title">{t('idx.india.c4title')}</div>
                <div className="ic-desc">{t('idx.india.c4desc')}</div>
              </div>
            </div>
            <div className="landing-india-card reveal reveal-delay-2">
              <div className="ic-num">05</div>
              <div>
                <div className="ic-title">{t('idx.india.c5title')}</div>
                <div className="ic-desc">{t('idx.india.c5desc')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="section" id="trust" style={{ background: 'var(--s0)', borderTop: '1px solid var(--b0)' }}>
        <div className="inner">
          <div className="center inner-narrow">
            <div className="eyebrow reveal">
              <div className="eyebrow-dot" aria-hidden />
              {t('idx.trust.eyebrow')}
            </div>
            <h2 className="sh reveal reveal-delay-1">{t('idx.trust.h2')}</h2>
          </div>

          <div className="landing-trust-grid">
            {TRUST_CELLS.map((cell) => (
              <div key={cell.title} className={`landing-trust-cell reveal ${cell.d ?? ''}`}>
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

      {/* JEWELLERS */}
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
              <div style={{ background: 'var(--s0)', border: '1px solid var(--b0)', borderRadius: 'var(--r3)', padding: 18, boxShadow: 'var(--cs)' }}>
                <div
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink3)',
                    marginBottom: 12,
                  }}
                >
                  {t('idx.jw.mockDeskTitle')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    [t('idx.jw.mockPurchases'), '14 txns'],
                    [t('idx.jw.mockDeposits'), '3 txns'],
                    [t('idx.jw.mockCridorapay'), '₹2.4L'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 'var(--r1)', padding: '11px 13px' }}>
                      <div
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: 'var(--ink3)',
                          marginBottom: 4,
                        }}
                      >
                        {k}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                    </div>
                  ))}
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      background: 'var(--gold-bg)',
                      border: '1px solid var(--gold-bd)',
                      borderRadius: 'var(--r1)',
                      padding: '11px 13px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--ink3)',
                        marginBottom: 4,
                      }}
                    >
                      {t('idx.jw.mockNewCustomers')}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--gold-hi)', fontVariantNumeric: 'tabular-nums' }}>+7 today</div>
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
              <p className="sh-sub reveal reveal-delay-2">{t('idx.jw.sub')}</p>

              <div className="jw-features">
                {JW_FEATURES.map((item, ix) => (
                  <div key={item.title} className={`jw-feat reveal reveal-delay-${ix + 1}`}>
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
                <Link className="btn btn-ghost" to="/investors">
                  {t('idx.jw.cta2')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* JOIN */}
      <section className="cta-section" id="join">
        <div className="cta-inner">
          <div className="eyebrow reveal" style={{ margin: '0 auto 18px' }}>
            <div className="eyebrow-dot" aria-hidden />
            {t('idx.cta.eyebrow')}
          </div>
          <h2 className="sh reveal reveal-delay-1">{t('idx.cta.h2')}</h2>
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
          <div className="cta-note reveal reveal-delay-3">{t('idx.cta.note')}</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 40, flexWrap: 'wrap' }}>
            {CTA_STATS.map(([val, label], i, arr) => (
              <Fragment key={val}>
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
