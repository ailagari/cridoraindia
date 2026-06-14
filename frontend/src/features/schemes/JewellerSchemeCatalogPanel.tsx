import { useCallback, useEffect, useState } from 'react'
import { Button, Card } from '@/components/ui'
import {
  createJewellerSchemeOffering,
  fetchJewellerSchemeCatalog,
  fetchJewellerSchemeOfferings,
  type SchemeOfferingDTO,
  type SchemeTemplateDTO,
} from '@/lib/schemesApi'

export function JewellerSchemeCatalogPanel() {
  const [catalog, setCatalog] = useState<SchemeTemplateDTO[]>([])
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([fetchJewellerSchemeCatalog(), fetchJewellerSchemeOfferings()])
      setCatalog(c)
      setOfferings(o)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed')
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const enroll = async (templateId: number) => {
    setBusy(true)
    try {
      await createJewellerSchemeOffering({ template_id: templateId })
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add offering')
    } finally {
      setBusy(false)
    }
  }

  const enrolledIds = new Set(offerings.map((o) => o.template_id))

  return (
    <div className="dash-panel-max">
      <Card>
        <h2 className="dash-card-title">Scheme catalog</h2>
        <p className="dash-muted">Browse published platform schemes and add them to your showroom.</p>
        {err ? <p className="form-error">{err}</p> : null}
        <ul className="dash-list">
          {catalog.map((t) => (
            <li key={t.id} className="dash-list-item">
              <div>
                <strong>{t.name}</strong>
                <p className="dash-muted">{t.flow_summary}</p>
              </div>
              {enrolledIds.has(t.id) ? (
                <span className="dash-badge">Active</span>
              ) : (
                <Button size="sm" onClick={() => void enroll(t.id)} disabled={busy}>
                  Select scheme
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="dash-card-title">Your offerings</h3>
        <ul className="dash-list">
          {offerings.map((o) => (
            <li key={o.id} className="dash-list-item">
              <div>
                <strong>{o.display_name}</strong>
                <p className="dash-muted">{o.flow_summary}</p>
              </div>
              <span className="dash-badge">{o.status}</span>
            </li>
          ))}
          {offerings.length === 0 ? <p className="dash-muted">No schemes selected yet.</p> : null}
        </ul>
      </Card>
    </div>
  )
}
