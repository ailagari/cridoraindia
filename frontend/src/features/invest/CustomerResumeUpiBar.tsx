import { Button } from '@/components/ui'
import { MobileDashboardCancelButton } from '@/features/dashboard/MobileDashboardCancelButton'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import { formatCustomerPaymentInr } from '@/features/invest/customerPaymentFlow'

type Props = {
  reference: string
  amountInr: string
  expiresAt: string | null | undefined
  busy: boolean
  onContinue: () => void
  onCancel: () => void | Promise<void>
}

export function CustomerResumeUpiBar({
  reference,
  amountInr,
  expiresAt,
  busy,
  onContinue,
  onCancel,
}: Props) {
  const countdown = useCounterOtpCountdown(expiresAt ?? null)
  if (countdown.expired) return null

  return (
    <div className="upi-continue-payment-bar" role="region" aria-label="Pending UPI payment">
      <div className="upi-continue-payment-bar__copy">
        <p className="upi-continue-payment-bar__title">{reference}</p>
        <p className="upi-continue-payment-bar__meta tabular">
          ₹{formatCustomerPaymentInr(amountInr)} · {countdown.labelMmSs} left
        </p>
      </div>
      <div className="upi-continue-payment-bar__actions">
        <Button type="button" variant="primary" disabled={busy} onClick={onContinue}>
          Continue payment
        </Button>
        <MobileDashboardCancelButton
          block
          busy={busy}
          label="Cancel payment"
          confirmMessage="Cancel this payment? You can start a new one later if needed."
          onCancel={onCancel}
        />
      </div>
    </div>
  )
}
