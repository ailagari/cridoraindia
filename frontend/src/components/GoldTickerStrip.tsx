import { useEffect, useState } from 'react'
import { fetchGoldTicker, fetchSpotPrices, type GoldTickerPayload, type SpotPricesPayload } from '@/lib/marketplaceApi'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

type Props = {
  variant?: 'public' | 'dash'
}

function spot22k(data: SpotPricesPayload): number | null {
  const v = data.gold?.['22K']
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function spot24k(data: SpotPricesPayload): number | null {
  const v = data.gold?.['24K']
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function GoldTickerStrip({ variant = 'public' }: Props) {
  const [spot, setSpot] = useState<SpotPricesPayload | null>(null)
  const [adminFallback, setAdminFallback] = useState<GoldTickerPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void (async () => {
        const sp = await fetchSpotPrices()
        if (cancelled) {
          return
        }
        setSpot(sp)
        const needAdmin = !sp || !sp.gold || spot22k(sp) == null
        if (needAdmin) {
          const tick = await fetchGoldTicker()
          if (!cancelled) {
            setAdminFallback(tick)
          }
        } else if (!cancelled) {
          setAdminFallback(null)
        }
      })()
    }
    load()
    const id = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const s22 = spot ? spot22k(spot) : null
  const s24 = spot ? spot24k(spot) : null
  const admin22 =
    adminFallback != null ? Number.parseFloat(adminFallback.platform_base_inr_per_gram_22k) : NaN

  const per916 =
    s22 != null
      ? s22
      : Number.isFinite(admin22)
        ? admin22
        : NaN
  const per24 =
    s24 != null
      ? s24
      : Number.isFinite(per916)
        ? per916 / 0.916
        : NaN

  const headline =
    spot?.source === 'spot'
      ? 'Live INR · global spot (XAU)'
      : spot?.source === 'stale_cache'
        ? 'INR rates (cached spot)'
        : spot?.source === 'platform_floor'
          ? 'Platform benchmark (INR)'
          : spot == null && adminFallback != null
            ? 'Platform benchmark (INR)'
            : 'Gold rates (INR)'

  const subNote =
    spot?.source === 'spot' || spot?.source === 'stale_cache'
      ? 'BIS 916 / 22K and 24K fine · indicative · not IBJA'
      : 'BIS 916 / 22K · admin reference when spot offline'

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
          maxWidth: 'min(420px, 100%)',
        }}
      >
        <span
          style={{
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--gold-light)',
          }}
        >
          22K 916
        </span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
          {Number.isFinite(per916) ? `₹${formatInr(per916, 2)}/g` : '—'}
        </span>
        <span style={{ color: 'var(--text-faint)' }}>|</span>
        <span style={{ fontWeight: 700, color: 'var(--gold-light)' }}>24K</span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
          {Number.isFinite(per24) ? `₹${formatInr(per24, 2)}/g` : '—'}
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
          gap: '0.85rem 1.25rem',
          padding: '0.45rem 0',
          fontSize: '0.78rem',
        }}
      >
        <span
          style={{
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--gold-light)',
          }}
        >
          {headline}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 600 }}>22K 916</span>{' '}
          <strong className="tabular" style={{ color: 'var(--success)', fontSize: '0.95rem' }}>
            ₹{Number.isFinite(per916) ? formatInr(per916, 2) : '—'}
          </strong>
          /g
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 600 }}>24K</span>{' '}
          <strong className="tabular" style={{ color: 'var(--text)', fontSize: '0.95rem' }}>
            ₹{Number.isFinite(per24) ? formatInr(per24, 2) : '—'}
          </strong>
          /g
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-faint)' }}>
          {subNote} · refresh ~1 min
        </span>
      </div>
    </div>
  )
}
