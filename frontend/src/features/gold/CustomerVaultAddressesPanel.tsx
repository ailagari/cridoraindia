import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useAuth } from '@/context/AuthContext'
import {
  fetchGoldWallet,
  vaultRowTotalGrams,
  type GoldWalletDTO,
  type VaultRowDTO,
} from '@/lib/goldTransferApi'
import { formatVaultCardDisplay, vaultCardCopyValue } from '@/lib/vaultRoutingDisplay'

function QrBlock({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState('')
  const [copyMsg, setCopyMsg] = useState('')
  const copyValue = vaultCardCopyValue(value)
  const displayValue = formatVaultCardDisplay(value)

  useEffect(() => {
    if (!copyValue) {
      setSrc('')
      return
    }
    let cancelled = false
    void QRCode.toDataURL(copyValue, { margin: 1, width: 168, errorCorrectionLevel: 'M' }).then(
      (u) => {
        if (!cancelled) setSrc(u)
      },
    )
    return () => {
      cancelled = true
    }
  }, [copyValue])

  const onCopy = useCallback(async () => {
    if (!copyValue) return
    try {
      await navigator.clipboard.writeText(copyValue)
      setCopyMsg('Copied')
      window.setTimeout(() => setCopyMsg(''), 2000)
    } catch {
      setCopyMsg('Copy failed')
      window.setTimeout(() => setCopyMsg(''), 2000)
    }
  }, [copyValue])

  if (!copyValue) {
    return (
      <div style={{ padding: '0.5rem 0' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label} — not available yet.</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
      {src ? (
        <img
          src={src}
          alt=""
          width={168}
          height={168}
          style={{ borderRadius: 12, border: '1px solid var(--border-soft)', background: '#fff' }}
        />
      ) : (
        <div
          style={{
            width: 168,
            height: 168,
            borderRadius: 12,
            background: 'var(--veil)',
            border: '1px dashed var(--border-soft)',
          }}
        />
      )}
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <p style={{ margin: '0 0 0.35rem', fontSize: '0.65rem', color: 'var(--text-faint)', fontWeight: 700 }}>
          {label}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.82rem',
            wordBreak: 'break-all',
            color: 'var(--text)',
          }}
        >
          {displayValue}
          <span style={{ display: 'block', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-faint)' }}>
            {copyValue}
          </span>
        </p>
        <button type="button" className="btn btn-ghost" style={{ marginTop: '0.5rem' }} onClick={() => void onCopy()}>
          Copy ID
        </button>
        {copyMsg ? (
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{copyMsg}</span>
        ) : null}
      </div>
    </div>
  )
}

function vaultRowSubtitle(v: VaultRowDTO): string {
  const g = vaultRowTotalGrams(v)
  const parts = [`${g.toFixed(4)} g vaulted`]
  if (v.is_primary_custodian) parts.push('primary')
  return parts.join(' · ')
}

export function CustomerVaultAddressesPanel() {
  const { user } = useAuth()
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [loadErr, setLoadErr] = useState('')

  const refresh = useCallback(async () => {
    setLoadErr('')
    const w = await fetchGoldWallet()
    if (!w) {
      setLoadErr('Could not load wallet.')
      setWallet(null)
      return
    }
    setWallet(w)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const kycOk = user?.kyc_status === 'verified'
  const primaryGlobal = (wallet?.cridora_global_id ?? '').trim()

  return (
    <div className="dash-panel-max">
      <p className="dash-panel-lead">
        <strong>Vault card IDs</strong> — each jeweller vault gets a random 10-digit number (like a card). Your{' '}
        <em>primary</em> card routes gifts to your default jeweller when senders omit a specific vault. Share the QR or
        copy the full ID (digits + <strong className="tabular">@cridora</strong>). IDs are not guessable from your name
        or jeweller.
      </p>

      {!kycOk ? (
        <p className="form-error" role="alert">
          Complete KYC to use verified routing IDs in production.
        </p>
      ) : null}

      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {wallet ? (
        <div className="card" style={{ padding: '1.25rem', borderRadius: 20, marginBottom: '1rem' }}>
          <h3 className="pf-card__title" style={{ fontSize: '1rem', marginTop: 0 }}>
            Member reference
          </h3>
          <p style={{ margin: '0 0 0.25rem', fontWeight: 800 }} className="tabular">
            {wallet.cridora_member_id || '—'}
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Optional on labels; routing uses your Cridora handle IDs below.
          </p>
        </div>
      ) : null}

      {wallet ? (
        <div className="card" style={{ padding: '1.25rem', borderRadius: 20, marginBottom: '1rem' }}>
          <h3 className="pf-card__title" style={{ fontSize: '1rem', marginTop: 0 }}>
            Primary (default jeweller) routing
          </h3>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Gold sent to this ID lands in your vault with{' '}
            <strong>{wallet.vaults?.find((v) => v.is_primary_custodian)?.custodian_label ?? 'your primary jeweller'}</strong>
            . Set primary under jeweller preferences when you have multiple vaults.
          </p>
          <QrBlock value={primaryGlobal} label="Primary vault card" />
        </div>
      ) : null}

      {wallet?.vaults && wallet.vaults.length > 0 ? (
        <div className="card" style={{ padding: '1.25rem', borderRadius: 20 }}>
          <h3 className="pf-card__title" style={{ fontSize: '1rem', marginTop: 0 }}>
            Per-jeweller vault IDs
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '1.25rem' }}>
            {wallet.vaults.map((v) => (
              <li
                key={v.custodian_id}
                style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-soft)' }}
              >
                <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>
                  {v.custodian_label || `Jeweller #${v.custodian_id}`}
                  <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.85rem' }}>
                    {vaultRowSubtitle(v)}
                  </span>
                </p>
                <QrBlock
                  value={v.vault_public_id}
                  label={v.vault_public_id ? 'Jeweller vault card' : 'Vault card pending'}
                />
                {!v.vault_public_id ? (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Cards are issued automatically when your vault opens at this jeweller.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : wallet ? (
        <p style={{ color: 'var(--text-muted)' }}>No vault rows yet — buy gold or receive a transfer to open a vault.</p>
      ) : null}

      <button type="button" className="btn btn-ghost" style={{ marginTop: '1rem' }} onClick={() => void refresh()}>
        Refresh
      </button>
    </div>
  )
}
