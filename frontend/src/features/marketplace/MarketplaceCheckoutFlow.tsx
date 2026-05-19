import { useCallback, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { formatInr } from '@/features/marketplace/productPricing'
import type { PriceBreakdown } from '@/lib/marketplacePricing'
import type { MarketplaceProductDTO } from '@/lib/marketplaceApi'
import {
  confirmVaultRedemptionPurchase,
  fetchVaultRedemptionQuote,
  type CashPaymentMethod,
  type VaultRedemptionQuoteDTO,
  type VaultRedemptionResultDTO,
} from '@/lib/vaultRedemptionPurchaseApi'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'

export type MarketplaceCheckoutReceipt = {
  product: MarketplaceProductDTO
  breakdown: PriceBreakdown
  vaultGrams: number
  quote: VaultRedemptionQuoteDTO
  redemption: VaultRedemptionResultDTO
}

const CASH_OPTIONS: { id: CashPaymentMethod; label: string; hint: string }[] = [
  { id: 'counter_cash', label: 'Cash at showroom', hint: 'Pay the jeweller in cash when you collect the piece.' },
  { id: 'counter_upi', label: 'UPI at counter', hint: 'Scan the jeweller’s UPI QR at pickup (demo — no live payment link).' },
  { id: 'card_demo', label: 'Card / netbanking (demo)', hint: 'Placeholder — production will integrate a payment gateway.' },
]

function parseG(s: string): number {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function MarketplaceCheckoutReceiptCard({
  receipt,
  onDone,
}: {
  receipt: MarketplaceCheckoutReceipt
  onDone: () => void
}) {
  const { breakdown: p, quote, redemption } = receipt
  const grams = parseG(redemption.grams_charged)
  const cash = parseG(redemption.cash_paid_inr)
  const gstSaved = parseG(redemption.gst_on_gold_saved_inr)

  return (
    <div className="card marketplace-checkout-receipt" style={{ padding: '1.5rem', borderRadius: 22 }}>
      <p
        style={{
          margin: '0 0 0.35rem',
          fontSize: '0.65rem',
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--success)',
        }}
      >
        Order confirmed
      </p>
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>{redemption.reference}</h2>
      <p style={{ margin: '0 0 1.25rem', color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
        {redemption.product_name} · {redemption.jeweller_name}. Show this bill at the showroom to collect your piece.
      </p>

      <div
        style={{
          padding: '1rem',
          borderRadius: 14,
          border: '1px solid var(--border-soft)',
          background: 'var(--veil-35)',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}
      >
        <BillRow label="Order total" value={`₹${formatInr(parseG(redemption.final_invoice_inr))}`} strong />
        {grams > 0 ? (
          <>
            <BillRow label="Grams debited from vault" value={`${grams.toFixed(3)} g`} />
            {p.gramsCreditedOnBill > 0 && Math.abs(p.gramsCreditedOnBill - grams) > 0.001 ? (
              <BillRow label="Credited on bill (vault rate)" value={`${p.gramsCreditedOnBill.toFixed(3)} g`} muted />
            ) : null}
          </>
        ) : null}
        {cash > 0 ? (
          <BillRow
            label="Paid in cash / UPI"
            value={`₹${formatInr(cash)}${redemption.cash_payment_method ? ` · ${redemption.cash_payment_method.replace(/_/g, ' ')}` : ''}`}
          />
        ) : null}
        {gstSaved > 0 ? (
          <BillRow label="Vault saved you (GST on gold)" value={`₹${formatInr(gstSaved)}`} muted />
        ) : null}
        <BillRow label="Gold metal (line)" value={`₹${formatInr(p.goldValue)}`} muted />
        <BillRow label="Making (after 5% off)" value={`₹${formatInr(p.makingCharges)}`} muted />
        <BillRow
          label={gstSaved > 0 ? 'GST on gold (after vault relief)' : 'GST on gold'}
          value={`₹${formatInr(p.gstOnGold)}`}
          muted
        />
        <BillRow label="GST on making" value={`₹${formatInr(p.gstOnMaking)}`} muted />
        {p.crossPlatformFee > 0 ? (
          <BillRow label="Cridora platform fee" value={`₹${formatInr(p.crossPlatformFee)}`} muted />
        ) : null}
      </div>

      <p className="form-footnote" style={{ marginTop: '1rem', fontSize: '0.72rem' }}>
        Metal rate: ₹{formatInr(parseG(quote.metal_rate_inr_per_gram), 2)}/g · Stock was reserved on confirm.
      </p>

      <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem' }} onClick={onDone}>
        Back to catalogue
      </button>
    </div>
  )
}

function BillRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text)' }}>{label}</span>
      <span
        className="tabular"
        style={{ fontWeight: strong ? 800 : muted ? 600 : 700, color: 'var(--text)' }}
      >
        {value}
      </span>
    </div>
  )
}

export function MarketplaceCashPayPage({
  amountInr,
  jewellerName,
  productLabel,
  vaultNote,
  onBack,
  onPaid,
  busy,
  error,
}: {
  amountInr: number
  jewellerName: string
  productLabel: string
  vaultNote?: ReactNode
  onBack: () => void
  onPaid: (method: CashPaymentMethod) => void
  busy: boolean
  error: string
}) {
  return (
    <div className="container page" style={{ paddingBottom: '4rem' }}>
      <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1.25rem' }}>
        ← Back to checkout
      </button>
      <h1 className="h1-page">Complete payment</h1>
      <p className="lead lead-tight" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
        {productLabel} · {jewellerName}
      </p>
      {vaultNote ? (
        <div
          className="card"
          style={{
            padding: '1rem 1.15rem',
            borderRadius: 16,
            marginBottom: '1.25rem',
            maxWidth: 520,
            fontSize: '0.85rem',
            border: '1px solid var(--border-soft)',
            background: 'var(--veil-35)',
          }}
        >
          {vaultNote}
        </div>
      ) : null}
      <div style={{ maxWidth: 520 }}>
        <MarketplaceCashPayStep
          amountInr={amountInr}
          jewellerName={jewellerName}
          onBack={onBack}
          onPaid={onPaid}
          busy={busy}
          error={error}
        />
      </div>
    </div>
  )
}

export function MarketplaceCashPayStep({
  amountInr,
  jewellerName,
  onBack,
  onPaid,
  busy,
  error,
}: {
  amountInr: number
  jewellerName: string
  onBack: () => void
  onPaid: (method: CashPaymentMethod) => void
  busy: boolean
  error: string
}) {
  const [method, setMethod] = useState<CashPaymentMethod | null>(null)

  return (
    <div className="card" style={{ padding: '1.35rem', borderRadius: 22 }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Pay remaining balance</h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Pay <strong className="tabular">₹{formatInr(amountInr)}</strong> to {jewellerName} using one of the options below,
        then confirm. Any vault grams you selected are debited when you complete this step.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
        {CASH_OPTIONS.map((opt) => (
          <label
            key={opt.id}
            style={{
              display: 'flex',
              gap: '0.65rem',
              alignItems: 'flex-start',
              padding: '0.75rem',
              borderRadius: 14,
              border: method === opt.id ? '2px solid var(--gold)' : '1px solid var(--border-soft)',
              background: method === opt.id ? 'var(--gold-shine-12)' : 'var(--veil-35)',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="cash-pay-method"
              checked={method === opt.id}
              onChange={() => setMethod(opt.id)}
              style={{ marginTop: 3 }}
            />
            <span style={{ fontSize: '0.88rem' }}>
              <strong>{opt.label}</strong>
              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                {opt.hint}
              </span>
            </span>
          </label>
        ))}
      </div>

      <FormSubmitFoot error={error} className="form-submit-foot--spaced">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || method == null}
          onClick={() => method != null && onPaid(method)}
        >
          {busy ? 'Confirming…' : `I paid ₹${formatInr(amountInr)} — complete order`}
        </button>
      </FormSubmitFoot>
    </div>
  )
}

export function useMarketplaceOrderConfirm({
  product,
  vaultGrams,
  payMode,
  breakdown,
  onSuccess,
}: {
  product: MarketplaceProductDTO
  vaultGrams: number
  payMode: 'cash' | 'vault'
  breakdown: PriceBreakdown
  onSuccess: (receipt: MarketplaceCheckoutReceipt) => void
}) {
  const { user, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const gramsToSend = payMode === 'vault' ? vaultGrams : 0

  const runConfirm = useCallback(
    async (cashPaymentMethod: CashPaymentMethod | '') => {
      setError('')
      if (product.id < 1) {
        setError(
          'This is a demo catalogue item. Checkout only works for real SKUs published by a verified jeweller.',
        )
        return
      }
      const listingRate = Number.parseFloat(product.metal_rate_inr_per_gram_used)
      if (!Number.isFinite(listingRate) || listingRate <= 0) {
        setError('This listing has no metal ₹/g. Ask the jeweller to set pricing on the SKU.')
        return
      }
      if (breakdown.finalAmount <= 0 && gramsToSend <= 0) {
        setError('Order total is ₹0 — check gold weight and making charges on this listing.')
        return
      }
      if (user?.kyc_status !== 'verified') {
        setError('Complete KYC before checkout.')
        return
      }
      setBusy(true)
      try {
        const q = await fetchVaultRedemptionQuote(product.id, gramsToSend)
        if (!q.ok) {
          setError(q.detail)
          return
        }
        const quote = q.data
        if (gramsToSend > 0 && !quote.sufficient_vault) {
          setError('Not enough vaulted gold with this jeweller.')
          return
        }
        const cashDue = parseG(quote.cash_payable_inr)
        if (cashDue > 0 && !cashPaymentMethod) {
          setError('Choose how you paid the cash balance.')
          return
        }

        const out = await confirmVaultRedemptionPurchase(product.id, {
          vaultGrams: gramsToSend,
          expected: {
            final_invoice_inr: quote.final_invoice_inr,
            cash_payable_inr: quote.cash_payable_inr,
            grams_charged: quote.grams_required,
          },
          cashPaymentMethod: cashPaymentMethod || undefined,
        })
        if (!out.ok) {
          setError(out.detail)
          return
        }
        void refreshProfile()
        onSuccess({
          product,
          breakdown,
          vaultGrams: gramsToSend,
          quote,
          redemption: out.redemption,
        })
      } finally {
        setBusy(false)
      }
    },
    [breakdown, gramsToSend, onSuccess, product, refreshProfile, user?.kyc_status],
  )

  return { busy, error, setError, runConfirm }
}
