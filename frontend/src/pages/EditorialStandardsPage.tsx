import { Link } from 'react-router-dom'
import { LegalDocumentLayout, LegalSection } from '@/components/LegalDocumentLayout'
import { LEGAL_ROUTES, SITE_LEGAL } from '@/content/siteLegal'

export function EditorialStandardsPage() {
  return (
    <LegalDocumentLayout
      eyebrow="Trust & accuracy"
      title="Editorial standards & data sources"
      lead={`How ${SITE_LEGAL.publisherName} sources, verifies, and corrects the gold and silver rates, and the calculator, shown on this site. Last updated: ${SITE_LEGAL.lastUpdated}.`}
      path={LEGAL_ROUTES.editorialStandards}
      seoTitle="Editorial Standards & Data Sources — Cridora India"
      seoDescription="How Cridora India sources, verifies, and corrects Kerala gold rate data, the gold jewellery calculator, and city rate references. Our accountability and correction process."
    >
      <LegalSection title="Where our rate data comes from">
        <p style={{ margin: '0 0 0.75rem' }}>
          {SITE_LEGAL.operatingBrand} publishes an indicative Kerala gold and silver reference rate, refreshed
          automatically approximately every two minutes during market hours. Our reference tracks:
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>Kerala jewellers&apos; association / Sarafa board daily gold and silver closes (24K, 22K/916, 18K, silver 999).</li>
          <li>MCX (Multi Commodity Exchange) and international LBMA spot price movement, used to interpolate live intraday changes between board updates.</li>
          <li>A running two-year daily archive so every historical row on our charts can be independently cross-checked against publicly reported rates for that date.</li>
        </ul>
        <p style={{ margin: '0.75rem 0 0' }}>
          Rates on India city pages (outside Kerala) currently reuse this Kerala/MCX reference rather than a
          city-specific board rate, and are labelled accordingly.
        </p>
      </LegalSection>

      <LegalSection title="What our rate is — and isn't">
        <p style={{ margin: 0 }}>
          Our number is an <strong>indicative reference</strong>, not a live exchange quote and not a specific
          jeweller&apos;s selling price. Individual jewellers set their own board rate and may differ from ours by
          making charges, GST, and local pricing. See the full{' '}
          <Link to={LEGAL_ROUTES.disclaimer}>disclaimer</Link> — Cridora is not SEBI regulated and nothing on this
          site is investment advice.
        </p>
      </LegalSection>

      <LegalSection title="How the gold calculator works">
        <p style={{ margin: 0 }}>
          The calculator multiplies the live rate per gram by the weight and purity you select, adds any making
          charge you enter (₹/gram or % of metal value), then applies India&apos;s standard GST treatment — 3% on
          the gold metal value and 18% on making charges — to produce an estimate. The formula and GST rates are
          fixed and documented on the{' '}
          <Link to="/gold-calculator">calculator page</Link> itself; only the live rate input changes automatically.
        </p>
      </LegalSection>

      <LegalSection title="Corrections and accuracy reports">
        <p style={{ margin: '0 0 0.75rem' }}>
          If you spot a rate, chart value, or calculation that looks wrong, please report it — we treat data
          accuracy reports as a priority, separate from general support:
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>
            Email <a href={`mailto:${SITE_LEGAL.supportEmail}`}>{SITE_LEGAL.supportEmail}</a> with the page URL,
            date, and the rate you expected to see.
          </li>
          <li>We review and, where a genuine data error is confirmed, correct it and note the correction date.</li>
          <li>
            Formal grievances under Indian IT rules go through our{' '}
            <Link to={LEGAL_ROUTES.grievance}>grievance redressal process</Link> instead.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Who is accountable for this content">
        <p style={{ margin: 0 }}>
          {SITE_LEGAL.publisherName} is operated from {SITE_LEGAL.location}. Rate-data sourcing, the calculator
          logic, and this page are maintained by the Cridora markets &amp; data team and are reviewed whenever the
          underlying board-rate or GST rules change. For questions about how a specific number was produced, contact{' '}
          <a href={`mailto:${SITE_LEGAL.contactEmail}`}>{SITE_LEGAL.contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
