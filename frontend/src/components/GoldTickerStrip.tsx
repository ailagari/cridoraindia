import { useCallback, useEffect, useMemo, useState } from 'react'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import { fetchGoldTicker, fetchSpotPrices, type GoldTickerPayload, type SpotPricesPayload } from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

type Props = {
  variant?: 'public' | 'dash'
}

function numFromGold(block: Record<string, number> | undefined, key: string): number | null {
  if (!block) return null
  const v = block[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function cridoraBasisNote(src: string | undefined): string {
  switch (src) {
    case 'manual_ticker':
      return 'Cridora manual board'
    case 'live_spot':
      return 'Live international spot + Cridora markup/deduction'
    case 'stale_spot_cache':
      return 'Stale international snapshot + Cridora markup/deduction'
    case 'db_snapshot':
      return 'Saved international snapshot + Cridora markup/deduction'
    case 'admin_fallback':
      return 'Platform fallback reference'
    default:
      return src ? src.replace(/_/g, ' ') : 'Cridora reference'
  }
}

export function GoldTickerStrip({ variant = 'public' }: Props) {
  const [spot, setSpot] = useState<SpotPricesPayload | null>(null)
  const [adminFallback, setAdminFallback] = useState<GoldTickerPayload | null>(null)

  const pollMs = LIVE_PRICE_POLL_MS
  const pollLabel = useMemo(() => `${(pollMs / 1000).toFixed(1)}s`, [pollMs])

  const load = useCallback(() => {
    void (async () => {
      const sp = await fetchSpotPrices()
      setSpot(sp)
      if (!sp) {
        const tick = await fetchGoldTicker()
        setAdminFallback(tick)
      } else {
        setAdminFallback(null)
      }
    })()
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLivePoll(load, pollMs, true)

  const liveGold = spot?.live_raw_spot?.gold
  const intl22 = numFromGold(liveGold, '22K')
  const intl24 = numFromGold(liveGold, '24K')

  const cridoraGold = spot?.gold
  let cridora22 = numFromGold(cridoraGold, '22K')
  let cridora24 = numFromGold(cridoraGold, '24K')

  if (spot == null && adminFallback != null) {
    const p = Number.parseFloat(adminFallback.platform_base_inr_per_gram_22k)
    if (Number.isFinite(p)) {
      cridora22 = p
      cridora24 = p / 0.916
    }
  }

  const basisSrc = spot?.cridora_base_source ?? adminFallback?.cridora_base_source
  const basisExplain = cridoraBasisNote(basisSrc)

  const intlHint =
    spot?.live_raw_spot?.source != null && spot.live_raw_spot.source !== ''
      ? spot.live_raw_spot.source.replace(/_/g, ' ')
      : 'international'

  if (variant === 'dash') {
    return (
      <div
        className="gold-ticker gold-ticker--dash"
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
        <span style={{ fontWeight: 800, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>Intl</span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>22K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {intl22 != null ? `₹${formatInr(intl22, 2)}/g` : '—'}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>24K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 600 }}>
          {intl24 != null ? `₹${formatInr(intl24, 2)}/g` : '—'}
        </span>
        <span style={{ color: 'var(--text-faint)' }}>|</span>
        <span style={{ fontWeight: 800, color: 'var(--gold-light)', letterSpacing: '0.06em' }}>Cridora</span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>22K</span>
        <span className="tabular" style={{ color: 'var(--gold-light)', fontWeight: 700 }}>
          {cridora22 != null ? `₹${formatInr(cridora22, 2)}/g` : '—'}
        </span>
        <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>24K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
          {cridora24 != null ? `₹${formatInr(cridora24, 2)}/g` : '—'}
        </span>
      </div>
    )
  }

  return (
    <div
      className="gold-ticker gold-ticker--public"
      style={{
        borderBottom: '1px solid var(--border-soft)',
        background: 'linear-gradient(90deg, var(--gold-shine-10), transparent)',
      }}
    >
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
              color: 'var(--text-faint)',
              fontSize: '0.62rem',
            }}
          >
            International (live)
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>22K 916</span>{' '}
            <strong className="tabular" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
              {intl22 != null ? `₹${formatInr(intl22, 2)}` : '—'}
            </strong>
            /g
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>24K</span>{' '}
            <strong className="tabular" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
              {intl24 != null ? `₹${formatInr(intl24, 2)}` : '—'}
            </strong>
            /g
          </span>
        </div>

        <span style={{ color: 'var(--border-soft)', fontWeight: 300 }} aria-hidden>
          |
        </span>

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
            Cridora reference
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>22K 916</span>{' '}
            <strong className="tabular" style={{ color: 'var(--success)', fontSize: '0.95rem' }}>
              {cridora22 != null ? `₹${formatInr(cridora22, 2)}` : '—'}
            </strong>
            /g
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600 }}>24K</span>{' '}
            <strong className="tabular" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
              {cridora24 != null ? `₹${formatInr(cridora24, 2)}` : '—'}
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
          Global spot → INR/g ({intlHint}), indicative · {basisExplain} · ~{pollLabel}
        </span>
      </div>
    </div>
  )
}
