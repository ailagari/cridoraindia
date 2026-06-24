export type HoldingsScope = 'personal' | 'all'

export const PF_HOLDINGS_SCOPE_KEY = 'cridora_pf_holdings_scope'
const PF_HOLDINGS_JEWELLERY_ONLY_KEY = 'cridora_pf_holdings_jewellery_only'

export function loadHoldingsScopePref(): HoldingsScope {
  try {
    if (typeof window === 'undefined') return 'personal'
    const stored = localStorage.getItem(PF_HOLDINGS_SCOPE_KEY)
    if (stored === 'personal' || stored === 'all') return stored
    const legacy = localStorage.getItem(PF_HOLDINGS_JEWELLERY_ONLY_KEY)
    if (legacy === '1') return 'personal'
    if (legacy === '0') return 'all'
  } catch {
    /* private mode */
  }
  return 'personal'
}

export function persistHoldingsScope(scope: HoldingsScope): void {
  try {
    localStorage.setItem(PF_HOLDINGS_SCOPE_KEY, scope)
  } catch {
    /* private mode */
  }
}
