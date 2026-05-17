import { Link } from 'react-router-dom'

export function DiscoverPage() {
  return (
    <div className="container page">
      <span className="pill">Discover</span>
      <h1 className="h1-page" style={{ marginTop: '0.75rem' }}>
        Who Cridora is for
      </h1>
      <p className="lead" style={{ marginTop: '0.75rem', maxWidth: '52ch' }}>
        Explore benefits tailored to savers and to partner jewellers — one platform, two clear value stories.
      </p>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          marginTop: '2rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        }}
      >
        <Link
          to="/why-cridora#discover-customers"
          className="card"
          style={{
            padding: '1.35rem 1.4rem',
            borderRadius: 18,
            textDecoration: 'none',
            color: 'inherit',
            border: '1px solid var(--border-soft)',
            display: 'block',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gold-light)' }}>For customers</h2>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Savings, live portfolio, nationwide redemption, and physical jewellery — see why savers join.
          </p>
          <span className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            View benefits
          </span>
        </Link>
        <Link
          to="/why-cridora#discover-jewellers"
          className="card"
          style={{
            padding: '1.35rem 1.4rem',
            borderRadius: 18,
            textDecoration: 'none',
            color: 'inherit',
            border: '1px solid var(--border-soft)',
            display: 'block',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-silk)' }}>For jewellers</h2>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Acquisition, retention, marketplace visibility, and digital ops — see why stores partner.
          </p>
          <span className="btn btn-ghost" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            View benefits
          </span>
        </Link>
      </div>
      <p style={{ marginTop: '2rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
        <Link to="/features">Platform features</Link>
        {' · '}
        <Link to="/how-it-works">How it works</Link>
      </p>
    </div>
  )
}
