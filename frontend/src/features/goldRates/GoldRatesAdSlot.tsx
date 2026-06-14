import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { GoldRatesAdPlacementDTO } from '@/lib/marketplaceApi'
import { adSlotFrameStyle, getGoldRatesAdSlotSpec } from '@/features/goldRates/goldRatesAdSpecs'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const SLOT_PLACEHOLDER_IMAGES: Record<string, string> = {
  top_banner: '/ads/gold-rates-top-banner.svg',
  sidebar: '/ads/gold-rates-sidebar.svg',
  in_content_1: '/ads/gold-rates-in-content.svg',
  in_content_2: '/ads/gold-rates-in-content.svg',
  footer: '/ads/gold-rates-footer.svg',
}

type Props = {
  placement: GoldRatesAdPlacementDTO | undefined
  adsenseClientId: string
  adsenseEnabled: boolean
  className?: string
}

function slotClass(slot: string | undefined): string {
  if (slot === 'sidebar') return ' gr-ad--sidebar'
  if (slot === 'footer') return ' gr-ad--footer'
  if (slot === 'top_banner') return ' gr-ad--top'
  return ' gr-ad--inline'
}

function AdFrame({
  slot,
  className,
  children,
}: {
  slot: string | undefined
  className?: string
  children: ReactNode
}) {
  const spec = getGoldRatesAdSlotSpec(slot)
  return (
    <div className={`gr-ad__frame${className ? ` ${className}` : ''}`} style={adSlotFrameStyle(spec)}>
      {children}
    </div>
  )
}

function mediaLink(placement: GoldRatesAdPlacementDTO): string | undefined {
  return placement.video_link_url?.trim() || placement.image_link_url?.trim() || undefined
}

function mediaAlt(placement: GoldRatesAdPlacementDTO): string {
  return (
    placement.video_alt?.trim() ||
    placement.image_alt?.trim() ||
    placement.label ||
    'Advertisement'
  )
}

function renderMediaBanner(
  placement: GoldRatesAdPlacementDTO,
  baseCls: string,
  opts?: { allowPlaceholderImage?: boolean },
) {
  const videoSrc = placement.video_url?.trim()
  const imageSrc = placement.image_url?.trim()
  const placeholder =
    SLOT_PLACEHOLDER_IMAGES[placement.slot] || '/ads/gold-rates-in-content.svg'
  const alt = mediaAlt(placement)
  const link = mediaLink(placement)

  if (videoSrc) {
    const poster = placement.video_poster_url?.trim() || imageSrc || undefined
    const video = (
      <video
        src={videoSrc}
        poster={poster}
        className="gr-ad__video"
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    )
    const framed = <AdFrame slot={placement.slot}>{video}</AdFrame>
    return (
      <aside className={`${baseCls} gr-ad--video`} aria-label={alt}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer sponsored" className="gr-ad__link">
            {framed}
          </a>
        ) : (
          framed
        )}
      </aside>
    )
  }

  const imgSrc = imageSrc || (opts?.allowPlaceholderImage ? placeholder : '')
  if (!imgSrc) {
    return (
      <aside className={`${baseCls} gr-ad--placeholder`} aria-hidden>
        <AdFrame slot={placement.slot}>
          <img src={placeholder} alt="" className="gr-ad__image gr-ad__image--placeholder" />
        </AdFrame>
      </aside>
    )
  }

  const img = <img src={imgSrc} alt={alt} className="gr-ad__image" loading="lazy" decoding="async" />
  const framed = <AdFrame slot={placement.slot}>{img}</AdFrame>
  return (
    <aside className={`${baseCls} gr-ad--image`} aria-label={alt}>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer sponsored" className="gr-ad__link">
          {framed}
        </a>
      ) : (
        framed
      )}
    </aside>
  )
}

export function GoldRatesAdSlot({ placement, adsenseClientId, adsenseEnabled, className }: Props) {
  const pushed = useRef(false)

  useEffect(() => {
    if (!adsenseEnabled || !adsenseClientId) return
    if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.cridoraAdsense = '1'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}`
    document.head.appendChild(script)
  }, [adsenseEnabled, adsenseClientId])

  useEffect(() => {
    pushed.current = false
  }, [placement?.id, placement?.mode, placement?.adsense_slot_id, placement?.image_url, placement?.video_url])

  useEffect(() => {
    if (!placement?.is_active) return
    if (placement.mode !== 'adsense' || !adsenseEnabled || !adsenseClientId || !placement.adsense_slot_id) return
    if (pushed.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      /* AdSense may block in dev */
    }
  }, [placement, adsenseEnabled, adsenseClientId])

  if (!placement?.is_active) {
    return null
  }

  const slotCls = slotClass(placement.slot)
  const baseCls = `gr-ad${slotCls}${className ? ` ${className}` : ''}`
  const frameStyle = adSlotFrameStyle(getGoldRatesAdSlotSpec(placement.slot)) as CSSProperties | undefined

  if (placement.mode === 'manual' && placement.manual_html?.trim()) {
    return (
      <aside
        className={`${baseCls} gr-ad--manual`}
        style={frameStyle}
        aria-label={placement.label || 'Sponsored'}
        dangerouslySetInnerHTML={{ __html: placement.manual_html }}
      />
    )
  }

  if (placement.mode === 'media') {
    return renderMediaBanner(placement, baseCls, { allowPlaceholderImage: true })
  }

  if (placement.mode === 'image') {
    return renderMediaBanner(
      { ...placement, video_url: '' },
      baseCls,
      { allowPlaceholderImage: true },
    )
  }

  if (placement.mode === 'video') {
    return renderMediaBanner(placement, baseCls)
  }

  if (placement.mode === 'adsense' && adsenseEnabled && adsenseClientId && placement.adsense_slot_id) {
    const spec = getGoldRatesAdSlotSpec(placement.slot)
    const format = placement.adsense_format?.trim() || spec?.adsenseFormat || 'auto'
    return (
      <aside className={`${baseCls} gr-ad--adsense`} aria-label={placement.label || 'Advertisement'}>
        <AdFrame slot={placement.slot} className="gr-ad__frame--adsense">
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', height: '100%' }}
            data-ad-client={adsenseClientId}
            data-ad-slot={placement.adsense_slot_id}
            data-ad-format={format}
            data-full-width-responsive="true"
          />
        </AdFrame>
      </aside>
    )
  }

  return (
    <aside className={`${baseCls} gr-ad--placeholder`} aria-hidden>
      <AdFrame slot={placement.slot}>
        <img
          src={SLOT_PLACEHOLDER_IMAGES[placement.slot] || '/ads/gold-rates-in-content.svg'}
          alt=""
          className="gr-ad__image gr-ad__image--placeholder"
        />
      </AdFrame>
    </aside>
  )
}

export function findAdPlacement(
  placements: GoldRatesAdPlacementDTO[],
  slot: string,
): GoldRatesAdPlacementDTO | undefined {
  return placements.find((p) => p.slot === slot && p.is_active)
}
