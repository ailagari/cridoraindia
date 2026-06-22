import { Link } from 'react-router-dom'
import { LegalDocumentLayout, LegalSection } from '@/components/LegalDocumentLayout'
import { LEGAL_ROUTES, SITE_LEGAL } from '@/content/siteLegal'

export function DisclaimerPage() {
  return (
    <LegalDocumentLayout
      eyebrow="Legal"
      title="Disclaimer"
      lead={`Important limitations on gold rates, calculator results, and platform content on ${SITE_LEGAL.website}. Last updated: ${SITE_LEGAL.lastUpdated}.`}
      path={LEGAL_ROUTES.disclaimer}
      seoTitle="Disclaimer — Gold Rates & Financial Information | Cridora India"
      seoDescription="Cridora India disclaimer: gold rates are indicative, not investment advice, not SEBI regulated."
    >
      <LegalSection title="Not investment advice">
        <p style={{ margin: 0 }}>
          Content on {SITE_LEGAL.website} — including live gold rates, charts, news-style headings, and calculator
          outputs — is for <strong>general information only</strong>. It is{' '}
          <strong>not investment, financial, legal, or tax advice</strong>. Cridora is not a SEBI-registered
          investment adviser, broker, or deposit-taking institution.
        </p>
      </LegalSection>

      <LegalSection title="Indicative gold rates">
        <p style={{ margin: '0 0 0.75rem' }}>
          Gold and silver rates shown on Cridora are compiled from board references, MCX-linked indicators, and
          jeweller association feeds. They may lag market moves, differ from your local shop&apos;s counter price,
          and vary by city, purity, and making charges.
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.15rem' }}>
          <li>
            <strong>Kerala city pages</strong> reflect Kerala board-style reference rates; many districts share
            the same statewide reference.
          </li>
          <li>
            <strong>All-India city pages</strong> show national reference prices for convenience; they are not
            guaranteed shop-specific quotes for that city.
          </li>
          <li>Always confirm the final price with your jeweller before purchase or sale.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Calculator estimates">
        <p style={{ margin: 0 }}>
          The gold jewellery calculator applies user-entered weight, purity, making charges, and GST rules as
          estimates. Actual invoices may include stone charges, wastage, discounts, or state-specific taxes not
          modelled in the tool.
        </p>
      </LegalSection>

      <LegalSection title="Jewellers and marketplace">
        <p style={{ margin: '0 0 0.75rem' }}>
          Jeweller listings and product catalogues may include verified partners and illustrative demo listings
          labelled as such. Cridora does not warrant the quality, hallmark, or delivery of third-party jewellers.
          Due diligence before payment is your responsibility.
        </p>
      </LegalSection>

      <LegalSection title="Digital gold and portfolio">
        <p style={{ margin: 0 }}>
          Portfolio balances and valuations on Cridora reflect records linked to participating jewellers and
          platform rules. They are not a substitute for physical inspection, bank deposits, or regulated digital
          gold products unless explicitly offered under a separate written agreement.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p style={{ margin: 0 }}>
          The site and tools are provided &quot;as is&quot; without warranties of accuracy, uptime, or fitness for
          a particular purpose. See also our <Link to={LEGAL_ROUTES.terms}>Terms of use</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p style={{ margin: 0 }}>
          Report factual errors in rates or content:{' '}
          <a href={`mailto:${SITE_LEGAL.supportEmail}`}>{SITE_LEGAL.supportEmail}</a>.
        </p>
      </LegalSection>
    </LegalDocumentLayout>
  )
}
