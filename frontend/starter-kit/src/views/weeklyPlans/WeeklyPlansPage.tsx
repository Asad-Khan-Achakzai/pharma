'use client'
import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import tableStyles from '@core/styles/table.module.css'

type Plan = { _id: string; medicalRepId: any; weekStartDate: string; weekEndDate: string; status: string; doctorVisits: any[]; distributorVisits: any[] }
const columnHelper = createColumnHelper<Plan>()

const WeeklyPlansPage = () => {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('weeklyPlans.create')
  const [data, setData] = useState<Plan[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ weekStartDate: '', weekEndDate: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isFormValid = form.weekStartDate !== '' && form.weekEndDate !== ''

  const fetchData = async () => {
    setLoading(true)
    try { const { data: r } = await weeklyPlansService.list({ limit: 100 }); setData(r.data || []) }
    catch (err) { showApiError(err, 'Failed to load weekly plans') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    setSaving(true)
    try { await weeklyPlansService.create(form); showSuccess('Plan created'); setOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Failed to create plan') }
    finally { setSaving(false) }
  }

  const columns = useMemo<ColumnDef<Plan, any>[]>(() => [
    columnHelper.display({ id: 'rep', header: 'Rep', cell: ({ row }) => <Typography fontWeight={500}>{row.original.medicalRepId?.name || '-'}</Typography> }),
    columnHelper.display({ id: 'week', header: 'Week', cell: ({ row }) => `${new Date(row.original.weekStartDate).toLocaleDateString()} - ${new Date(row.original.weekEndDate).toLocaleDateString()}` }),
    columnHelper.accessor('status', { header: 'Status', cell: ({ row }) => <Chip label={row.original.status} color={row.original.status === 'REVIEWED' ? 'success' : row.original.status === 'SUBMITTED' ? 'info' : 'default'} size='small' variant='tonal' /> }),
    columnHelper.display({ id: 'visits', header: 'Visits', cell: ({ row }) => `${row.original.doctorVisits?.length || 0} doctors, ${row.original.distributorVisits?.length || 0} distributors` })
  ], [])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Weekly Plans' action={canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => { setForm({ weekStartDate: '', weekEndDate: '' }); setOpen(true) }}>New Plan</Button>} />
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No plans</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Create Weekly Plan</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 6 }}><CustomTextField required fullWidth label='Week Start' type='date' value={form.weekStartDate} onChange={e => setForm(p => ({ ...p, weekStartDate: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField required fullWidth label='Week End' type='date' value={form.weekEndDate} onChange={e => setForm(p => ({ ...p, weekEndDate: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Create'}</Button></DialogActions>
      </Dialog>
    </Card>
  )
}
export default WeeklyPlansPage
