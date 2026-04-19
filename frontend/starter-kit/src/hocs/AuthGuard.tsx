'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getRequiredPermission } from '@/configs/routePermissions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'

const AuthGuard = ({ children }: { children: ReactNode }) => {
  const { user, loading, hasPermission } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)

  useEffect(() => {
    if (!loading && !user && !redirected.current) {
      redirected.current = true
      router.replace('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      redirected.current = false
    }
  }, [user])

  if (loading) {
    return (
      <div className='flex items-center justify-center min-bs-screen'>
        <div className='text-center'>
          <i className='tabler-loader-2 animate-spin text-4xl text-primary' />
        </div>
      </div>
    )
  }

  if (!user) return null

  if (pathname.startsWith('/super-admin')) {
    if (user.role !== 'SUPER_ADMIN') {
      return (
        <div className='flex items-center justify-center min-bs-screen'>
          <Card className='max-is-md'>
            <CardContent className='flex flex-col items-center gap-4 p-8 text-center'>
              <i className='tabler-lock text-5xl text-error' />
              <Typography variant='h5'>Access Denied</Typography>
              <Typography color='text.secondary'>Super Admin area is restricted to platform administrators.</Typography>
              <Button variant='contained' onClick={() => router.replace('/home')}>
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
    return <>{children}</>
  }

  const requiredPermission = getRequiredPermission(pathname)

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className='flex items-center justify-center min-bs-screen'>
        <Card className='max-is-md'>
          <CardContent className='flex flex-col items-center gap-4 p-8 text-center'>
            <i className='tabler-lock text-5xl text-error' />
            <Typography variant='h5'>Access Denied</Typography>
            <Typography color='text.secondary'>
              You don&apos;t have permission to access this page.
            </Typography>
            <Button variant='contained' onClick={() => router.replace('/home')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

export default AuthGuard
