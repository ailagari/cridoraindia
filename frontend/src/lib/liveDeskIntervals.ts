/** Spot / ticker / Cridora base — snappy but sustainable on Hobby-tier hosting. */
export const LIVE_PRICE_POLL_MS = 3000

/** Wallet, transfers, fractional orders & verify queues */
export const LIVE_BALANCE_POLL_MS = 4000

/** Jeweller marketplace editor (products + ticker snapshot) */
export const LIVE_MARKETPLACE_EDITOR_POLL_MS = 5000

/** Full product catalog refresh (heavier payload — keep slower) */
export const LIVE_CATALOG_POLL_MS = 7000

/** Storefront jeweller grid refresh */
export const LIVE_STOREFRONT_GRID_POLL_MS = 8000

/** Admin ticker & fees panel snapshot while idle */
export const LIVE_ADMIN_TICKER_POLL_MS = 4000

/** Admin overview & moderation lists */
export const LIVE_ADMIN_POLL_MS = 6000

/** Dashboard profile / auth me refreshes */
export const LIVE_PROFILE_POLL_MS = 8000

/** KYC / KYB document & bank status */
export const LIVE_KYC_POLL_MS = 45000

/** Verified jewellers list for marketplace filters */
export const LIVE_DIRECTORY_POLL_MS = 60000
