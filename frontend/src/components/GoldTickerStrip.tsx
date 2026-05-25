import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api'
import { useOptionalPublicLocale } from '@/i18n/PublicLocaleProvider'
import type { MessageKey } from '@/i18n/messages/en'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  fetchGoldTicker,
  fetchSpotPrices,
  type GoldTickerPayload,
  type SpotPricesPayload,
} from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

type Props = {
  /** Public site banner; jeweller dash compact row (live market only); admin dash includes international reference. */
  variant?: 'public' | 'jeweller' | 'admin'
}

function numFromGold(block: Record<string, number> | undefined, key: string): number | null {
  if (!block) return null
  const v = block[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** User-facing footnote for published ladder (no international wording). */
function liveMarketBasisNote(
  src: string | undefined,
  t: (key: MessageKey) => string,
): string {
  switch (src) {
    case 'manual_ticker':
      return t('ticker.basis.manual')
    case 'live_spot':
    case 'stale_spot_cache':
    case 'db_snapshot':
      return t('ticker.basis.published')
    case 'admin_fallback':
      return t('ticker.basis.fallback')
    default:
      return src ? src.replace(/_/g, ' ') : t('ticker.basis.live')
  }
}

/** Admin ticker: explain how published rate relates to international raw. */
function adminPublishedBasisNote(src: string | undefined): string {
  switch (src) {
    case 'manual_ticker':
      return 'Cridora manual board (no international row)'
    case 'live_spot':
      return 'International spot + admin markup/deduction → live market'
    case 'stale_spot_cache':
      return 'Stale international snapshot + admin markup/deduction'
    case 'db_snapshot':
      return 'Saved international snapshot + admin markup/deduction'
    case 'admin_fallback':
      return 'Platform fallback (no fresh international snapshot)'
    default:
      return src ? src.replace(/_/g, ' ') : 'Live market'
  }
}

async function fetchAdminSpotPrices(): Promise<SpotPricesPayload | null> {
  const res = await authFetch('/api/v1/admin/spot-prices/', { cache: 'no-store' })
  if (!res.ok) {
    return null
  }
  return (await res.json()) as SpotPricesPayload
}

export function GoldTickerStrip({ variant = 'public' }: Props) {
  const { t } = useOptionalPublicLocale()
  const [spot, setSpot] = useState<SpotPricesPayload | null>(null)
  const [adminFallback, setAdminFallback] = useState<GoldTickerPayload | null>(null)

  const pollMs = LIVE_PRICE_POLL_MS
  const pollLabel = useMemo(() => `${(pollMs / 1000).toFixed(1)}s`, [pollMs])

  const load = useCallback(() => {
    void (async () => {
      const sp =
        variant === 'admin' ? await fetchAdminSpotPrices() : await fetchSpotPrices()
      setSpot(sp)
      if (!sp) {
        const tick = await fetchGoldTicker()
        setAdminFallback(tick)
      } else {
        setAdminFallback(null)
      }
    })()
  }, [variant])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, pollMs, true)

  const liveGold = spot?.live_raw_spot?.gold
  const intl22 = numFromGold(liveGold, '22K')
  const intl24 = numFromGold(liveGold, '24K')

  const marketGold = spot?.gold
  let market22 = numFromGold(marketGold, '22K')
  let market24 = numFromGold(marketGold, '24K')

  if (spot == null && adminFallback != null) {
    const p = Number.parseFloat(adminFallback.platform_base_inr_per_gram_22k)
    if (Number.isFinite(p)) {
      market22 = p
      market24 = p / 0.916
    }
  }

  const basisSrc = spot?.cridora_base_source ?? adminFallback?.cridora_base_source
  const footPublic = liveMarketBasisNote(basisSrc, t)
  const footAdmin = adminPublishedBasisNote(basisSrc)

  const intlHint =
    spot?.live_raw_spot?.source != null && spot.live_raw_spot.source !== ''
      ? spot.live_raw_spot.source.replace(/_/g, ' ')
      : 'international'

  if (variant === 'admin') {
    return (
      <div
        className="gold-ticker gold-ticker--dash gold-ticker--admin"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          flexWrap: 'wrap',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          maxWidth: 'min(560px, 100%)',
        }}
      >
        <span style={{ fontWeight: 800, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>
          Intl ref.
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>22K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {intl22 != null ? `₹${formatInr(intl22, 2)}/g` : '—'}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>24K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {intl24 != null ? `₹${formatInr(intl24, 2)}/g` : '—'}
        </span>
        <span style={{ color: 'var(--text-faint)' }}>|</span>
        <span style={{ fontWeight: 800, color: 'var(--gold-light)', letterSpacing: '0.06em' }}>
          Live market
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>22K</span>
        <span className="tabular" style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
          {market22 != null ? `₹${formatInr(market22, 2)}/g` : '—'}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>24K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
          {market24 != null ? `₹${formatInr(market24, 2)}/g` : '—'}
        </span>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)', flex: '1 1 100%' }}>
          Raw INR/g ({intlHint}) · {footAdmin} · ~{pollLabel}
        </span>
      </div>
    )
  }

  if (variant === 'jeweller') {
    return (
      <div
        className="gold-ticker gold-ticker--dash gold-ticker--jeweller"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          flexWrap: 'wrap',
          fontSize: '0.68rem',
          color: 'var(--text-muted)',
          maxWidth: 'min(420px, 100%)',
        }}
      >
        <span style={{ fontWeight: 800, color: 'var(--gold-light)', letterSpacing: '0.06em' }}>
          Live market
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>22K</span>
        <span className="tabular" style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
          {market22 != null ? `₹${formatInr(market22, 2)}/g` : '—'}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>24K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
          {market24 != null ? `₹${formatInr(market24, 2)}/g` : '—'}
        </span>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>
          {footPublic} · ~{pollLabel}
        </span>
      </div>
    )
  }

  return (
    <div className="gold-ticker gold-ticker--public ref-pub-ticker">
      <div
        className="container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.85rem 1.35rem',
          padding: '0.5rem 0',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem 1rem' }}>
          <span
            style={{
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--gold-light)',
              fontSize: '0.62rem',
            }}
          >
            {t('ticker.liveMarket')}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>22K 916</span>{' '}
            <strong className="tabular" style={{ color: 'var(--success)', fontSize: '0.95rem' }}>
              {market22 != null ? `₹${formatInr(market22, 2)}` : '—'}
            </strong>
            /g
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>24K</span>{' '}
            <strong className="tabular" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
              {market24 != null ? `₹${formatInr(market24, 2)}` : '—'}
            </strong>
            /g
          </span>
        </div>

        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.62rem',
            color: 'var(--text-faint)',
            lineHeight: 1.35,
            textAlign: 'right',
            maxWidth: 420,
          }}
        >
          {t('ticker.indiaFacing', { interval: pollLabel })} · {footPublic}
        </span>
      </div>
    </div>
  )
}
