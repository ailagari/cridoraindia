import { Link } from 'react-router-dom'
import { LegalDocumentLayout, LegalSection } from '@/components/LegalDocumentLayout'
import { LEGAL_ROUTES, SITE_LEGAL } from '@/content/siteLegal'

export function TermsOfUsePage() {
  return (
    <LegalDocumentLayout
      eyebrow="Legal"
      title="Terms of use"
      lead={`Rules for using ${SITE_LEGAL.website} and Cridora platform services. Last updated: ${SITE_LEGAL.lastUpdated}.`}
      path={LEGAL_ROUTES.terms}
      seoTitle="Terms of Use — Cridora India"
      seoDescription="Terms of use for Cridora India website and digital gold portfolio platform."
    >
      <LegalSection title="1. Acceptance">
        <p style={{ margin: 0 }}>
          By accessing {SITE_LEGAL.website} or creating an account, you agree to these terms and our{' '}
          <Link to={LEGAL_ROUTES.privacy}>Privacy policy</Link> and{' '}
          <Link to={LEGAL_ROUTES.disclaimer}>Disclaimer</Link>. If you do not agree, do not use the site.
        </p>
      </LegalSection>

      <LegalSection title="2. Services">
        <p style={{ margin: '0 0 0.75rem' }}>
          Cridora provides informational gold-rate tools, a jewellery price calculator, jeweller directory and
          marketplace listings, and (for registered users) digital portfolio and bill-tracking features. Some
          features are in early access or waitlist; availability may change.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>You must provide accurate registration information and keep credentials secure.</li>
          <li>KYC/verification may be required for certain transactions or vault features.</li>
          <li>We may suspend accounts that violate these terms or applicable law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Gold rates and calculator">
        <p style={{ margin: 0 }}>
          Live rates and calculator outputs are indicative references, not offers to buy or sell gold. Final
          jewellery prices depend on the jeweller, making charges, taxes, and hallmarked purity. See the{' '}
          <Link to={LEGAL_ROUTES.disclaimer}>Disclaimer</Link> for full details.
        </p>
      </LegalSection>

      <LegalSection title="5. Jeweller and marketplace transactions">
        <p style={{ margin: '0 0 0.75rem' }}>
          Purchases, redemptions, and settlements with jewellers may involve separate terms from the jeweller.
          Cridora facilitates discovery, tracking, and platform tooling; jewellers remain responsible for
          physical goods, hallmarking, and shop-level pricing unless explicitly stated otherwise in a signed
          agreement.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p style={{ margin: '0 0 0.75rem' }}>You agree not to:</p>
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>Scrape, overload, or reverse-engineer the service without permission.</li>
          <li>Upload false KYC data, impersonate others, or commit fraud.</li>
          <li>Use the site for unlawful activity or to misrepresent rates or products.</li>
          <li>Interfere with ads, security, or other users&apos; access.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Advertising and third-party content">
        <p style={{ margin: 0 }}>
          Some public pages display advertisements served by <strong>Google AdSense</strong> and similar partners.
          Ads are identified as sponsored content and may use cookies as described in our{' '}
          <Link to={LEGAL_ROUTES.privacy}>Privacy policy</Link>. Cridora does not endorse products or services shown
          in third-party ads. Jeweller listings and marketplace content are separate from display advertising.
        </p>
      </LegalSection>

      <LegalSection title="8. Intellectual property">
        <p style={{ margin: 0 }}>
          Cridora branding, software, and original content on the site are owned by or licensed to{' '}
          {SITE_LEGAL.publisherName}. You may not copy or redistribute site content for commercial use without
          written permission.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p style={{ margin: 0 }}>
          To the maximum extent permitted by law, {SITE_LEGAL.publisherName} is not liable for indirect,
          incidental, or consequential damages arising from use of the site, rate inaccuracies, jeweller actions, or
          third-party services. Our total liability for any claim is limited to the amount you paid Cridora for
          the specific service giving rise to the claim in the prior twelve months, or ₹1,000, whichever is
          greater.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing law">
        <p style={{ margin: 0 }}>
          These terms are governed by the laws of India. Courts in Kerala shall have exclusive jurisdiction, subject
          to mandatory consumer protections in your state of residence.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p style={{ margin: 0 }}>
          Questions about these terms:{' '}
          <a href={`mailto:${SITE_LEGAL.contactEmail}`}>{SITE_LEGAL.contactEmail}</a> or our{' '}
          <Link to={LEGAL_ROUTES.contact}>Contact page</Link>.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
