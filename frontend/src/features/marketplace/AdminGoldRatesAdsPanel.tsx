import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminGoldRatesConfig,
  patchAdminGoldRatesConfig,
  type AdminGoldRatesPageConfigPayload,
  type GoldRatesAdPlacementDTO,
} from '@/lib/marketplaceApi'

const SLOT_LABELS: Record<string, string> = {
  top_banner: 'Top banner',
  sidebar: 'Sidebar',
  in_content_1: 'After rate cards',
  in_content_2: 'After chart',
  footer: 'Footer strip',
}

const PLACEHOLDER_IMAGES: Record<string, string> = {
  top_banner: '/ads/gold-rates-top-banner.svg',
  sidebar: '/ads/gold-rates-sidebar.svg',
  in_content_1: '/ads/gold-rates-in-content.svg',
  in_content_2: '/ads/gold-rates-in-content.svg',
  footer: '/ads/gold-rates-footer.svg',
}

type AdMode = GoldRatesAdPlacementDTO['mode']

export function AdminGoldRatesAdsPanel() {
  const [cfg, setCfg] = useState<AdminGoldRatesPageConfigPayload | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    const data = await fetchAdminGoldRatesConfig()
    setCfg(data)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updatePlacement = (slot: string, patch: Partial<GoldRatesAdPlacementDTO>) => {
    setCfg((prev) => {
      if (!prev) return prev
      const placements = prev.placements.map((p) => (p.slot === slot ? { ...p, ...patch } : p))
      return { ...prev, placements }
    })
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    setMsg(null)
    try {
      const saved = await patchAdminGoldRatesConfig({
        adsense_enabled: cfg.adsense_enabled,
        adsense_client_id: cfg.adsense_client_id,
        page_title: cfg.page_title,
        page_description: cfg.page_description,
        placements: cfg.placements,
      })
      if (saved) {
        setCfg(saved)
        setMsg('Saved.')
      } else {
        setMsg('Save failed.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (!cfg) {
    return <p className="text-muted">Loading gold rates page settings…</p>
  }

  return (
    <div className="admin-panel-stack">
      <header>
        <h2 className="admin-panel-title">Gold rates page & ads</h2>
        <p className="admin-panel-lead">
          Public page at <code>/gold-rates/kerala</code>. Configure SEO copy, banner images, manual HTML,
          or Google AdSense per slot.
        </p>
        <p className="admin-panel-lead">
          <a href="/gold-rates/kerala" target="_blank" rel="noreferrer">
            Open public page ↗
          </a>
        </p>
      </header>

      <section className="admin-card">
        <h3>SEO & AdSense</h3>
        <label className="admin-field">
          <span>Page title</span>
          <input
            value={cfg.page_title ?? ''}
            onChange={(e) => setCfg({ ...cfg, page_title: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>Meta description</span>
          <textarea
            rows={2}
            value={cfg.page_description ?? ''}
            onChange={(e) => setCfg({ ...cfg, page_description: e.target.value })}
          />
        </label>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={cfg.adsense_enabled}
            onChange={(e) => setCfg({ ...cfg, adsense_enabled: e.target.checked })}
          />
          Enable Google AdSense placements
        </label>
        <label className="admin-field">
          <span>AdSense client ID (ca-pub-…)</span>
          <input
            value={cfg.adsense_client_id ?? ''}
            onChange={(e) => setCfg({ ...cfg, adsense_client_id: e.target.value })}
            placeholder="ca-pub-xxxxxxxxxxxxxxxx"
          />
        </label>
        <p className="admin-panel-lead">
          When a slot is set to Google AdSense mode, it uses this publisher account and the slot ID below.
          Image and manual HTML modes ignore AdSense.
        </p>
      </section>

      {cfg.placements.map((p) => {
        const previewSrc =
          p.mode === 'image'
            ? p.image_url?.trim() || PLACEHOLDER_IMAGES[p.slot] || ''
            : p.mode === 'adsense' && cfg.adsense_enabled
              ? ''
              : PLACEHOLDER_IMAGES[p.slot] || ''
        return (
          <section key={p.slot} className="admin-card">
            <h3>{SLOT_LABELS[p.slot] ?? p.slot}</h3>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={p.is_active}
                onChange={(e) => updatePlacement(p.slot, { is_active: e.target.checked })}
              />
              Active
            </label>
            <label className="admin-field">
              <span>Mode</span>
              <select
                value={p.mode}
                onChange={(e) => updatePlacement(p.slot, { mode: e.target.value as AdMode })}
              >
                <option value="image">Image banner</option>
                <option value="manual">Manual HTML</option>
                <option value="adsense">Google AdSense</option>
              </select>
            </label>

            {p.mode === 'image' ? (
              <>
                <label className="admin-field">
                  <span>Image URL</span>
                  <input
                    value={p.image_url ?? ''}
                    onChange={(e) => updatePlacement(p.slot, { image_url: e.target.value })}
                    placeholder={PLACEHOLDER_IMAGES[p.slot] ?? 'https://…/banner.jpg'}
                  />
                </label>
                <label className="admin-field">
                  <span>Click-through URL (optional)</span>
                  <input
                    value={p.image_link_url ?? ''}
                    onChange={(e) => updatePlacement(p.slot, { image_link_url: e.target.value })}
                    placeholder="https://…"
                  />
                </label>
                <label className="admin-field">
                  <span>Alt text</span>
                  <input
                    value={p.image_alt ?? ''}
                    onChange={(e) => updatePlacement(p.slot, { image_alt: e.target.value })}
                    placeholder={SLOT_LABELS[p.slot] ?? 'Advertisement'}
                  />
                </label>
              </>
            ) : null}

            {p.mode === 'manual' ? (
              <label className="admin-field">
                <span>HTML snippet</span>
                <textarea
                  rows={4}
                  value={p.manual_html ?? ''}
                  onChange={(e) => updatePlacement(p.slot, { manual_html: e.target.value })}
                  placeholder="<div>Sponsored…</div>"
                />
              </label>
            ) : null}

            {p.mode === 'adsense' ? (
              <>
                <label className="admin-field">
                  <span>Ad unit slot ID</span>
                  <input
                    value={p.adsense_slot_id ?? ''}
                    onChange={(e) => updatePlacement(p.slot, { adsense_slot_id: e.target.value })}
                    placeholder="1234567890"
                  />
                </label>
                <label className="admin-field">
                  <span>Format</span>
                  <select
                    value={p.adsense_format ?? 'auto'}
                    onChange={(e) => updatePlacement(p.slot, { adsense_format: e.target.value })}
                  >
                    <option value="auto">auto</option>
                    <option value="horizontal">horizontal</option>
                    <option value="rectangle">rectangle</option>
                    <option value="vertical">vertical</option>
                  </select>
                </label>
              </>
            ) : null}

            {previewSrc ? (
              <div className="admin-ad-preview">
                <span className="admin-ad-preview__label">Preview</span>
                <img src={previewSrc} alt="" className="admin-ad-preview__img" />
              </div>
            ) : null}
          </section>
        )
      })}

      <div className="admin-actions">
        <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save page & ads'}
        </button>
        {msg ? <span className="admin-save-msg">{msg}</span> : null}
      </div>
    </div>
  )
}
