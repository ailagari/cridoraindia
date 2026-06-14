import type { LegacyRef } from 'react'
import { UpiPaymentStep } from '@/features/upi/UpiPaymentStep'
import type { UpiPaymentKind } from '@/features/upi/upiPaymentApi'

type Props = {
  kind: UpiPaymentKind
  paymentId: number
  busy: boolean
  setBusy: (busy: boolean) => void
  sectionId?: string
  sectionRef?: LegacyRef<HTMLDivElement>
  onSubmitted?: () => void
  onExpired?: () => void
  onSuccess?: (message: string) => void
  onError?: (message: string) => void
}

export function CustomerActiveUpiPayment({
  kind,
  paymentId,
  busy,
  setBusy,
  sectionId,
  sectionRef,
  onSubmitted,
  onExpired,
  onSuccess,
  onError,
}: Props) {
  return (
    <div ref={sectionRef} id={sectionId}>
      <UpiPaymentStep
        kind={kind}
        paymentId={paymentId}
        busy={busy}
        setBusy={setBusy}
        sectionId={sectionId}
        onSubmitted={onSubmitted}
        onExpired={onExpired}
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  )
}
