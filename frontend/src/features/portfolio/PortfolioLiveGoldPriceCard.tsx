import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { goldRateContextLine } from '@/content/cridoraVoice'
import {
  fetchGoldTickerHistory,
  type GoldTickerHistoryPayload,
  type GoldTickerPayload,
  type SpotPricesPayload,
} from '@/lib/marketplaceApi'
import {
  buildGoldSpotPricePoints,
  GoldSpotHistoryThinChart,
} from './PortfolioCharts'

type HistoryRange = '1d' | '1w' | '1m' | '1y'

const RANGE_OPTIONS: { key: HistoryRange; label: string }[] = [
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
  { key: '1y', label: '1Y' },
]

const RANGE_LABELS: Record<HistoryRange, string> = {
  '1d': '24H',
  '1w': '7D',
  '1m': '30D',
  '1y': '1Y',
}

function fmtInr0(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtInr2(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function maskInr(s: string): string {
  return s.replace(/[0-9]/g, '•')
}

function numFromGold(block: Record<string, number> | undefined, key: string): number | null {
  if (!block) return null
  const v = block[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function resolve22kPrice(
  spot: SpotPricesPayload | null,
  tickerFallback: GoldTickerPayload | null,
): number | null {
  let g22 = numFromGold(spot?.gold, '22K')
  if (g22 == null && spot?.platform_base_inr_per_gram_22k) {
    const p = Number.parseFloat(spot.platform_base_inr_per_gram_22k)
    if (Number.isFinite(p)) g22 = p
  }
  if (g22 == null && tickerFallback != null) {
    const p = Number.parseFloat(tickerFallback.platform_base_inr_per_gram_22k)
    if (Number.isFinite(p)) g22 = p
  }
  return g22
}

function fmtHoldingsGrams(g: number): string {
  if (g <= 0) return '0 g'
  if (g >= 1) return `${g.toFixed(2)} g`
  return `${g.toFixed(4)} g`
}

export function PortfolioLiveGoldPriceCard({
  spot,
  tickerFallback,
  holdingsGrams,
  holdingsValueInr,
  masked,
}: {
  spot: SpotPricesPayload | null
  tickerFallback: GoldTickerPayload | null
  holdingsGrams: number
  holdingsValueInr: number
  masked: boolean
}) {
  const [historyRange, setHistoryRange] = useState<HistoryRange>('1d')
  const [history, setHistory] = useState<GoldTickerHistoryPayload | null>(null)

  const livePrice = useMemo(() => resolve22kPrice(spot, tickerFallback), [spot, tickerFallback])

  const refreshHistory = useCallback(async () => {
    const h = await fetchGoldTickerHistory(historyRange)
    setHistory(h)
  }, [historyRange])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshHistory()
    }, 60000)
    return () => window.clearInterval(id)
  }, [refreshHistory])

  const pricePoints = useMemo(() => buildGoldSpotPricePoints(history, livePrice), [history, livePrice])

  const granularity: 'intraday' | 'daily' = history?.granularity === 'intraday' ? 'intraday' : 'daily'

  const periodHigh =
    pricePoints.length > 0 ? Math.max(...pricePoints.map((p) => p.valueInr)) : null
  const periodLow =
    pricePoints.length > 0 ? Math.min(...pricePoints.map((p) => p.valueInr)) : null

  const changePct = useMemo(() => {
    if (livePrice == null || pricePoints.length < 2) return null
    const base = pricePoints[0]!.valueInr
    if (!Number.isFinite(base) || base <= 0) return null
    return ((livePrice - base) / base) * 100
  }, [livePrice, pricePoints])

  const todayChange = useMemo(() => {
    if (history?.granularity !== 'daily') return null
    const todayKey = new Date().toLocaleDateString('en-CA')
    const todayPt = (history.points ?? []).find((p) => p.t.startsWith(todayKey))
    if (!todayPt?.change_pct) return null
    const n = Number.parseFloat(todayPt.change_pct)
    return Number.isFinite(n) ? n : null
  }, [history])

  const disp = (s: string) => (masked ? maskInr(s) : s)
  const rangeLabel = RANGE_LABELS[historyRange]
  const changeUp = changePct != null && changePct >= 0
  const dailyUp = todayChange != null && todayChange >= 0

  const rateContextLine = useMemo(() => {
    if (todayChange != null && Number.isFinite(todayChange)) {
      const dir = Math.abs(todayChange) < 0.05 ? 'steady' : todayChange > 0 ? 'up' : 'down'
      return goldRateContextLine({ deltaPct: todayChange, direction: dir })
    }
    if (changePct != null && Number.isFinite(changePct)) {
      const dir = Math.abs(changePct) < 0.05 ? 'steady' : changePct > 0 ? 'up' : 'down'
      return goldRateContextLine({ deltaPct: changePct, direction: dir })
    }
    return goldRateContextLine({ direction: 'unknown' })
  }, [todayChange, changePct])

  return (
    <section className="pf-live-gold" aria-label="Live gold price">
      <header className="pf-live-gold__head">
        <h2 className="pf-live-gold__title">Live Gold Price</h2>
        <div className="pf-live-gold__head-actions">
          <div className="pf-live-gold__ranges" role="group" aria-label="Chart range">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`pf-live-gold__range${historyRange === opt.key ? ' pf-live-gold__range--active' : ''}`}
                aria-pressed={historyRange === opt.key}
                onClick={() => setHistoryRange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Link to="/userdashboard?section=invest_fractional" className="pf-live-gold__invest">
            Invest →
          </Link>
        </div>
      </header>

      <div className="pf-live-gold__price-row">
        <p className="pf-live-gold__price tabular">
          {livePrice != null ? `₹${fmtInr0(livePrice)}` : '—'}
        </p>
        <div className="pf-live-gold__price-meta">
          <span className="pf-live-gold__unit">/ gram · 22K</span>
          {changePct != null ? (
            <span
              className={`pf-live-gold__change tabular ${changeUp ? 'pf-live-gold__change--up' : 'pf-live-gold__change--down'}`}
            >
              {changeUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% · {rangeLabel}
            </span>
          ) : (
            <span className="pf-live-gold__change pf-live-gold__change--flat">{rangeLabel} —</span>
          )}
          {history?.granularity === 'daily' && todayChange != null ? (
            <span
              className={`pf-live-gold__change pf-live-gold__change--daily tabular ${dailyUp ? 'pf-live-gold__change--up' : 'pf-live-gold__change--down'}`}
            >
              Day {dailyUp ? '+' : ''}{todayChange.toFixed(2)}%
            </span>
          ) : null}
        </div>
      </div>
      <p className="pf-live-gold__context">{rateContextLine}</p>

      <div className="pf-live-gold__rule" aria-hidden />

      <div className="pf-live-gold__chart">
        {pricePoints.length >= 2 ? (
          <GoldSpotHistoryThinChart
            points={pricePoints}
            granularity={granularity}
            masked={masked}
            ariaLabel={`22K board reference ₹ per gram over ${rangeLabel}`}
            windowLabel={rangeLabel}
          />
        ) : (
          <div className="pf-live-gold__chart-empty" aria-hidden />
        )}
      </div>

      <div className="pf-live-gold__stats">
        <div className="pf-live-gold__stat">
          <span className="pf-live-gold__stat-label">{rangeLabel} High</span>
          <span className="pf-live-gold__stat-val pf-live-gold__stat-val--high tabular">
            {periodHigh != null ? `₹${fmtInr0(periodHigh)}` : '—'}
          </span>
        </div>
        <div className="pf-live-gold__stat">
          <span className="pf-live-gold__stat-label">{rangeLabel} Low</span>
          <span className="pf-live-gold__stat-val pf-live-gold__stat-val--low tabular">
            {periodLow != null ? `₹${fmtInr0(periodLow)}` : '—'}
          </span>
        </div>
        <div className="pf-live-gold__stat">
          <span className="pf-live-gold__stat-label">Your holdings</span>
          <span className="pf-live-gold__stat-val tabular">{fmtHoldingsGrams(holdingsGrams)}</span>
        </div>
        <div className="pf-live-gold__stat">
          <span className="pf-live-gold__stat-label">Value</span>
          <span className="pf-live-gold__stat-val pf-live-gold__stat-val--gold tabular">
            {holdingsGrams > 0 ? disp(`₹${fmtInr2(holdingsValueInr)}`) : '—'}
          </span>
        </div>
      </div>
    </section>
  )
}
