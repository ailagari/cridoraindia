import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, Input } from '@/components/ui'

type Props = {
  design: SchemeDesign
  onChange: (d: SchemeDesign) => void
}

export function SchemeInputCard({ design, onChange }: Props) {
  const inp = design.input
  const patch = (key: string, value: unknown) =>
    onChange({ ...design, input: { ...inp, [key]: value } })

  return (
    <Card>
      <h3 className="dash-card-title">① Input — how customers pay</h3>
      <label className="form-label">
        Payment type
        <select
          className="form-input"
          value={String(inp.payment_type ?? 'cash')}
          onChange={(e) => patch('payment_type', e.target.value)}
        >
          <option value="cash">Cash (INR pool)</option>
          <option value="gold">Gold (grams + GST/MC)</option>
        </select>
      </label>
      <label className="form-label" style={{ marginTop: '0.5rem' }}>
        <input
          type="checkbox"
          checked={Boolean(inp.includes_gst)}
          onChange={(e) => patch('includes_gst', e.target.checked)}
        />{' '}
        Includes GST in deposit
      </label>
      {inp.includes_gst ? (
        <Input
          label="GST %"
          value={String(inp.gst_percent ?? 3)}
          onChange={(e) => patch('gst_percent', Number(e.target.value))}
        />
      ) : null}
      <Input
        label="Min deposit ₹ (optional)"
        value={inp.min_deposit_inr != null ? String(inp.min_deposit_inr) : ''}
        onChange={(e) =>
          patch('min_deposit_inr', e.target.value ? Number(e.target.value) : null)
        }
      />
    </Card>
  )
}
