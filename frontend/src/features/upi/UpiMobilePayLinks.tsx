import { Link } from 'react-router-dom'
import { UpiAppPayIcon } from '@/features/upi/UpiAppPayIcons'
import { buildUpiAppPayLinks } from '@/lib/upiPayLinks'

type Props = {
  upiUri: string
}

/** Icon buttons → same-origin handoff page → native PSP deep link (required for Chrome Android). */
export function UpiMobilePayLinks({ upiUri }: Props) {
  const appLinks = buildUpiAppPayLinks(upiUri)

  if (appLinks.length === 0) return null

  return (
    <div className="fractional-upi-pay__actions">
      <p className="fractional-upi-pay__qr-caption" style={{ marginBottom: '0.5rem' }}>
        Choose your UPI app. On the next screen, tap Open to launch the app with details filled in.
      </p>
      <div className="fractional-upi-pay__app-icons" role="list">
        {appLinks.map((app) => (
          <Link
            key={app.id}
            to={app.href}
            className="fractional-upi-pay__app-icon-btn"
            role="listitem"
            aria-label={`Pay with ${app.label}`}
          >
            <UpiAppPayIcon id={app.id} className="fractional-upi-pay__app-icon" />
            <span>{app.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
