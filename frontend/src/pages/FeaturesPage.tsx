import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

const items = [
  {
    title: 'Fractional gold purchase',
    body: 'Buy any nominal amount through participating jewellers (GST at purchase). Digital gram holdings; live rate-linked value. Optional jeweller lock-in: 15 days–12 months, or none — during lock-in: no cash redemption, transfer, loan, or emergency draw on those grams.',
  },
  {
    title: 'Gold deposit',
    body: 'Deposit physical gold after verification; grams credit your portfolio as the deposit holding type. Redeem as ornaments, cash (via jeweller sellback rules), loans, transfers, or in the product marketplace.',
  },
  {
    title: 'GoldNest',
    body: 'Single MVP scheme model: recurring contributions, live accumulation, maturity tracking, jeweller-defined benefits, optional making-charge perks — no advanced multi-scheme engine yet.',
  },
  {
    title: 'Portfolio and ledger',
    body: 'Dashboard: total gold (g), current live ₹ value, profit/loss, redeemable gold. Ledgers split into fractional, deposits, and GoldNest with grams, dates, jeweller, lock-in, value, and redemption eligibility.',
  },
  {
    title: 'Ornament redemption',
    body: 'Primary MVP flow. Same jeweller: 0% or reduced making charges, special pricing, faster path. Cross-jeweller: making, GST on making, cross-platform fee; you still spend grams; liability transfers and Cridora settles.',
  },
  {
    title: 'Cash redemption (sellback)',
    body: 'From original/default jeweller only; subject to lock-in and jeweller sellback rate plus configurable deductions. UI shows live rate, sellback rate, deductions, and final receivable.',
  },
  {
    title: 'Transfer and gifting',
    body: 'Send by Cridora username or phone; see first name, last name, and verification; double confirmation required.',
  },
  {
    title: 'Gold loans',
    body: 'Zero-interest gold loans — highlight: only a 2% processing fee. Jeweller sets max loan %, eligible holdings, lock-in rules; choose grams and partial utilisation with instant available amount.',
  },
  {
    title: 'Emergency funds',
    body: 'Cridora-backed: up to ~80% of portfolio value with temporarily locked holdings; gold consumed if default. Positioning: instant liquidity without selling your gold.',
  },
  {
    title: 'Jeweller marketplace',
    body: 'Cards show logo, name, verified badge, credibility score, city, live rate, jeweller rate, sellback, lock-in, min redeemable, same-store MC benefit, cross fee, feature tags, light metrics, and CTAs (view, invest, compare, default).',
  },
  {
    title: 'Product marketplace',
    body: 'BIS 916 ornaments, chains, bangles, coins, bridal sets — image, name, jeweller, weight, purity, making, final price. Strong CTA: “Use your gold” (e.g. use X g from portfolio, pay ₹Y extra).',
  },
  {
    title: 'Real-time consumption',
    body: 'Loans, transfers, cash redemption, ornament redemption, and emergency draws deduct grams immediately — one ledger across paths.',
  },
]

export function FeaturesPage() {
  return (
    <div className="container page">
      <span className="pill cridora-reveal" style={{ ['--reveal-delay' as string]: '0s' }}>
        Cridora Phase 1 MVP
      </span>
      <h1 className="h1-page cridora-reveal" style={{ ['--reveal-delay' as string]: '0.05s' }}>
        User features
      </h1>
      <p className="lead lead-tight cridora-reveal" style={{ ['--reveal-delay' as string]: '0.1s' }}>
        Aligned with the Phase 1 launch architecture: gold accumulation, portfolio utility, redemption flexibility, jeweller
        trust network, and live value — simple to understand; jeweller and admin tooling stay gated until APIs enforce
        each path.
      </p>

      <div
        style={{
          marginTop: '2rem',
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}
      >
        {items.map((f, index) => (
          <div
            key={f.title}
            className="card cridora-card-motion cridora-reveal"
            style={
              {
                ['--reveal-delay' as string]: `${0.08 + index * 0.04}s`,
                borderRadius: 20,
              } as CSSProperties
            }
          >
            <h2 style={{ marginTop: 0, fontSize: '1.2rem' }}>{f.title}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 0 }}>{f.body}</p>
          </div>
        ))}
      </div>

      <p
        className="cridora-reveal"
        style={
          {
            marginTop: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            ['--reveal-delay' as string]: `${0.08 + items.length * 0.04}s`,
          } as CSSProperties
        }
      >
        <Link to="/jewellers" className="btn btn-primary">
          Jeweller marketplace
        </Link>
        <Link to="/marketplace" className="btn btn-ghost">
          Product marketplace
        </Link>
      </p>
    </div>
  )
}
