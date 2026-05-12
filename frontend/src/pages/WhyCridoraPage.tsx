import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

const POSITIONING =
  'A live gold utility and redemption ecosystem — not simple balance-only digital gold, not stocks, ETFs, or commodity day-trading.'

const PILLARS: { title: string; hint: string }[] = [
  { title: 'Digital flexibility', hint: 'Save and move gold like software — grams, not opaque points.' },
  { title: 'Physical redemption', hint: 'Jewellery, ornaments, coins, and bars from real storefronts.' },
  { title: 'Jeweller interoperability', hint: 'Nationwide partners with settlement handled on-platform.' },
  { title: 'Liquidity access', hint: 'Sellback, loans, and emergency paths without leaving the network.' },
  { title: 'Nationwide usability', hint: 'Compare, switch, and redeem without one-shop lock-in.' },
]

const USER_REASONS: { title: string; body: string }[] = [
  {
    title: 'Buy gold in any amount',
    body: 'Start from ₹100, ₹500, or ₹1,000 — no large lump sums required. Gold savings stay within reach.',
  },
  { title: 'Real gold in grams', body: 'Hold actual quantity in grams, not abstract rewards. Value tracks live gold prices.' },
  {
    title: 'Live portfolio tracking',
    body: 'See live value, profit/loss, redeemable quantity, and jeweller-wise holdings as they update.',
  },
  {
    title: 'Nationwide redemption',
    body: 'Buy from one partner jeweller and redeem through another across India — less location lock-in.',
  },
  {
    title: 'Physical jewellery redemption',
    body: 'Convert holdings to BIS 916 ornaments and coins from real jewellers — designed around jewellery you wear or gift, not a passive balance line.',
  },
  {
    title: 'Better making-charge benefits',
    body: 'Redeeming with the same jeweller can unlock reduced making, loyalty perks, and offers.',
  },
  {
    title: 'Gold as emergency money',
    body: 'Sell for cash, borrow against holdings, or use Cridora-assisted emergency liquidity when life hits.',
  },
  {
    title: 'Zero-interest loans',
    body: 'Borrow interest-free against eligible gold with instant utilisation and a flat processing fee — a sharp differentiator.',
  },
  {
    title: 'Gold transfer & gifting',
    body: 'Gift or transfer grams instantly — weddings, family, friends — gold that moves like trusted money.',
  },
  {
    title: 'Deposit gold you already own',
    body: 'Bring verified physical gold in and credit your portfolio for one unified vault experience.',
  },
  {
    title: 'Choose between jewellers',
    body: 'Compare trust scores, pricing, lock-ins, redemption rules, sellback, and making charges in one place.',
  },
  { title: 'Not locked to one shop', body: 'Avoid schemes that trap savings in a single store, city, or path.' },
  {
    title: 'Safer than speculative markets',
    body: 'Gold stays tangible, culturally understood, and physically redeemable — unlike leveraged retail trading.',
  },
  {
    title: 'Family & community savings',
    body: 'Save together, share vaults, and move grams between members for collective goals.',
  },
]

const JEWELLER_REASONS: { title: string; body: string }[] = [
  {
    title: 'Customer acquisition',
    body: 'Digital traffic, younger savers, and nationwide visibility without rebuilding discovery from zero.',
  },
  {
    title: 'Retain customers longer',
    body: 'Lock-ins and portfolio tools improve stickiness, repeat visits, and long-term relationships.',
  },
  {
    title: 'Compete with large brands',
    body: 'Enterprise-grade rails, online presence, and tooling for SMEs that cannot fund bespoke platforms.',
  },
  {
    title: 'Customer gold float stays local',
    body: 'Funds and metal economics remain with jewellers — supporting working capital and inventory.',
  },
  {
    title: 'Marketplace visibility',
    body: 'Show ornaments, offers, collections, and indicative pricing once listings are approved.',
  },
  {
    title: 'Configurable models',
    body: 'Design lock-ins, GoldNest schemes, loyalty, waivers, and bespoke commercial rules.',
  },
  {
    title: 'Cross-jeweller revenue',
    body: 'Attract users redeeming from other partners — incremental footfall and margin opportunities.',
  },
  {
    title: 'Loan & sellback revenue',
    body: 'Earn via processing fees, spreads, making, and liquidity services aligned with policy.',
  },
  {
    title: 'Digital CRM & ledger',
    body: 'Customer records, liabilities, settlements, and redemption queues in one operating layer.',
  },
  {
    title: 'Trust & verification',
    body: 'Badges and credibility scores help trustworthy jewellers stand out in search.',
  },
  {
    title: 'Lower technology barrier',
    body: 'Dashboards, onboarding, and marketplace tooling so teams focus on craft and service — not greenfield IT.',
  },
]

const PLATFORM_WINS: { title: string; body: string; list?: string[] }[] = [
  {
    title: 'Network effects',
    body: 'More jewellers attract more users; more users attract more jewellers — compounding adoption.',
  },
  {
    title: 'Asset-light model',
    body: 'No need to own vaults, inventory, or manufacturing — Cridora scales as infrastructure.',
  },
  {
    title: 'Recurring revenue',
    body: 'Sustainable economics from transaction fees, cross-redemption fees, subscriptions, marketplace placements, emergency services, and settlement tooling.',
    list: [
      'Transaction & cross-redemption fees',
      'SaaS or platform subscriptions',
      'Marketplace promotions',
      'Emergency-fund and settlement services',
    ],
  },
  {
    title: 'Infrastructure positioning',
    body: 'Cridora is the interoperability layer — jeweller OS, settlement network, and distributed gold ecosystem — not “just another gold app.”',
  },
]

function staggerStyle(index: number): CSSProperties {
  return { ['--reveal-delay' as string]: `${index * 0.045}s` }
}

export function WhyCridoraPage() {
  let revealIndex = 0
  const next = () => revealIndex++

  return (
    <div className="container page">
      <span className="pill cridora-reveal" style={staggerStyle(next())}>
        Why Cridora
      </span>
      <h1 className="h1-page cridora-reveal" style={staggerStyle(next())}>
        One platform for India’s gold savings
      </h1>

      <blockquote
        className="card cridora-quote cridora-card-motion"
        style={{
          margin: '1.5rem 0 0',
          padding: '1.35rem 1.5rem',
          borderRadius: 20,
          border: '1px solid var(--border-soft)',
          fontSize: 'clamp(1.05rem, 2.2vw, 1.35rem)',
          fontWeight: 600,
          fontStyle: 'italic',
          letterSpacing: '-0.02em',
          lineHeight: 1.45,
          color: 'var(--text)',
          background: 'linear-gradient(135deg, var(--navy-55) 0%, var(--veil-55) 100%)',
        }}
      >
        “{POSITIONING}”
      </blockquote>

      <section style={{ marginTop: '2.75rem' }}>
        <h2 className="cridora-section-title cridora-reveal" style={staggerStyle(next())}>
          Why Cridora?
        </h2>
        <p className="lead lead-tight cridora-reveal" style={{ ...staggerStyle(next()), marginTop: 0 }}>
          Cridora is designed to solve the biggest problems in India’s fragmented gold savings and jewellery
          ecosystem by combining five pillars into one unified experience.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem',
          }}
        >
          {PILLARS.map((p) => {
            const si = next()
            return (
              <div
                key={p.title}
                className="card cridora-pillar cridora-card-motion cridora-reveal"
                style={{
                  ...staggerStyle(si),
                  padding: '1.15rem 1.25rem',
                  borderRadius: 18,
                  minHeight: 130,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--gold-light)', letterSpacing: '-0.01em' }}>
                  {p.title}
                </h3>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {p.hint}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section style={{ marginTop: '3.25rem' }}>
        <h2 className="cridora-section-title cridora-reveal" style={staggerStyle(next())}>
          Why users will join Cridora
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem',
          }}
        >
          {USER_REASONS.map((item, i) => (
            <div
              key={item.title}
              className="card cridora-card-motion cridora-reveal"
              style={{
                ...staggerStyle(next()),
                padding: '1.2rem 1.35rem',
                borderRadius: 20,
              }}
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
                {i + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.25 }}>{item.title}</h3>
              <p style={{ margin: '0.55rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: '3.25rem' }}>
        <h2 className="cridora-section-title cridora-reveal" style={staggerStyle(next())}>
          Why jewellers will join Cridora
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem',
          }}
        >
          {JEWELLER_REASONS.map((item, i) => (
            <div
              key={item.title}
              className="card cridora-card-motion cridora-reveal"
              style={{
                ...staggerStyle(next()),
                padding: '1.2rem 1.35rem',
                borderRadius: 20,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--silk-10)',
                  color: 'var(--text-silk)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  marginBottom: '0.65rem',
                }}
              >
                {i + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.25 }}>{item.title}</h3>
              <p style={{ margin: '0.55rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: '3.25rem' }}>
        <h2 className="cridora-section-title cridora-reveal" style={staggerStyle(next())}>
          Why Cridora wins
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
            marginTop: '1.25rem',
          }}
        >
          {PLATFORM_WINS.map((item) => (
            <div
              key={item.title}
              className="card cridora-card-motion cridora-reveal"
              style={{
                ...staggerStyle(next()),
                padding: '1.25rem 1.4rem',
                borderRadius: 20,
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--gold-light)' }}>{item.title}</h3>
              <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                {item.body}
              </p>
              {item.list ? (
                <ul
                  style={{
                    margin: '0.85rem 0 0',
                    paddingLeft: '1.1rem',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                  }}
                >
                  {item.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gap: '1.25rem', marginTop: '3rem' }}>
        <div className="card cridora-reveal cridora-card-motion" style={{ ...staggerStyle(next()), borderRadius: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: '1.35rem' }}>What ships today</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
            Three holding types on every ledger: fractional gold, gold deposit, and GoldNest. Messaging stays simple — buy
            gold, track it, use it, redeem across the jeweller network. Surfaces today centre on BIS 916 gold in India;
            other metals and purities stay off public flows until the product expands.
          </p>
        </div>

        <div className="card cridora-reveal cridora-card-motion" style={{ ...staggerStyle(next()), borderRadius: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: '1.35rem' }}>Nationwide redemption</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>
            Spend holdings at any partnered jeweller; Cridora settles liability between stores so customers are
            not manual couriers of inter-shop metal.
          </p>
        </div>

        <div className="grid-2" style={{ marginTop: 0 }}>
          <div
            className="card cridora-reveal cridora-card-motion"
            style={{ ...staggerStyle(next()), borderColor: 'var(--danger-ring)', borderRadius: 20 }}
          >
            <h3 style={{ marginTop: 0, color: 'var(--danger)', fontSize: '1.15rem' }}>Cridora is not</h3>
            <ul style={{ color: 'var(--text-muted)', margin: 0, paddingLeft: '1.1rem' }}>
              <li>the stock market or equity apps</li>
              <li>an ETF or paper gold wrapper</li>
              <li>a commodity day-trading product</li>
              <li>generic balance-only “digital gold” without redemption utility</li>
              <li>a bank, NBFC, or deposit-taking institution</li>
            </ul>
          </div>
          <div
            className="card cridora-reveal cridora-card-motion"
            style={{ ...staggerStyle(next()), borderColor: 'var(--success-ring)', borderRadius: 20 }}
          >
            <h3 style={{ marginTop: 0, color: 'var(--success)', fontSize: '1.15rem' }}>Cridora is</h3>
            <ul style={{ color: 'var(--text-muted)', margin: 0, paddingLeft: '1.1rem' }}>
              <li>a live gold savings, portfolio, and redemption network</li>
              <li>jeweller-backed grams with ornament and cash paths</li>
              <li>nationwide usability with cross-jeweller settlement</li>
              <li>liquidity without selling (loans, emergency funds)</li>
              <li>technology infrastructure for trusted retail jewellers</li>
            </ul>
          </div>
        </div>

        <div className="card cridora-reveal cridora-card-motion" style={{ ...staggerStyle(next()), borderRadius: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: '1.35rem' }}>Distributed custody</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            Jewellers are custodians and redemption operators; Cridora runs ledgers, settlement routing,
            compliance, reconciliation, and customer UX. Listings stay private until admin approval.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
            <Link to="/features" className="btn btn-primary">
              Platform features
            </Link>
            <Link to="/jewellers" className="btn btn-ghost">
              Jeweller marketplace
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
