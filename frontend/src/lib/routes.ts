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
