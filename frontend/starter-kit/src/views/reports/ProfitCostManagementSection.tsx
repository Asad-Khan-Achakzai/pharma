'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
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

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const defaultRange = () => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { startDate: formatYyyyMmDd(start), endDate: formatYyyyMmDd(end) }
}

const ProfitCostManagementSection = () => {
  const [startDate, setStartDate] = useState(() => defaultRange().startDate)
  const [endDate, setEndDate] = useState(() => defaultRange().endDate)
  const [productId, setProductId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [revBreakdown, setRevBreakdown] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, trRes, revRes, prodRes] = await Promise.all([
        reportsService.profitSummary(params),
        reportsService.profitTrends({ ...params, granularity: 'month' }),
        reportsService.profitRevenue(params),
        reportsService.productProfitability({ ...params, limit: '80' })
      ])
      setSummary(sumRes.data.data)
      setTrends(trRes.data.data)
      setRevBreakdown(revRes.data.data)
      setProducts(prodRes.data.data || [])
    } catch (e) {
      showApiError(e, 'Failed to load profit & cost reports')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
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
  }, [])

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

  const marginPct = summary?.profitMarginPercent

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Filters' subheader='Revenue uses delivery/return transactions; payroll uses paid-on date.' />
          <CardContent className='flex flex-wrap gap-4 items-end'>
            <AppReactDatepicker
              selected={parseYyyyMmDd(startDate) ?? null}
              id='pl-start'
              dateFormat='yyyy-MM-dd'
              onChange={(d: Date | null) => setStartDate(d ? formatYyyyMmDd(d) : '')}
              placeholderText='Start'
              customInput={<CustomTextField label='Start' sx={{ minWidth: 200 }} />}
            />
            <AppReactDatepicker
              selected={parseYyyyMmDd(endDate) ?? null}
              id='pl-end'
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
              disabled={lookupsLoading}
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
              disabled={lookupsLoading}
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
              disabled={lookupsLoading}
            >
              <MenuItem value=''>All employees</MenuItem>
              {employeeOptions.map((u: any) => (
                <MenuItem key={u._id} value={u._id}>
                  {u.name}
                </MenuItem>
              ))}
            </CustomTextField>
            <Button variant='contained' onClick={load} disabled={loading}>
              Apply
            </Button>
          </CardContent>
        </Card>
      </Grid>

      {loading ? (
        <Grid size={{ xs: 12 }} className='flex justify-center p-12'>
          <CircularProgress />
        </Grid>
      ) : (
        <>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='body2' color='text.secondary'>
                  Total revenue
                </Typography>
                <Typography variant='h5'>{formatPKR(summary?.totalRevenue ?? 0)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='body2' color='text.secondary'>
                  Total cost
                </Typography>
                <Typography variant='h5'>{formatPKR(summary?.totalCost ?? 0)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='body2' color='text.secondary'>
                  Net profit
                </Typography>
                <Typography variant='h5' color={summary?.netProfit >= 0 ? 'success.main' : 'error.main'}>
                  {formatPKR(summary?.netProfit ?? 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='body2' color='text.secondary'>
                  Profit margin
                </Typography>
                <Typography variant='h5'>
                  {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title='Cash & receivables'
                subheader='Company cash in the period (only collections by the company + distributor→company settlements). Distributor-held collections show separately until settled.'
              />
              <CardContent>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Company cash in (period)
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summary?.liquidity?.receivedInPeriod?.total ?? 0)}</Typography>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                      Collections by company:{' '}
                      {formatPKR(summary?.liquidity?.receivedInPeriod?.pharmacyCollectionsByCompany ?? 0)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' display='block'>
                      Distributor → company settlements:{' '}
                      {formatPKR(summary?.liquidity?.receivedInPeriod?.settlementsFromDistributors ?? 0)}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant='body2' color='text.secondary'>
                      With distributor (not settled)
                    </Typography>
                    <Typography variant='h5' color='info.main'>
                      {formatPKR(summary?.liquidity?.receivedInPeriod?.pharmacyCollectionsHeldByDistributors ?? 0)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                      Collected from pharmacies by distributors this period; not company cash until you record a
                      distributor→company settlement.
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Paid to distributors (period)
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summary?.liquidity?.paidOutInPeriod?.settlementsToDistributors ?? 0)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Net company cash movement (period)
                    </Typography>
                    <Typography
                      variant='h5'
                      color={
                        (summary?.liquidity?.netCashMovementInPeriod ?? 0) >= 0 ? 'success.main' : 'error.main'
                      }
                    >
                      {formatPKR(summary?.liquidity?.netCashMovementInPeriod ?? 0)}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Still to receive (pharmacies)
                    </Typography>
                    <Typography variant='h5' color='warning.main'>
                      {formatPKR(summary?.liquidity?.snapshot?.outstandingReceivableFromPharmacies ?? 0)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                      Customer prepaid credits: {formatPKR(summary?.liquidity?.snapshot?.customerPrepaidCredits ?? 0)}
                    </Typography>
                  </Grid>
                </Grid>
                <Divider sx={{ my: 3 }} />
                <Typography variant='body2' color='text.secondary' component='div' className='flex flex-col gap-1'>
                  <span>{summary?.liquidity?.help?.received}</span>
                  <span>{summary?.liquidity?.help?.distributorHeld}</span>
                  <span>{summary?.liquidity?.help?.outstanding}</span>
                  <span>{summary?.liquidity?.help?.prepaid}</span>
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 8 }}>
            <Card>
              <CardHeader title='Revenue vs cost vs profit' subheader='By month (trends)' />
              <CardContent>
                {trends?.series?.length ? (
                  <AppReactApexCharts type='line' height={360} options={lineOptions} series={lineSeries} />
                ) : (
                  <Typography color='text.secondary'>No trend data for this range.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Card>
              <CardHeader title='Cost breakdown' />
              <CardContent>
                {donutSeries.some((x: number) => x > 0) ? (
                  <AppReactApexCharts type='donut' height={360} options={donutOptions} series={donutSeries} />
                ) : (
                  <Typography color='text.secondary'>No costs in range.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title='Top products by revenue (delivery lines)' />
              <CardContent>
                {barSeries[0]?.data?.length ? (
                  <AppReactApexCharts type='bar' height={380} options={barOptions} series={barSeries} />
                ) : (
                  <Typography color='text.secondary'>No product revenue rows.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title='Top profitable products' />
              <CardContent className='flex flex-col gap-2'>
                {(summary?.insights?.topProfitableProducts || []).map((p: any) => (
                  <div key={String(p.productId)} className='flex justify-between gap-2'>
                    <Typography variant='body2'>{p.productName}</Typography>
                    <Chip size='small' color='success' variant='tonal' label={formatPKR(p.profit)} />
                  </div>
                ))}
                {!summary?.insights?.topProfitableProducts?.length && (
                  <Typography variant='body2' color='text.secondary'>
                    No data
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title='Lowest profit products' />
              <CardContent className='flex flex-col gap-2'>
                {(summary?.insights?.topLossMakingProducts || []).map((p: any) => (
                  <div key={String(p.productId)} className='flex justify-between gap-2'>
                    <Typography variant='body2'>{p.productName}</Typography>
                    <Chip size='small' color='warning' variant='tonal' label={formatPKR(p.profit)} />
                  </div>
                ))}
                {!summary?.insights?.topLossMakingProducts?.length && (
                  <Typography variant='body2' color='text.secondary'>
                    No data
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title='Insights'
                subheader={
                  summary?.insights?.highestCostCategory
                    ? `Highest cost bucket: ${summary.insights.highestCostCategory.label} (${formatPKR(
                        summary.insights.highestCostCategory.amount
                      )})`
                    : undefined
                }
              />
              <CardContent className='flex flex-wrap gap-4'>
                <Typography variant='body2'>
                  Revenue vs cost ratio:{' '}
                  <strong>
                    {summary?.insights?.revenueVsCostRatio != null
                      ? summary.insights.revenueVsCostRatio.toFixed(2)
                      : '—'}
                  </strong>
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Basis: {summary?.basis || 'transaction_delivery'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title='Product profitability' />
              <CardContent className='overflow-x-auto'>
                <table className='min-is-full text-sm'>
                  <thead>
                    <tr className='border-b'>
                      <th className='text-left p-2'>Product</th>
                      <th className='text-right p-2'>Sold</th>
                      <th className='text-right p-2'>Revenue</th>
                      <th className='text-right p-2'>COGS</th>
                      <th className='text-right p-2'>Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p: any) => (
                      <tr key={String(p.productId)} className='border-b border-divider'>
                        <td className='p-2'>{p.productName}</td>
                        <td className='p-2 text-right'>{p.totalSold}</td>
                        <td className='p-2 text-right'>{formatPKR(p.revenue)}</td>
                        <td className='p-2 text-right'>{formatPKR(p.cost)}</td>
                        <td className='p-2 text-right'>{formatPKR(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}
    </Grid>
  )
}

export default ProfitCostManagementSection
