import type { SchemeDesign } from '@/lib/schemesApi'
import { Card, CardHeader, Input, Select, Toggle } from '@/components/ui'

type Props = {
  design: SchemeDesign
  onChange: (d: SchemeDesign) => void
  disabled?: boolean
}

export function SchemeBonusCard({ design, onChange, disabled }: Props) {
  const tl = design.plan_timeline
  const patch = (key: string, value: unknown) =>
    onChange({ ...design, plan_timeline: { ...tl, [key]: value } })

  return (
    <Card>
      <CardHeader title="② Plan timeline — months & bonus" />
      <div className="ds-form ds-form--compact">
        <Toggle
          label="Fixed duration plan"
          checked={Boolean(tl.fixed_duration)}
          disabled={disabled}
          onChange={(checked) => patch('fixed_duration', checked)}
        />
        {tl.fixed_duration ? (
          <>
            <Input
              label="Customer months"
              inputMode="numeric"
              value={String(tl.customer_months ?? 11)}
              disabled={disabled}
              onChange={(e) => patch('customer_months', Number(e.target.value))}
            />
            <Toggle
              label="Jeweller bonus month"
              checked={Boolean(tl.bonus_enabled)}
              disabled={disabled}
              onChange={(checked) => patch('bonus_enabled', checked)}
            />
            {tl.bonus_enabled ? (
              <>
                <Input
                  label="Bonus month index"
                  inputMode="numeric"
                  value={String(tl.jeweller_bonus_month ?? 12)}
                  disabled={disabled}
                  onChange={(e) => patch('jeweller_bonus_month', Number(e.target.value))}
                />
                <Select
                  label="Bonus calculation"
                  value={String(tl.bonus_amount_mode ?? 'avg_all_months')}
                  disabled={disabled}
                  onChange={(e) => patch('bonus_amount_mode', e.target.value)}
                >
                  <option value="avg_all_months">Average all customer months</option>
                  <option value="avg_last_n_months">Average last N months</option>
                  <option value="fixed_inr">Fixed INR</option>
                </Select>
                {tl.bonus_amount_mode === 'avg_last_n_months' ? (
                  <Input
                    label="Avg last N months"
                    inputMode="numeric"
                    value={String(tl.bonus_avg_months ?? 6)}
                    disabled={disabled}
                    onChange={(e) => patch('bonus_avg_months', Number(e.target.value))}
                  />
                ) : null}
                <Select
                  label="Credit bonus as"
                  value={String(tl.bonus_credit_as ?? 'cash_pool')}
                  disabled={disabled}
                  onChange={(e) => patch('bonus_credit_as', e.target.value)}
                >
                  <option value="cash_pool">INR pool</option>
                  <option value="gold_grams">Gold grams</option>
                  <option value="making_charge_credit">MC credit</option>
                </Select>
              </>
            ) : null}
          </>
        ) : (
          <p className="ds-field__hint" style={{ margin: 0 }}>
            Open plan — deposits anytime, redeem per output rules.
          </p>
        )}
      </div>
    </Card>
  )
}
