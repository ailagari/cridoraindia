import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Input } from '@/components/ui'
import {
  approveSchemeContribution,
  fetchJewellerPendingSchemeContributions,
  fetchJewellerPendingSchemeUpi,
  rejectSchemeContribution,
  verifySchemeContributionOtp,
  type SchemeContributionDTO,
} from '@/lib/schemesApi'

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
        <h2 className="dash-card-title">Scheme desk</h2>
        <p className="dash-muted">Counter OTP queue and UPI contributions for scheme enrollments.</p>
        {msg ? <p className="form-success">{msg}</p> : null}
        {err ? <p className="form-error">{err}</p> : null}
      </Card>

      <Card>
        <h3 className="dash-card-title">Awaiting counter OTP</h3>
        <ul className="dash-list">
          {counter.map((c) => (
            <li key={c.id} className="dash-list-item">
              <div>
                <strong>{c.reference}</strong> — ₹{c.amount_inr}
              </div>
              <Input
                label="Counter OTP"
                placeholder="6-digit OTP"
                value={otpInputs[c.id] ?? ''}
                onChange={(e) =>
                  setOtpInputs((prev) => ({ ...prev, [c.id]: e.target.value }))
                }
              />
              <Button size="sm" onClick={() => void verify(c.id)}>
                Verify
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
