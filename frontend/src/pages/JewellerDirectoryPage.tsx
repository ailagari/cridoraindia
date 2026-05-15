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
          <span className="pill">Verified network</span>
          <h1
            style={{
              fontSize: 'clamp(1.85rem, 4vw, 2.65rem)',
              margin: '0.75rem 0',
              fontWeight: 650,
              letterSpacing: '-0.02em',
            }}
          >
            Jeweller marketplace
          </h1>
          <p style={{ margin: 0, maxWidth: '46ch', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            Compare live market rates, sellback posture, and trust signals—one row per showroom.
          </p>
        </div>
      </section>

      <div className="container" style={{ marginTop: '2rem' }}>
        <JewellerMarketplaceGrid intro="Cards reflect KYB-verified jewellers: identity, indicative rates, lock-in, credibility, and shortcuts into products." />
      </div>
    </div>
  )
}
