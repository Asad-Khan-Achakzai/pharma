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
import MenuItem from '@mui/material/MenuItem'
import type { ApexOptions } from 'apexcharts'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { formatYyyyMmDd, parseYyyyMmDd } from '@/utils/dateLocal'
import { showApiError } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import { productsService } from '@/services/products.service'
import { distributorsService } from '@/services/distributors.service'
import { usersService } from '@/services/users.service'
import { mapSummaryFinancial, mapTrendsFinancial } from '@/utils/financialMapper'
import Link from 'next/link'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const defaultRange = () => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { startDate: formatYyyyMmDd(start), endDate: formatYyyyMmDd(end) }
}

type ProfitCostDashboardChartsProps = {
  deferFetch?: boolean
}

const ProfitCostDashboardCharts = ({ deferFetch = false }: ProfitCostDashboardChartsProps) => {
  const [startDate, setStartDate] = useState(() => defaultRange().startDate)
  const [endDate, setEndDate] = useState(() => defaultRange().endDate)
  const [productId, setProductId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [revBreakdown, setRevBreakdown] = useState<any>(null)
  const [productOptions, setProductOptions] = useState<any[]>([])
  const [distributorOptions, setDistributorOptions] = useState<any[]>([])
  const [employeeOptions, setEmployeeOptions] = useState<any[]>([])
  const [lookupsLoading, setLookupsLoading] = useState(true)

  const params = useMemo(() => {
    const p: Record<string, string> = { startDate, endDate }
    if (productId.trim()) p.productId = productId.trim()
    if (distributorId.trim()) p.distributorId = distributorId.trim()
    if (employeeId.trim()) p.employeeId = employeeId.trim()
    return p
  }, [startDate, endDate, productId, distributorId, employeeId])

  /** Three parallel requests, separate loading — a slow trends query does not block summary KPIs or the donut. */
  const load = useCallback(() => {
    void (async () => {
      setSummaryLoading(true)
      try {
        const sumRes = await reportsService.profitSummary(params)
        setSummary(mapSummaryFinancial(sumRes.data.data))
      } catch (e) {
        showApiError(e, 'Failed to load profit summary')
      } finally {
        setSummaryLoading(false)
      }
    })()
    void (async () => {
      setTrendsLoading(true)
      try {
        const trRes = await reportsService.profitTrends({ ...params, granularity: 'month' })
        setTrends(mapTrendsFinancial(trRes.data.data))
      } catch (e) {
        showApiError(e, 'Failed to load profit trends')
      } finally {
        setTrendsLoading(false)
      }
    })()
    void (async () => {
      setRevenueLoading(true)
      try {
        const revRes = await reportsService.profitRevenue(params)
        setRevBreakdown(revRes.data.data)
      } catch (e) {
        showApiError(e, 'Failed to load product revenue')
      } finally {
        setRevenueLoading(false)
      }
    })()
  }, [params])

  useEffect(() => {
    if (!deferFetch) return
    load()
  }, [deferFetch, load])

  useEffect(() => {
    if (!deferFetch) return
    const fetchLookups = async () => {
      setLookupsLoading(true)
      try {
        const [pr, di, us] = await Promise.all([
          productsService.list({ limit: 200 }),
          distributorsService.list({ limit: 200 }),
          usersService.list({ limit: 200 })
        ])
        setProductOptions(pr.data.data || [])
        setDistributorOptions(di.data.data || [])
        setEmployeeOptions(us.data.data || [])
      } catch (e) {
        showApiError(e, 'Failed to load filter options')
      } finally {
        setLookupsLoading(false)
      }
    }
    fetchLookups()
  }, [deferFetch])

  const lineOptions: ApexOptions = useMemo(() => {
    const s = trends?.series || []
    const cats = s.map((x: any) => x.period)
    return {
      chart: { toolbar: { show: false }, zoom: { enabled: false } },
      stroke: { curve: 'smooth', width: 2 },
      dataLabels: { enabled: false },
      xaxis: { categories: cats },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      legend: { position: 'top' },
      colors: ['var(--mui-palette-primary-main)', 'var(--mui-palette-warning-main)', 'var(--mui-palette-success-main)'],
      grid: { strokeDashArray: 4, borderColor: 'var(--mui-palette-divider)' }
    }
  }, [trends])

  const lineSeries = useMemo(() => {
    const s = trends?.series || []
    return [
      { name: 'Revenue', data: s.map((x: any) => x.revenue) },
      { name: 'Total cost', data: s.map((x: any) => x.totalCost) },
      { name: 'Net profit', data: s.map((x: any) => x.netProfit) }
    ]
  }, [trends])

  const donutOptions: ApexOptions = useMemo(() => {
    const b = summary?.breakdown
    if (!b) return { labels: [] }
    return {
      labels: ['Product COGS', 'Shipping', 'Payroll', 'Doctor activities', 'Other expenses'],
      chart: { sparkline: { enabled: false } },
      legend: { position: 'bottom' },
      dataLabels: { enabled: true },
      colors: [
        'var(--mui-palette-primary-main)',
        'var(--mui-palette-info-main)',
        'var(--mui-palette-secondary-main)',
        'var(--mui-palette-warning-main)',
        'var(--mui-palette-error-main)'
      ]
    }
  }, [summary])

  const donutSeries = useMemo(() => {
    const b = summary?.breakdown
    if (!b) return []
    return [b.productCost, b.shippingCost, b.payrollCost, b.doctorActivityCost, b.otherExpenses]
  }, [summary])

  const barOptions: ApexOptions = useMemo(() => {
    const rows = (revBreakdown?.byProduct || []).slice(0, 12)
    return {
      chart: { toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: rows.map((r: any) => r.productName || '—'),
        labels: { rotate: -35, style: { fontSize: '11px' } }
      },
      yaxis: {
        labels: {
          formatter: (val: number) =>
            `₨ ${(val || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
        }
      },
      colors: ['var(--mui-palette-primary-main)'],
      grid: { strokeDashArray: 4, borderColor: 'var(--mui-palette-divider)' }
    }
  }, [revBreakdown])

  const barSeries = useMemo(() => {
    const rows = (revBreakdown?.byProduct || []).slice(0, 12)
    return [{ name: 'Revenue', data: rows.map((r: any) => r.revenue) }]
  }, [revBreakdown])

  const formatPKR = (v: number) =>
    `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const marginPct = summary?.profitMarginPercent

  return (
    <Grid size={{ xs: 12 }}>
      <Card>
        <CardHeader
          title='Profit & cost (charts)'
          subheader='Filters apply to the charts below. Open Reports for full tables and cash detail.'
          action={
            <Button component={Link} href='/reports' size='small' variant='tonal'>
              Full reports
            </Button>
          }
        />
        <CardContent className='flex flex-col gap-6'>
          <div>
            <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
              Filters
            </Typography>
            {lookupsLoading ? (
              <div className='flex flex-wrap gap-4 items-end'>
                <Skeleton variant='rounded' width={200} height={56} animation='wave' />
                <Skeleton variant='rounded' width={200} height={56} animation='wave' />
                <Skeleton variant='rounded' width={220} height={56} animation='wave' />
                <Skeleton variant='rounded' width={220} height={56} animation='wave' />
                <Skeleton variant='rounded' width={220} height={56} animation='wave' />
                <Skeleton variant='rounded' width={88} height={36} animation='wave' />
              </div>
            ) : (
              <div className='flex flex-wrap gap-4 items-end'>
                <AppReactDatepicker
                  selected={parseYyyyMmDd(startDate) ?? null}
                  id='dash-pl-start'
                  dateFormat='yyyy-MM-dd'
                  onChange={(d: Date | null) => setStartDate(d ? formatYyyyMmDd(d) : '')}
                  placeholderText='Start'
                  customInput={<CustomTextField label='Start' sx={{ minWidth: 200 }} />}
                />
                <AppReactDatepicker
                  selected={parseYyyyMmDd(endDate) ?? null}
                  id='dash-pl-end'
                  dateFormat='yyyy-MM-dd'
                  onChange={(d: Date | null) => setEndDate(d ? formatYyyyMmDd(d) : '')}
                  placeholderText='End'
                  customInput={<CustomTextField label='End' sx={{ minWidth: 200 }} />}
                />
                <CustomTextField
                  select
                  label='Product'
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value=''>All products</MenuItem>
                  {productOptions.map((p: any) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <CustomTextField
                  select
                  label='Distributor'
                  value={distributorId}
                  onChange={e => setDistributorId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value=''>All distributors</MenuItem>
                  {distributorOptions.map((d: any) => (
                    <MenuItem key={d._id} value={d._id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <CustomTextField
                  select
                  label='Employee (payroll filter)'
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value=''>All employees</MenuItem>
                  {employeeOptions.map((u: any) => (
                    <MenuItem key={u._id} value={u._id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
                <Button
                  variant='contained'
                  onClick={load}
                  disabled={summaryLoading || trendsLoading || revenueLoading}
                >
                  Apply
                </Button>
              </div>
            )}
            <Typography variant='caption' color='text.secondary' display='block' className='mt-2'>
              Revenue uses delivery/return transactions; payroll uses paid-on date.
            </Typography>
          </div>

          <Grid container spacing={4}>
            {summaryLoading
              ? (['Revenue', 'Total cost', 'Net profit', 'Margin'] as const).map(label => (
                  <Grid key={label} size={{ xs: 6, sm: 3 }}>
                    <Typography variant='caption' color='text.secondary'>
                      {label}
                    </Typography>
                    <Skeleton variant='text' width='88%' height={28} animation='wave' sx={{ mt: 0.5 }} />
                  </Grid>
                ))
              : [
                  { label: 'Revenue' as const, children: <Typography fontWeight={600}>{formatPKR(summary?.totalRevenue ?? 0)}</Typography> },
                  { label: 'Total cost' as const, children: <Typography fontWeight={600}>{formatPKR(summary?.totalCost ?? 0)}</Typography> },
                  {
                    label: 'Net profit' as const,
                    children: (
                      <Typography
                        fontWeight={600}
                        color={summary?.netProfit >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatPKR(summary?.netProfit ?? 0)}
                      </Typography>
                    )
                  },
                  {
                    label: 'Margin' as const,
                    children: (
                      <Typography fontWeight={600}>
                        {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
                      </Typography>
                    )
                  }
                ].map(row => (
                  <Grid key={row.label} size={{ xs: 6, sm: 3 }}>
                    <Typography variant='caption' color='text.secondary'>
                      {row.label}
                    </Typography>
                    {row.children}
                  </Grid>
                ))}
          </Grid>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Card variant='outlined'>
                <CardHeader title='Revenue vs cost vs profit' subheader='By month (trends)' />
                <CardContent>
                  {trendsLoading ? (
                    <Skeleton variant='rounded' width='100%' height={360} animation='wave' />
                  ) : trends?.series?.length ? (
                    <AppReactApexCharts type='line' height={360} options={lineOptions} series={lineSeries} />
                  ) : (
                    <Typography color='text.secondary'>No trend data for this range.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card variant='outlined'>
                <CardHeader title='Cost breakdown' />
                <CardContent>
                  {summaryLoading ? (
                    <Skeleton variant='rounded' width='100%' height={360} animation='wave' />
                  ) : donutSeries.some((x: number) => x > 0) ? (
                    <AppReactApexCharts type='donut' height={360} options={donutOptions} series={donutSeries} />
                  ) : (
                    <Typography color='text.secondary'>No costs in range.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Card variant='outlined'>
                <CardHeader title='Top products by revenue (delivery lines)' />
                <CardContent>
                  {revenueLoading ? (
                    <Skeleton variant='rounded' width='100%' height={380} animation='wave' />
                  ) : barSeries[0]?.data?.length ? (
                    <AppReactApexCharts type='bar' height={380} options={barOptions} series={barSeries} />
                  ) : (
                    <Typography color='text.secondary'>No product revenue rows.</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Grid>
  )
}

export default ProfitCostDashboardCharts
