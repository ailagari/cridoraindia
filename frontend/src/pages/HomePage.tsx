import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { HeroArabesqueBackground } from '@/components/HeroArabesqueBackground'
import { IMAGES } from '@/content/images'

const POSITIONING_LINE =
  'A live gold utility and redemption ecosystem — not stock, ETFs, or simple digital gold.'

const TAGLINE = 'Live gold savings, portfolio & redemption network'

const HERO_POINTS = [
  'Accumulate gold across verified jewellers with clear vault IDs.',
  'See grams and live value without drowning in feature lists.',
  'Redeem or transfer with policies visible before you confirm.',
] as const

const EXPLORE = [
  {
    title: 'How it works',
    blurb: 'Four calm steps from jeweller choice to redemption.',
    to: '/how-it-works',
    primary: true,
    cta: 'View flow',
  },
  {
    title: 'Why Cridora',
    blurb: 'Positioning for savers and partners—when you want the full narrative.',
    to: '/why-cridora',
    primary: false,
    cta: 'Read more',
  },
  {
    title: 'Jewellers',
    blurb: 'Compare verified storefronts, rates, and trust signals.',
    to: '/jewellers',
    primary: false,
    cta: 'Browse network',
  },
  {
    title: 'Products',
    blurb: 'BIS 916 ornaments with transparent pricing inputs.',
    to: '/marketplace',
    primary: false,
    cta: 'Browse showcase',
  },
] as const

function sd(index: number): CSSProperties {
  return { ['--reveal-delay' as string]: `${index * 0.06}s` }
}

export function HomePage() {
  let r = 0
  const d = () => r++
  return (
    <>
      <section className="home-hero">
        <HeroArabesqueBackground />
        <div className="container home-hero__content">
          <div className="grid-2">
            <div>
              <span className={`pill cridora-reveal`} style={sd(d())}>
                {TAGLINE}
              </span>
              <h1
                className="cridora-reveal"
                style={{
                  fontSize: 'clamp(2.25rem, 5vw, 3.25rem)',
                  lineHeight: 1.12,
                  margin: '1rem 0',
                  ...sd(d()),
                }}
              >
                Buy gold · Track gold ·{' '}
                <span style={{ color: 'var(--gold-light)' }}>Use &amp; redeem gold</span> in the Cridora network
              </h1>
              <ul
                className="cridora-reveal"
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: '0.65rem',
                  maxWidth: 'min(46ch, 100%)',
                  fontSize: '1.05rem',
                  ...sd(d()),
                }}
              >
                {HERO_POINTS.map((text, idx) => (
                  <li
                    key={idx}
                    className="card"
                    style={{
                      margin: 0,
                      display: 'flex',
                      gap: '0.6rem',
                      alignItems: 'flex-start',
                      padding: '0.8rem 1rem',
                      lineHeight: 1.55,
                      borderRadius: 'calc(var(--radius) - 2px)',
                    }}
                  >
                    <span aria-hidden style={{ color: 'var(--gold-light)', flexShrink: 0, marginTop: '0.12em' }}>
                      •
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{text}</span>
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
                <Link to="/signup" className="btn btn-primary">
                  Open account
                </Link>
                <Link to="/how-it-works" className="btn btn-ghost">
                  How it works
                </Link>
                <Link to="/waitlist" className="btn btn-ghost">
                  Waitlist
                </Link>
              </div>
            </div>
            <div
              className="cridora-reveal cridora-card-motion media-frame media-frame--hero"
              style={{
                position: 'relative',
                ...sd(d()),
              }}
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
                  background:
                    'linear-gradient(135deg, var(--veil-35) 0%, var(--navy-55) 100%)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingBottom: '1.5rem' }}>
        <blockquote
          className="card cridora-quote cridora-card-motion"
          style={{
            margin: 0,
            padding: '1.15rem 1.35rem',
            borderRadius: 18,
            fontSize: 'clamp(0.98rem, 1.9vw, 1.2rem)',
            fontWeight: 600,
            fontStyle: 'italic',
            letterSpacing: '-0.015em',
            lineHeight: 1.45,
            color: 'var(--text)',
            border: '1px solid var(--border-soft)',
            background: 'linear-gradient(120deg, var(--veil-40) 0%, var(--navy-55) 100%)',
          }}
        >
          “{POSITIONING_LINE}”
        </blockquote>
      </div>

      <section className="section-band">
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
            <h2 style={{ fontSize: '1.85rem', marginTop: 0 }}>
              Redemption network, portfolio utility, jeweller trust
            </h2>
            <ul
              style={{
                color: 'var(--text-muted)',
                paddingLeft: '1.1rem',
                display: 'grid',
                gap: '0.65rem',
              }}
            >
              <li>
                <strong style={{ color: 'var(--text)' }}>Vault-aware ledger</strong> — fractional gold, deposits, and schemes stay
                separated per jeweller relationship.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Portfolio clarity</strong> — grams, indicative value, and eligibility without redundant dashboards.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Governed marketplace</strong> — KYC, KYB, and listing review before anything is public.
              </li>
            </ul>
            <p style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link to="/how-it-works" className="btn btn-ghost">
                How it works
              </Link>
              <Link to="/investors" className="btn btn-ghost">
                Investors
              </Link>
            </p>
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
        </div>
      </section>

      <section className="container" style={{ padding: '3rem 0 4rem' }}>
        <h2 className="cridora-reveal" style={{ textAlign: 'center', marginBottom: '0.5rem', ...sd(d()) }}>
          Explore the network
        </h2>
        <p
          className="cridora-reveal"
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            marginBottom: '2rem',
            maxWidth: '56ch',
            marginInline: 'auto',
            ...sd(d()),
          }}
        >
          Start small, compare jewellers, and treat gold as infrastructure—not noise. India-first, BIS 916 focus. Deeper story on{' '}
          <Link to="/why-cridora">Why Cridora</Link>.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {EXPLORE.map((item) => (
            <div
              key={item.to}
              className="card cridora-card-motion cridora-reveal"
              style={{
                ...sd(d()),
                borderRadius: 20,
                padding: '1.25rem 1.35rem',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ marginTop: 0, fontSize: '1.08rem' }}>{item.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', flex: 1, lineHeight: 1.5 }}>
                {item.blurb}
              </p>
              <Link
                to={item.to}
                className={item.primary ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
              >
                {item.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
