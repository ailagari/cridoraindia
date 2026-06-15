import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { publicRateBasisLabel, publicRateSourceLabel } from '@/lib/publicRateLabels'
import { useLivePoll } from '@/lib/useLivePoll'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

type Props = {
  /** Public site banner; jeweller/admin/customer dashboards. */
  variant?: 'public' | 'jeweller' | 'admin' | 'customer'
}

function numFromGold(block: Record<string, number> | undefined, key: string): number | null {
  if (!block) return null
  const v = block[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Published ticker ladder: manual board or Cridora live Kerala gold rate. */
function publishedMarketGold(spot: SpotPricesPayload | null): Record<string, number> | undefined {
  if (!spot?.gold || Object.keys(spot.gold).length === 0) {
    return spot?.kerala_board?.gold
  }
  return spot.gold
}

function liveMarketBasisNote(
  src: string | undefined,
  t: (key: MessageKey) => string,
): string {
  switch (src) {
    case 'manual_ticker':
      return t('ticker.basis.manual')
    case 'kerala_gold_rate':
      return t('ticker.basis.keralaGold')
    case 'kerala_gold_rate_stale':
      return t('ticker.basis.keralaGoldStale')
    case 'live_spot':
    case 'stale_spot_cache':
    case 'db_snapshot':
      return t('ticker.basis.published')
    case 'admin_fallback':
      return t('ticker.basis.fallback')
    default:
      return publicRateBasisLabel(src)
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

  const rawGold = spot?.kerala_board?.gold ?? spot?.live_raw_spot?.gold
  const raw22 = numFromGold(rawGold, '22K')
  const raw24 = numFromGold(rawGold, '24K')

  const marketGold = publishedMarketGold(spot)
  let market22 = numFromGold(marketGold, '22K')
  let market24 = numFromGold(marketGold, '24K')

  if (spot == null && adminFallback != null) {
    const p = Number.parseFloat(adminFallback.platform_base_inr_per_gram_22k)
    if (Number.isFinite(p)) {
      market22 = p
      market24 = p / 0.916
    }
  }

  const basisSrc =
    spot?.source === 'manual_ticker'
      ? spot.source
      : spot?.kerala_board?.source ?? spot?.cridora_base_source ?? spot?.source ?? adminFallback?.cridora_base_source
  const footPublic = liveMarketBasisNote(basisSrc, t)
  const footAdmin = publicRateSourceLabel(basisSrc, spot?.source_label)

  if (variant === 'customer') {
    return (
      <div className="tb-ticker-dash" role="status" aria-live="polite">
        <span className="tick-dot" aria-hidden />
        <span className="tb-ticker-lbl">22K&nbsp;</span>
        <span className="tn">{market22 != null ? `₹${formatInr(market22, 2)}/g` : '—'}</span>
        <span aria-hidden style={{ opacity: 0.3, margin: '0 5px' }}>
          ·
        </span>
        <span className="tb-ticker-lbl">24K&nbsp;</span>
        <span className="tn">{market24 != null ? `₹${formatInr(market24, 2)}/g` : '—'}</span>
      </div>
    )
  }

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
        {raw22 != null ? (
          <>
            <span style={{ fontWeight: 800, color: 'var(--text-faint)', letterSpacing: '0.06em' }}>
              Raw Kerala
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>22K</span>
            <span className="tabular" style={{ color: 'var(--text)', fontWeight: 600 }}>
              ₹{formatInr(raw22, 2)}/g
            </span>
            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>24K</span>
            <span className="tabular" style={{ color: 'var(--text)', fontWeight: 600 }}>
              {raw24 != null ? `₹${formatInr(raw24, 2)}/g` : '—'}
            </span>
            <span style={{ color: 'var(--text-faint)' }}>|</span>
          </>
        ) : null}
        <span style={{ fontWeight: 800, color: 'var(--gold-light)', letterSpacing: '0.06em' }}>
          Cridora live
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
          {footAdmin} · ~{pollLabel}
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
          Cridora live
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
    <Link to="/gold-rates/kerala" className="gold-ticker gold-ticker--public ref-pub-ticker" aria-label={t('nav.goldRates')}>
      <div
        className="container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.85rem 1.35rem',
          padding: '0.5rem 0',
          fontSize: '0.78rem',
          textDecoration: 'none',
          color: 'inherit',
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
    </Link>
  )
}
