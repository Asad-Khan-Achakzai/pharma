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
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { doctorsService } from '@/services/doctors.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

type Doctor = { _id: string; name: string; specialization: string; phone: string; pharmacyId: any; isActive: boolean }

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<Doctor>()

const DoctorListPage = () => {
  const [data, setData] = useState<Doctor[]>([])
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Doctor | null>(null)
  const [form, setForm] = useState({ pharmacyId: '', name: '', specialization: '', phone: '', email: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isFormValid = form.pharmacyId !== '' && form.name.trim() !== ''

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('doctors.create')
  const canEdit = hasPermission('doctors.edit')
  const canDelete = hasPermission('doctors.delete')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [docsRes, pharmaRes] = await Promise.all([doctorsService.list({ limit: 100 }), pharmaciesService.list({ limit: 100 })])
      setData(docsRes.data.data || [])
      setPharmacies(pharmaRes.data.data || [])
    } catch (err) { showApiError(err, 'Failed to load data') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleOpen = (item?: Doctor) => {
    if (item) { setEditItem(item); setForm({ pharmacyId: item.pharmacyId?._id || '', name: item.name, specialization: item.specialization || '', phone: item.phone || '', email: '' }) }
    else { setEditItem(null); setForm({ pharmacyId: '', name: '', specialization: '', phone: '', email: '' }) }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editItem) { await doctorsService.update(editItem._id, form); showSuccess('Doctor updated') }
      else { await doctorsService.create(form); showSuccess('Doctor created') }
      setOpen(false); fetchData()
    } catch (err: any) { showApiError(err, 'Error saving doctor') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await doctorsService.remove(deleteId); showSuccess('Doctor deleted successfully'); setConfirmOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Error deleting doctor') }
    finally { setDeleting(false) }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Doctor, any>[]>(() => [
    columnHelper.accessor('name', { header: 'Name', cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography> }),
    columnHelper.accessor('specialization', { header: 'Specialization' }),
    columnHelper.display({ id: 'pharmacy', header: 'Pharmacy', cell: ({ row }) => row.original.pharmacyId?.name || '-' }),
    columnHelper.accessor('phone', { header: 'Phone' }),
    columnHelper.display({ id: 'actions', header: 'Actions', cell: ({ row }) => (
      <div className='flex gap-1'>
        {canEdit && <IconButton size='small' onClick={() => handleOpen(row.original)}><i className='tabler-edit text-textSecondary' /></IconButton>}
        {canDelete && <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}><i className='tabler-trash text-textSecondary' /></IconButton>}
      </div>
    ) })
  ], [canEdit, canDelete])

  const table = useReactTable({
    data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader title='Doctors' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>Add Doctor</Button>}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : <div className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''} onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{{ asc: ' 🔼', desc: ' 🔽' }[h.column.getIsSorted() as string] ?? null}</div>}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No doctors found</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editItem ? 'Edit Doctor' : 'Add Doctor'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}><CustomTextField required select fullWidth label='Pharmacy' value={form.pharmacyId} onChange={e => setForm(p => ({ ...p, pharmacyId: e.target.value }))}>{pharmacies.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}</CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Name' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Specialization' value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Phone' value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Doctor?'
        description='This doctor will be removed. You can contact support to restore it if needed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default DoctorListPage
