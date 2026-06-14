import { useMemo, useState } from 'react'
import type { JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import type { SchemeEnrollmentDTO } from '@/lib/schemesApi'
import { Button } from '@/components/ui'

type Props = {
  enrollments: SchemeEnrollmentDTO[]
  selected: SchemeEnrollmentDTO | null
  storefronts: JewellerStorefrontDTO[]
  disabled?: boolean
  onSelect: (enrollment: SchemeEnrollmentDTO) => void
}

function monthLabel(e: SchemeEnrollmentDTO): string {
  const total = e.offering.scheme_design?.plan_timeline?.customer_months
  const suffix = total ? ` of ${String(total)}` : ''
  return `Month ${e.current_plan_month}${suffix}`
}

function SchemeHero({
  enrollment,
  storefront,
  onChangeClick,
  disabled,
}: {
  enrollment: SchemeEnrollmentDTO
  storefront: JewellerStorefrontDTO | null
  onChangeClick: () => void
  disabled?: boolean
}) {
  const jeweller = enrollment.jeweller
  const initials = jeweller.business_name.trim().slice(0, 2).toUpperCase() || 'J'
  return (
    <div className="fractional-jeweller-pay-hero" aria-live="polite">
      <div className="fractional-jeweller-pay-hero__glow" aria-hidden="true" />
      <div className="fractional-jeweller-pay-hero__inner">
        <div className="fractional-jeweller-pay-hero__avatar" aria-hidden="true">
          {storefront?.logo_url ? (
            <img src={storefront.logo_url} alt="" className="fractional-jeweller-pay-hero__logo" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="fractional-jeweller-pay-hero__body">
          <p className="fractional-jeweller-pay-hero__eyebrow">Scheme deposit</p>
          <h2 className="fractional-jeweller-pay-hero__name">{enrollment.offering.display_name}</h2>
          <p className="fractional-jeweller-pay-hero__location">{jeweller.business_name}</p>
          <div className="fractional-jeweller-pay-hero__badges">
            <span className="fractional-jeweller-pay-hero__badge">{monthLabel(enrollment)}</span>
            <span className="fractional-jeweller-pay-hero__badge fractional-jeweller-pay-hero__badge--muted">
              ₹{enrollment.balances.inr_balance} pool
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="fractional-jeweller-pay-hero__change"
          disabled={disabled}
          onClick={onChangeClick}
        >
          Change
        </Button>
      </div>
    </div>
  )
}

export function SchemeEnrollmentPicker({
  enrollments,
  selected,
  storefronts,
  disabled,
  onSelect,
}: Props) {
  const [changeOpen, setChangeOpen] = useState(() => selected == null)

  const storefrontByJeweller = useMemo(() => {
    const m = new Map<number, JewellerStorefrontDTO>()
    for (const s of storefronts) m.set(s.id, s)
    return m
  }, [storefronts])

  const showHero = selected != null && !changeOpen
  const showPicker = changeOpen || selected == null

  if (enrollments.length === 0) {
    return (
      <p className="dash-muted" style={{ margin: 0 }}>
        No schemes ready for payment. Request to join below — your jeweller must add you first.
      </p>
    )
  }

  return (
    <div className="fractional-jeweller-picker">
      {showHero && selected ? (
        <SchemeHero
          enrollment={selected}
          storefront={storefrontByJeweller.get(selected.jeweller.id) ?? null}
          disabled={disabled}
          onChangeClick={() => setChangeOpen(true)}
        />
      ) : null}

      {showPicker ? (
        <div className="fractional-jeweller-picker__change-panel">
          {selected ? (
            <div className="fractional-jeweller-picker__change-head">
              <p className="fractional-jeweller-picker__change-title">Choose scheme</p>
              <Button
                type="button"
                variant="ghost"
                className="fractional-jeweller-picker__cancel"
                disabled={disabled}
                onClick={() => setChangeOpen(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="fractional-jeweller-picker__intro">
              <p className="fractional-jeweller-picker__intro-title">Which scheme?</p>
              <p className="fractional-jeweller-picker__intro-sub">
                Pick an active scheme your jeweller has admitted you to.
              </p>
            </div>
          )}

          <div className="fractional-jeweller-known">
            <p className="fractional-jeweller-known__label">Your active schemes</p>
            <div className="fractional-jeweller-known__grid" role="list">
              {enrollments.map((e) => {
                const active = selected?.id === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="listitem"
                    disabled={disabled}
                    aria-pressed={active}
                    className={
                      active
                        ? 'fractional-jeweller-known__chip fractional-jeweller-known__chip--active'
                        : 'fractional-jeweller-known__chip'
                    }
                    onClick={() => {
                      onSelect(e)
                      setChangeOpen(false)
                    }}
                  >
                    <span className="fractional-jeweller-known__chip-name">{e.offering.display_name}</span>
                    <span className="fractional-jeweller-known__chip-meta">{e.jeweller.business_name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
