import { Link, useSearchParams } from 'react-router-dom'
import { JEWELLER_REASONS, USER_REASONS } from '@/content/discoverBenefits'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'

export function DiscoverPage() {
  const narrow = usePublicLayoutMax767()
  const [searchParams] = useSearchParams()
  const audience = searchParams.get('audience') === 'jewellers' ? 'jewellers' : 'customers'
  const items = audience === 'jewellers' ? JEWELLER_REASONS : USER_REASONS

  if (narrow) {
    return (
      <div className="container page">
        <span className="pill">Discover</span>
        <h1 className="h1-page" style={{ marginTop: '0.75rem' }}>
          {audience === 'jewellers' ? 'For jewellers' : 'For users'}
        </h1>
        <p className="lead" style={{ marginTop: '0.65rem', maxWidth: '52ch' }}>
          {audience === 'jewellers'
            ? 'Why partner stores join Cridora — acquisition, retention, and digital rails in one place.'
            : 'Why savers choose Cridora — real grams, nationwide redemption, and physical jewellery.'}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem',
            marginTop: '1.35rem',
          }}
        >
          {items.map((item, i) => (
            <div
              key={item.title}
              className="card"
              style={{
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
                  background: audience === 'jewellers' ? 'var(--silk-10)' : 'var(--gold-soft)',
                  color: audience === 'jewellers' ? 'var(--text-silk)' : 'var(--gold-light)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  marginBottom: '0.65rem',
                }}
              >
                {i + 1}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.25 }}>{item.title}</h3>
              <p style={{ margin: '0.55rem 0 0', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.55 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '1.75rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          <Link to="/features">Platform features</Link>
          {' · '}
          <Link to="/#how">How it works</Link>
        </p>
      </div>
    )
  }

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
        <Link to="/#how">How it works</Link>
      </p>
    </div>
  )
}
