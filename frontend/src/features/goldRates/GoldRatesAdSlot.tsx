import { useEffect, useRef } from 'react'
import type { GoldRatesAdPlacementDTO } from '@/lib/marketplaceApi'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

type Props = {
  placement: GoldRatesAdPlacementDTO | undefined
  adsenseClientId: string
  adsenseEnabled: boolean
  className?: string
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
  }, [placement?.id, placement?.mode, placement?.adsense_slot_id])

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

  if (placement.mode === 'manual' && placement.manual_html?.trim()) {
    return (
      <aside
        className={`gr-ad gr-ad--manual${className ? ` ${className}` : ''}`}
        aria-label={placement.label || 'Sponsored'}
        dangerouslySetInnerHTML={{ __html: placement.manual_html }}
      />
    )
  }

  if (placement.mode === 'adsense' && adsenseEnabled && adsenseClientId && placement.adsense_slot_id) {
    return (
      <aside className={`gr-ad gr-ad--adsense${className ? ` ${className}` : ''}`} aria-label={placement.label || 'Advertisement'}>
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
    <aside className={`gr-ad gr-ad--placeholder${className ? ` ${className}` : ''}`} aria-hidden>
      <span className="gr-ad__placeholder-label">{placement.label || 'Ad placement'}</span>
    </aside>
  )
}

export function findAdPlacement(
  placements: GoldRatesAdPlacementDTO[],
  slot: string,
): GoldRatesAdPlacementDTO | undefined {
  return placements.find((p) => p.slot === slot && p.is_active)
}
