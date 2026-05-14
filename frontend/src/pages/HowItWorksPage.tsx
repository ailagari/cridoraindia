import { Link } from 'react-router-dom'

const steps = [
  { title: 'Choose your jeweller', body: 'Select a verified partner whose rates, policies, and catalogue fit how you save.' },
  { title: 'Buy or allocate gold', body: 'Fractional purchases credit your per-jeweller vault; deposits and schemes extend the same ledger model.' },
  { title: 'Track one portfolio', body: 'Grams, live value, and eligibility stay visible across every relationship you hold on Cridora.' },
  { title: 'Redeem with clarity', body: 'Same-store benefits or cross-network redemption follow rules you see before you confirm.' },
]

export function HowItWorksPage() {
  return (
    <div className="container page enterprise-public" style={{ maxWidth: 720, paddingTop: '2.5rem', paddingBottom: '4rem' }}>
      <p className="enterprise-public__eyebrow">How it works</p>
      <h1 className="enterprise-public__title">Gold savings, structured for India</h1>
      <p className="enterprise-public__lead">
        Cridora sits between savers and jewellers: identity, vaults, and policy—not noise.
      </p>
      <ol className="enterprise-public__steps">
        {steps.map((s) => (
          <li key={s.title}>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="enterprise-public__cta">
        <Link to="/jewellers" className="btn btn-primary">
          Browse jewellers
        </Link>
        <Link to="/waitlist" className="btn btn-ghost">
          Join waitlist
        </Link>
      </div>
    </div>
  )
}
