export type DashboardNavItem = {
  sectionKey: string
  label: string
  /** Review-queue count (e.g. admin KYC/KYB). Shown when greater than zero. */
  badge?: number
}

export type DashboardNavGroup = {
  id: string
  label: string
  shortLabel: string
  icon:
    | 'home'
    | 'shop'
    | 'invest'
    | 'portfolio'
    | 'redeem'
    | 'profile'
    | 'grid'
    | 'users'
    | 'building'
    | 'coins'
    | 'globe'
    | 'bell'
    | 'shield'
  items: DashboardNavItem[]
}
