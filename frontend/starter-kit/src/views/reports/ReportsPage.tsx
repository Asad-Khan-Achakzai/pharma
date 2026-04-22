'use client'

import { useState, useEffect, useMemo } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { showApiError } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { reportsService } from '@/services/reports.service'
import { mapProfitFinancial } from '@/utils/financialMapper'
import FinancialReportsSection from '@/views/reports/FinancialReportsSection'
import ProfitCostManagementSection from '@/views/reports/ProfitCostManagementSection'
import PageSkeleton from '@/components/skeletons/PageSkeleton'

type ReportsOpsCache = {
  profit: any
  expenses: any[]
  outstanding: any[]
  doctorROI: any[]
  repPerf: any[]
  invVal: any[]
}

let reportsOpsCache: ReportsOpsCache | null = null
let reportsVisitCache: any = null

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ReportsPage = () => {
  const [tab, setTab] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [profit, setProfit] = useState<any>(reportsOpsCache?.profit ?? null)
  const [expenses, setExpenses] = useState<any[]>(reportsOpsCache?.expenses ?? [])
  const [outstanding, setOutstanding] = useState<any[]>(reportsOpsCache?.outstanding ?? [])
  const [doctorROI, setDoctorROI] = useState<any[]>(reportsOpsCache?.doctorROI ?? [])
  const [repPerf, setRepPerf] = useState<any[]>(reportsOpsCache?.repPerf ?? [])
  const [invVal, setInvVal] = useState<any[]>(reportsOpsCache?.invVal ?? [])
  const [loading, setLoading] = useState(!reportsOpsCache)
  const [visitSummary, setVisitSummary] = useState<any>(reportsVisitCache)
  const [visitWeekStart, setVisitWeekStart] = useState('')
  const [visitWeekEnd, setVisitWeekEnd] = useState('')
  const [visitLoading, setVisitLoading] = useState(false)

  const defaultVisitWeek = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const mon = new Date(now)
    mon.setDate(diff)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
  }, [])

  const fetchReports = async () => {
    const hasCache = Boolean(reportsOpsCache)
    if (!hasCache) setLoading(true)
    try {
      const params = { from: from || undefined, to: to || undefined }
      const [profitRes, expRes, outRes, roiRes, repRes, invRes] = await Promise.all([
        reportsService.profit(params),
        reportsService.expenses(params),
        reportsService.outstanding(),
        reportsService.doctorROI(),
        reportsService.repPerformance(),
        reportsService.inventoryValuation()
      ])
      const next = {
        profit: mapProfitFinancial(profitRes.data.data),
        expenses: expRes.data.data || [],
        outstanding: outRes.data.data || [],
        doctorROI: roiRes.data.data || [],
        repPerf: repRes.data.data || [],
        invVal: invRes.data.data || []
      }
      reportsOpsCache = next
      setProfit(next.profit)
      setExpenses(next.expenses)
      setOutstanding(next.outstanding)
      setDoctorROI(next.doctorROI)
      setRepPerf(next.repPerf)
      setInvVal(next.invVal)
    } catch (err) {
      showApiError(err, 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  useEffect(() => {
    setVisitWeekStart(defaultVisitWeek.start)
    setVisitWeekEnd(defaultVisitWeek.end)
  }, [defaultVisitWeek])

  const fetchVisitSummary = async () => {
    if (!visitWeekStart || !visitWeekEnd) return
    const hasCache = Boolean(reportsVisitCache)
    if (!hasCache) setVisitLoading(true)
    try {
      const res = await reportsService.visitSummary({ weekStart: visitWeekStart, weekEnd: visitWeekEnd })
      reportsVisitCache = res.data.data
      setVisitSummary(res.data.data)
    } catch (err) {
      showApiError(err, 'Failed to load visit summary')
    } finally {
      setVisitLoading(false)
    }
  }

  useEffect(() => {
    if (visitWeekStart && visitWeekEnd) fetchVisitSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when week range is set
  }, [visitWeekStart, visitWeekEnd])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          className='mbe-4'
          variant='scrollable'
          scrollButtons='auto'
          allowScrollButtonsMobile
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 }
          }}
        >
          <Tab label='Operations' />
          <Tab label='Financial position & receipts' />
          <Tab label='Profit & cost' />
        </Tabs>
      </Grid>

      {tab === 1 && (
        <Grid size={{ xs: 12 }}>
          <FinancialReportsSection />
        </Grid>
      )}

      {tab === 2 && (
        <Grid size={{ xs: 12 }}>
          <ProfitCostManagementSection />
        </Grid>
      )}

      {tab === 0 && (
        <>
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent className='flex gap-4 items-end'>
                <CustomTextField
                  label='From'
                  type='date'
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <CustomTextField
                  label='To'
                  type='date'
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <Button
                  variant='contained'
                  onClick={fetchReports}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} color='inherit' /> : undefined}
                >
                  {loading ? 'Loading...' : 'Apply filter'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title='Field visit performance' subheader='Planned vs completed (Pacific week)' />
              <CardContent className='flex flex-col gap-4'>
                <div className='flex flex-wrap gap-4 items-end'>
                  <CustomTextField
                    label='Week start'
                    type='date'
                    value={visitWeekStart}
                    onChange={e => setVisitWeekStart(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    size='small'
                  />
                  <CustomTextField
                    label='Week end'
                    type='date'
                    value={visitWeekEnd}
                    onChange={e => setVisitWeekEnd(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                    size='small'
                  />
                  <Button variant='outlined' size='small' onClick={fetchVisitSummary} disabled={visitLoading}>
                    Refresh
                  </Button>
                </div>
                {visitLoading ? (
                  <div className='flex flex-wrap gap-4'>
                    <Skeleton variant='text' width={180} height={24} animation='wave' />
                    <Skeleton variant='text' width={140} height={24} animation='wave' />
                    <Skeleton variant='text' width={140} height={24} animation='wave' />
                    <Skeleton variant='text' width={140} height={24} animation='wave' />
                  </div>
                ) : visitSummary ? (
                  <div className='flex flex-wrap gap-6'>
                    <Typography>Planned (total items): <strong>{visitSummary.totalPlanned}</strong></Typography>
                    <Typography color='success.main'>Visited: <strong>{visitSummary.totalVisited}</strong></Typography>
                    <Typography color='warning.main'>Missed: <strong>{visitSummary.totalMissed}</strong></Typography>
                    <Typography>Pending: <strong>{visitSummary.totalPending}</strong></Typography>
                    <Typography>Completion: <strong>{visitSummary.completionRate}%</strong></Typography>
                    <Typography>Unplanned visits: <strong>{visitSummary.unplannedVisits}</strong></Typography>
                  </div>
                ) : (
                  <Typography color='text.secondary'>Set week range to load.</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {loading ? (
            <Grid size={{ xs: 12 }}>
              <PageSkeleton cardCount={3} showTable />
            </Grid>
          ) : (
            <>
              {profit && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardHeader title='Profit summary' />
                    <CardContent>
                      <Typography>Gross profit: {formatPKR(profit.grossProfit)}</Typography>
                      <Typography>Net profit: {formatPKR(profit.netProfit)}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardHeader title='Expenses breakdown' />
                  <CardContent>
                    {expenses.length === 0 ? (
                      <Skeleton variant='text' width='40%' height={22} animation='wave' />
                    ) : (
                      expenses.map((e: any) => (
                        <div key={e._id} className='flex justify-between mbe-2'>
                          <Typography>{e._id}</Typography>
                          <Typography fontWeight={500}>
                            {formatPKR(e.total)} ({e.count})
                          </Typography>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardHeader title='Outstanding receivables (legacy list: &gt; 0 only)' />
                  <CardContent>
                    <Typography variant='caption' display='block' color='text.secondary' className='mbe-2'>
                      For full pharmacy list including credits, use the Financial tab.
                    </Typography>
                    {outstanding.length === 0 ? (
                      <Skeleton variant='text' width='45%' height={22} animation='wave' />
                    ) : (
                      outstanding.map((o: any) => (
                        <div key={o._id} className='flex justify-between mbe-2'>
                          <Typography>
                            {o.pharmacyName} ({o.city})
                          </Typography>
                          <Typography fontWeight={500} color='error'>
                            {formatPKR(o.outstanding)}
                          </Typography>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardHeader title='Doctor ROI' />
                  <CardContent>
                    {doctorROI.length === 0 ? (
                      <Skeleton variant='text' width='36%' height={22} animation='wave' />
                    ) : (
                      doctorROI.map((d: any) => (
                        <div key={d._id} className='flex justify-between mbe-2'>
                          <Typography>{d.doctorName}</Typography>
                          <Typography fontWeight={500}>{(d.roiPercent ?? d.roi)?.toFixed(1)}%</Typography>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardHeader title='Rep performance' />
                  <CardContent>
                    {repPerf.length === 0 ? (
                      <Skeleton variant='text' width='36%' height={22} animation='wave' />
                    ) : (
                      repPerf.map((r: any) => (
                        <div key={r._id} className='flex justify-between mbe-2'>
                          <Typography>
                            {r.repName} ({r.month})
                          </Typography>
                          <Typography fontWeight={500}>
                            Sales: {r.salesPercent?.toFixed(0)}% | Packs: {r.packsPercent?.toFixed(0)}%
                          </Typography>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardHeader title='Inventory valuation' />
                  <CardContent>
                    {invVal.length === 0 ? (
                      <Skeleton variant='text' width='36%' height={22} animation='wave' />
                    ) : (
                      invVal.map((v: any) => (
                        <div key={v._id} className='flex justify-between mbe-2'>
                          <Typography>
                            {v.distributorName} ({v.totalQuantity} units)
                          </Typography>
                          <Typography fontWeight={500}>{formatPKR(v.totalValue)}</Typography>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </>
      )}
    </Grid>
  )
}

export default ReportsPage
