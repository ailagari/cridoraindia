import { useCallback, useEffect, useState } from 'react'
import type { GoldResolveRecipient, GoldWalletDTO } from '@/lib/goldTransferApi'
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
        GoldUPI transfers ({roleLabel}) — resolve <strong>username@jewellercode</strong>, confirm the recipient, then
        send grams from your vault balance.
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
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>Cridora ID</span>
              <p style={{ margin: '0.15rem 0 0', fontWeight: 800 }}>{wallet.cridora_member_id || '—'}</p>
            </div>
            <div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 800 }}>GoldUPI</span>
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
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: '1rem', maxWidth: 520 }}>
        <div className="dash-form-stack">
          <div className="field">
            <label htmlFor="gold-transfer-recipient-upi">Recipient GoldUPI</label>
            <input
              id="gold-transfer-recipient-upi"
              value={goldUpiInput}
              onChange={(e) => setGoldUpiInput(e.target.value)}
              placeholder="democustomer@demogold"
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
