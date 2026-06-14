import { useCallback, useEffect, useState } from 'react'
import { Button, Card, CardHeader, Feedback } from '@/components/ui'
import { JewellerSchemeEnrollPanel } from '@/features/schemes/JewellerSchemeEnrollPanel'
import {
  approveSchemeContribution,
  fetchJewellerPendingSchemeContributions,
  fetchJewellerPendingSchemeUpi,
  rejectSchemeContribution,
  verifySchemeContributionOtp,
  type SchemeContributionDTO,
} from '@/lib/schemesApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

export function JewellerSchemeDeskPanel() {
  const [counter, setCounter] = useState<SchemeContributionDTO[]>([])
  const [upi, setUpi] = useState<SchemeContributionDTO[]>([])
  const [otpInputs, setOtpInputs] = useState<Record<number, string>>({})
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const reload = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([
        fetchJewellerPendingSchemeContributions(),
        fetchJewellerPendingSchemeUpi(),
      ])
      setCounter(c.results)
      setUpi(u.results)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useLivePoll(reload, LIVE_BALANCE_POLL_MS, true)

  const verify = async (id: number) => {
    setErr('')
    try {
      await verifySchemeContributionOtp(id, otpInputs[id] ?? '')
      setMsg('Contribution verified.')
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Verify failed')
    }
  }

  return (
    <div className="dash-panel-max">
      <Card>
        <CardHeader title="Schemes desk" />
        <p className="dash-muted" style={{ marginTop: 0 }}>
          Verify counter OTP and approve UPI scheme deposits — same workflow as the fractional purchase desk.
        </p>
        {msg ? <Feedback tone="success">{msg}</Feedback> : null}
        {err ? <Feedback tone="error">{err}</Feedback> : null}
      </Card>

      <JewellerSchemeEnrollPanel />

      <Card>
        <CardHeader title="Awaiting counter OTP" />
        <ul className="dash-list">
          {counter.map((c) => (
            <li key={c.id} className="dash-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div>
                <strong>{c.reference}</strong> — ₹{c.amount_inr}
              </div>
              <input
                className="ds-input"
                placeholder="6-digit OTP from customer"
                value={otpInputs[c.id] ?? ''}
                onChange={(e) =>
                  setOtpInputs((prev) => ({ ...prev, [c.id]: e.target.value }))
                }
              />
              <Button size="sm" onClick={() => void verify(c.id)}>
                Verify & credit
              </Button>
            </li>
          ))}
          {counter.length === 0 ? <p className="dash-muted">No counter queue.</p> : null}
        </ul>
      </Card>

      <Card>
        <h3 className="dash-card-title">UPI pending review</h3>
        <ul className="dash-list">
          {upi.map((c) => (
            <li key={c.id} className="dash-list-item">
              <div>
                <strong>{c.reference}</strong> — ₹{c.amount_inr}
                {c.upi_utr ? <span className="dash-muted"> UTR {c.upi_utr}</span> : null}
              </div>
              <div className="dash-list-actions">
                <Button size="sm" onClick={() => void approveSchemeContribution(c.id).then(reload)}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void rejectSchemeContribution(c.id).then(reload)}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
          {upi.length === 0 ? <p className="dash-muted">No UPI queue.</p> : null}
        </ul>
      </Card>
    </div>
  )
}
