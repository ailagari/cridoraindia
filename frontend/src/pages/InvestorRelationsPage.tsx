export function InvestorRelationsPage() {
  return (
    <div className="container page enterprise-public" style={{ maxWidth: 640, paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <p className="enterprise-public__eyebrow">Investor relations</p>
      <h1 className="enterprise-public__title">Institutional enquiries</h1>
      <p className="enterprise-public__lead">
        For accredited investors and strategic partners evaluating India&apos;s digital gold and jeweller-network infrastructure.
      </p>
      <p style={{ color: 'var(--text-muted)', lineHeight: 1.65 }}>
        Submit your mandate through our briefing request form. We respond to qualified introductions on a rolling basis.
      </p>
      <p style={{ marginTop: '2rem' }}>
        <a
          className="btn btn-primary"
          href="mailto:ops@cridora.in?subject=Cridora%20investor%20briefing%20request"
        >
          Request briefing by email
        </a>
      </p>
    </div>
  )
}
