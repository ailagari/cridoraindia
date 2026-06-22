import { Link } from 'react-router-dom'
import { LegalDocumentLayout, LegalSection } from '@/components/LegalDocumentLayout'
import { LEGAL_ROUTES, SITE_LEGAL } from '@/content/siteLegal'

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      eyebrow="Legal"
      title="Privacy policy"
      lead={`How ${SITE_LEGAL.publisherName} collects, uses, and protects information when you use ${SITE_LEGAL.website}. Last updated: ${SITE_LEGAL.lastUpdated}.`}
      path={LEGAL_ROUTES.privacy}
      seoTitle="Privacy Policy — Cridora India"
      seoDescription="Privacy policy for Cridora India: data we collect, cookies, Google AdSense, and your choices on cridoraindia.com."
    >
      <LegalSection title="1. Who we are">
        <p style={{ margin: '0 0 0.75rem' }}>
          {SITE_LEGAL.publisherName} ({SITE_LEGAL.website}) is operated from {SITE_LEGAL.location}. For
          privacy-related questions contact{' '}
          <a href={`mailto:${SITE_LEGAL.contactEmail}`}>{SITE_LEGAL.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>
            <strong>Account data:</strong> name, phone, email, and KYC details you provide when you sign up or
            complete verification.
          </li>
          <li>
            <strong>Usage data:</strong> pages visited, device/browser type, approximate location from IP, and
            interactions with gold-rate tools and marketplace features.
          </li>
          <li>
            <strong>Communications:</strong> messages you send via waitlist, jeweller application, or support
            email.
          </li>
          <li>
            <strong>Cookies and similar technologies:</strong> session tokens, preferences (such as theme and
            language), and analytics or advertising identifiers as described below.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use information">
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>Provide live gold rates, calculators, portfolio tracking, and jeweller marketplace features.</li>
          <li>Authenticate users, prevent fraud, and comply with applicable law.</li>
          <li>Send service notifications you opt into (price alerts, account updates).</li>
          <li>Improve the site, fix errors, and measure traffic.</li>
          <li>Display advertisements through Google AdSense and similar partners.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Google AdSense and advertising">
        <p style={{ margin: '0 0 0.75rem' }}>
          We use <strong>Google AdSense</strong> (publisher ID: {SITE_LEGAL.adsensePublisherId}) to show ads on
          some public pages. Google and its partners may use cookies and device identifiers to serve ads based on
          your visits to this and other websites.
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>
            You can manage personalized ads at{' '}
            <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">
              Google Ads Settings
            </a>
            .
          </li>
          <li>
            Learn how Google uses data at{' '}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google partner sites policy
            </a>
            .
          </li>
          <li>
            Third-party vendors, including Google, use cookies to serve ads. Users may opt out of personalized
            advertising by visiting{' '}
            <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer">
              aboutads.info
            </a>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Cookies">
        <p style={{ margin: '0 0 0.75rem' }}>
          We use essential cookies for login and security, preference cookies for theme/language, and analytics or
          advertising cookies where enabled. You can control cookies through your browser settings; disabling
          essential cookies may limit site functionality.
        </p>
      </LegalSection>

      <LegalSection title="6. Sharing">
        <p style={{ margin: '0 0 0.75rem' }}>
          We do not sell your personal data. We may share information with verified jeweller partners (when you
          transact with them), payment and KYC service providers, hosting and analytics vendors, and authorities
          when required by law.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention and security">
        <p style={{ margin: '0 0 0.75rem' }}>
          We retain data while your account is active and as needed for legal, tax, and fraud-prevention
          obligations. We apply reasonable technical and organisational measures; no online service is completely
          secure.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p style={{ margin: '0 0 0.75rem' }}>
          Depending on applicable law, you may request access, correction, or deletion of personal data, or
          withdraw consent for marketing. Contact{' '}
          <a href={`mailto:${SITE_LEGAL.supportEmail}`}>{SITE_LEGAL.supportEmail}</a>. For formal complaints in
          India, see our <Link to={LEGAL_ROUTES.grievance}>Grievance policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p style={{ margin: 0 }}>
          Our services are not directed at children under 18. We do not knowingly collect data from minors.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p style={{ margin: 0 }}>
          We may update this policy. Material changes will be reflected on this page with a revised date. Continued
          use after changes constitutes acceptance.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
