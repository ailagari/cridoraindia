type Props = {
  compact?: boolean
}

export function UpiPayMethodNotice({ compact }: Props) {
  return (
    <div className={`fractional-upi-pay__notice${compact ? ' fractional-upi-pay__notice--compact' : ''}`} role="note">
      <strong>Pay with your UPI app.</strong>{' '}
      {compact ? (
        <>
          Tap an app icon, then tap <strong>Open</strong> on the next screen. If PhonePe or GPay shows a QR/gallery
          error, use <strong>Copy UPI ID and amount</strong> on that screen and pay manually inside the app.
        </>
      ) : (
        <>Scan the QR code below with your phone&apos;s UPI app camera.</>
      )}
    </div>
  )
}
