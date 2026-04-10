'use client'
import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { targetsService } from '@/services/targets.service'
import { usersService } from '@/services/users.service'
import tableStyles from '@core/styles/table.module.css'

type Target = { _id: string; medicalRepId: any; month: string; salesTarget: number; achievedSales: number; packsTarget: number; achievedPacks: number }
const columnHelper = createColumnHelper<Target>()

const parseYyyyMm = (s: string): Date | null => {
  const t = s.trim()
  if (!/^\d{4}-\d{2}$/.test(t)) return null
  const [y, m] = t.split('-').map(Number)
  if (m < 1 || m > 12) return null
  return new Date(y, m - 1, 1)
}

const formatYyyyMm = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const TargetsPage = () => {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('targets.create')
  const [data, setData] = useState<Target[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ medicalRepId: '', month: '', salesTarget: 0, packsTarget: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isFormValid = form.medicalRepId !== '' && form.month.trim() !== '' && form.salesTarget > 0 && form.packsTarget > 0

  const fetchData = async () => {
    setLoading(true)
    try { const [t, u] = await Promise.all([targetsService.list({ limit: 100 }), usersService.list({ limit: 100 })]); setData(t.data.data || []); setUsers(u.data.data || []) }
    catch (err) { showApiError(err, 'Failed to load targets') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleSave = async () => {
    setSaving(true)
    try { await targetsService.create(form); showSuccess('Target created'); setOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Failed to create target') }
    finally { setSaving(false) }
  }

  const columns = useMemo<ColumnDef<Target, any>[]>(() => [
    columnHelper.display({ id: 'rep', header: 'Rep', cell: ({ row }) => <Typography fontWeight={500}>{row.original.medicalRepId?.name || '-'}</Typography> }),
    columnHelper.accessor('month', { header: 'Month' }),
    columnHelper.display({ id: 'salesProgress', header: 'Sales Progress', cell: ({ row }) => { const pct = row.original.salesTarget > 0 ? Math.min((row.original.achievedSales / row.original.salesTarget) * 100, 100) : 0; return <div><LinearProgress variant='determinate' value={pct} /><Typography variant='caption'>{row.original.achievedSales?.toFixed(0)} / {row.original.salesTarget?.toFixed(0)}</Typography></div> } }),
    columnHelper.display({ id: 'packsProgress', header: 'Packs Progress', cell: ({ row }) => { const pct = row.original.packsTarget > 0 ? Math.min((row.original.achievedPacks / row.original.packsTarget) * 100, 100) : 0; return <div><LinearProgress variant='determinate' value={pct} color='secondary' /><Typography variant='caption'>{row.original.achievedPacks} / {row.original.packsTarget}</Typography></div> } })
  ], [])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Targets' action={canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => {
              setForm({
                medicalRepId: '',
                month: formatYyyyMm(new Date()),
                salesTarget: 0,
                packsTarget: 0
              })
              setOpen(true)
            }}>Add Target</Button>} />
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No targets</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Add Target</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField select required fullWidth label='Medical Rep' value={form.medicalRepId} onChange={e => setForm(p => ({ ...p, medicalRepId: e.target.value }))}>{users.filter((u: any) => u.role === 'MEDICAL_REP').map((u: any) => <MenuItem key={u._id} value={u._id}>{u.name}</MenuItem>)}</CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AppReactDatepicker
                showMonthYearPicker
                selected={parseYyyyMm(form.month) ?? new Date()}
                id='targets-month-picker'
                dateFormat='yyyy-MM'
                onChange={(date: Date | null) => {
                  setForm(p => ({ ...p, month: date ? formatYyyyMm(date) : '' }))
                }}
                customInput={<CustomTextField fullWidth required label='Month (YYYY-MM)' helperText='YYYY-MM' />}
              />
            </Grid>
            <Grid size={{ xs: 6 }}><CustomTextField required fullWidth label='Sales Target' type='number' value={form.salesTarget} onChange={e => setForm(p => ({ ...p, salesTarget: +e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField required fullWidth label='Packs Target' type='number' value={form.packsTarget} onChange={e => setForm(p => ({ ...p, packsTarget: +e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>
    </Card>
  )
}
export default TargetsPage
