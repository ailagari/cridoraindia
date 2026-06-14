import { Button, Card } from '@/components/ui'
import { MobileDashboardCancelButton } from '@/features/dashboard/MobileDashboardCancelButton'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import type { CounterOtpReveal } from '@/features/invest/customerPaymentFlow'

type Props = {
  paymentId: number
  referenceLabel?: string
  busy: boolean
  otpReveal: CounterOtpReveal | null
  onIssueOtp: (paymentId: number) => void | Promise<void>
  onCancel: () => void | Promise<void>
  cancelLabel?: string
  cancelConfirmMessage?: string
}

export function CustomerCounterPaymentFlow({
  paymentId,
  referenceLabel,
  busy,
  otpReveal,
  onIssueOtp,
  onCancel,
  cancelLabel = 'Cancel order',
  cancelConfirmMessage = 'Cancel this counter order? You can place a new one later if needed.',
}: Props) {
  const otpCountdown = useCounterOtpCountdown(otpReveal?.expiresAt ?? null)
  const activeOtp = otpReveal?.paymentId === paymentId

  return (
    <>
      <div className="dash-form-stack" style={{ marginTop: '0.5rem' }}>
        <Button
          type="button"
          variant="primary"
          block
          disabled={busy || (activeOtp && !otpCountdown.expired)}
          onClick={() => void onIssueOtp(paymentId)}
        >
          {activeOtp && otpCountdown.expired
            ? 'Generate new verification OTP'
            : activeOtp && !otpCountdown.expired
              ? 'OTP active — use timer below'
              : 'Generate verification OTP'}
        </Button>
        <MobileDashboardCancelButton
          block
          busy={busy}
          label={cancelLabel}
          confirmMessage={cancelConfirmMessage}
          onCancel={onCancel}
        />
      </div>

      {activeOtp && otpReveal ? (
        <Card
          tone="accent"
          style={{ opacity: otpCountdown.expired ? 0.65 : 1, border: '1px solid var(--gold-line-20)' }}
          role="status"
          aria-live="polite"
        >
          <p style={{ margin: '0 0 var(--sp-2)', fontSize: 'var(--ts-caption)', color: 'var(--text-muted)', fontWeight: 500 }}>
            {referenceLabel ? `${referenceLabel} · ` : ''}Show to jeweller
          </p>
          <p
            className="tabular"
            style={{ margin: '0 0 var(--sp-2)', fontSize: 'var(--ts-display)', fontWeight: 700, letterSpacing: '0.25em' }}
          >
            {otpReveal.otp}
          </p>
          <p
            style={{
              margin: '0 0 var(--sp-3)',
              fontSize: 'var(--ts-caption)',
              color: otpCountdown.expired ? 'var(--danger)' : 'var(--text-muted)',
            }}
          >
            {otpCountdown.expired ? 'Expired' : `${otpCountdown.labelMmSs} remaining`}
          </p>
          <Button
            type="button"
            variant="primary"
            block
            disabled={busy || !otpCountdown.expired}
            onClick={() => void onIssueOtp(paymentId)}
          >
            {otpCountdown.expired ? 'New OTP' : 'Active'}
          </Button>
        </Card>
      ) : null}
    </>
  )
}
