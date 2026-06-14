import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, CardHeader, Input, Select, Toggle } from '@/components/ui'

type Props = {
  design: SchemeDesign
  onChange: (d: SchemeDesign) => void
  disabled?: boolean
}

export function SchemeInputCard({ design, onChange, disabled }: Props) {
  const inp = design.input
  const patch = (key: string, value: unknown) =>
    onChange({ ...design, input: { ...inp, [key]: value } })

  return (
    <Card>
      <CardHeader title="① Input — how customers pay" />
      <div className="ds-form ds-form--compact">
        <Select
          label="Payment type"
          value={String(inp.payment_type ?? 'cash')}
          disabled={disabled}
          onChange={(e) => patch('payment_type', e.target.value)}
        >
          <option value="cash">Cash (INR pool)</option>
          <option value="gold">Gold (grams + GST/MC)</option>
        </Select>
        <Toggle
          label="Includes GST in deposit"
          checked={Boolean(inp.includes_gst)}
          disabled={disabled}
          onChange={(checked) => patch('includes_gst', checked)}
        />
        {inp.includes_gst ? (
          <Input
            label="GST %"
            inputMode="decimal"
            value={String(inp.gst_percent ?? 3)}
            disabled={disabled}
            onChange={(e) => patch('gst_percent', Number(e.target.value))}
          />
        ) : null}
        <Input
          label="Min deposit ₹"
          hint="Optional minimum per contribution"
          inputMode="decimal"
          placeholder="No minimum"
          value={inp.min_deposit_inr != null ? String(inp.min_deposit_inr) : ''}
          disabled={disabled}
          onChange={(e) =>
            patch('min_deposit_inr', e.target.value ? Number(e.target.value) : null)
          }
        />
      </div>
    </Card>
  )
}
