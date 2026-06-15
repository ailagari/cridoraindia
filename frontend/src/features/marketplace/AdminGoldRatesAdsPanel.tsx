import { useCallback, useEffect, useState } from 'react'
import { GOLD_CALCULATOR_AD_SLOT_SPECS } from '@/features/goldRates/goldCalculatorAdSpecs'
import { GOLD_RATES_AD_SLOT_SPECS } from '@/features/goldRates/goldRatesAdSpecs'
import {
  AdminGoldPageAdsSection,
  countActivePlacements,
  pageUsesAdsense,
} from '@/features/marketplace/AdminGoldPageAdsSection'
import {
  fetchAdminGoldCalculatorConfig,
  fetchAdminGoldRatesConfig,
  patchAdminGoldCalculatorConfig,
  patchAdminGoldRatesConfig,
  uploadAdminGoldCalculatorAdImage,
  uploadAdminGoldCalculatorAdVideo,
  uploadAdminGoldRatesAdImage,
  uploadAdminGoldRatesAdVideo,
  type AdminGoldCalculatorPageConfigPayload,
  type AdminGoldRatesPageConfigPayload,
  type GoldRatesAdPlacementDTO,
} from '@/lib/marketplaceApi'

const RATES_SLOT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(GOLD_RATES_AD_SLOT_SPECS).map(([slot, spec]) => [slot, spec.label]),
)

const CALC_SLOT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(GOLD_CALCULATOR_AD_SLOT_SPECS).map(([slot, spec]) => [slot, spec.label]),
)

function normalizePlacements(placements: GoldRatesAdPlacementDTO[]) {
  return placements.map((p) => ({
    ...p,
    mode:
      p.mode === 'adsense'
        ? ('adsense' as const)
        : p.mode === 'manual'
          ? ('manual' as const)
          : ('media' as const),
    image_link_url: p.image_link_url ?? p.video_link_url ?? '',
    video_link_url: p.video_link_url ?? p.image_link_url ?? '',
  }))
}

type OpenPage = 'rates' | 'calc' | null

export function AdminGoldRatesAdsPanel() {
  const [ratesCfg, setRatesCfg] = useState<AdminGoldRatesPageConfigPayload | null>(null)
  const [calcCfg, setCalcCfg] = useState<AdminGoldCalculatorPageConfigPayload | null>(null)
  const [ratesSaving, setRatesSaving] = useState(false)
  const [calcSaving, setCalcSaving] = useState(false)
  const [ratesMsg, setRatesMsg] = useState<string | null>(null)
  const [calcMsg, setCalcMsg] = useState<string | null>(null)
  const [openPage, setOpenPage] = useState<OpenPage>('rates')

  const togglePage = (page: Exclude<OpenPage, null>) => {
    setOpenPage((current) => (current === page ? null : page))
  }

  const load = useCallback(async () => {
    const [rates, calc] = await Promise.all([fetchAdminGoldRatesConfig(), fetchAdminGoldCalculatorConfig()])
    setRatesCfg(rates)
    setCalcCfg(calc)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveRates = async () => {
    if (!ratesCfg) return
    setRatesSaving(true)
    setRatesMsg(null)
    const placements = normalizePlacements(ratesCfg.placements)
    const adsense_enabled = placements.some((p) => p.mode === 'adsense') || ratesCfg.adsense_enabled
    try {
      const saved = await patchAdminGoldRatesConfig({
        adsense_enabled,
        adsense_client_id: ratesCfg.adsense_client_id,
        page_title: ratesCfg.page_title,
        page_description: ratesCfg.page_description,
        placements,
      })
      if (saved) {
        setRatesCfg(saved)
        setRatesMsg('Saved.')
      } else {
        setRatesMsg('Save failed.')
      }
    } finally {
      setRatesSaving(false)
    }
  }

  const saveCalc = async () => {
    if (!calcCfg) return
    setCalcSaving(true)
    setCalcMsg(null)
    const placements = normalizePlacements(calcCfg.placements)
    const adsense_enabled = placements.some((p) => p.mode === 'adsense') || calcCfg.adsense_enabled
    try {
      const saved = await patchAdminGoldCalculatorConfig({
        adsense_enabled,
        adsense_client_id: calcCfg.adsense_client_id,
        page_title: calcCfg.page_title,
        page_description: calcCfg.page_description,
        placements,
      })
      if (saved) {
        setCalcCfg(saved)
        setCalcMsg('Saved.')
      } else {
        setCalcMsg('Save failed.')
      }
    } finally {
      setCalcSaving(false)
    }
  }

  const loading = !ratesCfg || !calcCfg

  return (
    <div className="admin-panel-stack">
      <header>
        <h2 className="admin-panel-title">Public gold pages & ads</h2>
        <p className="admin-panel-lead">
          Manage SEO and advertisement slots for the Kerala gold rates page and the gold jewellery calculator.
        </p>
      </header>

      <section className="admin-card admin-ads-overview">
        <h3>Pages overview</h3>
        <div className="admin-ads-slots-table-wrap">
          <table className="admin-ads-slots-table admin-ads-overview-table">
            <thead>
              <tr>
                <th scope="col">Page</th>
                <th scope="col">Active slots</th>
                <th scope="col">AdSense</th>
                <th scope="col">Public link</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Gold rates (Kerala)</strong>
                  <span className="admin-ads-slots-table__slot-id">/gold-rates/kerala</span>
                </td>
                <td>{countActivePlacements(ratesCfg)}</td>
                <td>{pageUsesAdsense(ratesCfg) ? 'Yes' : 'No'}</td>
                <td>
                  <a href="/gold-rates/kerala" target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Gold calculator</strong>
                  <span className="admin-ads-slots-table__slot-id">/gold-calculator</span>
                </td>
                <td>{countActivePlacements(calcCfg)}</td>
                <td>{pageUsesAdsense(calcCfg) ? 'Yes' : 'No'}</td>
                <td>
                  <a href="/gold-calculator" target="_blank" rel="noreferrer">
                    Open ↗
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {loading ? (
        <p className="text-muted">Loading gold page settings…</p>
      ) : (
        <>
          <details className="admin-ads-page-accordion" open={openPage === 'rates'}>
            <summary onClick={(e) => { e.preventDefault(); togglePage('rates') }}>
              <span className="admin-ads-page-accordion__title">Gold rates page</span>
              <span className="admin-ads-page-accordion__meta">
                {countActivePlacements(ratesCfg)} active ·{' '}
                <a href="/gold-rates/kerala" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  View page ↗
                </a>
              </span>
            </summary>
            <AdminGoldPageAdsSection
              cfg={ratesCfg}
              slotSpecs={GOLD_RATES_AD_SLOT_SPECS}
              slotLabels={RATES_SLOT_LABELS}
              onCfgChange={setRatesCfg}
              onSave={saveRates}
              saving={ratesSaving}
              saveMsg={ratesMsg}
              uploadFns={{
                uploadImage: uploadAdminGoldRatesAdImage,
                uploadVideo: uploadAdminGoldRatesAdVideo,
              }}
            />
          </details>

          <details className="admin-ads-page-accordion" open={openPage === 'calc'}>
            <summary onClick={(e) => { e.preventDefault(); togglePage('calc') }}>
              <span className="admin-ads-page-accordion__title">Gold calculator page</span>
              <span className="admin-ads-page-accordion__meta">
                {countActivePlacements(calcCfg)} active ·{' '}
                <a href="/gold-calculator" target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  View page ↗
                </a>
              </span>
            </summary>
            <AdminGoldPageAdsSection
              cfg={calcCfg}
              slotSpecs={GOLD_CALCULATOR_AD_SLOT_SPECS}
              slotLabels={CALC_SLOT_LABELS}
              onCfgChange={setCalcCfg}
              onSave={saveCalc}
              saving={calcSaving}
              saveMsg={calcMsg}
              uploadFns={{
                uploadImage: uploadAdminGoldCalculatorAdImage,
                uploadVideo: uploadAdminGoldCalculatorAdVideo,
              }}
            />
          </details>
        </>
      )}
    </div>
  )
}
