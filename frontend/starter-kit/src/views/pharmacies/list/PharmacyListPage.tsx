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
import CircularProgress from '@mui/material/CircularProgress'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { pharmaciesService } from '@/services/pharmacies.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

type Pharmacy = {
  _id: string
  name: string
  city: string
  phone: string
  email: string
  address: string
  discountOnTP: number
  bonusScheme?: { buyQty?: number; getQty?: number }
  isActive: boolean
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<Pharmacy>()

const PharmacyListPage = () => {
  const [data, setData] = useState<Pharmacy[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Pharmacy | null>(null)
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    discountOnTP: 0,
    bonusScheme: { buyQty: 0, getQty: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<Pharmacy | null>(null)

  const isFormValid = form.name.trim() !== ''

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('pharmacies.create')
  const canEdit = hasPermission('pharmacies.edit')
  const canDelete = hasPermission('pharmacies.delete')

  const fetchData = async () => {
    setLoading(true)
    try { const { data: res } = await pharmaciesService.list({ limit: 100 }); setData(res.data || []) } catch (err) { showApiError(err, 'Failed to load pharmacies') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleOpen = (item?: Pharmacy) => {
    if (item) {
      setEditItem(item)
      setForm({
        name: item.name,
        address: item.address || '',
        city: item.city || '',
        state: '',
        phone: item.phone || '',
        email: item.email || '',
        discountOnTP: item.discountOnTP ?? 0,
        bonusScheme: {
          buyQty: item.bonusScheme?.buyQty ?? 0,
          getQty: item.bonusScheme?.getQty ?? 0
        }
      })
    } else {
      setEditItem(null)
      setForm({
        name: '',
        address: '',
        city: '',
        state: '',
        phone: '',
        email: '',
        discountOnTP: 0,
        bonusScheme: { buyQty: 0, getQty: 0 }
      })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editItem) { await pharmaciesService.update(editItem._id, form); showSuccess('Pharmacy updated') }
      else { await pharmaciesService.create(form); showSuccess('Pharmacy created') }
      setOpen(false); fetchData()
    } catch (err: any) { showApiError(err, 'Error saving pharmacy') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await pharmaciesService.remove(deleteId); showSuccess('Pharmacy deleted successfully'); setConfirmOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Error deleting pharmacy') }
    finally { setDeleting(false) }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Pharmacy, any>[]>(() => [
    columnHelper.accessor('name', { header: 'Name', cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography> }),
    columnHelper.accessor('city', { header: 'City' }),
    columnHelper.accessor('phone', { header: 'Phone' }),
    columnHelper.accessor('discountOnTP', { header: 'Disc. on TP %', cell: ({ row }) => `${row.original.discountOnTP ?? 0}%` }),
    columnHelper.display({ id: 'actions', header: 'Actions', cell: ({ row }) => (
      <div className='flex gap-1'>
        <IconButton size='small' onClick={() => setViewItem(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
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
      <CardHeader title='Pharmacies' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>Add Pharmacy</Button>}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : <div className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''} onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{{ asc: ' 🔼', desc: ' 🔽' }[h.column.getIsSorted() as string] ?? null}</div>}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No pharmacies found</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Pharmacy Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 12 }}><Typography variant='body2' color='text.secondary'>Name</Typography><Typography fontWeight={500}>{viewItem.name}</Typography></Grid>
              <Grid size={{ xs: 12 }}><Typography variant='body2' color='text.secondary'>Address</Typography><Typography>{viewItem.address?.trim() ? viewItem.address : '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>City</Typography><Typography>{viewItem.city || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Phone</Typography><Typography>{viewItem.phone || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Email</Typography><Typography>{viewItem.email || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Discount on TP</Typography><Typography>{viewItem.discountOnTP ?? 0}%</Typography></Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>Bonus scheme (Buy X Get Y)</Typography>
                <Typography>
                  {(viewItem.bonusScheme?.buyQty ?? 0) > 0 && (viewItem.bonusScheme?.getQty ?? 0) > 0
                    ? `Buy ${viewItem.bonusScheme?.buyQty} — Get ${viewItem.bonusScheme?.getQty} free`
                    : 'None'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Status</Typography><Chip label={viewItem.isActive ? 'Active' : 'Inactive'} color={viewItem.isActive ? 'success' : 'error'} size='small' variant='tonal' /></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewItem(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editItem ? 'Edit Pharmacy' : 'Add Pharmacy'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Name' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='City' value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Address' value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Phone' value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField fullWidth label='Email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Discount on TP %' type='number' value={form.discountOnTP} onChange={e => setForm(p => ({ ...p, discountOnTP: +e.target.value }))} helperText='Default pharmacy discount applied on trade price for new orders' /></Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant='subtitle2' className='mbe-2'>
                Bonus scheme (Buy X Get Y)
              </Typography>
              <Grid container spacing={3}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <CustomTextField
                    fullWidth
                    label='Buy qty (X)'
                    type='number'
                    value={form.bonusScheme.buyQty}
                    onChange={e =>
                      setForm(p => ({
                        ...p,
                        bonusScheme: { ...p.bonusScheme, buyQty: Math.max(0, +e.target.value) }
                      }))
                    }
                    helperText='Set 0 to disable'
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <CustomTextField
                    fullWidth
                    label='Get qty (Y) free'
                    type='number'
                    value={form.bonusScheme.getQty}
                    onChange={e =>
                      setForm(p => ({
                        ...p,
                        bonusScheme: { ...p.bonusScheme, getQty: Math.max(0, +e.target.value) }
                      }))
                    }
                    helperText='Free units per full X paid'
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Pharmacy?'
        description='This pharmacy will be removed. You can contact support to restore it if needed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default PharmacyListPage
