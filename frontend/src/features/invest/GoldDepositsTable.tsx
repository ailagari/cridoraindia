import { Fragment, useState } from 'react'
import { Badge, TablePagination } from '@/components/ui'
import { useTablePagination } from '@/hooks/useTablePagination'
import { useCounterOtpCountdown } from '@/features/invest/useCounterOtpCountdown'
import type { GoldDepositIntakeDTO } from '@/lib/goldDepositApi'

const DEPOSITS_PAGE_SZ = 10
const OTP_LEN = 6

function formatInr(s: string): string {
  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  return new Date(t).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
}

export function depositStatusLabel(status: string): string {
  if (status === 'awaiting_customer_otp') return 'Pending'
  if (status === 'completed') return 'Approved'
  if (status === 'cancelled') return 'Cancelled'
  return status.replace(/_/g, ' ')
}

function depositStatusTone(status: string): 'success' | 'danger' | 'warning' | 'gold' {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'awaiting_customer_otp') return 'warning'
  return 'gold'
}

function OtpLive({ otp, expiresAt }: { otp: string; expiresAt: string }) {
  const { expired, labelMmSs } = useCounterOtpCountdown(expiresAt)
  return (
    <div className="gold-deposit-otp-reveal">
      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
        Show this code only to your jeweller
      </p>
      <p
        className="tabular"
        style={{
          margin: '0.35rem 0 0',
          fontSize: '1.45rem',
          fontWeight: 800,
          letterSpacing: '0.2em',
          color: expired ? 'var(--danger)' : 'var(--gold-light)',
        }}
      >
        {otp}
      </p>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: expired ? 'var(--danger)' : 'var(--text-muted)' }}>
        {expired ? 'Expired — generate a new code.' : `Valid ${labelMmSs}`}
      </p>
    </div>
  )
}

function CustomerOtpExpiryHint({ expiresAt }: { expiresAt?: string | null }) {
  const { expired, labelMmSs } = useCounterOtpCountdown(expiresAt ?? null)
  if (!expiresAt) {
    return (
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
        No OTP yet — customer taps <strong>Generate OTP</strong>.
      </p>
    )
  }
  return (
    <p
      style={{
        margin: '0.35rem 0 0',
        fontSize: '0.72rem',
        color: expired ? 'var(--danger)' : 'var(--text-muted)',
        fontWeight: expired ? 700 : 400,
      }}
    >
      {expired ? 'OTP expired — customer must generate a new code.' : `OTP valid ${labelMmSs} remaining`}
    </p>
  )
}

type CustomerProps = {
  role: 'customer'
  rows: GoldDepositIntakeDTO[]
  busyId: number | null
  kycVerified: boolean
  otpReveal: { intakeId: number; otp: string; expiresAt: string } | null
  onIssueOtp: (id: number) => void
}

type JewellerProps = {
  role: 'jeweller'
  rows: GoldDepositIntakeDTO[]
  busyId: number | null
  otpById: Record<number, string>
  onOtpChange: (id: number, otp: string) => void
  onVerify: (id: number) => void
}

type Props = CustomerProps | JewellerProps

export function GoldDepositsTable(props: Props) {
  const { rows, busyId, role } = props
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const pg = useTablePagination(rows.length, DEPOSITS_PAGE_SZ)
  const pageRows = pg.active ? rows.slice(pg.sliceStart, pg.sliceEnd) : rows

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', margin: 0 }}>
        {role === 'customer'
          ? 'No deposit intakes yet. When a jeweller creates one for you, it appears here.'
          : 'No gold deposits recorded yet.'}
      </p>
    )
  }

  return (
    <div className="jeweller-purchases-wrap customer-orders-table-wrap gold-deposits-table-wrap">
      <table className="jeweller-purchases-table customer-orders-table gold-deposits-table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            {role === 'customer' ? <th scope="col">Jeweller</th> : <th scope="col">Customer</th>}
            <th scope="col">Metal</th>
            <th scope="col">Est. value</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r) => {
            const isOpen = expanded.has(r.id)
            const isPending = r.status === 'awaiting_customer_otp'
            return (
              <Fragment key={r.id}>
                <tr className={isOpen ? 'customer-orders-row--open' : undefined}>
                  <td data-label="Reference">
                    <button
                      type="button"
                      className="jeweller-unified-desk-order-toggle tabular"
                      aria-expanded={isOpen}
                      onClick={() => toggle(r.id)}
                    >
                      {r.reference}
                    </button>
                  </td>
                  {role === 'customer' ? (
                    <td data-label="Jeweller">
                      <strong>{r.jeweller.business_name}</strong>
                      {r.jeweller.city ? (
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {r.jeweller.city}
                        </span>
                      ) : null}
                    </td>
                  ) : (
                    <td data-label="Customer">
                      {r.customer ? (
                        <>
                          <strong>{r.customer.name || r.customer.email}</strong>
                          <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {r.customer.email}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td data-label="Metal">
                    <strong className="tabular">{r.grams} g</strong>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {r.purity_karat}
                    </span>
                  </td>
                  <td data-label="Est. value">
                    <strong className="tabular">₹{formatInr(r.estimated_value_inr)}</strong>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      @ ₹{formatInr(r.reference_metal_inr_per_gram)}/g
                    </span>
                  </td>
                  <td data-label="Status">
                    <Badge tone={depositStatusTone(r.status)}>{depositStatusLabel(r.status)}</Badge>
                  </td>
                  <td data-label="Created">{formatWhen(r.created_at)}</td>
                </tr>
                {isOpen ? (
                  <tr className="customer-orders-detail-row">
                    <td colSpan={6}>
                      <div className="customer-orders-detail gold-deposit-detail">
                        {r.jeweller_note ? (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Jeweller note: {r.jeweller_note}
                          </p>
                        ) : null}
                        {r.completed_at ? (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Approved {formatWhen(r.completed_at)}
                          </p>
                        ) : null}

                        {role === 'customer' && isPending && props.kycVerified ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={busyId != null}
                              onClick={() => props.onIssueOtp(r.id)}
                            >
                              {busyId === r.id ? 'Generating…' : 'Generate OTP for jeweller'}
                            </button>
                            {props.otpReveal && props.otpReveal.intakeId === r.id ? (
                              <OtpLive otp={props.otpReveal.otp} expiresAt={props.otpReveal.expiresAt} />
                            ) : null}
                          </>
                        ) : null}

                        {role === 'customer' && isPending && !props.kycVerified ? (
                          <p className="form-error" style={{ margin: 0 }}>
                            Complete KYC before generating OTP.
                          </p>
                        ) : null}

                        {role === 'jeweller' && isPending ? (
                          <div className="jeweller-purchases-otp-stack">
                            <p className="jeweller-purchases-otp-lead">
                              Customer generates OTP in their app. Enter the {OTP_LEN}-digit code to approve.
                            </p>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={OTP_LEN}
                              className="tabular jeweller-purchases-otp-input"
                              value={props.otpById[r.id] ?? ''}
                              onChange={(e) =>
                                props.onOtpChange(r.id, e.target.value.replace(/\D/g, '').slice(0, OTP_LEN))
                              }
                              placeholder="······"
                              aria-label={`OTP for ${r.reference}`}
                            />
                            <CustomerOtpExpiryHint expiresAt={r.otp_expires_at} />
                            <button
                              type="button"
                              className="btn btn-primary jeweller-purchases-verify-btn"
                              disabled={busyId != null || (props.otpById[r.id] ?? '').length !== OTP_LEN}
                              onClick={() => props.onVerify(r.id)}
                            >
                              {busyId === r.id ? 'Verifying…' : 'Verify OTP & approve deposit'}
                            </button>
                          </div>
                        ) : null}

                        {r.status === 'completed' ? (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
                            Deposit approved and credited to customer vault.
                          </p>
                        ) : null}

                        {r.status === 'cancelled' ? (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            This intake was cancelled.
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {pg.active ? (
        <TablePagination
          page={pg.page}
          totalPages={pg.totalPages}
          totalItems={rows.length}
          pageSize={pg.pageSize}
          onPrev={() => pg.setPage((p) => Math.max(0, p - 1))}
          onNext={() => pg.setPage((p) => Math.min(pg.totalPages - 1, p + 1))}
          className="pf-ledger-pagination"
        />
      ) : null}
    </div>
  )
}
