'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { payrollService } from '@/services/payroll.service'
import { usersService } from '@/services/users.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'

type PayrollEntry = { _id: string; employeeId: any; month: string; baseSalary: number; bonus: number; deductions: number; netSalary: number; status: string }
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<PayrollEntry>()

const PayrollPage = () => {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payroll.create')
  const canPay = hasPermission('payroll.pay')
  const [data, setData] = useState<PayrollEntry[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ employeeId: '', month: '', baseSalary: 0, bonus: 0, deductions: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)
  const [payTargetId, setPayTargetId] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try { const [p, u] = await Promise.all([payrollService.list({ limit: 100 }), usersService.list({ limit: 100 })]); setData(p.data.data || []); setUsers(u.data.data || []) }
    catch (err) { showApiError(err, 'Failed to load payroll') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    setSaving(true)
    try { await payrollService.create(form); showSuccess('Payroll created'); setOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Failed to create payroll') }
    finally { setSaving(false) }
  }

  const openPayConfirm = (id: string) => { setPayTargetId(id); setConfirmPayOpen(true) }

  const handlePay = useCallback(async () => {
    if (!payTargetId) return
    setPaying(true)
    setPayingId(payTargetId)
    try { await payrollService.pay(payTargetId); showSuccess('Marked as paid'); setConfirmPayOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Failed to mark payroll as paid') }
    finally { setPaying(false); setPayingId(null) }
  }, [payTargetId])

  const columns = useMemo<ColumnDef<PayrollEntry, any>[]>(() => [
    columnHelper.display({ id: 'employee', header: 'Employee', cell: ({ row }) => <Typography fontWeight={500}>{row.original.employeeId?.name || '-'}</Typography> }),
    columnHelper.accessor('month', { header: 'Month' }),
    columnHelper.accessor('baseSalary', { header: 'Base', cell: ({ row }) => `₨ ${row.original.baseSalary?.toFixed(2)}` }),
    columnHelper.accessor('netSalary', { header: 'Net Salary', cell: ({ row }) => <Typography fontWeight={500}>₨ {row.original.netSalary?.toFixed(2)}</Typography> }),
    columnHelper.accessor('status', { header: 'Status', cell: ({ row }) => <Chip label={row.original.status} color={row.original.status === 'PAID' ? 'success' : 'warning'} size='small' variant='tonal' /> }),
    columnHelper.display({ id: 'actions', header: '', cell: ({ row }) => row.original.status === 'PENDING' && canPay ? <Button size='small' variant='tonal' color='success' onClick={() => openPayConfirm(row.original._id)} disabled={payingId !== null} startIcon={payingId === row.original._id ? <CircularProgress size={20} color='inherit' /> : undefined}>{payingId === row.original._id ? 'Paying...' : 'Pay'}</Button> : null })
  ], [canPay, payingId])

  const table = useReactTable({ data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Payroll' action={<div className='flex gap-4 items-center'><CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />{canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => { setForm({ employeeId: '', month: '', baseSalary: 0, bonus: 0, deductions: 0 }); setOpen(true) }}>Add Payroll</Button>}</div>} />
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No payroll</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Add Payroll</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField select fullWidth label='Employee' value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}>{users.map(u => <MenuItem key={u._id} value={u._id}>{u.name}</MenuItem>)}</CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Month (YYYY-MM)' value={form.month} onChange={e => setForm(p => ({ ...p, month: e.target.value }))} placeholder='2026-04' /></Grid>
            <Grid size={{ xs: 4 }}><CustomTextField fullWidth label='Base Salary' type='number' value={form.baseSalary} onChange={e => setForm(p => ({ ...p, baseSalary: +e.target.value }))} /></Grid>
            <Grid size={{ xs: 4 }}><CustomTextField fullWidth label='Bonus' type='number' value={form.bonus} onChange={e => setForm(p => ({ ...p, bonus: +e.target.value }))} /></Grid>
            <Grid size={{ xs: 4 }}><CustomTextField fullWidth label='Deductions' type='number' value={form.deductions} onChange={e => setForm(p => ({ ...p, deductions: +e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
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
