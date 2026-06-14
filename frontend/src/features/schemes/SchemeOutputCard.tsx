import type { SchemeDesign } from '@/lib/schemesApi'
import { Card } from '@/components/ui'

type Props = {
  design: SchemeDesign
  onChange: (d: SchemeDesign) => void
}

export function SchemeOutputCard({ design, onChange }: Props) {
  const out = design.output
  const patch = (key: string, value: unknown) =>
    onChange({ ...design, output: { ...out, [key]: value } })

  return (
    <Card>
      <h3 className="dash-card-title">③ Output — redemption</h3>
      <label className="form-label">
        Redeem as
        <select
          className="form-input"
          value={String(out.redeem_as ?? 'jewellery_cash_pool')}
          onChange={(e) => patch('redeem_as', e.target.value)}
        >
          <option value="jewellery_cash_pool">Jewellery bill (INR pool)</option>
          <option value="gold_grams">Vault gold grams</option>
          <option value="cash_convert_to_gold">INR pool → gold at redemption</option>
          <option value="jewellery_from_gold">Jewellery from gold + MC</option>
        </select>
      </label>
      <label className="form-label" style={{ marginTop: '0.5rem' }}>
        <input
          type="checkbox"
          checked={Boolean(out.allow_topup)}
          onChange={(e) => patch('allow_topup', e.target.checked)}
        />{' '}
        Allow top-up at redemption
      </label>
      <label className="form-label">
        <input
          type="checkbox"
          checked={Boolean(out.lock_until_plan_complete)}
          onChange={(e) => patch('lock_until_plan_complete', e.target.checked)}
        />{' '}
        Lock redemption until plan complete
      </label>
    </Card>
  )
}
