import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildAdSizeGuidance,
  formatAdSize,
  getGoldRatesAdSlotSpec,
  GOLD_RATES_AD_SLOT_SPECS,
} from '@/features/goldRates/goldRatesAdSpecs'
import {
  fetchAdminGoldRatesConfig,
  patchAdminGoldRatesConfig,
  uploadAdminGoldRatesAdImage,
  type AdminGoldRatesPageConfigPayload,
  type GoldRatesAdPlacementDTO,
} from '@/lib/marketplaceApi'

const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(GOLD_RATES_AD_SLOT_SPECS).map(([slot, spec]) => [slot, spec.label]),
)

const PLACEHOLDER_IMAGES: Record<string, string> = {
  top_banner: '/ads/gold-rates-top-banner.svg',
  sidebar: '/ads/gold-rates-sidebar.svg',
  in_content_1: '/ads/gold-rates-in-content.svg',
  in_content_2: '/ads/gold-rates-in-content.svg',
  footer: '/ads/gold-rates-footer.svg',
}

type AdMode = GoldRatesAdPlacementDTO['mode']

const AD_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

export function AdminGoldRatesAdsPanel() {
  const [cfg, setCfg] = useState<AdminGoldRatesPageConfigPayload | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [uploadBusySlot, setUploadBusySlot] = useState<string | null>(null)
  const [uploadErr, setUploadErr] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  const uploadPlacementImage = async (slot: string, file: File) => {
    setUploadBusySlot(slot)
    setUploadErr((prev) => {
      const next = { ...prev }
      delete next[slot]
      return next
    })
    try {
      const out = await uploadAdminGoldRatesAdImage(file, slot)
      if (!out.ok) {
        setUploadErr((prev) => ({ ...prev, [slot]: out.detail }))
        return
      }
      updatePlacement(slot, { image_url: out.image_url })
    } finally {
      setUploadBusySlot(null)
    }
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
          Banner slots use standard Google AdSense / IAB sizes. Images are scaled to fit the slot
          container on all devices; prepare assets at the recommended dimensions below for best
          quality. When a slot uses Google AdSense mode, it uses this publisher account and the
          slot ID configured per placement.
        </p>
      </section>

      {cfg.placements.map((p) => {
        const slotSpec = getGoldRatesAdSlotSpec(p.slot)
        const previewSrc =
          p.mode === 'image'
            ? p.image_url?.trim() || PLACEHOLDER_IMAGES[p.slot] || ''
            : p.mode === 'adsense' && cfg.adsense_enabled
              ? ''
              : PLACEHOLDER_IMAGES[p.slot] || ''
        return (
          <section key={p.slot} className="admin-card">
            <h3>{SLOT_LABELS[p.slot] ?? p.slot}</h3>
            {slotSpec ? (
              <div className="admin-ad-size-guide" role="note">
                <strong>Recommended image size</strong>
                <p>{formatAdSize(slotSpec.recommended)}</p>
                <p className="admin-ad-size-guide__meta">{buildAdSizeGuidance(slotSpec)}</p>
              </div>
            ) : null}
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
                <div className="admin-field">
                  <span>Banner image</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[p.slot] = el
                      }}
                      type="file"
                      accept={AD_IMAGE_ACCEPT}
                      disabled={saving || uploadBusySlot === p.slot}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void uploadPlacementImage(p.slot, f)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={saving || uploadBusySlot === p.slot}
                      onClick={() => fileInputRefs.current[p.slot]?.click()}
                    >
                      {uploadBusySlot === p.slot ? 'Uploading…' : 'Upload image file'}
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      JPEG, PNG, or WebP · max 4 MB
                      {slotSpec ? ` · target ${slotSpec.recommended.width}×${slotSpec.recommended.height} px` : ''}
                    </span>
                  </div>
                  {uploadErr[p.slot] ? (
                    <p className="admin-save-msg" style={{ color: 'var(--danger)', marginTop: '0.35rem' }}>
                      {uploadErr[p.slot]}
                    </p>
                  ) : null}
                </div>
                <label className="admin-field">
                  <span>Or image URL</span>
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
                    value={p.adsense_format ?? slotSpec?.adsenseFormat ?? 'auto'}
                    onChange={(e) => updatePlacement(p.slot, { adsense_format: e.target.value })}
                  >
                    <option value="auto">auto (responsive)</option>
                    <option value="horizontal">horizontal (728×90 leaderboard)</option>
                    <option value="rectangle">rectangle (300×250 medium rectangle)</option>
                    <option value="vertical">vertical (120×600 skyscraper)</option>
                  </select>
                </label>
                {slotSpec ? (
                  <p className="admin-panel-lead">
                    Suggested AdSense unit: {formatAdSize(slotSpec.recommended)} · format{' '}
                    <code>{slotSpec.adsenseFormat}</code>
                  </p>
                ) : null}
              </>
            ) : null}

            {previewSrc ? (
              <div className="admin-ad-preview">
                <span className="admin-ad-preview__label">
                  Preview
                  {slotSpec ? ` · ${slotSpec.recommended.width}×${slotSpec.recommended.height} container` : ''}
                </span>
                <div
                  className={`admin-ad-preview__frame admin-ad-preview__frame--${p.slot}`}
                  style={
                    slotSpec
                      ? {
                          aspectRatio: slotSpec.aspectRatio,
                          maxWidth: slotSpec.maxWidthPx ? `${slotSpec.maxWidthPx}px` : undefined,
                        }
                      : undefined
                  }
                >
                  <img src={previewSrc} alt="" className="admin-ad-preview__img" />
                </div>
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
