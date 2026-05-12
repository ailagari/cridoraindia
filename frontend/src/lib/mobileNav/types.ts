export type DashboardNavItem = {
  sectionKey: string
  label: string
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
