import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardHeader, Feedback, Input, Select } from '@/components/ui'
import { jewellerLookupCustomer } from '@/lib/personalHoldingsApi'
import {
  fetchJewellerSchemeOfferingEnrollments,
  fetchJewellerSchemeOfferings,
  jewellerAdmitCustomerToScheme,
  type SchemeJewellerEnrollmentDTO,
  type SchemeOfferingDTO,
} from '@/lib/schemesApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

export function JewellerSchemeEnrollPanel() {
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
  const [offeringId, setOfferingId] = useState<number | ''>('')
  const [enrollments, setEnrollments] = useState<SchemeJewellerEnrollmentDTO[]>([])
  const [memberId, setMemberId] = useState('')
  const [phone, setPhone] = useState('')
  const [lookupErr, setLookupErr] = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [customerLabel, setCustomerLabel] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const activeOfferings = offerings.filter((o) => o.status === 'active')

  const reloadOfferings = useCallback(async () => {
    try {
      const rows = await fetchJewellerSchemeOfferings()
      setOfferings(rows)
      setOfferingId((prev) => {
        if (prev && rows.some((o) => o.id === prev)) return prev
        const first = rows.find((o) => o.status === 'active')
        return first?.id ?? ''
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load schemes')
    }
  }, [])

  const reloadEnrollments = useCallback(async () => {
    if (!offeringId) {
      setEnrollments([])
      return
    }
    try {
      const rows = await fetchJewellerSchemeOfferingEnrollments(offeringId)
      setEnrollments(rows)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load enrollments')
    }
  }, [offeringId])

  useEffect(() => {
    void reloadOfferings()
  }, [reloadOfferings])

  useEffect(() => {
    void reloadEnrollments()
  }, [reloadEnrollments])

  useLivePoll(() => {
    void reloadEnrollments()
  }, LIVE_BALANCE_POLL_MS, Boolean(offeringId))

  const runLookup = async () => {
    setLookupErr('')
    setMsg('')
    const r = await jewellerLookupCustomer({
      cridora_member_id: memberId.trim() || undefined,
      phone: phone.trim() || undefined,
    })
    if (!r.found || !r.customer) {
      setLookupErr(r.detail ?? 'Customer not found.')
      setCustomerId(null)
      setCustomerLabel('')
      return
    }
    setCustomerId(r.customer.id)
    setCustomerLabel(`${r.customer.label} · ${r.customer.cridora_member_id}`)
  }

  const admitCustomer = async () => {
    if (!offeringId || customerId == null) {
      setErr('Select a scheme and look up a verified customer first.')
      return
    }
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const row = await jewellerAdmitCustomerToScheme(offeringId, { customer_id: customerId })
      setMsg(
        row.payments_enabled
          ? `${row.customer.label} can now pay into ${row.offering.display_name}.`
          : `Added ${row.customer.label} to the scheme.`,
      )
      setMemberId('')
      setPhone('')
      setCustomerId(null)
      setCustomerLabel('')
      await reloadEnrollments()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add customer')
    } finally {
      setBusy(false)
    }
  }

  const pending = enrollments.filter((e) => e.status === 'pending_admission')
  const active = enrollments.filter(
    (e) => e.status === 'active' || e.status === 'plan_month_complete',
  )

  return (
    <Card>
      <CardHeader title="Add customers to schemes" />
      <p className="dash-muted" style={{ marginTop: 0 }}>
        Look up a verified customer by Cridora ID or phone, then add them to a scheme. Customers can
        request to join from their dashboard, but deposits start only after you add them here.
      </p>

      <div className="ds-form ds-form--compact" style={{ marginTop: '1rem' }}>
        <Select
          label="Scheme"
          value={offeringId === '' ? '' : String(offeringId)}
          onChange={(e) => setOfferingId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select scheme</option>
          {activeOfferings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.display_name}
            </option>
          ))}
        </Select>

        <Input
          label="Cridora member ID"
          placeholder="CRI…"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
        />
        <Input
          label="Phone"
          placeholder="Customer mobile"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={() => void runLookup()} disabled={busy}>
          Look up customer
        </Button>
        {customerLabel ? (
          <p className="ds-field__hint" style={{ margin: 0 }}>
            Selected: <strong>{customerLabel}</strong>
          </p>
        ) : null}
        {lookupErr ? <Feedback tone="error">{lookupErr}</Feedback> : null}
        <Button type="button" variant="primary" onClick={() => void admitCustomer()} disabled={busy || !offeringId}>
          Add to scheme & enable payments
        </Button>
      </div>

      {offeringId ? (
        <div style={{ marginTop: '1.25rem' }}>
          {pending.length > 0 ? (
            <>
              <h3 className="dash-card-title">Pending join requests</h3>
              <ul className="dash-list">
                {pending.map((e) => (
                  <li key={e.id} className="dash-list-item">
                    <div>
                      <strong>{e.customer.label}</strong>
                      <p className="dash-muted">
                        {e.customer.cridora_member_id}
                        {e.customer.phone ? ` · ${e.customer.phone}` : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() =>
                        void jewellerAdmitCustomerToScheme(offeringId, {
                          customer_id: e.customer.id,
                        })
                          .then(() => {
                            setMsg(`Admitted ${e.customer.label}.`)
                            return reloadEnrollments()
                          })
                          .catch((ex) =>
                            setErr(ex instanceof Error ? ex.message : 'Admit failed'),
                          )
                      }
                    >
                      Admit & enable pay
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h3 className="dash-card-title" style={{ marginTop: pending.length ? '1rem' : 0 }}>
            Enrolled customers
          </h3>
          <ul className="dash-list">
            {active.map((e) => (
              <li key={e.id} className="dash-list-item">
                <div>
                  <strong>{e.customer.label}</strong>
                  <p className="dash-muted">
                    {e.status === 'plan_month_complete' ? 'Cycle complete · ' : ''}
                    {e.payments_enabled ? 'Can pay' : 'Payments locked'}
                  </p>
                </div>
              </li>
            ))}
            {active.length === 0 ? <p className="dash-muted">No admitted customers yet.</p> : null}
          </ul>
        </div>
      ) : null}

      {msg ? <Feedback tone="success">{msg}</Feedback> : null}
      {err ? <Feedback tone="error">{err}</Feedback> : null}
    </Card>
  )
}
