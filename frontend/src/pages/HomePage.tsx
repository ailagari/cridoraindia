import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { HeroArabesqueBackground } from '@/components/HeroArabesqueBackground'
import { IMAGES } from '@/content/images'

const POSITIONING_LINE =
  'A live gold utility and redemption ecosystem — not stock, ETFs, or simple digital gold.'

const TAGLINE = 'Live gold savings, portfolio & redemption network'

const HERO_POINTS = [
  'Buy gold: fractional purchase, verified gold deposit, and GoldNest (recurring savings) — BIS 916, India only; live portfolio value.',
  'Track gold: total grams, live ₹ value, profit/loss, redeemable quantity; ledgers split by fractional, deposit, and GoldNest.',
  'Use & redeem: ornament redemption (same-jeweller making-charge benefits or cross-jeweller settlement), cash sellback, 0% gold loans (2% processing), transfers, and emergency liquidity — nationwide in the Cridora network.',
] as const

const EXPLORE = [
  {
    title: 'Why Cridora',
    blurb: 'Trust positioning for savers, jewellers, and the platform — buy, track, use, redeem anywhere in the network.',
    to: '/why-cridora',
    primary: true,
    cta: 'Read more',
  },
  {
    title: 'Features',
    blurb: 'Phase 1 modules: marketplace, portfolio, ornament & cash redemption, loans, transfers, emergency funds.',
    to: '/features',
    primary: false,
    cta: 'View features',
  },
  {
    title: 'Jeweller marketplace',
    blurb: 'Pick trusted partners — live rate, sellback, lock-in, credibility, same-store benefits, cross-redemption fees.',
    to: '/jewellers',
    primary: false,
    cta: 'Compare jewellers',
  },
  {
    title: 'Product marketplace',
    blurb: 'Ornaments and coins with BIS 916, making charges, and “Use your gold” checkout.',
    to: '/marketplace',
    primary: false,
    cta: 'Browse products',
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
                Phase 1 MVP · {TAGLINE}
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
                  Open a customer account
                </Link>
                <Link to="/jeweller/apply" className="btn btn-ghost">
                  Apply as jeweller
                </Link>
                <Link to="/marketplace" className="btn btn-ghost">
                  Product marketplace
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
                <strong style={{ color: 'var(--text)' }}>Three holding types</strong> — fractional gold, verified
                deposits, and GoldNest; each appears separately in portfolio, ledgers, redemption, and reports.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Portfolio dashboard</strong> — total grams, live value,
                profit/loss, redeemable gold; per-jeweller detail with lock-in and eligibility.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Ornament redemption</strong> — same jeweller: making-charge
                benefits (0%, reduced, category rules). Other jeweller: making, GST on making, cross-platform fee; gold
                liability settles between partners.
              </li>
              <li>
                <strong style={{ color: 'var(--text)' }}>Trust gates</strong> — customer KYC, jeweller verification,
                product and marketplace moderation before anything goes public.
              </li>
            </ul>
            <p style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link to="/why-cridora" className="btn btn-ghost">
                Why Cridora
              </Link>
              <Link to="/features" className="btn btn-ghost">
                Platform features
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
          Start from a small amount, compare jewellers, and use gold as a utility — with KYC, KYB, and admin gates on
          every public listing. Phase 1 scope: gold, BIS 916, India only. Deeper narrative on{' '}
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
