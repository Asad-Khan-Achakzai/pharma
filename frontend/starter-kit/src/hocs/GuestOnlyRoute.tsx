'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const GuestOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth()
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    if (!loading && user && !redirected.current) {
      redirected.current = true
      router.replace('/home')
    }
  }, [user, loading, router])

  if (loading) return null
  if (user) return null

  return <>{children}</>
}

export default GuestOnlyRoute
