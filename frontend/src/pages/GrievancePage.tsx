import { Link } from 'react-router-dom'
import { LegalDocumentLayout, LegalSection } from '@/components/LegalDocumentLayout'
import { LEGAL_ROUTES, SITE_LEGAL } from '@/content/siteLegal'

export function GrievancePage() {
  return (
    <LegalDocumentLayout
      eyebrow="Legal"
      title="Grievance redressal"
      lead={`How to raise concerns about ${SITE_LEGAL.publisherName} services, data, or content under applicable Indian IT rules. Last updated: ${SITE_LEGAL.lastUpdated}.`}
      path={LEGAL_ROUTES.grievance}
      seoTitle="Grievance Redressal — Cridora India"
      seoDescription="Contact Cridora India grievance officer for complaints about platform services, privacy, or content."
    >
      <LegalSection title="Grievance officer">
        <p style={{ margin: '0 0 0.75rem' }}>
          In accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code)
          Rules, 2021, the grievance officer for {SITE_LEGAL.publisherName} is reachable at:
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${SITE_LEGAL.grievanceEmail}`}>{SITE_LEGAL.grievanceEmail}</a>
          </li>
          <li>
            <strong>Subject line:</strong> Grievance — [brief topic]
          </li>
          <li>
            <strong>Location:</strong> {SITE_LEGAL.location}
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What to include">
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>Your full name and contact email or phone</li>
          <li>Account email or phone (if registered)</li>
          <li>URL or feature involved (e.g. marketplace listing, notification)</li>
          <li>Description of the issue and desired resolution</li>
          <li>Screenshots or reference numbers, if available</li>
        </ul>
      </LegalSection>

      <LegalSection title="Response timeline">
        <p style={{ margin: 0 }}>
          We acknowledge grievances within <strong>24 hours</strong> and aim to resolve or respond with status
          within <strong>15 days</strong>. Complex cases involving jeweller partners may require additional time;
          we will keep you informed.
        </p>
      </LegalSection>

      <LegalSection title="Other channels">
        <p style={{ margin: '0 0 0.75rem' }}>
          For general support (non-grievance):{' '}
          <a href={`mailto:${SITE_LEGAL.supportEmail}`}>{SITE_LEGAL.supportEmail}</a>.
        </p>
        <p style={{ margin: 0 }}>
          Privacy-specific requests: see our <Link to={LEGAL_ROUTES.privacy}>Privacy policy</Link>. Platform terms:{' '}
          <Link to={LEGAL_ROUTES.terms}>Terms of use</Link>.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
