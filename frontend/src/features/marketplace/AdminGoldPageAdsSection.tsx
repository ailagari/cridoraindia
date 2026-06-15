import { useRef, useState } from 'react'
import { GoldRatesAdSlot } from '@/features/goldRates/GoldRatesAdSlot'
import type { GoldRatesAdSlotSpec } from '@/features/goldRates/goldRatesAdSpecs'
import type { AdminGoldRatesPageConfigPayload, GoldRatesAdPlacementDTO } from '@/lib/marketplaceApi'
import '@/styles/gold-rates-page.css'

const AD_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm'

type SlotAdSource = 'manual' | 'adsense'

type UploadFns = {
  uploadImage: (file: File, slot: string) => Promise<{ ok: true; image_url: string } | { ok: false; detail: string }>
  uploadVideo: (file: File, slot: string) => Promise<{ ok: true; video_url: string } | { ok: false; detail: string }>
}

type Props = {
  cfg: AdminGoldRatesPageConfigPayload | null
  slotSpecs: Record<string, GoldRatesAdSlotSpec>
  slotLabels: Record<string, string>
  onCfgChange: (cfg: AdminGoldRatesPageConfigPayload) => void
  onSave: () => Promise<void>
  saving: boolean
  saveMsg: string | null
  uploadFns: UploadFns
}

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

function sourceLabel(mode: GoldRatesAdPlacementDTO['mode']): string {
  return mode === 'adsense' ? 'AdSense' : 'Manual'
}

export function AdminGoldPageAdsSection({
  cfg,
  slotSpecs,
  slotLabels,
  onCfgChange,
  onSave,
  saving,
  saveMsg,
  uploadFns,
}: Props) {
  const [uploadBusySlot, setUploadBusySlot] = useState<string | null>(null)
  const [uploadErr, setUploadErr] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const updatePlacement = (slot: string, patch: Partial<GoldRatesAdPlacementDTO>) => {
    if (!cfg) return
    const placements = cfg.placements.map((p) => (p.slot === slot ? { ...p, ...patch } : p))
    onCfgChange({ ...cfg, placements })
  }

  const setSlotSource = (slot: string, source: SlotAdSource) => {
    if (!cfg) return
    if (source === 'adsense') {
      const placements = cfg.placements.map((p) =>
        p.slot === slot ? { ...p, mode: 'adsense' as const } : p,
      )
      onCfgChange({ ...cfg, adsense_enabled: true, placements })
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
        ? await uploadFns.uploadVideo(file, slot)
        : await uploadFns.uploadImage(file, slot)
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

  if (!cfg) {
    return <p className="text-muted">Loading page settings…</p>
  }

  const anyAdsense = cfg.placements.some((p) => slotAdSource(p.mode) === 'adsense')

  return (
    <div className="admin-gold-page-section">
      <section className="admin-card">
        <h3>Page SEO</h3>
        <label className="admin-field">
          <span>Title</span>
          <input
            value={cfg.page_title ?? ''}
            onChange={(e) => onCfgChange({ ...cfg, page_title: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>Meta description</span>
          <textarea
            rows={2}
            value={cfg.page_description ?? ''}
            onChange={(e) => onCfgChange({ ...cfg, page_description: e.target.value })}
          />
        </label>
        {anyAdsense ? (
          <label className="admin-field">
            <span>AdSense publisher ID</span>
            <input
              value={cfg.adsense_client_id ?? ''}
              onChange={(e) => onCfgChange({ ...cfg, adsense_client_id: e.target.value })}
              placeholder="ca-pub-xxxxxxxxxxxxxxxx"
            />
          </label>
        ) : null}
      </section>

      <div className="admin-ads-slots-table-wrap">
        <table className="admin-ads-slots-table">
          <thead>
            <tr>
              <th scope="col">Slot</th>
              <th scope="col">Size</th>
              <th scope="col">Source</th>
              <th scope="col">Active</th>
              <th scope="col">Configure</th>
            </tr>
          </thead>
          <tbody>
            {cfg.placements.map((p) => {
              const source = slotAdSource(p.mode)
              const slotSpec = slotSpecs[p.slot]
              const linkUrl = p.video_link_url?.trim() || p.image_link_url?.trim() || ''
              const label = slotLabels[p.slot] ?? p.label ?? p.slot
              return (
                <tr key={p.slot} className={p.is_active ? '' : 'admin-ads-slots-table__row--inactive'}>
                  <td>
                    <strong>{label}</strong>
                    <span className="admin-ads-slots-table__slot-id">{p.slot}</span>
                  </td>
                  <td className="admin-ads-slots-table__size">
                    {slotSpec ? `${slotSpec.recommended.width}×${slotSpec.recommended.height}` : '—'}
                  </td>
                  <td>{sourceLabel(p.mode)}</td>
                  <td>
                    <label className="admin-check admin-gold-ad-slot__active">
                      <input
                        type="checkbox"
                        checked={p.is_active}
                        onChange={(e) => updatePlacement(p.slot, { is_active: e.target.checked })}
                      />
                      {p.is_active ? 'On' : 'Off'}
                    </label>
                  </td>
                  <td>
                    <details className="admin-ads-slot-accordion">
                      <summary>Edit slot</summary>
                      <div className="admin-ads-slot-accordion__body">
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

                        <div
                          className={`admin-ad-live-preview${p.is_active ? '' : ' admin-ad-live-preview--inactive'}`}
                        >
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
                              slotSpecs={slotSpecs}
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
                                <span className="admin-gold-ad-slot__hint">Image (4 MB) or video (16 MB)</span>
                              </div>
                              {uploadErr[p.slot] ? (
                                <p className="admin-save-msg admin-gold-ad-slot__err">{uploadErr[p.slot]}</p>
                              ) : null}
                            </div>
                            <label className="admin-field">
                              <span>Image URL</span>
                              <input
                                value={p.image_url ?? ''}
                                onChange={(e) =>
                                  updatePlacement(p.slot, { image_url: e.target.value, mode: 'media' })
                                }
                                placeholder="https://…/banner.jpg"
                              />
                            </label>
                            <label className="admin-field">
                              <span>Video URL</span>
                              <input
                                value={p.video_url ?? ''}
                                onChange={(e) =>
                                  updatePlacement(p.slot, { video_url: e.target.value, mode: 'media' })
                                }
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
                      </div>
                    </details>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="admin-actions">
        <button type="button" className="btn btn-gold" disabled={saving} onClick={() => void onSave()}>
          {saving ? 'Saving…' : 'Save page'}
        </button>
        {saveMsg ? <span className="admin-save-msg">{saveMsg}</span> : null}
      </div>
    </div>
  )
}

export function countActivePlacements(cfg: AdminGoldRatesPageConfigPayload | null): string {
  if (!cfg) return '—'
  const active = cfg.placements.filter((p) => p.is_active).length
  return `${active}/${cfg.placements.length}`
}

export function pageUsesAdsense(cfg: AdminGoldRatesPageConfigPayload | null): boolean {
  if (!cfg) return false
  return cfg.adsense_enabled || cfg.placements.some((p) => p.mode === 'adsense')
}
