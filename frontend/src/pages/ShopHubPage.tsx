import { Link } from 'react-router-dom'

export function ShopHubPage() {
  return (
    <div className="container page">
      <span className="pill">Shop</span>
      <h1 className="h1-page" style={{ marginTop: '0.75rem' }}>
        Browse the marketplace
      </h1>
      <p className="lead" style={{ marginTop: '0.75rem', maxWidth: '52ch' }}>
        Explore verified jeweller storefronts or product listings — pick a path below.
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
          to="/jewellers"
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
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gold-light)' }}>Jewellers</h2>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Directory of partner stores, trust signals, and discovery.
          </p>
          <span className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            Open jewellers
          </span>
        </Link>
        <Link
          to="/marketplace"
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
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-silk)' }}>Products</h2>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Browse ornaments and listings from the product marketplace.
          </p>
          <span className="btn btn-ghost" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            Open products
          </span>
        </Link>
      </div>
    </div>
  )
}
