import { Link } from 'react-router-dom'
import { FormSubmitFoot } from '@/components/ui/FormSubmitFoot'
import { formatInrPerGram, liveInrPerGramForPurity, spotRefForPurity } from '@/features/jeweller/catalogPuritySpot'
import { useJewellerSellingPurities } from '@/features/jeweller/useJewellerSellingPurities'

export function JewellerSellingPuritiesPanel() {
  const {
    catalogMeta,
    catalogLoading,
    spot,
    purityDraftIds,
    selectedPurities,
    saveBusy,
    error,
    success,
    togglePurityDraft,
    savePurities,
  } = useJewellerSellingPurities()

  const spotNote = spot?.note?.trim() || 'Indicative live market INR/g — same feed as the dashboard ticker.'

  return (
    <section className="card jeweller-selling-purities" style={{ marginBottom: '1.75rem', padding: '1.25rem' }}>
      <span className="pill">Storefront metals</span>
      <h2 className="dash-panel-title" style={{ marginTop: '0.5rem' }}>
        Selling purities &amp; live rates
      </h2>
      <p className="dash-panel-lead" style={{ marginBottom: '1rem' }}>
        Choose the gold and silver fineness you actually sell. These drive your{' '}
        <Link to="/dashboard/jeweller?section=mkt_products">catalogue SKU</Link> purity dropdown and the live ₹/g board
        shown here. Platform defaults cover common India hallmarks; admins can add more in Django admin.
      </p>

      {catalogLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading purity catalogue…</p>
      ) : !catalogMeta || catalogMeta.metal_purities.length === 0 ? (
        <p className="form-error" role="status">
          No active purities in the catalogue. Ask Cridora admin to run migrations or add rows under Marketplace → Metal
          purities in Django admin.
        </p>
      ) : (
        <>
          <div className="jeweller-selling-purities__checks" role="group" aria-label="Selling purities">
            {catalogMeta.metal_purities.map((m) => (
              <label key={m.id} className="jeweller-selling-purities__check">
                <input
                  type="checkbox"
                  checked={purityDraftIds.includes(m.id)}
                  disabled={saveBusy}
                  onChange={(e) => togglePurityDraft(m.id, e.target.checked)}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          <FormSubmitFoot error={error} success={success} className="jeweller-selling-purities__actions">
            <button type="button" className="btn btn-primary" disabled={saveBusy} onClick={() => void savePurities()}>
              {saveBusy ? 'Saving…' : 'Save selling purities'}
            </button>
          </FormSubmitFoot>

          {selectedPurities.length > 0 ? (
            <div className="jeweller-selling-purities__rates">
              <h3 className="jeweller-selling-purities__rates-title">Live ticker (your selection)</h3>
              <p className="jeweller-selling-purities__rates-hint">{spotNote}</p>
              <table className="admin-user-table jeweller-selling-purities__table">
                <thead>
                  <tr>
                    <th scope="col">Purity</th>
                    <th scope="col">Ticker</th>
                    <th scope="col">₹ / g</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurities.map((m) => {
                    const ref = spotRefForPurity(m)
                    const inr = liveInrPerGramForPurity(m, spot)
                    return (
                      <tr key={m.id}>
                        <td>{m.label}</td>
                        <td>
                          {ref.family === 'silver' ? 'Silver' : 'Gold'} · {ref.key}
                        </td>
                        <td className="tabular">{inr != null ? `₹${formatInrPerGram(inr)}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ marginTop: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Select at least one purity and save to see matching live rates.
            </p>
          )}
        </>
      )}
    </section>
  )
}
