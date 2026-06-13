import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchVerifiedJewellers, type JewellerStorefrontDTO } from '@/lib/marketplaceApi'
import {
  canPromoteJewellerToPrimary,
  fetchGoldWallet,
  patchDefaultJeweller,
  vaultRowTotalGrams,
  type GoldWalletDTO,
} from '@/lib/goldTransferApi'
import { jewellerOptionLabel } from '@/features/invest/fractionalJewellerSelect'
import { LIVE_BALANCE_POLL_MS } from '@/lib/liveDeskIntervals'
import { useLivePoll } from '@/lib/useLivePoll'
import { Button } from '@/components/ui'

type JewellerLabel = {
  id: number
  business_name: string
  city: string
  state: string
}

function resolveJewellerLabel(id: number, jewellers: JewellerStorefrontDTO[], wallet: GoldWalletDTO): string {
  const fromDir = jewellers.find((j) => j.id === id)
  if (fromDir) return jewellerOptionLabel(fromDir)
  const fromVault = wallet.vaults?.find((v) => v.custodian_id === id)
  if (fromVault?.custodian_label?.trim()) return fromVault.custodian_label.trim()
  return `Jeweller #${id}`
}

export function CustomerDefaultJewellerPanel({
  onWalletChange,
}: {
  onWalletChange?: (wallet: GoldWalletDTO) => void
}) {
  const [wallet, setWallet] = useState<GoldWalletDTO | null>(null)
  const [jewellers, setJewellers] = useState<JewellerStorefrontDTO[]>([])
  const [loadErr, setLoadErr] = useState('')
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setLoadErr('')
    const [w, list] = await Promise.all([fetchGoldWallet(), fetchVerifiedJewellers()])
    if (!w) {
      setLoadErr('Could not load your jeweller preferences.')
      setWallet(null)
      return
    }
    setWallet(w)
    onWalletChange?.(w)
    setJewellers(list.filter((j) => j.id > 0))
  }, [onWalletChange])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useLivePoll(refresh, LIVE_BALANCE_POLL_MS, true)

  const primaryId = wallet?.default_jeweller_id ?? null
  const secondaryIds = wallet?.secondary_jeweller_ids ?? []

  const primaryLabel = useMemo(() => {
    if (!wallet || primaryId == null) return null
    return resolveJewellerLabel(primaryId, jewellers, wallet)
  }, [jewellers, primaryId, wallet])

  const secondaryRows = useMemo((): JewellerLabel[] => {
    if (!wallet) return []
    return secondaryIds.map((id) => {
      const fromDir = jewellers.find((j) => j.id === id)
      if (fromDir) {
        return {
          id,
          business_name: fromDir.business_name,
          city: fromDir.city,
          state: fromDir.state,
        }
      }
      const vault = wallet.vaults?.find((v) => v.custodian_id === id)
      return {
        id,
        business_name: vault?.custodian_label?.trim() || `Jeweller #${id}`,
        city: '',
        state: '',
      }
    })
  }, [jewellers, secondaryIds, wallet])

  const onMakePrimary = useCallback(
    async (jewellerId: number) => {
      setActionMsg('')
      setActionErr('')
      const gate = canPromoteJewellerToPrimary(wallet, jewellerId)
      if (!gate.allowed) {
        setActionErr(gate.reason ?? 'Cannot set this jeweller as primary.')
        return
      }
      setBusyId(jewellerId)
      try {
        const out = await patchDefaultJeweller(jewellerId)
        if (!out.ok) {
          setActionErr(out.detail)
          return
        }
        setWallet(out.wallet)
        onWalletChange?.(out.wallet)
        setActionMsg('Primary jeweller updated. New transfers and routing use this partner by default.')
      } finally {
        setBusyId(null)
      }
    },
    [onWalletChange, wallet],
  )

  if (loadErr) {
    return <p className="form-error">{loadErr}</p>
  }

  if (!wallet) {
    return (
      <div className="card" style={{ padding: '1.25rem', borderRadius: 18, marginBottom: '1.25rem' }}>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading jeweller preferences…</p>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '1.25rem', borderRadius: 18, marginBottom: '1.25rem' }}>
      <h3 className="pf-card__title" style={{ fontSize: '1rem', marginTop: 0 }}>
        Primary jeweller
      </h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        Your <strong>primary</strong> jeweller is set at signup when you enter a referral code. Fractional buys, gold
        transfers, and marketplace benefits default to this partner. Jewellers where you hold vault balances appear as{' '}
        <strong>secondary</strong> until you promote one to primary.
      </p>

      {primaryId == null ? (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 14,
            border: '1px dashed var(--border-soft)',
            background: 'var(--veil)',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>No primary jeweller yet</p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Search below and tap <strong>Set as primary</strong> on any verified jeweller to choose your default partner.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderRadius: 14,
            border: '1px solid var(--gold-border)',
            background: 'var(--gold-bg)',
            marginBottom: secondaryRows.length > 0 ? '1rem' : 0,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--gold-lo)' }}>
              PRIMARY
            </p>
            <p style={{ margin: '0.2rem 0 0', fontWeight: 700 }}>{primaryLabel}</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ID <span className="tabular">{primaryId}</span>
            </p>
          </div>
          <Link to={`/userdashboard?section=invest_fractional&jeweller_id=${primaryId}`} className="btn btn-primary btn-sm">
            Buy gold here
          </Link>
        </div>
      )}

      {secondaryRows.length > 0 ? (
        <div>
          <p style={{ margin: '0 0 0.65rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
            SECONDARY PARTNERS
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.65rem' }}>
            {secondaryRows.map((row) => {
              const vaultRow = wallet.vaults?.find((v) => v.custodian_id === row.id)
              const grams = vaultRow ? vaultRowTotalGrams(vaultRow) : 0
              return (
                <li
                  key={row.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 12,
                    border: '1px solid var(--border-soft)',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{jewellerOptionLabel(row)}</p>
                    {grams > 1e-9 ? (
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span className="tabular">{grams.toFixed(4)}</span> g vaulted
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="btn-sm"
                    loading={busyId === row.id}
                    disabled={busyId != null && busyId !== row.id}
                    onClick={() => void onMakePrimary(row.id)}
                  >
                    Make primary
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {actionMsg ? (
        <p style={{ margin: '1rem 0 0', fontSize: '0.85rem', color: 'var(--success)' }}>{actionMsg}</p>
      ) : null}
      {actionErr ? (
        <p className="form-error" style={{ marginTop: '1rem' }}>
          {actionErr}
        </p>
      ) : null}
    </div>
  )
}
