import { Link } from 'react-router-dom'

export function CustomerDepositInfoPanel() {
  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        <strong>Gold deposit</strong> (physical → digital): bring verified gold to a partner jeweller; they record weight and
        buyback-linked value under your Cridora member ID. Grams are credited as a deposit-class vault holding once intake and
        OTP verification are complete — end-to-end deposit APIs are next on the roadmap.
      </p>

      <div className="card" style={{ maxWidth: 560, padding: '1.25rem 1.35rem', borderRadius: 20 }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>From your dashboard today</h2>
        <ul style={{ margin: '0 0 1rem', paddingLeft: '1.15rem', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.55 }}>
          <li>Browse verified jewellers and choose where you want to deposit.</li>
          <li>Use <strong>Buy gold</strong> for counter fractional purchases (digital grams via OTP verification).</li>
          <li>Browse approved products as a guide to each showroom&apos;s catalogue.</li>
        </ul>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          <Link className="btn btn-primary" to="/userdashboard?section=shop_jewellers">
            Verified jewellers
          </Link>
          <Link className="btn btn-ghost" to="/userdashboard?section=shop_products">
            Approved products
          </Link>
          <Link className="btn btn-ghost" to="/userdashboard?section=invest_fractional">
            Counter fractional buy
          </Link>
        </div>
      </div>
    </div>
  )
}
