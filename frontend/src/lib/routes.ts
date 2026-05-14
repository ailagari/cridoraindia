import type { AuthUser } from '@/context/AuthContext'

/** In-app dashboards (SPA); marketing site uses PublicLayout. */
export function isDashboardPath(pathname: string): boolean {
  return pathname.startsWith('/dashboard/') || pathname.startsWith('/userdashboard')
}

export function userDashboardPath(user: AuthUser): string {
  switch (user.user_type) {
    case 'customer':
      return '/userdashboard'
    case 'jeweller':
      return '/dashboard/jeweller'
    case 'admin':
      return '/dashboard/admin'
    default:
      return '/'
  }
}

/** After login or “open dashboard”: surface KYC/KYB until the account is verified. */
export function dashboardLandingPath(user: AuthUser): string {
  const base = userDashboardPath(user)
  if (user.user_type === 'customer' && user.kyc_status !== 'verified') {
    return `${base}?section=profile_kyc`
  }
  if (user.user_type === 'jeweller' && user.kyc_status !== 'verified') {
    return `${base}?section=prof_kyb`
  }
  return base
}
