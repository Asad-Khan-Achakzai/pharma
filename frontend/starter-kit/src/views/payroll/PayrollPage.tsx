'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { payrollService } from '@/services/payroll.service'
import { usersService } from '@/services/users.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'

type Line = { name: string; amount: number }
type CommissionSnap = { type?: string; value?: number; salesTotal?: number; amount?: number }

export type PayrollEntry = {
  _id: string
  employeeId: { _id?: string; name?: string } | string
  month: string
  baseSalary: number
  bonus: number
  deductions: number
  netSalary: number
  grossSalary?: number
  status: string
  calculationMode?: string
  allowanceLines?: Line[]
  deductionLines?: Line[]
  commission?: CommissionSnap
  dailyAllowance?: number
  dailyAllowanceTotal?: number
  attendanceDeduction?: number
  presentDays?: number
  absentDays?: number
  halfDays?: number
  leaveDays?: number
  totalDaysInMonth?: number
  paidOn?: string
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const r = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank: r })
  return r.passed
}

const columnHelper = createColumnHelper<PayrollEntry>()

const employeeName = (e: PayrollEntry['employeeId']) =>
  typeof e === 'object' && e && 'name' in e ? e.name ?? '-' : '-'

const parseYyyyMm = (s: string): Date | null => {
  const t = s.trim()
  if (!/^\d{4}-\d{2}$/.test(t)) return null
  const [y, m] = t.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return new Date(y, m - 1, 1)
}

const formatYyyyMm = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const defaultMonthYyyyMm = () => {
  const d = new Date()
  return formatYyyyMm(d)
}

const PayrollPage = () => {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payroll.create')
  const canPay = hasPermission('payroll.pay')

  const [data, setData] = useState<PayrollEntry[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [form, setForm] = useState({
    employeeId: '',
    month: '',
    baseSalary: 0,
    bonus: 0,
    deductions: 0
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [viewItem, setViewItem] = useState<PayrollEntry | null>(null)
  const [breakdownItem, setBreakdownItem] = useState<PayrollEntry | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)
  const [payTargetId, setPayTargetId] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [filterEmployeeId, setFilterEmployeeId] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterMonthFrom, setFilterMonthFrom] = useState('')
  const [filterMonthTo, setFilterMonthTo] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { limit: 200 }
      if (filterEmployeeId) params.employeeId = filterEmployeeId
      if (filterMonth.trim()) params.month = filterMonth.trim()
      else {
        if (filterMonthFrom.trim()) params.monthFrom = filterMonthFrom.trim()
        if (filterMonthTo.trim()) params.monthTo = filterMonthTo.trim()
      }
      const [p, u] = await Promise.all([payrollService.list(params), usersService.list({ limit: 200 })])
      setData(p.data.data || [])
      setUsers(u.data.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load payroll')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDownloadPayslip = useCallback(async (id: string) => {
    setDownloadingId(id)
    try {
      const res = await payrollService.downloadPayslip(id)
      const blob = res.data as Blob
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip-${id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      showSuccess('Download started')
    } catch (err) {
      showApiError(err, 'Could not download payslip')
    } finally {
      setDownloadingId(null)
    }
  }, [])

  const runPreview = async () => {
    if (!form.employeeId || !form.month.trim()) {
      showApiError(new Error('Employee and month are required'), 'Validation')
      return
    }
    setPreviewLoading(true)
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        month: form.month.trim()
      }
      if (manualMode) {
        body.manual = true
        body.baseSalary = form.baseSalary
        body.bonus = form.bonus
        body.deductions = form.deductions
      }
      const r = await payrollService.preview(body)
      setPreview(r.data.data)
    } catch (err) {
      showApiError(err, 'Preview failed')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.employeeId || !form.month.trim()) {
      showApiError(new Error('Employee and month are required'), 'Validation')
      return
    }
    if (manualMode && form.baseSalary <= 0) {
      showApiError(new Error('Base salary must be greater than 0'), 'Validation')
      return
    }
    if (!manualMode && !preview) {
      showApiError(new Error('Run preview before saving (structure-based payroll)'), 'Validation')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        month: form.month.trim()
      }
      if (manualMode) {
        body.baseSalary = form.baseSalary
        body.bonus = form.bonus
        body.deductions = form.deductions
      }
      await payrollService.create(body)
      showSuccess('Payroll created')
      setOpen(false)
      setPreview(null)
      setManualMode(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to create payroll')
    } finally {
      setSaving(false)
    }
  }

  const openPayConfirm = (id: string) => {
    setPayTargetId(id)
    setConfirmPayOpen(true)
  }

  const handlePay = useCallback(async () => {
    if (!payTargetId) return
    setPaying(true)
    setPayingId(payTargetId)
    try {
      await payrollService.pay(payTargetId)
      showSuccess('Marked as paid')
      setConfirmPayOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to mark payroll as paid')
    } finally {
      setPaying(false)
      setPayingId(null)
    }
  }, [payTargetId])

  const fmt = (n: number | undefined) => (typeof n === 'number' ? n.toFixed(2) : '—')

  const columns = useMemo<ColumnDef<PayrollEntry, any>[]>(
    () => [
      columnHelper.display({
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => <Typography fontWeight={500}>{employeeName(row.original.employeeId)}</Typography>
      }),
      columnHelper.accessor('month', { header: 'Month' }),
      columnHelper.display({
        id: 'mode',
        header: 'Mode',
        cell: ({ row }) => (
          <Chip
            size='small'
            variant='tonal'
            label={(row.original.calculationMode || 'manual') === 'structure' ? 'Structure' : 'Manual'}
          />
        )
      }),
      columnHelper.accessor('netSalary', {
        header: 'Net Salary',
        cell: ({ row }) => (
          <Typography fontWeight={500}>₨ {row.original.netSalary?.toFixed(2)}</Typography>
        )
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            label={row.original.status}
            color={row.original.status === 'PAID' ? 'success' : 'warning'}
            size='small'
            variant='tonal'
          />
        )
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex gap-1 items-center'>
            <IconButton size='small' onClick={() => setViewItem(row.original)}>
              <i className='tabler-eye text-textSecondary' />
            </IconButton>
            <IconButton size='small' onClick={() => setBreakdownItem(row.original)}>
              <i className='tabler-list-details text-textSecondary' />
            </IconButton>
            <IconButton
              size='small'
              title='Download payslip'
              onClick={() => handleDownloadPayslip(row.original._id)}
              disabled={downloadingId === row.original._id}
            >
              {downloadingId === row.original._id ? (
                <CircularProgress size={18} />
              ) : (
                <i className='tabler-file-download text-textSecondary' />
              )}
            </IconButton>
            {row.original.status === 'PENDING' && canPay && (
              <Button
                size='small'
                variant='tonal'
                color='success'
                onClick={() => openPayConfirm(row.original._id)}
                disabled={payingId !== null}
                startIcon={payingId === row.original._id ? <CircularProgress size={20} color='inherit' /> : undefined}
              >
                {payingId === row.original._id ? 'Paying...' : 'Pay'}
              </Button>
            )}
          </div>
        )
      })
    ],
    [canPay, payingId, downloadingId, handleDownloadPayslip]
  )

  const table = useReactTable({
    data,
    columns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { globalFilter },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader title='Payroll' />
      <div className='flex flex-col gap-4 pli-6 pbe-4'>
        <div className='flex flex-wrap items-end gap-4'>
          <CustomTextField
            select
            sx={{ minWidth: 200 }}
            label='Filter employee'
            value={filterEmployeeId}
            onChange={e => setFilterEmployeeId(e.target.value)}
          >
            <MenuItem value=''>All</MenuItem>
            {users.map((u: any) => (
              <MenuItem key={u._id} value={u._id}>
                {u.name}
              </MenuItem>
            ))}
          </CustomTextField>
          <CustomTextField
            label='Month (YYYY-MM)'
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            placeholder='Exact month'
            sx={{ minWidth: 140 }}
          />
          <CustomTextField
            label='Month from'
            value={filterMonthFrom}
            onChange={e => setFilterMonthFrom(e.target.value)}
            placeholder='2026-01'
            sx={{ minWidth: 120 }}
          />
          <CustomTextField
            label='Month to'
            value={filterMonthTo}
            onChange={e => setFilterMonthTo(e.target.value)}
            placeholder='2026-03'
            sx={{ minWidth: 120 }}
          />
          <Button variant='tonal' onClick={() => fetchData()} disabled={loading}>
            Apply filters
          </Button>
        </div>
        <div className='flex flex-wrap items-center justify-between gap-4'>
        <CustomTextField
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder='Search...'
        />
        {canCreate && (
          <Button
            variant='contained'
            startIcon={<i className='tabler-plus' />}
            onClick={() => {
              setForm({
                employeeId: '',
                month: defaultMonthYyyyMm(),
                baseSalary: 0,
                bonus: 0,
                deductions: 0
              })
              setManualMode(false)
              setPreview(null)
              setOpen(true)
            }}
          >
            Add Payroll
          </Button>
        )}
        </div>
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  No payroll
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Add Payroll</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={manualMode}
                    onChange={(_, c) => {
                      setManualMode(c)
                      setPreview(null)
                    }}
                  />
                }
                label='Manual entry (base, bonus, deductions). If off, active salary structure is used.'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                select
                fullWidth
                label='Employee'
                value={form.employeeId}
                onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
              >
                {users.map((u: any) => (
                  <MenuItem key={u._id} value={u._id}>
                    {u.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AppReactDatepicker
                showMonthYearPicker
                selected={parseYyyyMm(form.month) ?? new Date()}
                id='payroll-month-picker'
                dateFormat='yyyy-MM'
                onChange={(date: Date | null) => {
                  setForm(p => ({ ...p, month: date ? formatYyyyMm(date) : '' }))
                  setPreview(null)
                }}
                customInput={<CustomTextField fullWidth label='Payroll month' helperText='YYYY-MM' />}
              />
            </Grid>
            {manualMode && (
              <>
                <Grid size={{ xs: 4 }}>
                  <CustomTextField
                    fullWidth
                    type='number'
                    label='Base Salary'
                    value={form.baseSalary}
                    onChange={e => setForm(p => ({ ...p, baseSalary: +e.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <CustomTextField
                    fullWidth
                    type='number'
                    label='Bonus'
                    value={form.bonus}
                    onChange={e => setForm(p => ({ ...p, bonus: +e.target.value }))}
                  />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <CustomTextField
                    fullWidth
                    type='number'
                    label='Deductions'
                    value={form.deductions}
                    onChange={e => setForm(p => ({ ...p, deductions: +e.target.value }))}
                  />
                </Grid>
              </>
            )}
            <Grid size={{ xs: 12 }} className='flex gap-2 flex-wrap'>
              <Button variant='tonal' onClick={runPreview} disabled={previewLoading}>
                {previewLoading ? 'Calculating...' : 'Preview'}
              </Button>
            </Grid>
            {preview && (
              <Grid size={{ xs: 12 }}>
                <Typography variant='subtitle2' className='mbe-2'>
                  Preview
                </Typography>
                <Typography variant='body2'>Gross: ₨ {fmt(preview.grossSalary as number)}</Typography>
                <Typography variant='body2'>Net: ₨ {fmt(preview.netSalary as number)}</Typography>
                {(preview.allowanceLines as Line[] | undefined)?.length ? (
                  <Typography variant='caption' display='block' className='mts-2'>
                    Allowances:{' '}
                    {(preview.allowanceLines as Line[]).map(l => `${l.name} (${l.amount})`).join(', ')}
                  </Typography>
                ) : null}
                {(preview.deductionLines as Line[] | undefined)?.length ? (
                  <Typography variant='caption' display='block'>
                    Deductions:{' '}
                    {(preview.deductionLines as Line[]).map(l => `${l.name} (${l.amount})`).join(', ')}
                  </Typography>
                ) : null}
                {preview.commission && (preview.commission as CommissionSnap).amount != null ? (
                  <Typography variant='caption' display='block'>
                    Commission (sales ₨ {fmt((preview.commission as CommissionSnap).salesTotal)}): ₨{' '}
                    {fmt((preview.commission as CommissionSnap).amount)}
                  </Typography>
                ) : null}
                {(preview.presentDays != null || preview.dailyAllowanceTotal != null) && (
                  <>
                    <Typography variant='caption' display='block' className='mts-2'>
                      Attendance: present {String(preview.presentDays ?? '—')}, absent {String(preview.absentDays ?? '—')}
                      , half {String(preview.halfDays ?? '—')}, leave {String(preview.leaveDays ?? '—')}
                    </Typography>
                    <Typography variant='caption' display='block'>
                      Daily allowance (earned): ₨ {fmt(preview.dailyAllowanceTotal as number)} (rate ₨{' '}
                      {fmt(preview.dailyAllowance as number)})
                    </Typography>
                    <Typography variant='caption' display='block'>
                      Attendance deduction: ₨ {fmt(preview.attendanceDeduction as number)}
                    </Typography>
                  </>
                )}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={
              saving ||
              (!manualMode && !preview) ||
              (manualMode && form.baseSalary <= 0) ||
              !form.employeeId ||
              !form.month.trim()
            }
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Payroll Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Employee
                </Typography>
                <Typography fontWeight={500}>{employeeName(viewItem.employeeId)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Month
                </Typography>
                <Typography>{viewItem.month}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Mode
                </Typography>
                <Chip
                  size='small'
                  label={(viewItem.calculationMode || 'manual') === 'structure' ? 'Structure' : 'Manual'}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Net Salary
                </Typography>
                <Typography fontWeight={500}>₨ {fmt(viewItem.netSalary)}</Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>
                  Status
                </Typography>
                <Chip
                  label={viewItem.status}
                  color={viewItem.status === 'PAID' ? 'success' : 'warning'}
                  size='small'
                  variant='tonal'
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewItem(null)}>Close</Button>
          <Button variant='tonal' onClick={() => viewItem && setBreakdownItem(viewItem)}>
            View breakdown
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!breakdownItem} onClose={() => setBreakdownItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Salary breakdown</DialogTitle>
        <DialogContent>
          {breakdownItem && (
            <Grid container spacing={2} className='pbs-4'>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Basic
                </Typography>
                <Typography>₨ {fmt(breakdownItem.baseSalary)}</Typography>
              </Grid>
              {breakdownItem.grossSalary != null && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Gross
                  </Typography>
                  <Typography fontWeight={600}>₨ {fmt(breakdownItem.grossSalary)}</Typography>
                </Grid>
              )}
              {(breakdownItem.allowanceLines ?? []).map((line, i) => (
                <Grid size={{ xs: 12 }} key={`a-${i}`}>
                  <Typography variant='body2' color='text.secondary'>
                    Allowance: {line.name}
                  </Typography>
                  <Typography>₨ {fmt(line.amount)}</Typography>
                </Grid>
              ))}
              {breakdownItem.commission && breakdownItem.commission.amount != null && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Commission ({breakdownItem.commission.value}% of sales ₨ {fmt(breakdownItem.commission.salesTotal)})
                  </Typography>
                  <Typography>₨ {fmt(breakdownItem.commission.amount)}</Typography>
                </Grid>
              )}
              {(breakdownItem.deductionLines ?? []).map((line, i) => (
                <Grid size={{ xs: 12 }} key={`d-${i}`}>
                  <Typography variant='body2' color='text.secondary'>
                    Deduction: {line.name}
                  </Typography>
                  <Typography>₨ {fmt(line.amount)}</Typography>
                </Grid>
              ))}
              {breakdownItem.calculationMode === 'structure' && (
                <>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Days (present / absent / half / leave)
                    </Typography>
                    <Typography>
                      {breakdownItem.presentDays ?? 0} / {breakdownItem.absentDays ?? 0} /{' '}
                      {breakdownItem.halfDays ?? 0} / {breakdownItem.leaveDays ?? 0} (month total{' '}
                      {breakdownItem.totalDaysInMonth ?? '—'})
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Daily allowance earned
                    </Typography>
                    <Typography>₨ {fmt(breakdownItem.dailyAllowanceTotal)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Attendance deduction (from basic)
                    </Typography>
                    <Typography color='error.main'>₨ {fmt(breakdownItem.attendanceDeduction)}</Typography>
                  </Grid>
                </>
              )}
              {!breakdownItem.deductionLines?.length && breakdownItem.calculationMode === 'manual' && (
                <Grid size={{ xs: 12 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Deductions (legacy total)
                  </Typography>
                  <Typography>₨ {fmt(breakdownItem.deductions)}</Typography>
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Net
                </Typography>
                <Typography fontWeight={700}>₨ {fmt(breakdownItem.netSalary)}</Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant='tonal'
            startIcon={<i className='tabler-file-download' />}
            onClick={() => breakdownItem && handleDownloadPayslip(breakdownItem._id)}
            disabled={!breakdownItem || downloadingId === breakdownItem._id}
          >
            {downloadingId === breakdownItem?._id ? 'Downloading...' : 'Download payslip'}
          </Button>
          <Button onClick={() => setBreakdownItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmPayOpen}
        onClose={() => setConfirmPayOpen(false)}
        onConfirm={handlePay}
        title='Mark as Paid?'
        description='This will mark the payroll entry as paid and create a salary expense record.'
        confirmText='Yes, Mark Paid'
        confirmColor='success'
        icon='tabler-cash'
        loading={paying}
      />
    </Card>
  )
}

export default PayrollPage
