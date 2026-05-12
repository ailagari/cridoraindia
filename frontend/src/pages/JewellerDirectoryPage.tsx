import { JewellerMarketplaceGrid } from '@/features/marketplace/JewellerMarketplaceGrid'

export function JewellerDirectoryPage() {
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
          <span className="pill">Compare showrooms · KYB verified</span>
          <h1
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              margin: '0.75rem 0',
              textTransform: 'uppercase',
              fontStyle: 'italic',
              letterSpacing: '-0.03em',
            }}
          >
            Jeweller <span style={{ color: 'var(--gold-light)' }}>marketplace</span>
          </h1>
        </div>
      </section>

      <div className="container" style={{ marginTop: '2rem' }}>
        <JewellerMarketplaceGrid intro="Each card summarises identity, live and sellback rates, lock-in rules, minimum redeemable gold, same-store making benefits, cross-redemption fees, credibility signals, and shortcuts to products or signup. Preview rows fill in when live data is thin; verified KYB listings replace matching names automatically. Sort by making charge, buyback, deposit yield, or loan availability." />
      </div>
    </div>
  )
}
