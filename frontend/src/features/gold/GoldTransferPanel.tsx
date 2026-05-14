import { useCallback, useEffect, useState } from 'react'
import type { GoldResolveRecipient, GoldWalletDTO } from '@/lib/goldTransferApi'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import {
  fetchGoldWallet,
  resolveGoldUPI,
  sendGoldTransfer,
} from '@/lib/goldTransferApi'

type Props = {
  roleLabel: string
}

export function GoldTransferPanel({ roleLabel }: Props) {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [goldUpiInput, setGoldUpiInput] = useState('')
  const [recipient, setRecipient] = useState<GoldResolveRecipient | null>(null)
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

  const onResolve = async () => {
    setResolveErr('')
    setRecipient(null)
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
      const result = await sendGoldTransfer(upi, grams.trim())
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
        Transfer grams using a vault ID (<strong>handle.jewellercode@cridora</strong>) or legacy{' '}
        <strong>username@jewellercode</strong>.{' '}
        <span style={{ color: 'var(--text-faint)' }}>({roleLabel})</span>
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
            {wallet.cridora_global_id ? (
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Global handle</span>
                <p style={{ margin: '0.15rem 0 0', fontWeight: 700 }}>{wallet.cridora_global_id}</p>
              </div>
            ) : null}
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
            {wallet.vaults && wallet.vaults.length > 0 ? (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Vaults</span>
                <ul style={{ margin: '0.35rem 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: '0.35rem' }}>
                  {wallet.vaults.slice(0, 6).map((v) => (
                    <li key={`${v.vault_public_id}-${v.custodian_id}`} style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text)' }}>{v.fractional_grams} g</span>
                      {v.vault_public_id ? (
                        <>
                          {' · '}
                          <span className="tabular">{v.vault_public_id}</span>
                        </>
                      ) : null}
                      {v.custodian_label ? ` · ${v.custodian_label}` : null}
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
              placeholder="rahul4821.goldhouse@cridora or user@jewellercode"
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
          <button type="button" className="btn btn-primary btn--block" disabled={busy || !recipient} onClick={() => void onSend()}>
            Send gold
          </button>
          {sendErr ? <p className="form-error">{sendErr}</p> : null}
          {sendOk ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>{sendOk}</p> : null}
        </div>
      </div>
    </div>
  )
}
