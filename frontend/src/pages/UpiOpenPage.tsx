import { Link, useSearchParams } from 'react-router-dom'
import { UpiAppPayIcon } from '@/features/upi/UpiAppPayIcons'
import {
  appLabel,
  buildNativeAppPayHref,
  parseHandoffSearchParams,
  type UpiAppId,
} from '@/lib/upiPayLinks'

function formatInr(am: string): string {
  const n = Number.parseFloat(am)
  if (!Number.isFinite(n)) return am
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

const MANUAL_STEPS: Record<UpiAppId, string[]> = {
  phonepe: [
    'Open PhonePe → Money Transfers → To Contact / UPI ID',
    'Paste the UPI ID below and verify the payee',
    'Enter the amount shown below and pay with your UPI PIN',
  ],
  gpay: [
    'Open Google Pay → New payment → UPI ID or QR',
    'Paste the UPI ID below',
    'Enter the amount shown below and pay with your UPI PIN',
  ],
  paytm: [
    'Open Paytm → Send money → To UPI ID',
    'Paste the UPI ID below',
    'Enter the amount shown below and pay with your UPI PIN',
  ],
}

export function UpiOpenPage() {
  const [searchParams] = useSearchParams()
  const parsed = parseHandoffSearchParams(searchParams)

  if (!parsed) {
    return (
      <div className="card" style={{ maxWidth: 420, margin: '2rem auto', padding: '1.25rem' }}>
        <p className="form-error" style={{ margin: 0 }}>
          Invalid payment link. Go back and try again from your order.
        </p>
      </div>
    )
  }

  const { app, params } = parsed
  const nativeHref = buildNativeAppPayHref(app, params)
  const label = appLabel(app)
  const copyText = [`UPI ID: ${params.pa}`, `Amount: ₹${formatInr(params.am)}`, params.tn ? `Note: ${params.tn}` : '']
    .filter(Boolean)
    .join('\n')

  return (
    <div className="card fractional-upi-pay" style={{ maxWidth: 420, margin: '1.5rem auto' }}>
      <p className="fractional-upi-pay__title">Pay with {label}</p>
      <p className="fractional-upi-pay__lead" style={{ marginBottom: '1rem' }}>
        Pay <strong className="tabular">₹{formatInr(params.am)}</strong>
        {params.pn ? (
          <>
            {' '}
            to <strong>{params.pn}</strong>
          </>
        ) : null}
      </p>

      <div className="fractional-upi-pay__payee" style={{ marginBottom: '1rem' }}>
        <span className="fractional-upi-pay__label">UPI ID</span>
        <p className="fractional-upi-pay__vpa tabular">{params.pa}</p>
        {params.tn ? <p className="fractional-upi-pay__meta">{params.tn}</p> : null}
      </div>

      <div className="fractional-upi-pay__actions">
        <a href={nativeHref} className="fractional-upi-pay__app-icon-btn fractional-upi-pay__app-icon-btn--open">
          <UpiAppPayIcon id={app} className="fractional-upi-pay__app-icon" />
          <span>Open {label}</span>
        </a>
        <p className="fractional-upi-pay__qr-caption" style={{ margin: 0 }}>
          Tap above to open {label} with payee and amount filled in. Confirm and enter your UPI PIN.
        </p>
      </div>

      <div className="fractional-upi-pay__manual-fallback">
        <p className="fractional-upi-pay__label">If {label} shows a QR or gallery error</p>
        <ol className="fractional-upi-pay__manual-steps">
          {MANUAL_STEPS[app].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <button
          type="button"
          className="btn btn-secondary btn--block"
          onClick={() => void navigator.clipboard.writeText(copyText)}
        >
          Copy UPI ID and amount
        </button>
      </div>

      <p style={{ margin: '1rem 0 0', fontSize: '0.78rem' }}>
        <Link to=".." relative="path">
          ← Back to payment
        </Link>
      </p>
    </div>
  )
}
