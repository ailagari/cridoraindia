import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminFeatureRollout,
  patchAdminFeatureRollout,
  type FeatureCatalogItem,
} from '@/lib/platformFeatures'

export function AdminFeatureRolloutPanel() {
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([])
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [loadErr, setLoadErr] = useState('')
  const [saveErr, setSaveErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadErr('')
    const out = await fetchAdminFeatureRollout()
    if (!out) {
      setLoadErr('Could not load feature rollout settings.')
      return
    }
    setCatalog(out.catalog)
    const next: Record<string, boolean> = {}
    for (const row of out.catalog) {
      next[row.key] = row.enabled
    }
    setDraft(next)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (key: string) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const save = async () => {
    setSaveErr('')
    setBusy(true)
    try {
      const out = await patchAdminFeatureRollout(draft)
      if (!out) {
        setSaveErr('Save failed.')
        return
      }
      setCatalog(out.catalog)
      const next: Record<string, boolean> = {}
      for (const row of out.catalog) {
        next[row.key] = row.enabled
      }
      setDraft(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-panel-max">
      <h2 className="dash-table-title">Feature rollout</h2>
      <p className="dash-panel-lead" style={{ maxWidth: 640 }}>
        Turn customer and jeweller features on or off without redeploying. Cash sellback stays OTP-based;
        UPI sellback is off by default until you enable it here.
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}
      {saveErr ? <p className="form-error">{saveErr}</p> : null}

      <div className="card" style={{ maxWidth: 720, padding: '1rem 1.15rem' }}>
        {catalog.length === 0 && !loadErr ? <p>Loading…</p> : null}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {catalog.map((row) => (
            <li
              key={row.key}
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={draft[row.key] ?? row.enabled}
                  onChange={() => toggle(row.key)}
                />
                <span>{row.enabled ? 'On' : 'Off'}</span>
              </label>
              <div>
                <strong>{row.label}</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', opacity: 0.85 }}>{row.description}</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', opacity: 0.6 }}>
                  Key: {row.key}
                  {row.default !== (draft[row.key] ?? row.enabled) ? ' · differs from default' : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save rollout'}
        </button>
      </div>
    </div>
  )
}
