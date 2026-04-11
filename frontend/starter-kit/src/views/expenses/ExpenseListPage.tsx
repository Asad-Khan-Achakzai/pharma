'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { expensesService } from '@/services/expenses.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'

type Expense = { _id: string; category: string; amount: number; description: string; date: string }
const categories = ['LOGISTICS','OFFICE','OTHER']
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<Expense>()

const ExpenseListPage = () => {
  const [data, setData] = useState<Expense[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ category: 'OTHER', amount: 0, description: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isFormValid = form.category !== '' && form.amount > 0

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('expenses.create')
  const canDelete = hasPermission('expenses.delete')

  const fetchData = async () => {
    setLoading(true)
    try { const { data: r } = await expensesService.list({ limit: 100 }); setData(r.data || []) } catch (err) { showApiError(err, 'Failed to load expenses') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    setSaving(true)
    try { await expensesService.create(form); showSuccess('Expense added'); setOpen(false); fetchData() }
    catch (e: any) { showApiError(e, 'Error saving expense') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await expensesService.remove(deleteId); showSuccess('Expense deleted'); setConfirmOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Error deleting expense') }
    finally { setDeleting(false) }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Expense, any>[]>(() => [
    columnHelper.accessor('category', { header: 'Category', cell: ({ row }) => <Chip label={row.original.category} size='small' variant='tonal' /> }),
    columnHelper.accessor('amount', { header: 'Amount', cell: ({ row }) => <Typography fontWeight={500}>₨ {row.original.amount?.toFixed(2)}</Typography> }),
    columnHelper.accessor('description', { header: 'Description' }),
    columnHelper.display({ id: 'date', header: 'Date', cell: ({ row }) => new Date(row.original.date).toLocaleDateString() }),
    columnHelper.display({ id: 'actions', header: '', cell: ({ row }) => canDelete ? <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}><i className='tabler-trash text-textSecondary' /></IconButton> : null })
  ], [canDelete])

  const table = useReactTable({ data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Expenses' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => { setForm({ category: 'OTHER', amount: 0, description: '' }); setOpen(true) }}>Add Expense</Button>}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No expenses</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Add Expense</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField select required fullWidth label='Category' value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>{categories.map(c => <MenuItem key={c} value={c}>{c.replace('_', ' ')}</MenuItem>)}</CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Amount' type='number' value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} /></Grid>
            <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Description' value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Expense?'
        description='This expense record and its linked transaction will be removed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}
export default ExpenseListPage
