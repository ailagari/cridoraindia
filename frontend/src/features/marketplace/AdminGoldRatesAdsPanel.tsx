import { useCallback, useEffect, useRef, useState } from 'react'
import { GoldRatesAdSlot } from '@/features/goldRates/GoldRatesAdSlot'
import { getGoldRatesAdSlotSpec, GOLD_RATES_AD_SLOT_SPECS } from '@/features/goldRates/goldRatesAdSpecs'
import {
  fetchAdminGoldRatesConfig,
  patchAdminGoldRatesConfig,
  uploadAdminGoldRatesAdImage,
  uploadAdminGoldRatesAdVideo,
  type AdminGoldRatesPageConfigPayload,
  type GoldRatesAdPlacementDTO,
} from '@/lib/marketplaceApi'
import '@/styles/gold-rates-page.css'

const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(GOLD_RATES_AD_SLOT_SPECS).map(([slot, spec]) => [slot, spec.label]),
)

type SlotAdSource = 'manual' | 'adsense'

const AD_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'

function slotAdSource(mode: GoldRatesAdPlacementDTO['mode']): SlotAdSource {
  return mode === 'adsense' ? 'adsense' : 'manual'
}

function previewPlacement(p: GoldRatesAdPlacementDTO): GoldRatesAdPlacementDTO {
  const source = slotAdSource(p.mode)
  if (source === 'adsense') {
    return { ...p, is_active: true, mode: 'adsense' }
  }
  if (p.mode === 'manual' && p.manual_html?.trim()) {
    return { ...p, is_active: true }
  }
  return { ...p, is_active: true, mode: 'media' }
}

function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true
  return /\.(mp4|webm)$/i.test(file.name)
}

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

  const setSlotSource = (slot: string, source: SlotAdSource) => {
    if (source === 'adsense') {
      updatePlacement(slot, { mode: 'adsense' })
      setCfg((prev) => (prev ? { ...prev, adsense_enabled: true } : prev))
      return
    }
    updatePlacement(slot, { mode: 'media' })
  }

  const attachPlacementMedia = async (slot: string, file: File) => {
    setUploadBusySlot(slot)
    setUploadErr((prev) => {
      const next = { ...prev }
      delete next[slot]
      return next
    })
    try {
      const out = isVideoFile(file)
        ? await uploadAdminGoldRatesAdVideo(file, slot)
        : await uploadAdminGoldRatesAdImage(file, slot)
      if (!out.ok) {
        setUploadErr((prev) => ({ ...prev, [slot]: out.detail }))
        return
      }
      if ('video_url' in out) {
        updatePlacement(slot, { video_url: out.video_url, mode: 'media' })
      } else {
        updatePlacement(slot, { image_url: out.image_url, mode: 'media' })
      }
    } finally {
      setUploadBusySlot(null)
    }
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    setMsg(null)
    const placements = cfg.placements.map((p) => ({
      ...p,
      mode:
        p.mode === 'adsense'
          ? ('adsense' as const)
          : p.mode === 'manual'
            ? ('manual' as const)
            : ('media' as const),
      image_link_url: p.image_link_url ?? p.video_link_url ?? '',
      video_link_url: p.video_link_url ?? p.image_link_url ?? '',
    }))
    const adsense_enabled = placements.some((p) => p.mode === 'adsense') || cfg.adsense_enabled
    try {
      const saved = await patchAdminGoldRatesConfig({
        adsense_enabled,
        adsense_client_id: cfg.adsense_client_id,
        page_title: cfg.page_title,
        page_description: cfg.page_description,
        placements,
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

  const anyAdsense = cfg.placements.some((p) => slotAdSource(p.mode) === 'adsense')

  return (
    <div className="admin-panel-stack">
      <header>
        <h2 className="admin-panel-title">Gold rates page & ads</h2>
        <p className="admin-panel-lead">
          <a href="/gold-rates/kerala" target="_blank" rel="noreferrer">
            Open public page ↗
          </a>
        </p>
      </header>

      <section className="admin-card">
        <h3>Page SEO</h3>
        <label className="admin-field">
          <span>Title</span>
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
        {anyAdsense ? (
          <label className="admin-field">
            <span>AdSense publisher ID</span>
            <input
              value={cfg.adsense_client_id ?? ''}
              onChange={(e) => setCfg({ ...cfg, adsense_client_id: e.target.value })}
              placeholder="ca-pub-xxxxxxxxxxxxxxxx"
            />
          </label>
        ) : null}
      </section>

      {cfg.placements.map((p) => {
        const source = slotAdSource(p.mode)
        const slotSpec = getGoldRatesAdSlotSpec(p.slot)
        const linkUrl = p.video_link_url?.trim() || p.image_link_url?.trim() || ''
        return (
          <section key={p.slot} className="admin-card admin-gold-ad-slot">
            <div className="admin-gold-ad-slot__head">
              <h3>{SLOT_LABELS[p.slot] ?? p.slot}</h3>
              <label className="admin-check admin-gold-ad-slot__active">
                <input
                  type="checkbox"
                  checked={p.is_active}
                  onChange={(e) => updatePlacement(p.slot, { is_active: e.target.checked })}
                />
                Active
              </label>
            </div>

            <div className="admin-ad-mode-toggle" role="group" aria-label="Ad source">
              <button
                type="button"
                className={`admin-ad-mode-toggle__btn${source === 'manual' ? ' admin-ad-mode-toggle__btn--active' : ''}`}
                onClick={() => setSlotSource(p.slot, 'manual')}
              >
                Manual
              </button>
              <button
                type="button"
                className={`admin-ad-mode-toggle__btn${source === 'adsense' ? ' admin-ad-mode-toggle__btn--active' : ''}`}
                onClick={() => setSlotSource(p.slot, 'adsense')}
              >
                AdSense
              </button>
            </div>

            <div className={`admin-ad-live-preview${p.is_active ? '' : ' admin-ad-live-preview--inactive'}`}>
              <span className="admin-ad-preview__label">
                Live preview
                {slotSpec ? ` · ${slotSpec.recommended.width}×${slotSpec.recommended.height}` : ''}
                {!p.is_active ? ' · slot inactive on public page' : ''}
              </span>
              <div className="admin-ad-live-preview__stage">
                <GoldRatesAdSlot
                  placement={previewPlacement(p)}
                  adsenseClientId={cfg.adsense_client_id ?? ''}
                  adsenseEnabled={cfg.adsense_enabled || anyAdsense}
                />
              </div>
            </div>

            {source === 'manual' ? (
              <div className="admin-gold-ad-slot__fields">
                <div className="admin-field">
                  <span>Attach image or video</span>
                  <div className="admin-gold-ad-slot__attach-row">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[p.slot] = el
                      }}
                      type="file"
                      accept={AD_MEDIA_ACCEPT}
                      disabled={saving || uploadBusySlot === p.slot}
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void attachPlacementMedia(p.slot, f)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={saving || uploadBusySlot === p.slot}
                      onClick={() => fileInputRefs.current[p.slot]?.click()}
                    >
                      {uploadBusySlot === p.slot ? 'Uploading…' : 'Attach file'}
                    </button>
                    <span className="admin-gold-ad-slot__hint">
                      Image (4 MB) or video (16 MB)
                    </span>
                  </div>
                  {uploadErr[p.slot] ? (
                    <p className="admin-save-msg admin-gold-ad-slot__err">{uploadErr[p.slot]}</p>
                  ) : null}
                </div>
                <label className="admin-field">
                  <span>Image URL</span>
                  <input
                    value={p.image_url ?? ''}
                    onChange={(e) => updatePlacement(p.slot, { image_url: e.target.value, mode: 'media' })}
                    placeholder="https://…/banner.jpg"
                  />
                </label>
                <label className="admin-field">
                  <span>Video URL</span>
                  <input
                    value={p.video_url ?? ''}
                    onChange={(e) => updatePlacement(p.slot, { video_url: e.target.value, mode: 'media' })}
                    placeholder="https://…/banner.mp4"
                  />
                </label>
                <label className="admin-field">
                  <span>Click-through URL</span>
                  <input
                    value={linkUrl}
                    onChange={(e) =>
                      updatePlacement(p.slot, {
                        image_link_url: e.target.value,
                        video_link_url: e.target.value,
                        mode: 'media',
                      })
                    }
                    placeholder="https://… (optional)"
                  />
                </label>
              </div>
            ) : (
              <div className="admin-gold-ad-slot__fields">
                <label className="admin-field">
                  <span>AdSense slot ID</span>
                  <input
                    value={p.adsense_slot_id ?? ''}
                    onChange={(e) => updatePlacement(p.slot, { adsense_slot_id: e.target.value })}
                    placeholder="1234567890"
                  />
                </label>
              </div>
            )}
          </section>
        )
      })}

      <div className="admin-actions">
        <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {msg ? <span className="admin-save-msg">{msg}</span> : null}
      </div>
    </div>
  )
}
