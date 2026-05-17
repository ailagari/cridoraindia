import { Link } from 'react-router-dom'
import { JEWELLER_REASONS, USER_REASONS } from '@/content/whyCridoraBenefits'

function BenefitsGrid({
  items,
  variant,
  title,
}: {
  items: { title: string; body: string }[]
  variant: 'user' | 'jeweller'
  title: string
}) {
  return (
    <>
      <h2 className="cridora-section-title" style={{ marginTop: '1.25rem' }}>
        {title}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
          marginTop: '1.25rem',
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
                background: variant === 'user' ? 'var(--gold-soft)' : 'var(--silk-10)',
                color: variant === 'user' ? 'var(--gold-light)' : 'var(--text-silk)',
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
    </>
  )
}

export function DiscoverCustomersPage() {
  return (
    <div className="container page">
      <span className="pill">Discover · Users</span>
      <h1 className="h1-page" style={{ marginTop: '0.75rem' }}>
        Why savers choose Cridora
      </h1>
      <p className="lead lead-tight" style={{ marginTop: '0.5rem', maxWidth: '52ch' }}>
        Benefits built for customers — from flexible savings to nationwide redemption.
      </p>
      <BenefitsGrid items={USER_REASONS} variant="user" title="What users get" />
      <p style={{ marginTop: '2rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
        <Link to="/why-cridora">Full Why Cridora story</Link>
        {' · '}
        <Link to="/features">Platform features</Link>
      </p>
    </div>
  )
}

export function DiscoverJewellersPage() {
  return (
    <div className="container page">
      <span className="pill">Discover · Jewellers</span>
      <h1 className="h1-page" style={{ marginTop: '0.75rem' }}>
        Why stores partner with Cridora
      </h1>
      <p className="lead lead-tight" style={{ marginTop: '0.5rem', maxWidth: '52ch' }}>
        Benefits for partner jewellers — acquisition, retention, and modern rails.
      </p>
      <BenefitsGrid items={JEWELLER_REASONS} variant="jeweller" title="What jewellers get" />
      <p style={{ marginTop: '2rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
        <Link to="/why-cridora">Full Why Cridora story</Link>
        {' · '}
        <Link to="/jeweller/apply">Apply as jeweller</Link>
      </p>
    </div>
  )
}
