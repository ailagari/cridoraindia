import { Link } from 'react-router-dom'
import { SeoHead } from '@/components/SeoHead'
import { LEGAL_ROUTES, SITE_LEGAL } from '@/content/siteLegal'

const cardStyle = { padding: '1.35rem 1.5rem' } as const

export function ContactPage() {
  return (
    <>
      <SeoHead
        title="Contact & About — Cridora India"
        description="Contact Cridora India for support, partnerships, and waitlist enquiries. Digital gold portfolio and live gold rates platform based in Kerala, India."
        path={LEGAL_ROUTES.contact}
      />
      <div
        className="container page enterprise-public"
        style={{ maxWidth: 760, paddingTop: '2.5rem', paddingBottom: '4rem' }}
      >
        <p className="enterprise-public__eyebrow">Company</p>
        <h1 className="enterprise-public__title">Contact &amp; about</h1>
        <p className="enterprise-public__lead">
          {SITE_LEGAL.publisherName} builds live gold-rate utilities, a jewellery calculator, and digital tools that
          connect customers with verified jewellers across India. We are based in {SITE_LEGAL.location}.
        </p>

        <div
          style={{
            display: 'grid',
            gap: '1.15rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            marginTop: '2rem',
          }}
        >
          <div className="card" style={cardStyle}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>General &amp; operations</h2>
            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
              Platform questions, partnerships, and media.
            </p>
            <a className="btn btn-primary" style={{ display: 'inline-flex' }} href={`mailto:${SITE_LEGAL.contactEmail}`}>
              {SITE_LEGAL.contactEmail}
            </a>
          </div>

          <div className="card" style={cardStyle}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>User support</h2>
            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
              Help with accounts, rates, or technical issues.
            </p>
            <a className="btn btn-ghost" style={{ display: 'inline-flex' }} href={`mailto:${SITE_LEGAL.supportEmail}`}>
              {SITE_LEGAL.supportEmail}
            </a>
          </div>

          <div className="card" style={cardStyle}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Waitlist</h2>
            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
              Early access for customers and jewellers.
            </p>
            <Link className="btn btn-ghost" style={{ display: 'inline-flex' }} to="/waitlist">
              Join waitlist
            </Link>
          </div>

          <div className="card" style={cardStyle}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Grievance officer</h2>
            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', lineHeight: 1.55, fontSize: '0.95rem' }}>
              Formal complaints under IT rules.
            </p>
            <Link className="btn btn-ghost" style={{ display: 'inline-flex' }} to={LEGAL_ROUTES.grievance}>
              Grievance policy
            </Link>
          </div>
        </div>

        <div className="card" style={{ ...cardStyle, marginTop: '1.25rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Publisher</h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.1rem',
              color: 'var(--text-muted)',
              lineHeight: 1.65,
              fontSize: '0.95rem',
            }}
          >
            <li>
              <strong>Website:</strong>{' '}
              <a href={SITE_LEGAL.website} target="_blank" rel="noopener noreferrer">
                {SITE_LEGAL.website}
              </a>
            </li>
            <li>
              <strong>Brand:</strong> {SITE_LEGAL.operatingBrand} / {SITE_LEGAL.publisherName}
            </li>
            <li>
              <strong>Location:</strong> {SITE_LEGAL.location}
            </li>
            <li>
              <strong>Legal:</strong>{' '}
              <Link to={LEGAL_ROUTES.privacy}>Privacy</Link>
              {' · '}
              <Link to={LEGAL_ROUTES.terms}>Terms</Link>
              {' · '}
              <Link to={LEGAL_ROUTES.disclaimer}>Disclaimer</Link>
            </li>
            <li>
              <strong>Advertising:</strong> Google AdSense publisher ID {SITE_LEGAL.adsensePublisherId}.{' '}
              <a href={`${SITE_LEGAL.website}/ads.txt`} target="_blank" rel="noopener noreferrer">
                ads.txt
              </a>
            </li>
          </ul>
        </div>

        <p style={{ marginTop: '1.5rem', color: 'var(--text-faint)', fontSize: '0.82rem', lineHeight: 1.55 }}>
          Use our free{' '}
          <Link to="/gold-rates/kerala">live Kerala gold rates</Link> and{' '}
          <Link to="/gold-calculator">gold calculator</Link> — no account required.
        </p>
      </div>
    </>
  )
}
