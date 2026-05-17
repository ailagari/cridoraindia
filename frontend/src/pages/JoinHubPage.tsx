import { Link } from 'react-router-dom'

export function JoinHubPage() {
  return (
    <div className="container page">
      <span className="pill">Join</span>
      <h1 className="h1-page" style={{ marginTop: '0.75rem' }}>
        Create your account
      </h1>
      <p className="lead" style={{ marginTop: '0.75rem', maxWidth: '52ch' }}>
        Start as a saver building gold holdings, or apply as a partner jeweller — pick the path that fits you.
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
          to="/signup"
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
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gold-light)' }}>Customer / saver</h2>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Sign up to save in gold, track your portfolio, and redeem across the network.
          </p>
          <span className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            Sign up
          </span>
        </Link>
        <Link
          to="/jeweller/apply"
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
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-silk)' }}>Jeweller</h2>
          <p style={{ margin: '0.65rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
            Apply to list your store, run schemes, and connect with savers on Cridora.
          </p>
          <span className="btn btn-ghost" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            Apply as jeweller
          </span>
        </Link>
      </div>
    </div>
  )
}
