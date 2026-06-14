import { DashSegmentPair } from '@/components/DashSegmentPair'
import { customerPaymentMethodHint } from '@/features/invest/customerPaymentFlow'

type Method = { id: string; label: string }

type Props = {
  methods: readonly Method[]
  value: 'upi' | 'counter'
  onChange: (method: 'upi' | 'counter') => void
}

export function CustomerPaymentMethodField({ methods, value, onChange }: Props) {
  if (methods.length === 0) return null
  return (
    <>
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className="fractional-buy-legend">Payment method</legend>
        <DashSegmentPair
          items={[...methods]}
          value={value}
          onChange={(id) => onChange(id as 'upi' | 'counter')}
          ariaLabel="Payment method"
          className="fractional-buy-payment-segments"
        />
      </fieldset>
      <p style={{ margin: 0, fontSize: 'var(--ts-caption)', color: 'var(--text-faint)', lineHeight: 1.4 }}>
        {customerPaymentMethodHint(value)}
      </p>
    </>
  )
}
