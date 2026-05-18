import { useCallback, useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api'
import { LIVE_PRICE_POLL_MS } from '@/lib/liveDeskIntervals'
import {
  fetchMarketplaceCatalogMeta,
  fetchSpotPrices,
  type CatalogMetalPurityDTO,
  type MarketplaceCatalogMetaDTO,
  type SpotPricesPayload,
} from '@/lib/marketplaceApi'
import { useLivePoll } from '@/lib/useLivePoll'
import { default916PurityId } from '@/features/jeweller/catalogPuritySpot'

export function useJewellerSellingPurities() {
  const [catalogMeta, setCatalogMeta] = useState<MarketplaceCatalogMetaDTO | null>(null)
  const [spot, setSpot] = useState<SpotPricesPayload | null>(null)
  const [profileMetalIds, setProfileMetalIds] = useState<number[]>([])
  const [purityDraftIds, setPurityDraftIds] = useState<number[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [saveBusy, setSaveBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    const m = await fetchMarketplaceCatalogMeta()
    setCatalogMeta(m)
    setCatalogLoading(false)
    return m
  }, [])

  const loadSpot = useCallback(async () => {
    const s = await fetchSpotPrices()
    setSpot(s)
    return s
  }, [])

  const refreshProfileMetals = useCallback(async (meta?: MarketplaceCatalogMetaDTO | null) => {
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/')
    if (!res.ok) return
    const j = (await res.json()) as { metal_purities_offered?: { id: number }[] }
    const ids = (j.metal_purities_offered ?? []).map((x) => x.id)
    setProfileMetalIds(ids)
    const cat = meta ?? catalogMeta
    const defaultId = cat ? default916PurityId(cat.metal_purities) : null
    if (ids.length > 0) {
      setPurityDraftIds(ids)
    } else if (defaultId != null) {
      setPurityDraftIds([defaultId])
    }
  }, [catalogMeta])

  useEffect(() => {
    void (async () => {
      const m = await loadCatalog()
      await loadSpot()
      const res = await authFetch('/api/v1/jeweller/marketplace/profile/')
      if (res.ok) {
        const j = (await res.json()) as { metal_purities_offered?: { id: number }[] }
        const ids = (j.metal_purities_offered ?? []).map((x) => x.id)
        setProfileMetalIds(ids)
        const defaultId = m ? default916PurityId(m.metal_purities) : null
        if (ids.length > 0) setPurityDraftIds(ids)
        else if (defaultId != null) setPurityDraftIds([defaultId])
      }
    })()
  }, [loadCatalog, loadSpot])

  useLivePoll(() => void loadSpot(), LIVE_PRICE_POLL_MS, true)

  useEffect(() => {
    if (!success) return
    const t = window.setTimeout(() => setSuccess(''), 6000)
    return () => window.clearTimeout(t)
  }, [success])

  const skuMetalOptions: CatalogMetalPurityDTO[] = useMemo(() => {
    if (!catalogMeta) return []
    const metals = catalogMeta.metal_purities
    if (profileMetalIds.length > 0) {
      const allow = new Set(profileMetalIds)
      return metals.filter((m) => allow.has(m.id))
    }
    const defaultId = default916PurityId(metals)
    if (defaultId == null) return []
    return metals.filter((m) => m.id === defaultId)
  }, [catalogMeta, profileMetalIds])

  const togglePurityDraft = useCallback((id: number, checked: boolean) => {
    setPurityDraftIds((prev) => {
      if (checked) return [...new Set([...prev, id])].sort((a, b) => a - b)
      return prev.filter((x) => x !== id)
    })
  }, [])

  const savePurities = useCallback(async (): Promise<boolean> => {
    if (purityDraftIds.length === 0) {
      setError('Select at least one purity you sell.')
      setSuccess('')
      return false
    }
    setSaveBusy(true)
    setError('')
    const res = await authFetch('/api/v1/jeweller/marketplace/profile/', {
      method: 'PATCH',
      jsonBody: { metal_purity_ids: purityDraftIds },
    })
    setSaveBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSuccess('')
      setError(typeof j === 'object' && j && 'detail' in j ? String((j as { detail?: string }).detail) : 'Could not save.')
      return false
    }
    await refreshProfileMetals()
    setSuccess('Selling purities saved. Live ticker rates below match your selection.')
    window.dispatchEvent(new CustomEvent('jeweller-selling-purities-saved'))
    return true
  }, [purityDraftIds, refreshProfileMetals])

  const selectedPurities = useMemo(() => {
    if (!catalogMeta) return []
    const allow = new Set(purityDraftIds)
    return catalogMeta.metal_purities.filter((m) => allow.has(m.id))
  }, [catalogMeta, purityDraftIds])

  return {
    catalogMeta,
    catalogLoading,
    spot,
    profileMetalIds,
    purityDraftIds,
    skuMetalOptions,
    selectedPurities,
    saveBusy,
    error,
    success,
    setError,
    setSuccess,
    togglePurityDraft,
    savePurities,
    refreshProfileMetals,
    reloadCatalog: loadCatalog,
  }
}
