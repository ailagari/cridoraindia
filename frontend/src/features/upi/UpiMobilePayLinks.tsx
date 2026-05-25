import { useMemo } from 'react'
import { UpiAppPayIcon } from '@/features/upi/UpiAppPayIcons'
import { buildUpiAppPayLinks } from '@/lib/upiPayLinks'

type Props = {
  upiUri: string
}

/** App-branded icon links — each opens the matching UPI app with payment details pre-filled. */
export function UpiMobilePayLinks({ upiUri }: Props) {
  const appLinks = useMemo(() => buildUpiAppPayLinks(upiUri), [upiUri])

  if (appLinks.length === 0) return null

  return (
    <div className="fractional-upi-pay__actions">
      <p className="fractional-upi-pay__qr-caption" style={{ marginBottom: '0.5rem' }}>
        Tap your UPI app — payee, amount, and reference are pre-filled. Confirm and enter your UPI PIN.
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
