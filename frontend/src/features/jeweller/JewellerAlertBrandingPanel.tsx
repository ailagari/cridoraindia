import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  NotificationPreviewStage,
  type PreviewTab,
} from '@/components/notifications/NotificationPreviewMocks'
import { useAuth } from '@/context/AuthContext'
import {
  contactMailtoHref,
  JEWELLER_PREVIEW_SAMPLES,
  resolvePreviewCopy,
  type BrandingMode,
} from '@/lib/notificationPreviewSamples'

const PREVIEW_TABS: { id: PreviewTab; label: string }[] = [
  { id: 'phone', label: 'Phone alert' },
  { id: 'bell', label: 'Cridora bell' },
  { id: 'browser', label: 'Computer' },
]

export function JewellerAlertBrandingPanel() {
  const { user } = useAuth()
  const businessName = (user?.business_name || user?.email || 'Your shop').trim()
  const logoUrl = (user?.logo_url || '').trim()
  const hasLogo = Boolean(logoUrl)

  const [previewTab, setPreviewTab] = useState<PreviewTab>('phone')
  const [brandingMode, setBrandingMode] = useState<BrandingMode>('logo')
  const [activeSampleId, setActiveSampleId] = useState(JEWELLER_PREVIEW_SAMPLES[0]?.id ?? 'gold_rate')

  const activeSample = useMemo(
    () => JEWELLER_PREVIEW_SAMPLES.find((s) => s.id === activeSampleId) ?? JEWELLER_PREVIEW_SAMPLES[0],
    [activeSampleId],
  )

  const previewCopy = useMemo(() => {
    if (!activeSample) {
      return { title: businessName, body: '', brandingLabel: 'Cridora' }
    }
    return resolvePreviewCopy(activeSample, businessName, brandingMode)
  }, [activeSample, businessName, brandingMode])

  const effectiveMode: BrandingMode =
    brandingMode === 'logo' && !hasLogo ? 'name' : brandingMode

  return (
    <div className="dash-panel-max ad-preview-page">
      <div className="card ad-preview-hero">
        <h2 className="dash-coming__title" style={{ marginTop: 0 }}>
          Customer alert preview
        </h2>
        <p className="dash-coming__text" style={{ marginBottom: '1rem', maxWidth: 640 }}>
          See how calm, factual updates from your shop can reach customers on their phone and inside
          Cridora. We send information — not spam — through Cridora&apos;s trusted gold platform.
        </p>
        <div className="ad-preview-hero-meta">
          <div>
            <span className="ad-preview-meta-label">Your shop</span>
            <strong>{businessName}</strong>
          </div>
          <div>
            <span className="ad-preview-meta-label">Logo on alerts</span>
            <strong>{hasLogo ? 'Uploaded' : 'Not uploaded yet'}</strong>
          </div>
        </div>
        {!hasLogo ? (
          <p className="ad-preview-warn">
            Upload your logo under{' '}
            <Link to="/jewellerdashboard?section=prof_more">Shop &amp; business</Link> to preview logo
            branding on phone alerts.
          </p>
        ) : null}
      </div>

      <div className="ad-preview-grid">
        <div className="card ad-preview-controls">
          <h3 style={{ marginTop: 0 }}>Preview options</h3>
          <p className="dash-footnote" style={{ marginBottom: '0.75rem' }}>
            Compare how alerts look with your <strong>name only</strong> versus your{' '}
            <strong>shop logo</strong> on the phone icon.
          </p>

          <div className="ad-preview-mode-toggle" role="group" aria-label="Branding style">
            <button
              type="button"
              className={`btn btn-ghost ad-preview-mode-btn${effectiveMode === 'name' ? ' ad-preview-mode-btn--active' : ''}`}
              onClick={() => setBrandingMode('name')}
            >
              Name only
              <span className="ad-preview-mode-sub">Cridora icon on phone</span>
            </button>
            <button
              type="button"
              className={`btn btn-ghost ad-preview-mode-btn${effectiveMode === 'logo' ? ' ad-preview-mode-btn--active' : ''}`}
              onClick={() => setBrandingMode('logo')}
              disabled={!hasLogo}
            >
              Name + logo
              <span className="ad-preview-mode-sub">Your logo on phone</span>
            </button>
          </div>

          <div className="ad-preview-tabs" role="tablist" aria-label="Where alert appears">
            {PREVIEW_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={previewTab === t.id}
                className={`btn btn-ghost ad-preview-tab${previewTab === t.id ? ' ad-preview-tab--active' : ''}`}
                onClick={() => setPreviewTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <h4 className="ad-preview-samples-title">Example messages</h4>
          <ul className="ad-preview-sample-list">
            {JEWELLER_PREVIEW_SAMPLES.map((s) => {
              const copy = resolvePreviewCopy(s, businessName, effectiveMode)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`ad-preview-sample-btn${activeSampleId === s.id ? ' ad-preview-sample-btn--active' : ''}`}
                    onClick={() => setActiveSampleId(s.id)}
                  >
                    <span className="ad-preview-sample-cat">{s.categoryLabel}</span>
                    <span className="ad-preview-sample-title">{copy.title}</span>
                    <span className="ad-preview-sample-body">{copy.body}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="card ad-preview-stage-card">
          <NotificationPreviewStage
            tab={previewTab}
            payload={{
              title: previewCopy.title,
              body: previewCopy.body,
              brandingLabel: previewCopy.brandingLabel,
              logoUrl,
              mode: effectiveMode,
            }}
          />
        </div>
      </div>

      <div className="card ad-preview-plans">
        <h3 style={{ marginTop: 0 }}>Branding options (overview)</h3>
        <div className="ad-preview-plan-cards">
          <div className="ad-preview-plan-card">
            <h4>Name alerts</h4>
            <p>Your shop name in the title and message. Cridora icon on the phone.</p>
            <ul>
              <li>Gold rate &amp; scheme facts</li>
              <li>Calm, information-style copy</li>
            </ul>
          </div>
          <div className="ad-preview-plan-card ad-preview-plan-card--highlight">
            <h4>Logo alerts</h4>
            <p>Your uploaded logo on the phone alert and inside the Cridora bell.</p>
            <ul>
              <li>Festival greetings &amp; offers</li>
              <li>Stronger recognition for your brand</li>
            </ul>
          </div>
        </div>
        <p className="dash-footnote" style={{ marginTop: '1rem' }}>
          Cridora sends one phone alert at a time. Older messages stay in the customer&apos;s bell
          inside the app. Customers can control offers in their notification settings.
        </p>
      </div>

      <div className="card ad-preview-contact">
        <h3 style={{ marginTop: 0 }}>Ready to reach your customers?</h3>
        <p className="dash-coming__text" style={{ marginBottom: '1rem', maxWidth: 520 }}>
          Contact the Cridora team to discuss alert packages, sample wording, and scheduling a
          campaign for your customers.
        </p>
        <a className="btn btn-primary" href={contactMailtoHref(businessName)}>
          Contact us
        </a>
      </div>
    </div>
  )
}
