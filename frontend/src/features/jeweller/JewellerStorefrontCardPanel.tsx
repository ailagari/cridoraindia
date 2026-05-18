import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'
import { authFetch, authUpload } from '@/lib/api'
import { LIVE_MARKETPLACE_EDITOR_POLL_MS } from '@/lib/liveDeskIntervals'
import { numOrZero, parseN } from '@/features/marketplace/jewellerMarketplaceShared'
import { useLivePoll } from '@/lib/useLivePoll'

type ProfileApi = Record<string, unknown>

export function JewellerStorefrontCardPanel() {
  const logoInputRef = useRef<HTMLInputElement>(null)
  /** Avoid clobbering in-progress edits when marketplace profile is polled every few seconds. */
  const storefrontDraftDirtyRef = useRef(false)

  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [logoBusy, setLogoBusy] = useState(false)

  const [cardDraft, setCardDraft] = useState({
    logo_url: '',
    credibility_score: '',
    minimum_redeemable_grams: '',
    same_store_mc_benefit: '',
    metric_active_users: '0',
    metric_total_redeemed_gold_grams: '0',
    metric_years_active: '0',
    feat_instant_redemption: false,
    feat_zero_mc_same_store: false,
    feat_loan_available: false,
    feat_goldnest_available: false,
    feat_emergency_funds: false,
  })

  const commitCardDraft = useCallback((updater: SetStateAction<typeof cardDraft>) => {
    storefrontDraftDirtyRef.current = true
    setCardDraft(updater)
  }, [])

  const flashSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg)
    setFormError('')
  }, [])

  useEffect(() => {
    if (!successMsg) return
    const t = window.setTimeout(() => setSuccessMsg(''), 6000)
    return () => window.clearTimeout(t)
  }, [successMsg])

  const refreshProfile = useCallback(async () => {
    setLoadError('')
    const pr = await authFetch('/api/v1/jeweller/marketplace/profile/')
    if (!pr.ok) {
      const j = await pr.json().catch(() => ({}))
      setLoadError((j as { detail?: string }).detail ?? 'Could not load marketplace profile.')
      return
    }
    const pJson = (await pr.json()) as ProfileApi
    if (storefrontDraftDirtyRef.current) {
      return
    }
    setCardDraft({
      logo_url: String(pJson.logo_url ?? ''),
      credibility_score:
        pJson.credibility_score != null && String(pJson.credibility_score) !== ''
          ? String(pJson.credibility_score)
          : '',
      minimum_redeemable_grams:
        pJson.minimum_redeemable_grams != null && String(pJson.minimum_redeemable_grams) !== ''
          ? String(pJson.minimum_redeemable_grams)
          : '',
      same_store_mc_benefit: String(pJson.same_store_mc_benefit ?? ''),
      metric_active_users: String(pJson.metric_active_users ?? '0'),
      metric_total_redeemed_gold_grams: String(pJson.metric_total_redeemed_gold_grams ?? '0'),
      metric_years_active: String(pJson.metric_years_active ?? '0'),
      feat_instant_redemption: Boolean(pJson.feat_instant_redemption),
      feat_zero_mc_same_store: Boolean(pJson.feat_zero_mc_same_store),
      feat_loan_available: Boolean(pJson.feat_loan_available),
      feat_goldnest_available: Boolean(pJson.feat_goldnest_available),
      feat_emergency_funds: Boolean(pJson.feat_emergency_funds),
    })
  }, [])

  useEffect(() => {
    void refreshProfile()
  }, [refreshProfile])

  useLivePoll(refreshProfile, LIVE_MARKETPLACE_EDITOR_POLL_MS, true)

  const uploadLogo = async (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setSuccessMsg('')
      setFormError('Logo must be JPEG, PNG, or WebP.')
      return
    }
    const maxBytes = 2 * 1024 * 1024
    if (file.size > maxBytes) {
      setSuccessMsg('')
      setFormError('Logo must be 2 MB or smaller.')
      return
    }
    setLogoBusy(true)
    setFormError('')
    const fd = new FormData()
    fd.append('file', file)
    let res: Response
    try {
      res = await authUpload('/api/v1/jeweller/marketplace/logo/', fd)
    } catch {
      setSuccessMsg('')
      setFormError('Not signed in or upload failed to start.')
      setLogoBusy(false)
      return
    }
    setLogoBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSuccessMsg('')
      setFormError(JSON.stringify(j))
      return
    }
    const body = (await res.json()) as { logo_url?: string }
    if (body.logo_url) {
      setCardDraft((p) => ({ ...p, logo_url: body.logo_url ?? p.logo_url }))
    }
    await refreshProfile()
    flashSuccess('Logo uploaded.')
  }

  const saveShopCard = async () => {
    setBusy(true)
    setFormError('')
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/', {
      method: 'PATCH',
      jsonBody: {
        logo_url: cardDraft.logo_url.trim(),
        minimum_redeemable_grams:
          cardDraft.minimum_redeemable_grams.trim() === ''
            ? null
            : numOrZero(cardDraft.minimum_redeemable_grams),
        same_store_mc_benefit: cardDraft.same_store_mc_benefit.trim(),
        metric_active_users: Math.max(0, Math.floor(parseN(cardDraft.metric_active_users))),
        metric_total_redeemed_gold_grams: numOrZero(cardDraft.metric_total_redeemed_gold_grams),
        metric_years_active: numOrZero(cardDraft.metric_years_active),
        feat_instant_redemption: cardDraft.feat_instant_redemption,
        feat_zero_mc_same_store: cardDraft.feat_zero_mc_same_store,
        feat_loan_available: cardDraft.feat_loan_available,
        feat_goldnest_available: cardDraft.feat_goldnest_available,
        feat_emergency_funds: cardDraft.feat_emergency_funds,
      },
    })
    setBusy(false)
    if (!res.ok) {
      setSuccessMsg('')
      const j = await res.json().catch(() => ({}))
      setFormError(JSON.stringify(j))
      return
    }
    storefrontDraftDirtyRef.current = false
    await refreshProfile()
    flashSuccess('Shop card saved.')
  }

  const disableActions = busy || logoBusy

  return (
    <div className="jeweller-mkt" style={{ marginBottom: '1.75rem' }}>
      <p className="dash-panel-lead" style={{ marginTop: 0 }}>
        Public shop card — logo, redemption headline, optional metrics, and highlight badges. This is what shoppers see on{' '}
        <strong>jeweller directory pages</strong> after KYB approval. Product SKUs stay under{' '}
        <Link to="/dashboard/jeweller?section=mkt_products">Marketplace · Catalogue SKU</Link>.
      </p>

      {loadError ? <p className="form-error">{loadError}</p> : null}

      <details className="jeweller-mkt-acc card" open>
        <summary>Shop card &amp; highlights</summary>
        <div className="jeweller-mkt-acc__body">
          <table className="admin-user-table jeweller-mkt-card-table">
            <tbody>
              <tr>
                <th scope="row">Logo</th>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                    {cardDraft.logo_url.trim() !== '' ? (
                      <img
                        src={cardDraft.logo_url.trim()}
                        alt=""
                        style={{
                          width: 96,
                          height: 96,
                          objectFit: 'contain',
                          borderRadius: 12,
                          border: '1px solid var(--border-soft)',
                          background: 'var(--veil)',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No logo yet</span>
                    )}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={disableActions}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (f) void uploadLogo(f)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={disableActions}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoBusy ? 'Uploading…' : 'Upload image'}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                    JPEG, PNG, or WebP · max 2 MB. Or paste a hosted URL below.
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Logo URL</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      value={cardDraft.logo_url}
                      onChange={(e) => commitCardDraft((p) => ({ ...p, logo_url: e.target.value }))}
                      placeholder="Set automatically after upload, or paste https://…"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Credibility score</th>
                <td style={{ fontWeight: 700 }}>
                  {cardDraft.credibility_score.trim() === ''
                    ? 'Not set — assigned by Cridora admin'
                    : `${cardDraft.credibility_score.trim()} / 100 (admin only)`}
                </td>
              </tr>
              <tr>
                <th scope="row">Minimum redeemable (g)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="decimal"
                      value={cardDraft.minimum_redeemable_grams}
                      onChange={(e) => commitCardDraft((p) => ({ ...p, minimum_redeemable_grams: e.target.value }))}
                      placeholder="e.g. 0.25"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Same-store making benefit</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      value={cardDraft.same_store_mc_benefit}
                      onChange={(e) => commitCardDraft((p) => ({ ...p, same_store_mc_benefit: e.target.value }))}
                      placeholder="e.g. 0% MC same store"
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Active users (display)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="numeric"
                      value={cardDraft.metric_active_users}
                      onChange={(e) => commitCardDraft((p) => ({ ...p, metric_active_users: e.target.value }))}
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Total redeemed gold (g)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="decimal"
                      value={cardDraft.metric_total_redeemed_gold_grams}
                      onChange={(e) =>
                        commitCardDraft((p) => ({ ...p, metric_total_redeemed_gold_grams: e.target.value }))
                      }
                    />
                  </label>
                </td>
              </tr>
              <tr>
                <th scope="row">Years active (display)</th>
                <td>
                  <label className="field" style={{ margin: 0 }}>
                    <input
                      inputMode="decimal"
                      value={cardDraft.metric_years_active}
                      onChange={(e) => commitCardDraft((p) => ({ ...p, metric_years_active: e.target.value }))}
                    />
                  </label>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="jeweller-mkt-feature-tags">
            <div className="jeweller-mkt-feature-tags__head">
              <h3 className="jeweller-mkt-feature-tags__title">Shop highlights</h3>
              <p className="jeweller-mkt-feature-tags__hint">
                Toggle the badges shoppers see on your card. Only enable what you actively offer.
              </p>
            </div>
            <div className="jeweller-mkt-feature-tags__grid" role="group" aria-label="Shop highlight badges">
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_instant_redemption}
                  onChange={(e) => commitCardDraft((p) => ({ ...p, feat_instant_redemption: e.target.checked }))}
                />
                <span>
                  Instant redemption
                  <small>Fast redemption pathway where your process supports it.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_zero_mc_same_store}
                  onChange={(e) => commitCardDraft((p) => ({ ...p, feat_zero_mc_same_store: e.target.checked }))}
                />
                <span>
                  0% MC (same store)
                  <small>No making charge when customers redeem with you in-store.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_loan_available}
                  onChange={(e) => commitCardDraft((p) => ({ ...p, feat_loan_available: e.target.checked }))}
                />
                <span>
                  Loan available
                  <small>Gold-backed or partner lending you disclose.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_goldnest_available}
                  onChange={(e) => commitCardDraft((p) => ({ ...p, feat_goldnest_available: e.target.checked }))}
                />
                <span>
                  GoldNest
                  <small>Vault / fractional savings programme you participate in.</small>
                </span>
              </label>
              <label className="jeweller-mkt-feature-tag">
                <input
                  type="checkbox"
                  checked={cardDraft.feat_emergency_funds}
                  onChange={(e) => commitCardDraft((p) => ({ ...p, feat_emergency_funds: e.target.checked }))}
                />
                <span>
                  Emergency funds
                  <small>Liquidity or advance options you disclose to verified customers.</small>
                </span>
              </label>
            </div>
          </div>

          <FormSubmitFoot error={formError} success={successMsg} className="form-submit-foot--spaced">
            <button type="button" className="btn btn-primary" disabled={disableActions} onClick={() => void saveShopCard()}>
              {busy ? 'Saving…' : 'Save shop card'}
            </button>
          </FormSubmitFoot>
        </div>
      </details>
    </div>
  )
}
