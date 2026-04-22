'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode
} from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { superAdminService } from '@/services/superAdmin.service'

interface User {
  _id: string
  name: string
  email: string
  role: string
  permissions: string[]
  companyId: any
  /** Populated when present — operating tenant for SUPER_ADMIN. */
  activeCompanyId?: { _id: string; name: string; city?: string; currency?: string } | string | null
  phone?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  hasPermission: (permission: string) => boolean
  /** SUPER_ADMIN only — switches operating company; updates tokens and user. */
  switchCompanyContext: (companyId: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

function idKey(x: unknown): string {
  if (x == null) return ''
  if (typeof x === 'object' && x !== null && '_id' in x && (x as { _id?: unknown })._id != null) {
    return String((x as { _id: unknown })._id)
  }
  return String(x)
}

/** Avoid replacing user with a new object when nothing meaningful changed — prevents effect storms downstream. */
function authUserEquivalent(a: User | null, b: User | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const perm = (p: string[]) => JSON.stringify([...(p || [])].sort())
  return (
    a._id === b._id &&
    a.role === b.role &&
    a.email === b.email &&
    a.name === b.name &&
    perm(a.permissions || []) === perm(b.permissions || []) &&
    idKey(a.companyId) === idKey(b.companyId) &&
    idKey(a.activeCompanyId) === idKey(b.activeCompanyId)
  )
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  /** All callers await the same in-flight /auth/me — avoids races and duplicate work */
  const fetchUserPromiseRef = useRef<Promise<void> | null>(null)
  const lastBackgroundRevalidate = useRef(0)
  /** Skip tab-visibility refresh right after login (navigation can fire visibility + overlap with session) */
  const skipBackgroundRevalidateUntil = useRef(0)

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setLoading(false)
      return
    }

    if (fetchUserPromiseRef.current) {
      await fetchUserPromiseRef.current
      return
    }

    const run = (async () => {
      try {
        const { data } = await authService.getMe()
        const next = data.data as User
        setUser((prev) => (authUserEquivalent(prev, next) ? prev : next))
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status
        /** Only drop the session when the server rejects credentials — not 5xx/network blips */
        if (status === 401) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    })()

    fetchUserPromiseRef.current = run.finally(() => {
      fetchUserPromiseRef.current = null
    })

    await fetchUserPromiseRef.current
  }, [])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  /**
   * Refresh session when the tab becomes visible again — throttled so we do not stack /auth/me
   * with heavy dashboard loads or steal the main thread after login.
   * (We intentionally avoid window "focus" — it fires on almost every click and caused request storms.)
   */
  useEffect(() => {
    const REVALIDATE_MIN_MS = 60_000

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (!localStorage.getItem('accessToken')) return
      const now = Date.now()
      if (now < skipBackgroundRevalidateUntil.current) return
      if (now - lastBackgroundRevalidate.current < REVALIDATE_MIN_MS) return
      lastBackgroundRevalidate.current = now
      void fetchUser()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [fetchUser])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authService.login({ email, password })
    localStorage.setItem('accessToken', data.data.tokens.accessToken)
    localStorage.setItem('refreshToken', data.data.tokens.refreshToken)
    skipBackgroundRevalidateUntil.current = Date.now() + 5_000
    setUser(data.data.user)
    router.push('/home')
  }, [router])

  const register = useCallback(async (regData: any) => {
    const { data } = await authService.register(regData)
    localStorage.setItem('accessToken', data.data.tokens.accessToken)
    localStorage.setItem('refreshToken', data.data.tokens.refreshToken)
    skipBackgroundRevalidateUntil.current = Date.now() + 5_000
    setUser(data.data.user)
    router.push('/home')
  }, [router])

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    router.push('/login')
  }, [router])

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
    return user.permissions.includes(permission)
  }, [user])

  const switchCompanyContext = useCallback(
    async (companyId: string) => {
      const { data } = await superAdminService.switchCompany(companyId)
      const payload = data.data as { tokens: { accessToken: string; refreshToken: string } }
      localStorage.setItem('accessToken', payload.tokens.accessToken)
      localStorage.setItem('refreshToken', payload.tokens.refreshToken)
      await fetchUser()
    },
    [fetchUser]
  )

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      hasPermission,
      switchCompanyContext,
      refreshUser: fetchUser
    }),
    [user, loading, login, register, logout, hasPermission, switchCompanyContext, fetchUser]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
