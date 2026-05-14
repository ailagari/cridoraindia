export function WaitlistPage() {
  return (
    <div className="container page enterprise-public" style={{ maxWidth: 800, paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <p className="enterprise-public__eyebrow">Waitlist</p>
      <h1 className="enterprise-public__title">Early access</h1>
      <p className="enterprise-public__lead">
        Separate queues for savers and jewellers. Pick the path that matches you—we keep each list narrow and intentional.
      </p>
      <div
        style={{
          display: 'grid',
          gap: '1.25rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          marginTop: '2rem',
        }}
      >
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Savers</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
            Retail customers building fractional gold, deposits, and scheme balances across the Cridora network.
          </p>
          <a
            className="btn btn-primary"
            style={{ marginTop: '1.25rem', display: 'inline-flex' }}
            href="mailto:waitlist.users@cridora.in?subject=Cridora%20user%20waitlist"
          >
            Email waitlist · users
          </a>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Jewellers</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
            Verified storefronts joining marketplace, liability tooling, and redemption operations on Cridora.
          </p>
          <a
            className="btn btn-primary"
            style={{ marginTop: '1.25rem', display: 'inline-flex' }}
            href="mailto:waitlist.jewellers@cridora.in?subject=Cridora%20jeweller%20waitlist"
          >
            Email waitlist · jewellers
          </a>
        </div>
      </div>
    </div>
  )
}
