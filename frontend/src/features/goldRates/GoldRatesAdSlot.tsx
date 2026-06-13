import { useEffect, useRef } from 'react'
import type { GoldRatesAdPlacementDTO } from '@/lib/marketplaceApi'

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

export function GoldRatesAdSlot({ placement, adsenseClientId, adsenseEnabled, className }: Props) {
  const pushed = useRef(false)

  useEffect(() => {
    if (!adsenseEnabled || !adsenseClientId) return
    if (document.querySelector('script[data-cridora-adsense]')) return
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.cridoraAdsense = '1'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}`
    document.head.appendChild(script)
  }, [adsenseEnabled, adsenseClientId])

  useEffect(() => {
    pushed.current = false
  }, [placement?.id, placement?.mode, placement?.adsense_slot_id, placement?.image_url])

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

  if (placement.mode === 'manual' && placement.manual_html?.trim()) {
    return (
      <aside
        className={`${baseCls} gr-ad--manual`}
        aria-label={placement.label || 'Sponsored'}
        dangerouslySetInnerHTML={{ __html: placement.manual_html }}
      />
    )
  }

  if (placement.mode === 'image') {
    const src =
      placement.image_url?.trim() ||
      SLOT_PLACEHOLDER_IMAGES[placement.slot] ||
      '/ads/gold-rates-in-content.svg'
    const alt = placement.image_alt?.trim() || placement.label || 'Advertisement'
    const link = placement.image_link_url?.trim()
    const img = (
      <img src={src} alt={alt} className="gr-ad__image" loading="lazy" decoding="async" />
    )
    return (
      <aside className={`${baseCls} gr-ad--image`} aria-label={alt}>
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer sponsored" className="gr-ad__link">
            {img}
          </a>
        ) : (
          img
        )}
      </aside>
    )
  }

  if (placement.mode === 'adsense' && adsenseEnabled && adsenseClientId && placement.adsense_slot_id) {
    return (
      <aside className={`${baseCls} gr-ad--adsense`} aria-label={placement.label || 'Advertisement'}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={adsenseClientId}
          data-ad-slot={placement.adsense_slot_id}
          data-ad-format={placement.adsense_format || 'auto'}
          data-full-width-responsive="true"
        />
      </aside>
    )
  }

  return (
    <aside className={`${baseCls} gr-ad--placeholder`} aria-hidden>
      <img
        src={SLOT_PLACEHOLDER_IMAGES[placement.slot] || '/ads/gold-rates-in-content.svg'}
        alt=""
        className="gr-ad__image gr-ad__image--placeholder"
      />
    </aside>
  )
}

export function findAdPlacement(
  placements: GoldRatesAdPlacementDTO[],
  slot: string,
): GoldRatesAdPlacementDTO | undefined {
  return placements.find((p) => p.slot === slot && p.is_active)
}
