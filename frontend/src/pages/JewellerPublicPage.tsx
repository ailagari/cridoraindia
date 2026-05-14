import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchJewellerStorefront, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import { useLiveCridoraBase } from '@/hooks/useLiveCridoraBase'

function formatInr(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: fractionDigits })
}

function parseNum(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function JewellerPublicPage() {
  const { id } = useParams<{ id: string }>()
  const numericId = id ? Number.parseInt(id, 10) : NaN
  const [row, setRow] = useState<JewellerStorefrontDTO | null>(null)
  const [error, setError] = useState('')
  const { data: liveBase } = useLiveCridoraBase()

  useEffect(() => {
    if (!Number.isFinite(numericId)) {
      setError('Invalid jeweller.')
      return
    }
    let cancel = false
    setError('')
    void fetchJewellerStorefront(numericId).then((data) => {
      if (cancel) return
      if (!data) {
        setError('This jeweller is not available on the public directory (KYB must be verified).')
        setRow(null)
        return
      }
      setRow(data)
    })
    return () => {
      cancel = true
    }
  }, [numericId])

  if (error || !Number.isFinite(numericId)) {
    return (
      <div className="container page" style={{ paddingBottom: '4rem' }}>
        <p className="form-error">{error || 'Invalid link.'}</p>
        <p>
          <Link to="/jewellers" className="btn btn-ghost">
            ← Jeweller marketplace
          </Link>
        </p>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="container page" style={{ paddingBottom: '4rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading storefront…</p>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <section
        style={{
          padding: '2.75rem 0',
          background: 'var(--gradient-hero-band)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <div className="container">
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em' }}>
            <Link to="/jewellers" style={{ color: 'var(--gold-light)', textDecoration: 'none' }}>
              ← Directory
            </Link>
          </p>
          <span className="pill">KYB-verified partner</span>
          <h1 className="h1-page" style={{ marginTop: '0.75rem' }}>
            {row.business_name}
          </h1>
          <p className="lead lead-tight" style={{ color: 'var(--text-muted)' }}>
            {row.shop_address ? `${row.shop_address} · ` : ''}
            {row.city}
            {row.state ? `, ${row.state}` : ''}
            {row.gstin ? ` · GST ${row.gstin}` : ''}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem' }}>
            <Link to={`/marketplace?jeweller=${row.id}`} className="btn btn-primary">
              Browse approved products
            </Link>
            <Link to="/marketplace" className="btn btn-ghost">
              Full product marketplace
            </Link>
          </div>
        </div>
      </section>

      <div className="container" style={{ marginTop: '2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}
        >
          <div className="card" style={{ padding: '1rem', borderRadius: 20 }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text-faint)', fontWeight: 800 }}>Cridora 22K (live)</p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }} className="tabular">
              ₹{liveBase?.platformBaseInrPerGram22k ? formatInr(parseNum(liveBase.platformBaseInrPerGram22k), 2) : '—'}/g
            </p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {liveBase?.source ? liveBase.source.replace(/_/g, ' ') : '—'} · jeweller reference ₹
              {formatInr(parseNum(row.reference_metal_inr_per_gram), 2)}/g
            </p>
          </div>
          <div className="card" style={{ padding: '1rem', borderRadius: 20 }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text-faint)', fontWeight: 800 }}>Typical making</p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '1.2rem', fontWeight: 800 }} className="tabular">
              ₹{formatInr(parseNum(row.representative_making_charge_inr_per_gram), 0)}/g
            </p>
          </div>
          <div className="card" style={{ padding: '1rem', borderRadius: 20 }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text-faint)', fontWeight: 800 }}>Indicative buyback</p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '1.2rem', fontWeight: 800, color: 'var(--gold-light)' }} className="tabular">
              ₹{formatInr(parseNum(row.buyback_indicative_inr_per_gram), 2)}/g
            </p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Reference metal (default markup) ₹{formatInr(parseNum(row.reference_metal_inr_per_gram), 2)}/g · deductions{' '}
              {formatInr(parseNum(row.sellback_deduction_percent), 2)}% + ₹
              {formatInr(parseNum(row.sellback_fixed_inr_per_gram), 2)}/g
            </p>
          </div>
          <div className="card" style={{ padding: '1rem', borderRadius: 20 }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text-faint)', fontWeight: 800 }}>Gold deposit yield</p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '1.2rem', fontWeight: 800 }} className="tabular">
              {formatInr(parseNum(row.gold_deposit_yield_apr_percent), 2)}% APR
            </p>
          </div>
          <div className="card" style={{ padding: '1rem', borderRadius: 20 }}>
            <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--text-faint)', fontWeight: 800 }}>Gold loan (disclosed)</p>
            <p style={{ margin: '0.35rem 0 0', fontSize: '1.2rem', fontWeight: 800 }} className="tabular">
              {formatInr(parseNum(row.gold_loan_interest_apr_percent), 2)}% APR
            </p>
          </div>
        </div>

        {row.gold_deposit_note ? (
          <div className="card" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: 20 }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Gold deposit & vault notes</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
              {row.gold_deposit_note}
            </p>
          </div>
        ) : null}

        <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {row.approved_listing_count} approved listing{row.approved_listing_count === 1 ? '' : 's'} on the product marketplace.
        </p>
      </div>
    </div>
  )
}
