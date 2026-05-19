import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GoldTransferMobileFlow } from '@/features/gold/GoldTransferMobileFlow'
import { useGoldTransfer } from '@/features/gold/useGoldTransfer'
import { usePublicLayoutMax767 } from '@/hooks/usePublicLayoutMax767'
import {
  vaultRowEstimatedInr,
  vaultRowTotalGrams,
} from '@/lib/goldTransferApi'
import { formatVaultCardDisplay } from '@/lib/vaultRoutingDisplay'

type Props = {
  roleLabel: string
}

function _vaultGramsPositive(s: string | undefined): boolean {
  if (s == null || String(s).trim() === '') return false
  const n = Number.parseFloat(String(s))
  return Number.isFinite(n) && n > 0
}

function GoldTransferDesktopPanel({ roleLabel }: Props) {
  const transfer = useGoldTransfer({ roleLabel })

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Send from one of your vaulted jewellers to a recipient&apos;s{' '}
        <strong className="tabular">10-digit vault card</strong> (
        <strong className="tabular">1234567890@cridora</strong>) or legacy{' '}
        <strong>handle@jewellercode</strong>. Customers must hold gold at the send-from jeweller.{' '}
        <span style={{ color: 'var(--text-faint)' }}>({roleLabel})</span>
      </p>

      {transfer.loadErr ? <p className="form-error">{transfer.loadErr}</p> : null}

      {transfer.wallet ? (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            maxWidth: 520,
          }}
        >
          <div className="dash-form-stack">
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Member reference</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 800 }}>{transfer.wallet.cridora_member_id || '—'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Your primary vault card</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 700 }} className="tabular">
                {transfer.wallet.cridora_global_id ? formatVaultCardDisplay(transfer.wallet.cridora_global_id) : '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Routing (GoldUPI)</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 800, color: 'var(--gold-light)' }}>
                {transfer.wallet.gold_upi || '—'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Balance</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 800 }} className="tabular">
                {transfer.wallet.balance_grams} g
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={transfer.busy}
              onClick={() => void transfer.refreshWallet()}
            >
              Refresh balance
            </button>
            {transfer.isCustomer && transfer.sendEligibleVaults.length > 0 ? (
              <div className="field" style={{ marginTop: '0.65rem' }}>
                <label htmlFor="gold-transfer-from-vault">Send from vault (jeweller)</label>
                <select
                  id="gold-transfer-from-vault"
                  className="field-control"
                  value={transfer.fromCustodianId ?? ''}
                  onChange={(e) => transfer.setFromCustodianId(Number.parseInt(e.target.value, 10) || null)}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  {transfer.sendEligibleVaults.map((v) => (
                    <option key={v.custodian_id} value={v.custodian_id}>
                      {v.custodian_label || `Jeweller ${v.custodian_id}`} · {vaultRowTotalGrams(v).toFixed(4)} g
                      {v.is_primary_custodian ? ' · primary' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {transfer.wallet.vaults && transfer.wallet.vaults.length > 0 ? (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Vaults</span>
                <ul style={{ margin: '0.35rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
                  {transfer.wallet.vaults.slice(0, 6).map((v, idx) => (
                    <li
                      key={`${v.vault_public_id ?? 'vault'}-${v.custodian_id}-${idx}`}
                      style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                    >
                      <span style={{ color: 'var(--text)' }} className="tabular">
                        {vaultRowTotalGrams(v).toFixed(6)} g
                      </span>{' '}
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.72em' }}>vault total</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', marginTop: 2, color: 'var(--text-faint)' }}>
                        Fr {v.fractional_grams} g
                        {_vaultGramsPositive(v.deposit_grams) ? ` · Dep ${v.deposit_grams} g` : ''}
                        {_vaultGramsPositive(v.golden_scheme_grams) ? ` · Scheme ${v.golden_scheme_grams} g` : ''}
                      </span>
                      {v.jeweller_metal_rate_inr_per_gram ? (
                        <>
                          {' '}
                          · ~₹
                          {vaultRowEstimatedInr(v).toLocaleString('en-IN', {
                            maximumFractionDigits: 0,
                          })}{' '}
                          @ ₹{Number.parseFloat(v.jeweller_metal_rate_inr_per_gram).toLocaleString('en-IN', {
                            maximumFractionDigits: 2,
                          })}
                          /g
                        </>
                      ) : null}
                      {v.vault_public_id ? (
                        <>
                          {' · '}
                          <span className="tabular">{formatVaultCardDisplay(v.vault_public_id)}</span>
                        </>
                      ) : null}
                      {v.custodian_label ? ` · ${v.custodian_label}` : null}
                      {v.jeweller_metal_rate_last_updated_at ? (
                        <span style={{ display: 'block', fontSize: '0.68rem', opacity: 0.92, marginTop: 2 }}>
                          Jeweller rate ref.{' '}
                          {new Date(v.jeweller_metal_rate_last_updated_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: '1rem', maxWidth: 520 }}>
        <div className="dash-form-stack">
          <div className="field">
            <label htmlFor="gold-transfer-recipient-upi">Recipient handle</label>
            <input
              id="gold-transfer-recipient-upi"
              value={transfer.goldUpiInput}
              onChange={(e) => transfer.setGoldUpiInput(e.target.value)}
              placeholder="8472910536@cridora or user@jewellercode"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn--block"
            disabled={transfer.busy}
            onClick={() => void transfer.onResolve()}
          >
            Verify recipient
          </button>
          {transfer.resolveErr ? <p className="form-error">{transfer.resolveErr}</p> : null}
          {transfer.recipient ? (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border-soft)',
                background: 'var(--veil)',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{transfer.recipient.display_name}</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }} className="tabular">
                {formatVaultCardDisplay(transfer.recipient.gold_upi)}
              </p>
              {transfer.routingKind ? (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                  Routing: {transfer.routingKind.replace(/_/g, ' ')}
                </p>
              ) : null}
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {transfer.recipient.user_type} · {transfer.recipient.jeweller_label}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <div className="dash-form-stack">
          <div className="field">
            <label htmlFor="gold-transfer-grams">Grams to send</label>
            <input
              id="gold-transfer-grams"
              value={transfer.grams}
              onChange={(e) => transfer.setGrams(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={!transfer.canSend}
            onClick={() => void transfer.onSend()}
          >
            Send gold
          </button>
          {transfer.sendErr ? <p className="form-error">{transfer.sendErr}</p> : null}
          {transfer.sendOk ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>{transfer.sendOk}</p> : null}
        </div>
      </div>
    </div>
  )
}

export function GoldTransferPanel({ roleLabel }: Props) {
  const narrow = usePublicLayoutMax767()
  const [params] = useSearchParams()

  const initialMode = useMemo(() => {
    const mode = params.get('transferMode')
    return mode === 'enter' ? 'enter' : 'scan'
  }, [params])

  const receiveQrPath = useMemo(() => {
    if (roleLabel === 'customer') return '/userdashboard?section=profile_qr'
    return undefined
  }, [roleLabel])

  if (narrow) {
    return (
      <GoldTransferMobileFlow
        roleLabel={roleLabel}
        initialMode={initialMode}
        receiveQrPath={receiveQrPath}
      />
    )
  }

  return <GoldTransferDesktopPanel roleLabel={roleLabel} />
}
