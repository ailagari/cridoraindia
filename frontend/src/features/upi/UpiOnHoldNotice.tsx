import { onHoldMessage, type UpiPaymentKind } from '@/features/upi/upiPaymentApi'

type Props = {
  kind: UpiPaymentKind
  contactName?: string
}

export function UpiOnHoldNotice({ kind, contactName }: Props) {
  return (
    <div className="fractional-upi-pay card upi-on-hold-notice" role="status">
      <p className="fractional-upi-pay__title upi-on-hold-notice__title">
        {onHoldMessage(kind, contactName)}
      </p>
      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Visit in person to verify payment and resolve this order.
      </p>
    </div>
  )
}
