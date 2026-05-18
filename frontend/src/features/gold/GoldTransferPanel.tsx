import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GoldResolveRecipient, GoldWalletDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  fetchGoldWallet,
  resolveGoldUPI,
  sendGoldTransfer,
  vaultRowEstimatedInr,
  vaultRowTotalGrams,
} from '@/lib/goldTransferApi'

type Props = {
  roleLabel: string
}

function _vaultGramsPositive(s: string | undefined): boolean {
  if (s == null || String(s).trim() === '') return false
  const n = Number.parseFloat(String(s))
  return Number.isFinite(n) && n > 0
}

export function GoldTransferPanel({ roleLabel }: Props) {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [goldUpiInput, setGoldUpiInput] = useState('')
  const [recipient, setRecipient] = useState<GoldResolveRecipient | null>(null)
  const [routingKind, setRoutingKind] = useState<string>('')
  const [resolveErr, setResolveErr] = useState('')
  const [grams, setGrams] = useState('1.0')
  const [sendErr, setSendErr] = useState('')
  const [sendOk, setSendOk] = useState('')
  const [busy, setBusy] = useState(false)

  const refreshWallet = useCallback(async () => {
    setLoadErr('')
    const w = await fetchGoldWallet()
    if (!w) {
      setLoadErr('Could not load gold wallet.')
      setWallet(null)
      return
    }
    setWallet(w)
  }, [])

  useEffect(() => {
    void refreshWallet()
  }, [refreshWallet])

  useLivePoll(refreshWallet, LIVE_BALANCE_POLL_MS, true)

  const sendEligibleVaults = useMemo(() => {
    if (!wallet?.vaults?.length) return []
    return wallet.vaults.filter((v) => vaultRowTotalGrams(v) > 1e-9)
  }, [wallet])

  const [fromCustodianId, setFromCustodianId] = useState<number | null>(null)

  useEffect(() => {
    if (!wallet?.vaults?.length) {
      setFromCustodianId(null)
      return
    }
    const rows = wallet.vaults.filter((v) => vaultRowTotalGrams(v) > 1e-9)
    if (rows.length === 0) {
      setFromCustodianId(null)
      return
    }
    const def = wallet.default_jeweller_id
    const prefer = rows.find((r) => r.custodian_id === def) ?? rows[0]
    setFromCustodianId((prev) => {
      if (prev != null && rows.some((r) => r.custodian_id === prev)) return prev
      return prefer.custodian_id
    })
  }, [wallet])

  const isCustomer = roleLabel === 'customer'

  const onResolve = async () => {
    setResolveErr('')
    setRecipient(null)
    setRoutingKind('')
    setSendOk('')
    setBusy(true)
    try {
      const out = await resolveGoldUPI(goldUpiInput)
      if (!out.found) {
        setResolveErr(out.detail ?? `No account for ${out.gold_upi ?? goldUpiInput}`)
        return
      }
      if (out.recipient) {
        setRecipient(out.recipient)
        setGoldUpiInput(out.recipient.gold_upi || goldUpiInput)
        setRoutingKind(out.routing_kind ?? '')
      }
    } finally {
      setBusy(false)
    }
  }

  const onSend = async () => {
    setSendErr('')
    setSendOk('')
    if (!recipient) {
      setSendErr('Resolve a recipient first.')
      return
    }
    const upi = recipient.gold_upi || goldUpiInput.trim()
    setBusy(true)
    try {
      const fromId = isCustomer ? fromCustodianId : null
      const result = await sendGoldTransfer(upi, grams.trim(), fromId)
      if (!result.ok) {
        setSendErr(result.detail)
        return
      }
      setWallet(result.wallet)
      setSendOk(`${result.detail} Sent ${grams.trim()} g to ${upi}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        Send from one of your vaulted jewellers to a recipient&apos;s{' '}
        <strong className="tabular">handle.jewellercode@cridora</strong>, <strong className="tabular">handle@cridora</strong>{' '}
        (their primary vault), or <strong>handle@jewellercode</strong>. Customers must hold gold at the send-from
        jeweller. <span style={{ color: 'var(--text-faint)' }}>({roleLabel})</span>
      </p>

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {wallet ? (
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
              <p style={{ margin: '0.15rem 0 0', fontWeight: 800 }}>{wallet.cridora_member_id || '—'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Primary routing</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 700 }}>{wallet.cridora_global_id || '—'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Routing (GoldUPI)</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 800, color: 'var(--gold-light)' }}>{wallet.gold_upi || '—'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Balance</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 800 }} className="tabular">
                {wallet.balance_grams} g
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn--block"
              disabled={busy}
              onClick={() => void refreshWallet()}
            >
              Refresh balance
            </button>
            {isCustomer && sendEligibleVaults.length > 0 ? (
              <div className="field" style={{ marginTop: '0.65rem' }}>
                <label htmlFor="gold-transfer-from-vault">Send from vault (jeweller)</label>
                <select
                  id="gold-transfer-from-vault"
                  className="field-control"
                  value={fromCustodianId ?? ''}
                  onChange={(e) => setFromCustodianId(Number.parseInt(e.target.value, 10) || null)}
                  style={{ width: '100%', marginTop: 6 }}
                >
                  {sendEligibleVaults.map((v) => (
                    <option key={v.custodian_id} value={v.custodian_id}>
                      {v.custodian_label || `Jeweller ${v.custodian_id}`} · {vaultRowTotalGrams(v).toFixed(4)} g
                      {v.is_primary_custodian ? ' · primary' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {wallet.vaults && wallet.vaults.length > 0 ? (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Vaults</span>
                <ul style={{ margin: '0.35rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
                  {wallet.vaults.slice(0, 6).map((v, idx) => (
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
                          <span className="tabular">{v.vault_public_id}</span>
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
              value={goldUpiInput}
              onChange={(e) => setGoldUpiInput(e.target.value)}
              placeholder="rahul4821.goldhouse@cridora · rahul@cridora · user@jewellercode"
              autoComplete="off"
            />
          </div>
          <button type="button" className="btn btn-ghost btn--block" disabled={busy} onClick={() => void onResolve()}>
            Verify recipient
          </button>
          {resolveErr ? <p className="form-error">{resolveErr}</p> : null}
          {recipient ? (
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 8,
                border: '1px solid var(--border-soft)',
                background: 'var(--veil)',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{recipient.display_name}</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{recipient.gold_upi}</p>
              {routingKind ? (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                  Routing: {routingKind.replace(/_/g, ' ')}
                </p>
              ) : null}
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {recipient.user_type} · {recipient.jeweller_label}
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
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn--block"
            disabled={
              busy ||
              !recipient ||
              (isCustomer && (fromCustodianId == null || sendEligibleVaults.length === 0))
            }
            onClick={() => void onSend()}
          >
            Send gold
          </button>
          {sendErr ? <p className="form-error">{sendErr}</p> : null}
          {sendOk ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>{sendOk}</p> : null}
        </div>
      </div>
    </div>
  )
}
