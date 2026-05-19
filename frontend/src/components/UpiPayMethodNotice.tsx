type Props = {
  compact?: boolean
}

export function UpiPayMethodNotice({ compact }: Props) {
  return (
    <div className={`fractional-upi-pay__notice${compact ? ' fractional-upi-pay__notice--compact' : ''}`} role="note">
      <strong>Use Open UPI app to pay.</strong>{' '}
      {compact ? (
        <>Do not upload a screenshot to PhonePe gallery — limits apply.</>
      ) : (
        <>
          Tap the button below to open GPay or PhonePe with amount pre-filled. Do not screenshot this page and pay via
          PhonePe&apos;s &ldquo;gallery QR&rdquo; — NPCI limits those payments to ₹2,000 and may block the flow. You can
          also copy the UPI ID and pay manually inside your UPI app.
        </>
      )}
    </div>
  )
}
