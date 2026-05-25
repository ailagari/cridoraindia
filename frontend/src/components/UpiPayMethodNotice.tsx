type Props = {
  compact?: boolean
}

export function UpiPayMethodNotice({ compact }: Props) {
  return (
    <div className={`fractional-upi-pay__notice${compact ? ' fractional-upi-pay__notice--compact' : ''}`} role="note">
      <strong>Pay with your UPI app.</strong>{' '}
      {compact ? (
        <>
          Tap a UPI app icon below — PhonePe, GPay, or Paytm opens with details pre-filled. Confirm the payment
          and enter your UPI PIN.
        </>
      ) : (
        <>Scan the QR code below with your phone&apos;s UPI app camera.</>
      )}
    </div>
  )
}
