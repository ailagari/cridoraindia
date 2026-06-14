import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Badge, Card, CardHeader, EmptyState, Feedback, Input, PageHeader, Select, statusTone } from '@/components/ui'
import {
  createJewellerSchemeOffering,
  fetchJewellerSchemeCatalog,
  fetchJewellerSchemeCatalogDetail,
  fetchJewellerSchemeOfferings,
  updateJewellerSchemeOffering,
  type SchemeOfferingDTO,
  type SchemeTemplateDTO,
} from '@/lib/schemesApi'
import { LIVE_MARKETPLACE_EDITOR_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'

export function JewellerSchemeCatalogPanel() {
  const [catalog, setCatalog] = useState<SchemeTemplateDTO[]>([])
  const [offerings, setOfferings] = useState<SchemeOfferingDTO[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SchemeTemplateDTO | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

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
      const message = e instanceof Error ? e.message : 'Load failed'
      setErr(
        message.includes('403') || message.toLowerCase().includes('disabled')
          ? 'Investment schemes are not enabled for your account. Ask platform admin to enable Investment schemes in feature rollout.'
          : message,
      )
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    const t = window.setTimeout(() => void reload(), search || category ? 300 : 0)
    return () => window.clearTimeout(t)
  }, [reload, search, category])

  useLivePoll(reload, LIVE_MARKETPLACE_EDITOR_POLL_MS, true)

  const enrolledIds = new Set(offerings.map((o) => o.template_id))
  const activeOfferings = offerings.filter((o) => o.status === 'active')

  const adopt = async (templateId: number) => {
    setBusy(true)
    setErr('')
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
      <PageHeader
        eyebrow="Marketplace"
        title="Scheme catalog"
        subtitle="Browse published platform schemes and add them to your showroom. Customers can enroll and deposit from their dashboard once schemes are active."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void reload()} disabled={loading || busy}>
            Refresh
          </Button>
        }
      />

      {err ? <Feedback tone="error">{err}</Feedback> : null}

      <Card>
        <CardHeader
          title="Scheme library"
          action={
            <span className="ds-field__hint" style={{ margin: 0 }}>
              {loading ? 'Loading…' : `${catalog.length} published`}
            </span>
          }
        />
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

        {loading ? (
          <p className="dash-muted" style={{ marginTop: '1rem' }}>
            Loading scheme library…
          </p>
        ) : catalog.length === 0 ? (
          <EmptyState
            title="No schemes in the library"
            description="Platform admin must publish scheme templates before they appear here. Check Programs & risks in the admin dashboard, or adjust your search filters."
          />
        ) : (
          <div
            className="pf-grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--sp-4)',
              marginTop: 'var(--sp-4)',
            }}
          >
            {catalog.map((t) => {
              const adopted = enrolledIds.has(t.id)
              const expanded = expandedId === t.id
              return (
                <Card
                  key={t.id}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
                >
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--sp-2)',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}
                    >
                      <h3 className="dash-card-title" style={{ margin: 0, lineHeight: 1.3, flex: '1 1 12rem' }}>
                        {t.name}
                      </h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {t.category ? <Badge tone="gold">{t.category}</Badge> : null}
                        {adopted ? <Badge tone="success">In showroom</Badge> : null}
                      </div>
                    </div>
                    <p className="dash-muted" style={{ margin: 0, lineHeight: 1.45, fontSize: 'var(--ts-sm)' }}>
                      {t.flow_summary}
                    </p>
                    {expanded && detail?.id === t.id ? (
                      <div
                        style={{
                          marginTop: 'var(--sp-2)',
                          padding: 'var(--sp-3)',
                          background: 'var(--silk-06)',
                          borderRadius: 'var(--r-md)',
                          border: '1px solid var(--border-soft)',
                        }}
                      >
                        {detail.description ? (
                          <p className="dash-muted" style={{ margin: '0 0 var(--sp-2)' }}>
                            {detail.description}
                          </p>
                        ) : null}
                        <p className="ds-field__hint" style={{ margin: 0, lineHeight: 1.45 }}>
                          <strong>Flow:</strong> {detail.flow_summary}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--sp-2)',
                      flexWrap: 'wrap',
                      marginTop: 'var(--sp-4)',
                      paddingTop: 'var(--sp-3)',
                      borderTop: '1px solid var(--border-soft)',
                    }}
                  >
                    <Button size="sm" variant="secondary" onClick={() => void toggleDetail(t.id)}>
                      {expanded ? 'Hide preview' : 'Preview'}
                    </Button>
                    {adopted ? (
                      <span className="ds-field__hint" style={{ margin: 0, alignSelf: 'center' }}>
                        Already added
                      </span>
                    ) : (
                      <Button size="sm" variant="primary" onClick={() => void adopt(t.id)} disabled={busy}>
                        Add to showroom
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Your showroom schemes"
          action={
            activeOfferings.length > 0 ? (
              <Link to="/dashboard/jeweller?section=txn_schemes" className="btn btn-ghost btn--sm">
                Open schemes desk
              </Link>
            ) : null
          }
        />
        <p className="dash-muted" style={{ marginTop: 0 }}>
          Active offerings appear to customers under Invest → Scheme. Use the schemes desk to verify counter OTP and UPI
          deposits.
        </p>
        {offerings.length === 0 ? (
          <EmptyState
            title="No schemes selected yet"
            description="Choose one or more schemes from the library above. They will become available for customer enrollment once status is active."
          />
        ) : (
          <div
            className="pf-grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--sp-4)',
              marginTop: 'var(--sp-4)',
            }}
          >
            {offerings.map((o) => (
              <Card
                key={o.id}
                style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'var(--sp-2)',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--sp-2)',
                    }}
                  >
                    <h3 className="dash-card-title" style={{ margin: 0, lineHeight: 1.3, flex: '1 1 12rem' }}>
                      {o.display_name}
                    </h3>
                    <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                  </div>
                  <p className="dash-muted" style={{ margin: 0, lineHeight: 1.45, fontSize: 'var(--ts-sm)' }}>
                    {o.flow_summary}
                  </p>
                  {o.customer_facing_note ? (
                    <p className="ds-field__hint" style={{ margin: 'var(--sp-2) 0 0', lineHeight: 1.45 }}>
                      {o.customer_facing_note}
                    </p>
                  ) : null}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-2)',
                    flexWrap: 'wrap',
                    marginTop: 'var(--sp-4)',
                    paddingTop: 'var(--sp-3)',
                    borderTop: '1px solid var(--border-soft)',
                  }}
                >
                  {o.status === 'active' ? (
                    <Button size="sm" variant="secondary" onClick={() => void setOfferingStatus(o.id, 'paused')} disabled={busy}>
                      Pause
                    </Button>
                  ) : null}
                  {o.status === 'paused' ? (
                    <Button size="sm" variant="primary" onClick={() => void setOfferingStatus(o.id, 'active')} disabled={busy}>
                      Resume
                    </Button>
                  ) : null}
                  {o.status !== 'withdrawn' ? (
                    <Button size="sm" variant="ghost" onClick={() => void setOfferingStatus(o.id, 'withdrawn')} disabled={busy}>
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
