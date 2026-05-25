type Props = {
  compact?: boolean
}

export function UpiPayMethodNotice({ compact }: Props) {
  return (
    <div className={`fractional-upi-pay__notice${compact ? ' fractional-upi-pay__notice--compact' : ''}`} role="note">
      <strong>Use Open UPI app to pay.</strong>{' '}
      {compact ? (
        <>
          Tap <strong>Pay by UPI</strong> to open PhonePe or GPay with the amount filled in. You can also copy the UPI ID
          below and pay manually in your app.
        </>
      ) : (
        <>
          Scan the QR code with your UPI app camera, or copy the UPI ID and pay manually inside GPay or PhonePe.
        </>
      )}
    </div>
  )
}
