import { useEffect, useState } from 'react'
import { fetchGoldTicker, type GoldTickerPayload } from '@/lib/marketplaceApi'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

type Props = {
  variant?: 'public' | 'dash'
}

export function GoldTickerStrip({ variant = 'public' }: Props) {
  const [data, setData] = useState<GoldTickerPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      void fetchGoldTicker().then((payload) => {
        if (!cancelled) {
          setData(payload)
        }
      })
    }
    load()
    const id = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const finalPerGram = data ? Number.parseFloat(data.platform_base_inr_per_gram_22k) : NaN

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
          Live 22K
        </span>
        <span className="tabular" style={{ color: 'var(--text)', fontWeight: 700 }}>
          {Number.isFinite(finalPerGram) ? `₹${formatInr(finalPerGram, 2)}/g` : '—'}
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
          Live 22K · BIS 916
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          <strong className="tabular" style={{ color: 'var(--success)', fontSize: '0.95rem' }}>
            ₹{Number.isFinite(finalPerGram) ? formatInr(finalPerGram, 2) : '—'}
          </strong>
          /g
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-faint)' }}>
          Updates every minute · indicative benchmark
        </span>
      </div>
    </div>
  )
}
