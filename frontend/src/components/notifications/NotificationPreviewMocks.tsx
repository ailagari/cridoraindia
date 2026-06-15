import type { BrandingMode } from '@/lib/notificationPreviewSamples'
import { previewIconUrl } from '@/lib/notificationPreviewSamples'

type PreviewPayload = {
  title: string
  body: string
  brandingLabel?: string
  logoUrl?: string
  mode: BrandingMode
}

function PreviewIcon({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      className="ad-preview-icon"
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const img = e.currentTarget
        if (img.src.endsWith('/icon-192.png')) return
        img.src = '/icon-192.png'
      }}
    />
  )
}

/** Phone lock-screen style tray notification. */
export function PhoneTrayPreview({ title, body, logoUrl, mode }: PreviewPayload) {
  const icon = previewIconUrl(logoUrl || '', mode)
  return (
    <div className="ad-preview-phone" aria-hidden="true">
      <div className="ad-preview-phone-status">
        <span>9:41</span>
        <span className="ad-preview-phone-status-icons">▮▮▮ 🔋</span>
      </div>
      <div className="ad-preview-tray-card">
        <PreviewIcon src={icon} />
        <div className="ad-preview-tray-text">
          <p className="ad-preview-tray-title">{title}</p>
          <p className="ad-preview-tray-body">{body}</p>
        </div>
      </div>
      <p className="ad-preview-footnote">How it looks on your customer&apos;s phone</p>
    </div>
  )
}

/** In-app bell dropdown style. */
export function BellInboxPreview({
  title,
  body,
  brandingLabel,
  logoUrl,
  mode,
}: PreviewPayload) {
  const thumb = previewIconUrl(logoUrl || '', mode)
  return (
    <div className="ad-preview-bell-wrap" aria-hidden="true">
      <div className="ad-preview-bell-panel card">
        <div className="ad-preview-bell-head">
          <span className="ad-preview-bell-head-title">Your alerts</span>
        </div>
        <button type="button" className="ad-preview-bell-item notif-item-btn notif-item-btn--unread">
          <img src={thumb} alt="" className="notif-item-thumb" width={36} height={36} />
          <p className="notif-item-title">{title}</p>
          <p className="notif-item-body">{body}</p>
          {brandingLabel ? <p className="ad-preview-bell-via">{brandingLabel}</p> : null}
          <p className="notif-item-time">Just now</p>
        </button>
      </div>
      <p className="ad-preview-footnote">Inside Cridora when they tap the bell</p>
    </div>
  )
}

/** Desktop browser notification center style. */
export function BrowserTrayPreview({ title, body, logoUrl, mode }: PreviewPayload) {
  const icon = previewIconUrl(logoUrl || '', mode)
  return (
    <div className="ad-preview-browser" aria-hidden="true">
      <div className="ad-preview-browser-chrome">
        <span className="ad-preview-browser-dot" />
        <span className="ad-preview-browser-dot" />
        <span className="ad-preview-browser-dot" />
        <span className="ad-preview-browser-url">cridora.in</span>
      </div>
      <div className="ad-preview-browser-tray">
        <p className="ad-preview-browser-tray-label">Notifications</p>
        <div className="ad-preview-browser-card">
          <PreviewIcon src={icon} />
          <div className="ad-preview-tray-text">
            <p className="ad-preview-tray-title">{title}</p>
            <p className="ad-preview-tray-body">{body}</p>
          </div>
        </div>
      </div>
      <p className="ad-preview-footnote">On computer when Cridora is in the browser</p>
    </div>
  )
}

export type PreviewTab = 'phone' | 'bell' | 'browser'

type Props = {
  tab: PreviewTab
  payload: PreviewPayload
}

export function NotificationPreviewStage({ tab, payload }: Props) {
  if (tab === 'phone') return <PhoneTrayPreview {...payload} />
  if (tab === 'bell') return <BellInboxPreview {...payload} />
  return <BrowserTrayPreview {...payload} />
}
