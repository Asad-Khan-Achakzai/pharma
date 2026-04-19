'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) { setLoading(false); return }
      const { data } = await authService.getMe()
      setUser(data.data)
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  useEffect(() => {
    const revalidate = () => {
      if (localStorage.getItem('accessToken')) {
        fetchUser()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidate()
    }

    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchUser])

  const login = async (email: string, password: string) => {
    const { data } = await authService.login({ email, password })
    localStorage.setItem('accessToken', data.data.tokens.accessToken)
    localStorage.setItem('refreshToken', data.data.tokens.refreshToken)
    setUser(data.data.user)
    router.push('/home')
  }

  const register = async (regData: any) => {
    const { data } = await authService.register(regData)
    localStorage.setItem('accessToken', data.data.tokens.accessToken)
    localStorage.setItem('refreshToken', data.data.tokens.refreshToken)
    setUser(data.data.user)
    router.push('/home')
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    router.push('/login')
  }

  const hasPermission = (permission: string) => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
    return user.permissions.includes(permission)
  }

  const switchCompanyContext = async (companyId: string) => {
    const { data } = await superAdminService.switchCompany(companyId)
    const payload = data.data as { tokens: { accessToken: string; refreshToken: string } }
    localStorage.setItem('accessToken', payload.tokens.accessToken)
    localStorage.setItem('refreshToken', payload.tokens.refreshToken)
    await fetchUser()
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, hasPermission, switchCompanyContext, refreshUser: fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
