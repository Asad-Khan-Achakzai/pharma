'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import MenuItem from '@mui/material/MenuItem'
import type { ApexOptions } from 'apexcharts'
import CustomTextField from '@core/components/mui/TextField'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import { attendanceService } from '@/services/attendance.service'
import { useAuth } from '@/contexts/AuthContext'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false })

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type TodayEmployee = {
  employeeId: string
  name: string
  status: string
  checkInTime: string | null
  checkOutTime?: string | null
  hasCheckedOut?: boolean
}

type TodayBoard = {
  employees: TodayEmployee[]
  summary: { present: number; notMarked: number; totalEmployees: number }
  distribution: Record<string, number>
}

const statusDisplay = (s: string) => {
  switch (s) {
    case 'PRESENT':
      return 'Present'
    case 'HALF_DAY':
      return 'Half-Day'
    case 'ABSENT':
      return 'Absent'
    case 'LEAVE':
      return 'Leave'
    case 'NOT_MARKED':
      return 'Not marked'
    default:
      return s
  }
}

const statusChipColor = (s: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
  if (s === 'PRESENT') return 'success'
  if (s === 'HALF_DAY') return 'info'
  if (s === 'LEAVE') return 'default'
  if (s === 'ABSENT' || s === 'NOT_MARKED') return 'error'
  return 'default'
}

const donutColors = ['#00d4bd', '#ffa1a1', '#826bf8', '#32baff']

const DashboardPage = () => {
  const { user, hasPermission } = useAuth()
  /** Reps often have no attendance.* strings in DB; admins bypass hasPermission anyway */
  const showCompanyAttendance =
    user?.role === 'ADMIN' || user?.role === 'MEDICAL_REP' || hasPermission('attendance.view')
  const showMyAttendance =
    user?.role === 'ADMIN' || user?.role === 'MEDICAL_REP' || hasPermission('attendance.mark')
  const [data, setData] = useState<any>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [todayBoard, setTodayBoard] = useState<TodayBoard | null>(null)
  const [meToday, setMeToday] = useState<any>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterStatus, setFilterStatus] = useState<string>('')

  const textSecondary = 'var(--mui-palette-text-secondary)'

  const loadAttendanceWidgets = useCallback(async () => {
    const canCompany =
      user?.role === 'ADMIN' || user?.role === 'MEDICAL_REP' || hasPermission('attendance.view')
    const canMine =
      user?.role === 'ADMIN' || user?.role === 'MEDICAL_REP' || hasPermission('attendance.mark')
    try {
      if (canCompany) {
        const r = await attendanceService.today()
        setTodayBoard(r.data.data as TodayBoard)
      } else {
        setTodayBoard(null)
      }
      if (canMine) {
        const m = await attendanceService.meToday()
        setMeToday(m.data.data)
      } else {
        setMeToday(null)
      }
    } catch (err) {
      showApiError(err, 'Failed to load attendance')
    }
  }, [hasPermission, user?.role])

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

  useEffect(() => {
    loadAttendanceWidgets()
  }, [loadAttendanceWidgets])

  const formatPstHm = (iso: string | undefined) => {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      await attendanceService.checkIn()
      showSuccess('Checked in')
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not check in')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    try {
      await attendanceService.checkOut()
      showSuccess('Checked out')
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not check out')
    } finally {
      setCheckingOut(false)
    }
  }

  const tableRows = useMemo(() => {
    if (!todayBoard?.employees?.length) return []
    let list = [...todayBoard.employees]
    if (filterStatus) list = list.filter(e => e.status === filterStatus)
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'name') return dir * a.name.localeCompare(b.name)
      return dir * a.status.localeCompare(b.status)
    })
    return list
  }, [todayBoard, sortBy, sortDir, filterStatus])

  const donutOptions: ApexOptions = useMemo(() => {
    const d = todayBoard?.distribution
    const labels = ['Present', 'Absent', 'Half-Day', 'Leave']
    const series = d
      ? [d.Present ?? 0, d.Absent ?? 0, d['Half-Day'] ?? 0, d.Leave ?? 0]
      : [0, 0, 0, 0]
    const total = series.reduce((s, n) => s + n, 0)

    return {
      stroke: { width: 0 },
      labels,
      colors: donutColors,
      dataLabels: {
        enabled: true,
        formatter: (val: string) => `${Math.round(parseFloat(val))}%`
      },
      legend: {
        fontSize: '13px',
        position: 'bottom',
        labels: { colors: textSecondary },
        itemMargin: { horizontal: 8 }
      },
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              name: { fontSize: '0.95rem' },
              value: {
                fontSize: '1rem',
                color: textSecondary,
                formatter: (val: string) => `${val}`
              },
              total: {
                show: true,
                fontSize: '1rem',
                label: 'Total',
                formatter: () => `${total}`,
                color: 'var(--mui-palette-text-primary)'
              }
            }
          }
        }
      },
      chart: { toolbar: { show: false } },
      responsive: [
        {
          breakpoint: 576,
          options: { chart: { height: 260 }, legend: { position: 'bottom' } }
        }
      ]
    }
  }, [todayBoard?.distribution, textSecondary])

  const donutSeries = useMemo(() => {
    const d = todayBoard?.distribution
    if (!d) return [0, 0, 0, 0]
    return [d.Present ?? 0, d.Absent ?? 0, d['Half-Day'] ?? 0, d.Leave ?? 0]
  }, [todayBoard?.distribution])

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
      {(showCompanyAttendance || showMyAttendance) && (
        <Grid size={{ xs: 12 }}>
          <Grid container spacing={4}>
            {showCompanyAttendance && todayBoard?.summary && (
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardHeader
                    title='Employees Working Today'
                    subheader={`Total present: ${todayBoard.summary.present} · Staff tracked: ${todayBoard.summary.totalEmployees}`}
                  />
                  <CardContent>
                    <Grid container spacing={4}>
                      <Grid size={{ xs: 12, lg: 7 }}>
                        <div className='flex flex-wrap gap-4 mbe-4'>
                          <CustomTextField
                            select
                            size='small'
                            label='Sort by'
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as 'name' | 'status')}
                            sx={{ minWidth: 140 }}
                          >
                            <MenuItem value='name'>Name</MenuItem>
                            <MenuItem value='status'>Status</MenuItem>
                          </CustomTextField>
                          <CustomTextField
                            select
                            size='small'
                            label='Order'
                            value={sortDir}
                            onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
                            sx={{ minWidth: 120 }}
                          >
                            <MenuItem value='asc'>A → Z</MenuItem>
                            <MenuItem value='desc'>Z → A</MenuItem>
                          </CustomTextField>
                          <CustomTextField
                            select
                            size='small'
                            label='Filter status'
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            sx={{ minWidth: 160 }}
                          >
                            <MenuItem value=''>All</MenuItem>
                            <MenuItem value='PRESENT'>Present</MenuItem>
                            <MenuItem value='HALF_DAY'>Half-Day</MenuItem>
                            <MenuItem value='ABSENT'>Absent</MenuItem>
                            <MenuItem value='LEAVE'>Leave</MenuItem>
                            <MenuItem value='NOT_MARKED'>Not marked</MenuItem>
                          </CustomTextField>
                        </div>
                        <TableContainer component={Paper} variant='outlined'>
                          <Table size='small'>
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align='right'>Check-in (PT)</TableCell>
                                <TableCell align='right'>Check-out (PT)</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {tableRows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} align='center'>
                                    <Typography color='text.secondary' variant='body2'>
                                      No rows match the current filters.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                tableRows.map(row => (
                                  <TableRow
                                    key={row.employeeId}
                                    hover
                                    sx={row.hasCheckedOut ? { bgcolor: 'action.hover' } : undefined}
                                  >
                                    <TableCell>
                                      <Typography fontWeight={500}>{row.name}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        size='small'
                                        variant='tonal'
                                        label={statusDisplay(row.status)}
                                        color={statusChipColor(row.status)}
                                      />
                                    </TableCell>
                                    <TableCell align='right'>
                                      {row.checkInTime ?? '—'}
                                    </TableCell>
                                    <TableCell align='right'>
                                      {row.checkOutTime ?? '—'}
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid size={{ xs: 12, lg: 5 }}>
                        <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
                          Today&apos;s distribution
                        </Typography>
                        <AppReactApexCharts
                          type='donut'
                          width='100%'
                          height={320}
                          options={donutOptions}
                          series={donutSeries}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
            {showMyAttendance && (
              <Grid size={{ xs: 12 }}>
                <Card>
                  <CardHeader title='My attendance today' />
                  <CardContent className='flex flex-col gap-3 items-start'>
                    <Typography component='div' variant='body2' className='flex items-center gap-2 flex-wrap'>
                      <span>Status:</span>
                      <Chip
                        size='small'
                        label={
                          meToday?.uiStatus === 'CHECKED_OUT'
                            ? 'Checked out'
                            : meToday?.uiStatus === 'PRESENT'
                              ? 'Present'
                              : 'Not marked'
                        }
                        color={
                          meToday?.uiStatus === 'CHECKED_OUT'
                            ? 'default'
                            : meToday?.uiStatus === 'PRESENT'
                              ? 'success'
                              : 'warning'
                        }
                        variant='tonal'
                      />
                    </Typography>
                    {meToday?.checkInTime && (
                      <Typography variant='body2' color='text.secondary'>
                        Check-in (PT): {formatPstHm(meToday.checkInTime as string) ?? '—'}
                      </Typography>
                    )}
                    {meToday?.checkOutTime && (
                      <Typography variant='body2' color='text.secondary'>
                        Check-out (PT): {formatPstHm(meToday.checkOutTime as string) ?? '—'}
                      </Typography>
                    )}
                    {meToday?.pstDate && (
                      <Typography variant='caption' color='text.disabled'>
                        Business date (Pacific): {meToday.pstDate}
                      </Typography>
                    )}
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        variant='contained'
                        size='small'
                        onClick={handleCheckIn}
                        disabled={checkingIn || checkingOut || !meToday?.canCheckIn}
                      >
                        {checkingIn ? 'Checking in...' : 'Check In'}
                      </Button>
                      <Button
                        variant='tonal'
                        color='secondary'
                        size='small'
                        onClick={handleCheckOut}
                        disabled={checkingIn || checkingOut || !meToday?.canCheckOut}
                      >
                        {checkingOut ? 'Checking out...' : 'Check Out'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Grid>
      )}

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
