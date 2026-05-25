import { UpiAppPayIcon } from '@/features/upi/UpiAppPayIcons'
import { buildUpiAppPayLinks } from '@/lib/upiPayLinks'

type Props = {
  upiUri: string
}

export function UpiMobilePayLinks({ upiUri }: Props) {
  const appLinks = buildUpiAppPayLinks(upiUri)

  if (appLinks.length === 0) return null

  return (
    <div className="fractional-upi-pay__actions">
      <p className="fractional-upi-pay__qr-caption" style={{ marginBottom: '0.5rem' }}>
        Tap your UPI app to pay with amount and payee filled in.
      </p>
      <div className="fractional-upi-pay__app-icons" role="list">
        {appLinks.map((app) => (
          <a
            key={app.id}
            href={app.href}
            className="fractional-upi-pay__app-icon-btn"
            role="listitem"
            aria-label={`Pay with ${app.label}`}
          >
            <UpiAppPayIcon id={app.id} className="fractional-upi-pay__app-icon" />
            <span>{app.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
