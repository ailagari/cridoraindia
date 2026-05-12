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

export type UserType = 'customer' | 'jeweller' | 'admin'

export type AuthUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  user_type: UserType
  kyc_status: string
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

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('cridora_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
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
        const em = data.email
        const pw = data.password
        const msg =
          (Array.isArray(em) ? String(em[0]) : em != null ? String(em) : '') ||
          (Array.isArray(pw) ? String(pw[0]) : pw != null ? String(pw) : '') ||
          (data.detail != null ? String(data.detail) : '') ||
          'Sign in failed'
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
        const em = data.email
        const msg =
          (Array.isArray(em) ? String(em[0]) : em != null ? String(em) : '') ||
          (data.detail != null ? String(data.detail) : '') ||
          'Registration failed'
        throw new Error(msg)
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
        const em = data.email
        const msg =
          (Array.isArray(em) ? String(em[0]) : em != null ? String(em) : '') ||
          (data.detail != null ? String(data.detail) : '') ||
          'Application failed'
        throw new Error(msg)
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
