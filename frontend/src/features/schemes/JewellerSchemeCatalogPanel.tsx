import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Input, Select } from '@/components/ui'
import {
  createJewellerSchemeOffering,
  fetchJewellerSchemeCatalog,
  fetchJewellerSchemeCatalogDetail,
  fetchJewellerSchemeOfferings,
  updateJewellerSchemeOffering,
  type SchemeOfferingDTO,
  type SchemeTemplateDTO,
} from '@/lib/schemesApi'

export function JewellerSchemeCatalogPanel() {
  const [catalog, setCatalog] = useState<SchemeTemplateDTO[]>([])
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchemeTemplateDTO | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const categories = useMemo(() => {
    const set = new Set(catalog.map((t) => t.category).filter(Boolean))
    return Array.from(set).sort()
  }, [catalog])

  const reload = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([
        fetchJewellerSchemeCatalog({
          q: search.trim() || undefined,
          category: category || undefined,
        }),
        fetchJewellerSchemeOfferings(),
      ])
      setCatalog(c)
      setOfferings(o)
      setErr('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed')
    }
  }, [search, category])

  useEffect(() => {
    const t = window.setTimeout(() => void reload(), 300)
    return () => window.clearTimeout(t)
  }, [reload])

  const enrolledIds = new Set(offerings.map((o) => o.template_id))

  const adopt = async (templateId: number) => {
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

  const toggleDetail = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    try {
      const d = await fetchJewellerSchemeCatalogDetail(id)
      setDetail(d)
    } catch {
      setDetail(null)
    }
  }

  const setOfferingStatus = async (id: number, status: 'active' | 'paused' | 'withdrawn') => {
    const labels = { active: 'Resume', paused: 'Pause', withdrawn: 'Withdraw' }
    if (!window.confirm(`${labels[status] === 'Withdraw' ? 'Withdraw' : labels[status]} this offering?`)) return
    setBusy(true)
    try {
      await updateJewellerSchemeOffering(id, { status })
      await reload()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-panel-max">
      <Card>
        <h2 className="dash-card-title">Scheme catalog</h2>
        <p className="dash-muted">Browse published platform schemes and add them to your showroom.</p>
        {err ? <p className="form-error">{err}</p> : null}
        <div className="ds-field-row" style={{ marginTop: 'var(--sp-3)' }}>
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Scheme name…"
          />
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <ul className="dash-list" style={{ marginTop: '1rem' }}>
          {catalog.map((t) => (
            <li key={t.id} className="dash-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <strong>{t.name}</strong>
                  {t.category ? <span className="dash-muted"> · {t.category}</span> : null}
                  <p className="dash-muted">{t.flow_summary}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <Button size="sm" variant="secondary" onClick={() => void toggleDetail(t.id)}>
                    {expandedId === t.id ? 'Hide' : 'Preview'}
                  </Button>
                  {enrolledIds.has(t.id) ? (
                    <span className="dash-badge">Adopted</span>
                  ) : (
                    <Button size="sm" onClick={() => void adopt(t.id)} disabled={busy}>
                      Select scheme
                    </Button>
                  )}
                </div>
              </div>
              {expandedId === t.id && detail?.id === t.id ? (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--surface-muted, #f5f5f5)', borderRadius: 6 }}>
                  {detail.description ? <p className="dash-muted">{detail.description}</p> : null}
                  <p className="dash-muted" style={{ marginTop: '0.5rem' }}>
                    <strong>Flow:</strong> {detail.flow_summary}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
          {catalog.length === 0 ? <p className="dash-muted">No published schemes match your filters.</p> : null}
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
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="dash-badge">{o.status}</span>
                {o.status === 'active' ? (
                  <Button size="sm" variant="secondary" onClick={() => void setOfferingStatus(o.id, 'paused')} disabled={busy}>
                    Pause
                  </Button>
                ) : null}
                {o.status === 'paused' ? (
                  <Button size="sm" onClick={() => void setOfferingStatus(o.id, 'active')} disabled={busy}>
                    Resume
                  </Button>
                ) : null}
                {o.status !== 'withdrawn' ? (
                  <Button size="sm" variant="secondary" onClick={() => void setOfferingStatus(o.id, 'withdrawn')} disabled={busy}>
                    Withdraw
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {offerings.length === 0 ? <p className="dash-muted">No schemes selected yet.</p> : null}
        </ul>
      </Card>
    </div>
  )
}
