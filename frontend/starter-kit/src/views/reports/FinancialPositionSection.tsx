'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import type { ApexOptions } from 'apexcharts'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import CardSkeleton from '@/components/skeletons/CardSkeleton'

let financialPositionCache: { summary: any; flow: any } | null = null

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Stretch cards to match the tallest item in each Grid row */
const metricGridSx = { display: 'flex' } as const
const metricCardSx = {
  flex: 1,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0
} as const
const metricCardContentSx = { flex: 1 } as const

const FinancialPositionSection = () => {
  const { user } = useAuth()
  const canEditCashOpening = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const [loading, setLoading] = useState(!financialPositionCache)
  const [flowLoading, setFlowLoading] = useState(!financialPositionCache)
  const [summary, setSummary] = useState<any>(financialPositionCache?.summary ?? null)
  const [flow, setFlow] = useState<any>(financialPositionCache?.flow ?? null)
  const [cashInput, setCashInput] = useState('')
  const [savingCash, setSavingCash] = useState(false)

  const loadData = useCallback(async () => {
    const hasCache = Boolean(financialPositionCache)
    if (!hasCache) {
      setLoading(true)
      setFlowLoading(true)
    }
    try {
      const [summaryRes, flowRes] = await Promise.all([
        reportsService.financialSummary(),
        reportsService.financialFlowMonthly({ months: 12 })
      ])
      const next = { summary: summaryRes.data.data, flow: flowRes.data.data }
      financialPositionCache = next
      setSummary(next.summary)
      setFlow(next.flow)
      setCashInput(String(next.summary?.cashOpeningBalance ?? 0))
    } catch (e) {
      showApiError(e, 'Failed to load financial position')
    } finally {
      setLoading(false)
      setFlowLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveCashOpening = async () => {
    const n = parseFloat(cashInput)
    if (Number.isNaN(n)) {
      showApiError(null, 'Enter a valid number')
      return
    }
    setSavingCash(true)
    try {
      await reportsService.patchCompanyCashOpening({ cashOpeningBalance: n })
      showSuccess('Cash opening balance saved')
      await loadData()
    } catch (e) {
      showApiError(e, 'Failed to update')
    } finally {
      setSavingCash(false)
    }
  }

  const lineOptions: ApexOptions = useMemo(() => {
    const series = flow?.series || []
    const cats = series.map((x: any) => x.month)
    return {
      chart: { toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { width: 2, curve: 'smooth' },
      dataLabels: { enabled: false },
      xaxis: { categories: cats },
      yaxis: { labels: { formatter: (v: number) => formatPKR(v) } },
      tooltip: { y: { formatter: (v: number) => formatPKR(v) } },
      legend: { position: 'top' }
    }
  }, [flow])

  const lineSeries = useMemo(() => {
    const series = flow?.series || []
    return [
      { name: 'Inflow', data: series.map((x: any) => x.inflow) },
      { name: 'Outflow', data: series.map((x: any) => x.outflow) }
    ]
  }, [flow])

  const barOptions: ApexOptions = useMemo(() => {
    const s = summary
    if (!s) return { chart: { type: 'bar' } }
    return {
      chart: { toolbar: { show: false } },
      plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Pharmacy receivable', 'Supplier payable', 'Distributor payable']
      },
      yaxis: { labels: { formatter: (v: number) => formatPKR(v) } },
      tooltip: { y: { formatter: (v: number) => formatPKR(v) } },
      colors: ['#2e7d32', '#c62828', '#1565c0']
    }
  }, [summary])

  const barSeries = useMemo(() => {
    if (!summary) return [{ name: 'Amount', data: [0, 0, 0] }]
    return [
      {
        name: 'PKR',
        data: [
          summary.totalPharmacyReceivable ?? 0,
          Math.max(0, summary.totalSupplierPayable ?? 0),
          summary.totalDistributorPayable ?? 0
        ]
      }
    ]
  }, [summary])

  if (loading && !summary) {
    return (
      <Grid size={{ xs: 12 }}>
        <CardSkeleton rows={6} />
      </Grid>
    )
  }

  return (
    <Grid container spacing={4} sx={{ alignItems: 'stretch' }}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='body2' color='text.secondary' className='mbe-2'>
          Implied cash uses collections, settlements, expenses (including payroll), and supplier payments. Supplier{' '}
          <strong>PURCHASE</strong> lines affect payables only, not PnL. Delivery profit is unchanged.
        </Typography>
      </Grid>

      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <Typography variant='body2' color='text.secondary'>
              Implied cash balance
            </Typography>
            <Typography variant='h5'>{formatPKR(summary?.cashBalance ?? 0)}</Typography>
            <Typography variant='caption' color='text.secondary' display='block' className='mts-2'>
              Opening: {formatPKR(summary?.cashOpeningBalance ?? 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <Typography variant='body2' color='text.secondary'>
              Pharmacy receivables
            </Typography>
            <Typography variant='h5' color='success.main'>
              {formatPKR(summary?.totalPharmacyReceivable ?? 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <Typography variant='body2' color='text.secondary'>
              Supplier payables
            </Typography>
            <Typography variant='h5' color='warning.main'>
              {formatPKR(summary?.totalSupplierPayable ?? 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <Typography variant='body2' color='text.secondary'>
              Distributor commission payable
            </Typography>
            <Typography variant='h5' color='info.main'>
              {formatPKR(summary?.totalDistributorPayable ?? 0)}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }} sx={metricGridSx}>
        <Card sx={metricCardSx}>
          <CardContent sx={metricCardContentSx}>
            <Typography variant='body2' color='text.secondary'>
              Net position
            </Typography>
            <Typography variant='h5' color={summary?.netPosition >= 0 ? 'success.main' : 'error.main'}>
              {formatPKR(summary?.netPosition ?? 0)}
            </Typography>
            <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
              Cash + pharmacy receivable − supplier − distributor (working-capital style)
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {canEditCashOpening && (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant='outlined'>
            <CardHeader title='Cash opening balance' subheader='Set starting bank/cash before tracked movements' titleTypographyProps={{ variant: 'subtitle1' }} />
            <CardContent className='flex flex-wrap gap-2 items-end'>
              <TextField
                size='small'
                label='PKR'
                type='number'
                value={cashInput}
                onChange={e => setCashInput(e.target.value)}
              />
              <Button size='small' variant='contained' onClick={saveCashOpening} disabled={savingCash}>
                {savingCash ? 'Saving...' : 'Save'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      )}

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Cash inflow vs outflow (12 months)' />
          <CardContent>
            {flowLoading ? (
              <Skeleton variant='rounded' width='100%' height={320} animation='wave' />
            ) : (
              <AppReactApexCharts type='line' height={320} options={lineOptions} series={lineSeries} />
            )}
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Receivable vs payables (snapshot)' />
          <CardContent>
            <AppReactApexCharts type='bar' height={320} options={barOptions} series={barSeries} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default FinancialPositionSection
