'use client'

import { memo } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import type { KpiItem } from './dashboard.types'

const DashboardKPISection = memo(function DashboardKPISection({
  dashboardDataLoading,
  loadError,
  kpis,
  data
}: {
  dashboardDataLoading: boolean
  loadError: boolean
  kpis: KpiItem[]
  data: any
}) {
  return (
    <>
      {dashboardDataLoading
        ? Array.from({ length: 6 }).map((_, i) => (
            <Grid key={`kpi-skel-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
              <Card>
                <CardContent className='flex flex-col items-center gap-2 p-6'>
                  <Skeleton variant='circular' width={48} height={48} animation='wave' />
                  <Skeleton variant='text' width='85%' height={36} animation='wave' />
                  <Skeleton variant='text' width='65%' height={24} animation='wave' />
                </CardContent>
              </Card>
            </Grid>
          ))
        : loadError
          ? (
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent className='p-6'>
                  <Typography color='error'>Summary metrics could not be loaded.</Typography>
                </CardContent>
              </Card>
            </Grid>
            )
          : kpis.map((kpi, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
                <Card>
                  <CardContent className='flex flex-col items-center gap-2 p-6'>
                    <i className={`${kpi.icon} text-3xl text-${kpi.color}`} />
                    <Typography variant='h6' className='text-center'>
                      {kpi.value}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {kpi.title}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Orders by Status' />
          <CardContent>
            {dashboardDataLoading ? (
              <div className='flex gap-4 flex-wrap'>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 2,
                      minWidth: 120,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1
                    }}
                  >
                    <Skeleton variant='text' width={48} height={40} animation='wave' />
                    <Skeleton variant='text' width='75%' height={28} animation='wave' sx={{ mt: 1 }} />
                    <Skeleton variant='text' width='60%' height={20} animation='wave' />
                  </Box>
                ))}
              </div>
            ) : loadError || !data ? (
              <Typography color='text.secondary' variant='body2'>
                Order breakdown is unavailable until the dashboard loads successfully.
              </Typography>
            ) : (
              <div className='flex gap-4 flex-wrap'>
                {Object.entries(data.ordersByStatus || {}).map(([status, count]) => (
                  <div key={status} className='flex flex-col items-center p-4 border rounded'>
                    <Typography variant='h5'>{count as number}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {status}
                    </Typography>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>
    </>
  )
})

export default DashboardKPISection
