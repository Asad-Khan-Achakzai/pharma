'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { ApexOptions } from 'apexcharts'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { reportsService } from '@/services/reports.service'
import { mapDashboardFinancial } from '@/utils/financialMapper'
import { attendanceService } from '@/services/attendance.service'
import { supplierService } from '@/services/supplier.service'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminLike } from '@/utils/roleHelpers'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { isAxiosError } from 'axios'
import DashboardKPISection from '@/views/dashboard/DashboardKPISection'
import DashboardChartsSection from '@/views/dashboard/DashboardChartsSection'
import DashboardSupplierSection from '@/views/dashboard/DashboardSupplierSection'
import DashboardAttendanceSection from '@/views/dashboard/DashboardAttendanceSection'
import type { KpiItem, TodayBoard, TodayEmployee } from '@/views/dashboard/dashboard.types'

function isAbortError(e: unknown): boolean {
  return isAxiosError(e) && e.code === 'ERR_CANCELED'
}

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const donutColors = ['#00d4bd', '#ffa1a1', '#826bf8', '#32baff']

/** Set `window.__DASH_DEBUG__ = true` in the browser console to enable logs outside development. */
function dashDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    process.env.NODE_ENV === 'development' ||
    (window as unknown as { __DASH_DEBUG__?: boolean }).__DASH_DEBUG__ === true
  )
}

function dashLog(phase: string, data?: Record<string, unknown>) {
  if (!dashDebugEnabled()) return
  const ms = Math.round(performance.now())
  if (data && Object.keys(data).length > 0) {
    console.log(`[Dashboard +${ms}ms] ${phase}`, data)
  } else {
    console.log(`[Dashboard +${ms}ms] ${phase}`)
  }
}

let dashboardKpiCache: any = null

const DashboardPage = () => {
  const { user } = useAuth()

  /** Stable booleans — do not depend on hasPermission() identity */
  const attendanceScope = useMemo(() => {
    if (!user) return { team: false, mine: false }
    const r = user.role
    if (r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'MEDICAL_REP') return { team: true, mine: true }
    const p = user.permissions || []
    return { team: p.includes('attendance.view'), mine: p.includes('attendance.mark') }
  }, [user])

  const showCompanyAttendance = attendanceScope.team
  const showMyAttendance = attendanceScope.mine
  const [data, setData] = useState<any>(dashboardKpiCache)
  const [loadError, setLoadError] = useState(false)
  const [dashboardDataLoading, setDashboardDataLoading] = useState(!dashboardKpiCache)
  const [todayBoard, setTodayBoard] = useState<TodayBoard | null>(null)
  /** Start true so team card does not flash the error state before the first fetch. */
  const [teamAttendanceLoading, setTeamAttendanceLoading] = useState(true)
  const [meToday, setMeToday] = useState<any>(null)
  const [meTodayLoading, setMeTodayLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [markAbsentConfirmOpen, setMarkAbsentConfirmOpen] = useState(false)
  const [pendingAbsent, setPendingAbsent] = useState<{ employeeId: string; name: string } | null>(null)
  const [adminAttendanceBusy, setAdminAttendanceBusy] = useState(false)
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null)
  const [statusMenuEmployee, setStatusMenuEmployee] = useState<{ employeeId: string; name: string } | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const textSecondary = 'var(--mui-palette-text-secondary)'
  const canViewReports = useMemo(() => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
    return user.permissions.includes('reports.view')
  }, [user])

  const canViewInventory = useMemo(() => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
    return user.permissions.includes('inventory.view')
  }, [user])

  /** Stable for effects — mirrors hasPermission('suppliers.view') */
  const canViewSuppliers = useMemo(() => {
    if (!user) return false
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
    return user.permissions.includes('suppliers.view')
  }, [user])

  const isAdmin = isAdminLike(user?.role)

  /**
   * Profit/inventory charts use `next/dynamic` with local skeletons; supplier cards use
   * `supplierPaymentsLoading` / `supplierPayablesLoading` (separate fetches, same pattern as attendance).
   */

  const [supplierPaymentsLoading, setSupplierPaymentsLoading] = useState(true)
  const [supplierPayablesLoading, setSupplierPayablesLoading] = useState(true)
  const [recentSupplierPayments, setRecentSupplierPayments] = useState<any[]>([])
  const [topSuppliersPayable, setTopSuppliersPayable] = useState<any[]>([])
  /**
   * Non-critical widgets are mounted only after critical KPIs render + main thread is idle.
   * This improves TTI by reducing first-paint CPU and request fan-out.
   */
  const [nonCriticalReady, setNonCriticalReady] = useState(false)

  /**
   * Overlapping attendance fetches (Strict Mode, or attendanceScope updating) used to leave
   * `meTodayLoading` stuck true: an older request's `finally` could run after a newer request
   * set loading true, or two `set(false)` calls raced with a third `set(true)`. Only the latest
   * generation may clear loading or apply results.
   */
  const teamAttendanceFetchGenRef = useRef(0)
  const meTodayFetchGenRef = useRef(0)
  const teamAttendanceLoadRunRef = useRef(0)
  const meAttendanceLoadRunRef = useRef(0)

  /**
   * Team and me are loaded in **separate** effects. A slow `/attendance/me/today` must not delay
   * the team card: previously one `loadAttendanceWidgets` + shared `tRunStart` / `Promise.all`
   * made logs and mental model couple the two; `/me/today` can take 10s+ while `/today` returns in
   * under ~1s (server/DB variance + connection limits). In-flight GET dedupe still applies per service.
   */
  const loadTeamAttendanceWidgets = useCallback((): Promise<void> => {
    const runId = ++teamAttendanceLoadRunRef.current
    const tRunStart = performance.now()
    const canCompany = attendanceScope.team

    if (!canCompany) {
      teamAttendanceFetchGenRef.current += 1
      setTodayBoard(null)
      setTeamAttendanceLoading(false)
      dashLog('loadAttendanceWidgets:invalidateTeam', { runId, teamGenNow: teamAttendanceFetchGenRef.current })
      return Promise.resolve()
    }

    const teamGen = ++teamAttendanceFetchGenRef.current
    setTeamAttendanceLoading(true)
    dashLog('loadAttendanceWidgets:teamFetchScheduled', { runId, teamGen })

    return (async () => {
      const t0 = performance.now()
      let committedSuccessWithData = false
      try {
        const r = await attendanceService.today()
        const elapsed = Math.round(performance.now() - t0)
        const currentGen = teamAttendanceFetchGenRef.current
        const applied = teamGen === currentGen
        dashLog('attendance:team:response', {
          runId,
          teamGen,
          currentGen,
          ms: elapsed,
          appliedData: applied
        })
        if (applied) {
          const board = r.data.data as TodayBoard
          setTodayBoard(board)
          setTeamAttendanceLoading(false)
          committedSuccessWithData = true
        } else {
          dashLog('attendance:team:staleIgnored', { runId, teamGen, currentGen })
        }
      } catch (err) {
        if (isAbortError(err)) {
          dashLog('attendance:team:aborted', { runId, teamGen })
          return
        }
        showApiError(err, 'Failed to load team attendance')
        const currentGen = teamAttendanceFetchGenRef.current
        const applied = teamGen === currentGen
        dashLog('attendance:team:error', { runId, teamGen, currentGen, applied })
        if (applied) {
          setTodayBoard(null)
        }
      } finally {
        const currentGen = teamAttendanceFetchGenRef.current
        const willClear = teamGen === currentGen
        dashLog('attendance:team:finally', {
          runId,
          teamGen,
          currentGen,
          willClearTeamLoading: willClear,
          sinceRunStartMs: Math.round(performance.now() - tRunStart)
        })
        if (willClear && !committedSuccessWithData) {
          setTeamAttendanceLoading(false)
        }
      }
    })()
  }, [attendanceScope.team])

  const loadMyAttendanceWidget = useCallback((): Promise<void> => {
    const runId = ++meAttendanceLoadRunRef.current
    const tRunStart = performance.now()
    const canMine = attendanceScope.mine

    if (!canMine) {
      meTodayFetchGenRef.current += 1
      setMeToday(null)
      setMeTodayLoading(false)
      dashLog('loadAttendanceWidgets:invalidateMe', { runId, meGenNow: meTodayFetchGenRef.current })
      return Promise.resolve()
    }

    const meGen = ++meTodayFetchGenRef.current
    setMeTodayLoading(true)
    dashLog('loadAttendanceWidgets:meFetchScheduled', { runId, meGen })

    return (async () => {
      const t0 = performance.now()
      let committedSuccessWithData = false
      try {
        const m = await attendanceService.meToday()
        const elapsed = Math.round(performance.now() - t0)
        const currentGen = meTodayFetchGenRef.current
        const applied = meGen === currentGen
        dashLog('attendance:meToday:response', {
          runId,
          meGen,
          currentGen,
          ms: elapsed,
          appliedData: applied
        })
        if (applied) {
          const payload = m.data.data
          setMeToday(payload)
          setMeTodayLoading(false)
          committedSuccessWithData = true
        } else {
          dashLog('attendance:meToday:staleIgnored', { runId, meGen, currentGen })
        }
      } catch (err) {
        if (isAbortError(err)) {
          dashLog('attendance:meToday:aborted', { runId, meGen })
          return
        }
        showApiError(err, 'Failed to load my attendance')
        const currentGen = meTodayFetchGenRef.current
        const applied = meGen === currentGen
        dashLog('attendance:meToday:error', { runId, meGen, currentGen, applied })
        if (applied) {
          setMeToday(null)
        }
      } finally {
        const currentGen = meTodayFetchGenRef.current
        const willClear = meGen === currentGen
        dashLog('attendance:meToday:finally', {
          runId,
          meGen,
          currentGen,
          willClearMeLoading: willClear,
          sinceRunStartMs: Math.round(performance.now() - tRunStart)
        })
        if (willClear && !committedSuccessWithData) {
          setMeTodayLoading(false)
        }
      }
    })()
  }, [attendanceScope.mine])

  /** Check-in / admin tools: refresh both resources and await completion. */
  const loadAttendanceWidgets = useCallback(async () => {
    dashLog('loadAttendanceWidgets:refreshBoth', {
      teamGen: teamAttendanceFetchGenRef.current,
      meGen: meTodayFetchGenRef.current
    })
    await Promise.all([loadTeamAttendanceWidgets(), loadMyAttendanceWidget()])
  }, [loadTeamAttendanceWidgets, loadMyAttendanceWidget])

  useEffect(() => {
    const ac = new AbortController()
    const fetch = async () => {
      const runId = `kpi-${Math.random().toString(36).slice(2, 9)}`
      const t0 = performance.now()
      dashLog('dashboardKPI:fetch:start', { runId })
      if (!dashboardKpiCache) setDashboardDataLoading(true)
      setLoadError(false)
      let ok = false
      try {
        const { data: res } = await reportsService.dashboard({ signal: ac.signal })
        if (ac.signal.aborted) return
        /** Must set data before clearing loading — do not wrap in startTransition or KPI cards can show empty after skeletons */
        const mapped = mapDashboardFinancial(res.data)
        dashboardKpiCache = mapped
        setData(mapped)
        ok = true
      } catch (err) {
        if (isAbortError(err)) {
          dashLog('dashboardKPI:fetch:aborted', { runId })
          return
        }
        showApiError(err, 'Failed to load dashboard')
        setLoadError(true)
        setData(null)
      } finally {
        if (!ac.signal.aborted) {
          setDashboardDataLoading(false)
          dashLog('dashboardKPI:fetch:done', {
            runId,
            ok,
            ms: Math.round(performance.now() - t0)
          })
        }
      }
    }
    void fetch()
    return () => ac.abort()
  }, [])

  useEffect(() => {
    if (dashboardDataLoading || nonCriticalReady) return
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null
    const markReady = () => {
      if (!cancelled) setNonCriticalReady(true)
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(markReady, { timeout: 500 })
    } else {
      timeoutId = setTimeout(markReady, 120)
    }
    return () => {
      cancelled = true
      if (idleId != null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [dashboardDataLoading, nonCriticalReady])

  const teamAttendanceEffectRunRef = useRef(0)
  useEffect(() => {
    teamAttendanceEffectRunRef.current += 1
    dashLog('effect:teamAttendance', { runCount: teamAttendanceEffectRunRef.current })
    void loadTeamAttendanceWidgets()
  }, [loadTeamAttendanceWidgets])

  const myAttendanceEffectRunRef = useRef(0)
  useEffect(() => {
    myAttendanceEffectRunRef.current += 1
    dashLog('effect:myAttendance', { runCount: myAttendanceEffectRunRef.current })
    void loadMyAttendanceWidget()
  }, [loadMyAttendanceWidget])

  /** Recent payments and balances in **separate** effects so a slow balances call does not block the payments table. */
  useEffect(() => {
    if (!canViewSuppliers || !nonCriticalReady) {
      dashLog('supplierWidgets:payments:skip', { reason: !canViewSuppliers ? 'noPermission' : 'deferred' })
      return
    }
    const ac = new AbortController()
    const runId = `sup-pay-${Math.random().toString(36).slice(2, 9)}`
    const t0 = performance.now()
    dashLog('supplierWidgets:payments:fetch:start', { runId })
    setSupplierPaymentsLoading(true)
    ;(async () => {
      try {
        const r = await supplierService.recentPayments({ limit: 8, signal: ac.signal })
        if (ac.signal.aborted) return
        const rp = (r.data as any)?.data?.docs ?? (r.data as any)?.docs ?? []
        setRecentSupplierPayments(Array.isArray(rp) ? rp : [])
      } catch (e) {
        if (isAbortError(e)) {
          dashLog('supplierWidgets:payments:aborted', { runId })
          return
        }
        setRecentSupplierPayments([])
      } finally {
        if (!ac.signal.aborted) {
          setSupplierPaymentsLoading(false)
          dashLog('supplierWidgets:payments:done', { runId, ms: Math.round(performance.now() - t0) })
        }
      }
    })()
    return () => ac.abort()
  }, [canViewSuppliers, nonCriticalReady])

  useEffect(() => {
    if (!canViewSuppliers || !nonCriticalReady) {
      dashLog('supplierWidgets:payables:skip', { reason: !canViewSuppliers ? 'noPermission' : 'deferred' })
      return
    }
    const ac = new AbortController()
    const runId = `sup-bal-${Math.random().toString(36).slice(2, 9)}`
    const t0 = performance.now()
    dashLog('supplierWidgets:payables:fetch:start', { runId })
    setSupplierPayablesLoading(true)
    ;(async () => {
      try {
        const b = await supplierService.balancesSummary({ signal: ac.signal })
        if (ac.signal.aborted) return
        const rows = (b.data as any)?.data?.rows ?? (b.data as any)?.rows ?? []
        setTopSuppliersPayable(Array.isArray(rows) ? rows.slice(0, 8) : [])
      } catch (e) {
        if (isAbortError(e)) {
          dashLog('supplierWidgets:payables:aborted', { runId })
          return
        }
        setTopSuppliersPayable([])
      } finally {
        if (!ac.signal.aborted) {
          setSupplierPayablesLoading(false)
          dashLog('supplierWidgets:payables:done', { runId, ms: Math.round(performance.now() - t0) })
        }
      }
    })()
    return () => ac.abort()
  }, [canViewSuppliers, nonCriticalReady])

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

  const openMarkAbsentConfirm = (employeeId: string, name: string) => {
    setPendingAbsent({ employeeId, name })
    setMarkAbsentConfirmOpen(true)
  }

  const closeMarkAbsentConfirm = () => {
    if (adminAttendanceBusy) return
    setMarkAbsentConfirmOpen(false)
    setPendingAbsent(null)
  }

  const openStatusMenu = (e: MouseEvent<HTMLElement>, row: TodayEmployee) => {
    setStatusMenuAnchor(e.currentTarget)
    setStatusMenuEmployee({ employeeId: row.employeeId, name: row.name })
  }

  const closeStatusMenu = () => {
    setStatusMenuAnchor(null)
    setStatusMenuEmployee(null)
  }

  const applyAdminStatusFromMenu = async (status: 'PRESENT' | 'HALF_DAY' | 'LEAVE' | 'ABSENT') => {
    if (!statusMenuEmployee) return
    const { employeeId, name } = statusMenuEmployee
    if (status === 'ABSENT') {
      closeStatusMenu()
      openMarkAbsentConfirm(employeeId, name)
      return
    }
    setAdminAttendanceBusy(true)
    try {
      await attendanceService.adminSetTodayStatus({ employeeId, status })
      showSuccess('Attendance updated')
      closeStatusMenu()
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not update attendance')
    } finally {
      setAdminAttendanceBusy(false)
    }
  }

  const handleConfirmMarkAbsent = async () => {
    if (!pendingAbsent) return
    setAdminAttendanceBusy(true)
    try {
      await attendanceService.adminSetTodayStatus({ employeeId: pendingAbsent.employeeId, status: 'ABSENT' })
      showSuccess('Employee marked absent for today')
      setMarkAbsentConfirmOpen(false)
      setPendingAbsent(null)
      await loadAttendanceWidgets()
    } catch (err) {
      showApiError(err, 'Could not update attendance')
    } finally {
      setAdminAttendanceBusy(false)
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

  const kpis = useMemo(
    () =>
      data
        ? [
            { title: 'Total Sales', value: formatPKR(data.totalSales), icon: 'tabler-chart-line', color: 'primary' },
            { title: 'Gross Profit', value: formatPKR(data.grossProfit), icon: 'tabler-trending-up', color: 'success' },
            { title: 'Total Expenses', value: formatPKR(data.totalExpenses), icon: 'tabler-receipt', color: 'warning' },
            { title: 'Net Profit', value: formatPKR(data.netProfit), icon: 'tabler-coin', color: 'info' },
            { title: 'Total Paid', value: formatPKR(data.totalPaid), icon: 'tabler-cash', color: 'success' },
            { title: 'Outstanding', value: formatPKR(data.totalOutstanding), icon: 'tabler-alert-circle', color: 'error' }
          ]
        : [],
    [data]
  )

  return (
    <>
    <Grid container spacing={6}>
      <DashboardKPISection dashboardDataLoading={dashboardDataLoading} loadError={loadError} kpis={kpis} data={data} />
      <DashboardAttendanceSection
        showCompanyAttendance={showCompanyAttendance}
        showMyAttendance={showMyAttendance}
        meTodayLoading={meTodayLoading}
        meToday={meToday}
        checkingIn={checkingIn}
        checkingOut={checkingOut}
        handleCheckIn={handleCheckIn}
        handleCheckOut={handleCheckOut}
        teamAttendanceLoading={teamAttendanceLoading}
        todayBoard={todayBoard}
        isAdmin={isAdmin}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDir={sortDir}
        setSortDir={setSortDir}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        tableRows={tableRows}
        adminAttendanceBusy={adminAttendanceBusy}
        openStatusMenu={openStatusMenu}
        donutOptions={donutOptions}
        donutSeries={donutSeries}
        formatPstHm={formatPstHm}
      />
      <DashboardChartsSection
        canViewReports={canViewReports}
        canViewInventory={canViewInventory}
        nonCriticalReady={nonCriticalReady}
      />
      <DashboardSupplierSection
        canViewSuppliers={canViewSuppliers}
        supplierPaymentsLoading={supplierPaymentsLoading}
        recentSupplierPayments={recentSupplierPayments}
        supplierPayablesLoading={supplierPayablesLoading}
        topSuppliersPayable={topSuppliersPayable}
        nonCriticalReady={nonCriticalReady}
      />
    </Grid>

    <Menu
      anchorEl={statusMenuAnchor}
      open={Boolean(statusMenuAnchor)}
      onClose={closeStatusMenu}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { minWidth: 200 } } }}
    >
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('PRESENT')}
      >
        Mark present
      </MenuItem>
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('HALF_DAY')}
      >
        Half-day
      </MenuItem>
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('LEAVE')}
      >
        Leave
      </MenuItem>
      <MenuItem
        disabled={adminAttendanceBusy}
        onClick={() => applyAdminStatusFromMenu('ABSENT')}
        sx={{ color: 'warning.main' }}
      >
        Mark absent…
      </MenuItem>
    </Menu>

    <ConfirmDialog
      open={markAbsentConfirmOpen}
      onClose={closeMarkAbsentConfirm}
      onConfirm={handleConfirmMarkAbsent}
      title='Mark employee absent?'
      description={
        pendingAbsent
          ? `Mark ${pendingAbsent.name} as absent for today? Their check-in will be removed if it was recorded by mistake.`
          : ''
      }
      confirmText='Yes, mark absent'
      cancelText='Cancel'
      confirmColor='warning'
      icon='tabler-user-x'
      loading={adminAttendanceBusy}
    />
    </>
  )
}

export default DashboardPage
