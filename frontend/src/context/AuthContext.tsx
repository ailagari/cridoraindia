import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  apiFetch,
  authFetch,
  clearTokens,
  getStoredAccess,
  storeTokens,
} from '@/lib/api'
import { claimPushSubscriptionForLoggedInUser } from '@/lib/webPushApi'

export type UserType = 'customer' | 'jeweller' | 'admin'

export type AuthUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  user_type: UserType
  kyc_status: string
  business_name: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  registerCustomer: (payload: Record<string, string>) => Promise<AuthUser>
  registerJeweller: (payload: Record<string, string>) => Promise<AuthUser>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function extractApiMessage(data: Record<string, unknown>, fallback: string): string {
  const d = data.detail
  if (typeof d === 'string' && d) return d
  const parts: string[] = []
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length > 0) parts.push(String(v[0]))
    else if (typeof v === 'string' && v) parts.push(v)
  }
  return parts.join(' ') || fallback
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('cridora_user')
  if (!raw) return null
  try {
    const u = JSON.parse(raw) as AuthUser
    return {
      ...u,
      business_name: typeof u.business_name === 'string' ? u.business_name : '',
    }
  } catch {
    return null
  }
}

function saveUser(u: AuthUser) {
  localStorage.setItem('cridora_user', JSON.stringify(u))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getStoredAccess()
    const cached = readStoredUser()
    if (token && cached) {
      setUser(cached)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user || !getStoredAccess()) return
    void claimPushSubscriptionForLoggedInUser()
  }, [loading, user])

  const persistSession = useCallback((data: Record<string, unknown>) => {
    const access = String(data.access ?? '')
    const refresh = String(data.refresh ?? '')
    storeTokens(access, refresh)
    const u: AuthUser = {
      id: Number(data.user_id),
      email: String(data.email),
      first_name: String(data.first_name ?? ''),
      last_name: String(data.last_name ?? ''),
      user_type: data.user_type as UserType,
      kyc_status: String(data.kyc_status ?? 'pending'),
      business_name: typeof data.business_name === 'string' ? data.business_name : '',
    }
    saveUser(u)
    setUser(u)
    return u
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch('/api/v1/auth/login/', {
        method: 'POST',
        jsonBody: { email, password },
      })
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      if (!res.ok) {
        const msg = extractApiMessage(data, 'Sign in failed')
        throw new Error(msg)
      }
      return persistSession(data)
    },
    [persistSession],
  )

  const registerCustomer = useCallback(
    async (payload: Record<string, string>) => {
      const res = await apiFetch('/api/v1/auth/register/', {
        method: 'POST',
        jsonBody: payload,
      })
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      if (!res.ok) {
        throw new Error(extractApiMessage(data, 'Registration failed'))
      }
      return persistSession(data)
    },
    [persistSession],
  )

  const registerJeweller = useCallback(
    async (payload: Record<string, string>) => {
      const res = await apiFetch('/api/v1/auth/jeweller/apply/', {
        method: 'POST',
        jsonBody: payload,
      })
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >
      if (!res.ok) {
        throw new Error(extractApiMessage(data, 'Application failed'))
      }
      return persistSession(data)
    },
    [persistSession],
  )

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')
    const access = getStoredAccess()
    if (refresh && access) {
      await apiFetch('/api/v1/auth/logout/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}` },
        jsonBody: { refresh },
      }).catch(() => undefined)
    }
    clearTokens()
    setUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!getStoredAccess()) return
    const res = await authFetch('/api/v1/auth/me/')
    if (!res.ok) return
    const data = (await res.json()) as Record<string, unknown>
    const u: AuthUser = {
      id: Number(data.id),
      email: String(data.email),
      first_name: String(data.first_name ?? ''),
      last_name: String(data.last_name ?? ''),
      user_type: data.user_type as UserType,
      kyc_status: String(data.kyc_status ?? 'pending'),
      business_name: typeof data.business_name === 'string' ? data.business_name : '',
    }
    saveUser(u)
    setUser(u)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      registerCustomer,
      registerJeweller,
      logout,
      refreshProfile,
    }),
    [
      user,
      loading,
      login,
      registerCustomer,
      registerJeweller,
      logout,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
