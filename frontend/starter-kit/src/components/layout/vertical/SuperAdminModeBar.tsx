'use client'

import Link from 'next/link'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { useAuth } from '@/contexts/AuthContext'

const SuperAdminModeBar = () => {
  const { user } = useAuth()
  if (user?.role !== 'SUPER_ADMIN') return null

  const viewing =
    user.activeCompanyId && typeof user.activeCompanyId === 'object'
      ? user.activeCompanyId.name
      : 'No company selected'

  return (
    <div className='flex flex-wrap items-center gap-2 px-4 py-2 border-be border-divider bg-actionHover/40 w-full'>
      <Chip size='small' color='warning' variant='tonal' label='SUPER ADMIN MODE' />
      <Typography variant='caption' color='text.secondary' component='span'>
        Viewing:
      </Typography>
      <Typography variant='caption' fontWeight={600} component='span'>
        {viewing}
      </Typography>
      <Link href='/super-admin' className='text-xs text-primary ms-2 hover:underline'>
        Company hub
      </Link>
    </div>
  )
}

export default SuperAdminModeBar
