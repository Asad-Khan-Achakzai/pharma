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
import TablePaginationComponent from '@components/TablePaginationComponent'
import { distributorsService } from '@/services/distributors.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'

import tableStyles from '@core/styles/table.module.css'

type Distributor = {
  _id: string
  name: string
  city: string
  phone: string
  email: string
  discountOnTP: number
  isActive: boolean
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const columnHelper = createColumnHelper<Distributor>()

const DistributorListPage = () => {
  const [data, setData] = useState<Distributor[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Distributor | null>(null)
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', phone: '', email: '', discountOnTP: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isFormValid = form.name.trim() !== ''

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('distributors.create')
  const canEdit = hasPermission('distributors.edit')
  const canDelete = hasPermission('distributors.delete')

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await distributorsService.list({ limit: 100 })
      setData(res.data || [])
    } catch (err) { showApiError(err, 'Failed to load distributors') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleOpen = (item?: Distributor) => {
    if (item) {
      setEditItem(item)
      setForm({ name: item.name, address: '', city: item.city || '', state: '', phone: item.phone || '', email: item.email || '', discountOnTP: item.discountOnTP || 0 })
    } else {
      setEditItem(null)
      setForm({ name: '', address: '', city: '', state: '', phone: '', email: '', discountOnTP: 0 })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editItem) {
        await distributorsService.update(editItem._id, form)
        showSuccess('Distributor updated')
      } else {
        await distributorsService.create(form)
        showSuccess('Distributor created')
      }
      setOpen(false)
      fetchData()
    } catch (err: any) { showApiError(err, 'Error saving distributor') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await distributorsService.remove(deleteId)
      showSuccess('Distributor deleted successfully')
      setConfirmOpen(false)
      fetchData()
    } catch (err) { showApiError(err, 'Error deleting distributor') }
    finally { setDeleting(false) }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Distributor, any>[]>(() => [
    columnHelper.accessor('name', { header: 'Name', cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography> }),
    columnHelper.accessor('city', { header: 'City' }),
    columnHelper.accessor('phone', { header: 'Phone' }),
    columnHelper.accessor('discountOnTP', { header: 'Discount on TP', cell: ({ row }) => `${row.original.discountOnTP}%` }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex gap-1'>
          {canEdit && <IconButton size='small' onClick={() => handleOpen(row.original)}><i className='tabler-edit text-textSecondary' /></IconButton>}
          {canDelete && <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}><i className='tabler-trash text-textSecondary' /></IconButton>}
        </div>
      )
    })
  ], [canEdit, canDelete])

  const table = useReactTable({
    data, columns, filterFns: { fuzzy: fuzzyFilter },
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
      <CardHeader title='Distributors' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>Add Distributor</Button>}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>
                    {h.isPlaceholder ? null : (
                      <div className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''} onClick={h.column.getToggleSortingHandler()}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {{ asc: ' 🔼', desc: ' 🔽' }[h.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className='text-center p-6'>No distributors found</td></tr>
            ) : table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editItem ? 'Edit Distributor' : 'Add Distributor'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Name' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='City' value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Address' value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Phone' value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Discount on TP (%)' type='number' value={form.discountOnTP} onChange={e => setForm(p => ({ ...p, discountOnTP: +e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Distributor?'
        description='This distributor will be removed. You can contact support to restore it if needed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default DistributorListPage
