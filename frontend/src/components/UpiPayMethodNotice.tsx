type Props = {
  compact?: boolean
}

export function UpiPayMethodNotice({ compact }: Props) {
  return (
    <div className={`fractional-upi-pay__notice${compact ? ' fractional-upi-pay__notice--compact' : ''}`} role="note">
      <strong>Pay with your UPI app.</strong>{' '}
      {compact ? (
        <>Tap PhonePe, GPay, or Paytm below. After paying, submit your UTR or payment screenshot.</>
      ) : (
        <>Scan the QR code below with your phone&apos;s UPI app camera.</>
      )}
    </div>
  )
}
