'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import { formatYyyyMmDd } from '@/utils/dateLocal'
import { showApiError } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import { mapSummaryFinancial } from '@/utils/financialMapper'
import PageSkeleton from '@/components/skeletons/PageSkeleton'

let profitCostCache: { summary: any; products: any[] } | null = null

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const monthToDateRange = () => {
  const end = new Date()
  const start = new Date(end.getFullYear(), end.getMonth(), 1)
  return { startDate: formatYyyyMmDd(start), endDate: formatYyyyMmDd(end) }
}

const ProfitCostManagementSection = () => {
  const params = useMemo(() => monthToDateRange(), [])
  const [loading, setLoading] = useState(!profitCostCache)
  const [summary, setSummary] = useState<any>(profitCostCache?.summary ?? null)
  const [products, setProducts] = useState<any[]>(profitCostCache?.products ?? [])

  const load = useCallback(async () => {
    const hasCache = Boolean(profitCostCache)
    if (!hasCache) setLoading(true)
    try {
      const [sumRes, prodRes] = await Promise.all([
        reportsService.profitSummary(params),
        reportsService.productProfitability({ ...params, limit: '80' })
      ])
      const next = {
        summary: mapSummaryFinancial(sumRes.data.data),
        products: prodRes.data.data || []
      }
      profitCostCache = next
      setSummary(next.summary)
      setProducts(next.products)
    } catch (e) {
      showApiError(e, 'Failed to load profit & cost reports')
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    load()
  }, [load])

  const marginPct = summary?.profitMarginPercent

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card variant='outlined'>
          <CardContent className='flex flex-wrap gap-2 justify-between items-center'>
            <Typography variant='body2' color='text.secondary'>
              Period: <strong>{params.startDate}</strong> → <strong>{params.endDate}</strong> (current month). Charts
              and filters are on the <strong>Dashboard</strong>.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {loading ? (
        <Grid size={{ xs: 12 }}>
          <PageSkeleton cardCount={4} showTable />
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
