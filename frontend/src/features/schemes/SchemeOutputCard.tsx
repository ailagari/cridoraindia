import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, CardHeader, Select, Toggle } from '@/components/ui'
import { SchemeSectionPreview } from './SchemeSectionPreview'
import { buildOutputPreview, type SchemePreviewData } from './schemePreviewHelpers'

type Props = {
  design: SchemeDesign
  onChange: (d: SchemeDesign) => void
  disabled?: boolean
  preview?: SchemePreviewData | null
}

export function SchemeOutputCard({ design, onChange, disabled, preview }: Props) {
  const out = design.output
  const patch = (key: string, value: unknown) =>
    onChange({ ...design, output: { ...out, [key]: value } })

  const outputPreview = buildOutputPreview(design, preview ?? null)

  return (
    <Card>
      <CardHeader title="③ Output — redemption" />
      <div className="ds-form ds-form--compact">
        <Select
          label="Redeem as"
          value={String(out.redeem_as ?? 'jewellery_cash_pool')}
          disabled={disabled}
          onChange={(e) => patch('redeem_as', e.target.value)}
        >
          <option value="jewellery_cash_pool">Jewellery bill (INR pool)</option>
          <option value="gold_grams">Vault gold grams</option>
          <option value="cash_convert_to_gold">INR pool → gold at redemption</option>
          <option value="jewellery_from_gold">Jewellery from gold + MC</option>
        </Select>
        <Toggle
          label="Allow top-up at redemption"
          checked={Boolean(out.allow_topup)}
          disabled={disabled}
          onChange={(checked) => patch('allow_topup', checked)}
        />
        <Toggle
          label="Lock redemption until plan complete"
          checked={Boolean(out.lock_until_plan_complete)}
          disabled={disabled}
          onChange={(checked) => patch('lock_until_plan_complete', checked)}
        />
        <SchemeSectionPreview title={outputPreview.title} lines={outputPreview.lines} />
      </div>
    </Card>
  )
}
