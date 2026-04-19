'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { showApiError } from '@/utils/apiErrors'
import { attendanceService } from '@/services/attendance.service'
import { usersService } from '@/services/users.service'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminLike } from '@/utils/roleHelpers'

type AttRow = {
  _id: string
  date: string
  status: string
  checkInTime?: string
  checkOutTime?: string
  markedBy?: string
  notes?: string
}

const parseYyyyMm = (s: string): Date | null => {
  const t = s.trim()
  if (!/^\d{4}-\d{2}$/.test(t)) return null
  const [y, m] = t.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return new Date(y, m - 1, 1)
}

const formatYyyyMm = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const AttendancePage = () => {
  const { user, hasPermission } = useAuth()
  const isAdmin = isAdminLike(user?.role)
  const canViewReport = hasPermission('attendance.view')

  const [users, setUsers] = useState<{ _id: string; name: string }[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AttRow[]>([])
  const [summary, setSummary] = useState<Record<string, number> | null>(null)
  const [monthly, setMonthly] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (user?._id && !isAdmin) setEmployeeId(user._id)
  }, [user, isAdmin])

  useEffect(() => {
    const load = async () => {
      try {
        const u = await usersService.list({ limit: 200 })
        setUsers(u.data.data || [])
      } catch (e) {
        showApiError(e, 'Failed to load users')
      }
    }
    if (canViewReport) load()
  }, [canViewReport])

  const runReport = useCallback(async () => {
    if (!employeeId) {
      showApiError(new Error('Select employee'), 'Validation')
      return
    }
    setLoading(true)
    try {
      const r = await attendanceService.report({
        employeeId,
        startDate,
        endDate
      })
      setRows(r.data.data.records || [])
      setSummary(r.data.data.summary || null)
    } catch (e) {
      showApiError(e, 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [employeeId, startDate, endDate])

  const runMonthly = useCallback(async () => {
    if (!employeeId) {
      showApiError(new Error('Select employee'), 'Validation')
      return
    }
    setLoading(true)
    try {
      const r = await attendanceService.monthlySummary({ employeeId, month })
      setMonthly(r.data.data || null)
    } catch (e) {
      showApiError(e, 'Failed to load monthly summary')
    } finally {
      setLoading(false)
    }
  }, [employeeId, month])

  const statusColor = (s: string) => {
    if (s === 'PRESENT') return 'success'
    if (s === 'ABSENT') return 'error'
    if (s === 'HALF_DAY') return 'warning'
    if (s === 'LEAVE') return 'default'
    return 'default'
  }

  const table = useMemo(() => rows, [rows])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Attendance report' />
          <div className='flex flex-col gap-4 pli-6 pbe-6'>
            {!canViewReport ? (
              <Typography color='text.secondary'>You do not have access to attendance reports.</Typography>
            ) : (
              <>
                <div className='flex flex-wrap gap-4 items-end'>
                  {isAdmin && (
                    <CustomTextField
                      select
                      sx={{ minWidth: 220 }}
                      label='Employee'
                      value={employeeId}
                      onChange={e => setEmployeeId(e.target.value)}
                    >
                      {users.map(u => (
                        <MenuItem key={u._id} value={u._id}>
                          {u.name}
                        </MenuItem>
                      ))}
                    </CustomTextField>
                  )}
                  <CustomTextField
                    type='date'
                    label='Start'
                    InputLabelProps={{ shrink: true }}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                  <CustomTextField
                    type='date'
                    label='End'
                    InputLabelProps={{ shrink: true }}
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                  <Button variant='contained' onClick={runReport} disabled={loading || !employeeId}>
                    Load range
                  </Button>
                </div>

                {summary && (
                  <div className='flex flex-wrap gap-2'>
                    <Chip label={`Total days (range): ${summary.totalDays}`} variant='outlined' />
                    <Chip label={`Present: ${summary.presentDays}`} color='success' variant='tonal' />
                    <Chip label={`Absent: ${summary.absentDays}`} color='error' variant='tonal' />
                    <Chip label={`Half day: ${summary.halfDays}`} color='warning' variant='tonal' />
                    <Chip label={`Leave: ${summary.leaveDays}`} variant='outlined' />
                  </div>
                )}

                <div className='overflow-x-auto border rounded'>
                  <table className='min-is-full text-sm'>
                    <thead>
                      <tr className='border-b bg-actionHover'>
                        <th className='text-left p-3'>Date</th>
                        <th className='text-left p-3'>Status</th>
                        <th className='text-left p-3'>Check-in</th>
                        <th className='text-left p-3'>Check-out</th>
                        <th className='text-left p-3'>Marked by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className='p-6 text-center'>
                            <CircularProgress size={28} />
                          </td>
                        </tr>
                      ) : table.length === 0 ? (
                        <tr>
                          <td colSpan={5} className='p-6 text-center text-textSecondary'>
                            No records. Set filters and load.
                          </td>
                        </tr>
                      ) : (
                        table.map(r => (
                          <tr key={r._id} className='border-b border-divider'>
                            <td className='p-3'>{new Date(r.date).toLocaleDateString()}</td>
                            <td className='p-3'>
                              <Chip size='small' label={r.status} color={statusColor(r.status)} variant='tonal' />
                            </td>
                            <td className='p-3'>{r.checkInTime ? new Date(r.checkInTime).toLocaleString() : '—'}</td>
                            <td className='p-3'>{r.checkOutTime ? new Date(r.checkOutTime).toLocaleString() : '—'}</td>
                            <td className='p-3'>{r.markedBy || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <Typography variant='subtitle2' className='mbs-4'>
                  Monthly summary (earned daily allowance)
                </Typography>
                <div className='flex flex-wrap gap-4 items-end'>
                  <AppReactDatepicker
                    showMonthYearPicker
                    selected={parseYyyyMm(month) ?? new Date()}
                    id='attendance-month-picker'
                    dateFormat='yyyy-MM'
                    onChange={(date: Date | null) => {
                      setMonth(date ? formatYyyyMm(date) : '')
                      setMonthly(null)
                    }}
                    customInput={
                      <CustomTextField sx={{ minWidth: 220 }} label='Month (YYYY-MM)' helperText='YYYY-MM' />
                    }
                  />
                  <Button variant='tonal' onClick={runMonthly} disabled={loading || !employeeId}>
                    Load month summary
                  </Button>
                </div>
                {monthly && (
                  <div className='flex flex-wrap gap-2 mbs-2'>
                    <Chip label={`Present: ${monthly.presentDays}`} variant='outlined' />
                    <Chip label={`Absent: ${monthly.absentDays}`} variant='outlined' />
                    <Chip label={`Half: ${monthly.halfDays}`} variant='outlined' />
                    <Chip label={`Daily allowance earned: ₨ ${Number(monthly.dailyAllowanceEarned).toFixed(2)}`} color='primary' />
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </Grid>
    </Grid>
  )
}

export default AttendancePage
