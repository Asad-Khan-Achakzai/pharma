'use client'

import { useState, useEffect } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const DashboardPage = () => {
  const [data, setData] = useState<any>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const { data: res } = await reportsService.dashboard()
        setData(res.data)
      } catch (err) {
        showApiError(err, 'Failed to load dashboard')
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return <div className='flex justify-center items-center min-bs-[40vh]'><CircularProgress /></div>
  if (!data) return <Typography>{loadError ? 'Failed to load dashboard data' : ''}</Typography>

  const kpis = [
    { title: 'Total Sales', value: formatPKR(data.totalSales), icon: 'tabler-chart-line', color: 'primary' },
    { title: 'Gross Profit', value: formatPKR(data.grossProfit), icon: 'tabler-trending-up', color: 'success' },
    { title: 'Total Expenses', value: formatPKR(data.totalExpenses), icon: 'tabler-receipt', color: 'warning' },
    { title: 'Net Profit', value: formatPKR(data.netProfit), icon: 'tabler-coin', color: 'info' },
    { title: 'Total Paid', value: formatPKR(data.totalPaid), icon: 'tabler-cash', color: 'success' },
    { title: 'Outstanding', value: formatPKR(data.totalOutstanding), icon: 'tabler-alert-circle', color: 'error' }
  ]

  return (
    <Grid container spacing={6}>
      {kpis.map((kpi, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <Card>
            <CardContent className='flex flex-col items-center gap-2 p-6'>
              <i className={`${kpi.icon} text-3xl text-${kpi.color}`} />
              <Typography variant='h6' className='text-center'>{kpi.value}</Typography>
              <Typography variant='body2' color='text.secondary'>{kpi.title}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Orders by Status' />
          <CardContent>
            <div className='flex gap-4 flex-wrap'>
              {Object.entries(data.ordersByStatus || {}).map(([status, count]) => (
                <div key={status} className='flex flex-col items-center p-4 border rounded'>
                  <Typography variant='h5'>{count as number}</Typography>
                  <Typography variant='body2' color='text.secondary'>{status}</Typography>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default DashboardPage
