import type { SchemeEnrollmentDTO } from '@/lib/schemesApi'
import { Card } from '@/components/ui'

type Props = {
  enrollment: SchemeEnrollmentDTO
  active?: boolean
  onSelect?: () => void
}

export function CustomerSchemeProgressCard({ enrollment, active, onSelect }: Props) {
  const e = enrollment
  const bucket = e.month_buckets[e.month_buckets.length - 1]
  return (
    <Card
      className={active ? 'scheme-progress-card is-active' : 'scheme-progress-card'}
      onClick={onSelect}
      style={{ cursor: onSelect ? 'pointer' : undefined }}
    >
      <h3 className="dash-card-title">{e.offering.display_name}</h3>
      <p className="dash-muted">{e.jeweller.business_name}</p>
      {e.status !== 'active' || !e.payments_enabled ? (
        <p>
          <span className="dash-badge">
            {e.status === 'pending_admission'
              ? 'Awaiting jeweller'
              : e.status.replace(/_/g, ' ')}
          </span>
        </p>
      ) : null}
      <p>
        Month <strong>{e.current_plan_month}</strong>
        {e.offering.scheme_design?.plan_timeline?.customer_months
          ? ` of ${String(e.offering.scheme_design.plan_timeline.customer_months)}`
          : ''}
      </p>
      <dl className="dash-dl">
        <dt>INR pool</dt>
        <dd>₹{e.balances.inr_balance}</dd>
        <dt>Gold</dt>
        <dd>{e.balances.gold_grams_balance} g</dd>
        {bucket ? (
          <>
            <dt>This month ({bucket.calendar_month})</dt>
            <dd>
              ₹{bucket.monthly_total_inr} · {bucket.deposit_count} deposit(s)
            </dd>
          </>
        ) : null}
      </dl>
    </Card>
  )
}
