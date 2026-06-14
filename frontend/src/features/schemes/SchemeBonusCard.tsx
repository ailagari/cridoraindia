import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, Input } from '@/components/ui'

type Props = {
  design: SchemeDesign
  onChange: (d: SchemeDesign) => void
}

export function SchemeBonusCard({ design, onChange }: Props) {
  const tl = design.plan_timeline
  const patch = (key: string, value: unknown) =>
    onChange({ ...design, plan_timeline: { ...tl, [key]: value } })

  return (
    <Card>
      <h3 className="dash-card-title">② Plan timeline — months & bonus</h3>
      <label className="form-label">
        <input
          type="checkbox"
          checked={Boolean(tl.fixed_duration)}
          onChange={(e) => patch('fixed_duration', e.target.checked)}
        />{' '}
        Fixed duration plan
      </label>
      {tl.fixed_duration ? (
        <>
          <Input
            label="Customer months"
            value={String(tl.customer_months ?? 11)}
            onChange={(e) => patch('customer_months', Number(e.target.value))}
          />
          <label className="form-label" style={{ marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              checked={Boolean(tl.bonus_enabled)}
              onChange={(e) => patch('bonus_enabled', e.target.checked)}
            />{' '}
            Jeweller bonus month
          </label>
          {tl.bonus_enabled ? (
            <>
              <Input
                label="Bonus month index"
                value={String(tl.jeweller_bonus_month ?? 12)}
                onChange={(e) => patch('jeweller_bonus_month', Number(e.target.value))}
              />
              <label className="form-label">
                Bonus calculation
                <select
                  className="form-input"
                  value={String(tl.bonus_amount_mode ?? 'avg_all_months')}
                  onChange={(e) => patch('bonus_amount_mode', e.target.value)}
                >
                  <option value="avg_all_months">Average all customer months</option>
                  <option value="avg_last_n_months">Average last N months</option>
                  <option value="fixed_inr">Fixed INR</option>
                </select>
              </label>
              {tl.bonus_amount_mode === 'avg_last_n_months' ? (
                <Input
                  label="Avg last N months"
                  value={String(tl.bonus_avg_months ?? 6)}
                  onChange={(e) => patch('bonus_avg_months', Number(e.target.value))}
                />
              ) : null}
              <label className="form-label">
                Credit bonus as
                <select
                  className="form-input"
                  value={String(tl.bonus_credit_as ?? 'cash_pool')}
                  onChange={(e) => patch('bonus_credit_as', e.target.value)}
                >
                  <option value="cash_pool">INR pool</option>
                  <option value="gold_grams">Gold grams</option>
                  <option value="making_charge_credit">MC credit</option>
                </select>
              </label>
            </>
          ) : null}
        </>
      ) : (
        <p className="dash-muted">Open plan — deposits anytime, redeem per output rules.</p>
      )}
    </Card>
  )
}
