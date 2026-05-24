import { onHoldMessage, type UpiPaymentKind } from '@/features/upi/upiPaymentApi'

type Props = {
  kind: UpiPaymentKind
}

export function UpiOnHoldNotice({ kind }: Props) {
  return (
    <div className="fractional-upi-pay card" role="status">
      <p className="fractional-upi-pay__title" style={{ color: 'var(--danger)' }}>
        Payment on hold
      </p>
      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {onHoldMessage(kind)}
      </p>
    </div>
  )
}
