import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, CardHeader, Input, Select, Toggle } from '@/components/ui'
import { SchemeSectionPreview } from './SchemeSectionPreview'
import { buildInputPreview, type SchemePreviewData } from './schemePreviewHelpers'

type Props = {
  design: SchemeDesign
  onChange: (d: SchemeDesign) => void
  disabled?: boolean
  preview?: SchemePreviewData | null
}

export function SchemeInputCard({ design, onChange, disabled, preview }: Props) {
  const inp = design.input
  const isGold = inp.payment_type === 'gold'
  const patch = (key: string, value: unknown) =>
    onChange({ ...design, input: { ...inp, [key]: value } })

  const setMakingChargeEnabled = (checked: boolean) => {
    onChange({
      ...design,
      input: {
        ...inp,
        includes_making_charge: checked,
        making_charge_mode: checked ? 'jeweller_percent' : 'none',
        making_charge_percent: checked ? Number(inp.making_charge_percent ?? 12) : inp.making_charge_percent,
      },
    })
  }

  const inputPreview = buildInputPreview(design, preview ?? null)

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

        {isGold ? (
          <>
            <Toggle
              label="Includes GST on gold"
              checked={Boolean(inp.includes_gst)}
              disabled={disabled}
              onChange={(checked) => patch('includes_gst', checked)}
            />
            {inp.includes_gst ? (
              <Input
                label="GST on gold %"
                inputMode="decimal"
                value={String(inp.gst_percent ?? 3)}
                disabled={disabled}
                onChange={(e) => patch('gst_percent', Number(e.target.value))}
              />
            ) : null}

            <Toggle
              label="Includes making charge in deposit"
              checked={Boolean(inp.includes_making_charge)}
              disabled={disabled}
              onChange={setMakingChargeEnabled}
            />
            {inp.includes_making_charge ? (
              <>
                <Input
                  label="Making charge %"
                  hint="% of gold value before GST"
                  inputMode="decimal"
                  value={String(inp.making_charge_percent ?? 12)}
                  disabled={disabled}
                  onChange={(e) => patch('making_charge_percent', Number(e.target.value))}
                />
                <Toggle
                  label="GST on making charge"
                  checked={Boolean(inp.includes_gst_on_making_charge)}
                  disabled={disabled}
                  onChange={(checked) => patch('includes_gst_on_making_charge', checked)}
                />
                {inp.includes_gst_on_making_charge ? (
                  <Input
                    label="GST on making charge %"
                    inputMode="decimal"
                    value={String(inp.gst_on_making_charge_percent ?? inp.gst_percent ?? 3)}
                    disabled={disabled}
                    onChange={(e) => patch('gst_on_making_charge_percent', Number(e.target.value))}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <p className="ds-field__hint" style={{ margin: 0 }}>
            GST and making charge apply when payment type is gold.
          </p>
        )}

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
        <SchemeSectionPreview title={inputPreview.title} lines={inputPreview.lines} />
      </div>
    </Card>
  )
}
