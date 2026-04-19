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
import { productsService } from '@/services/products.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'

import tableStyles from '@core/styles/table.module.css'

type Product = {
  _id: string
  name: string
  composition: string
  mrp: number
  tp: number
  casting: number
  isActive: boolean
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const columnHelper = createColumnHelper<Product>()

const ProductListPage = () => {
  const [data, setData] = useState<Product[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', composition: '', mrp: 0, tp: 0, casting: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<Product | null>(null)

  const isFormValid = form.name.trim() !== '' && form.mrp > 0 && form.tp > 0 && form.casting > 0

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('products.create')
  const canEdit = hasPermission('products.edit')
  const canDelete = hasPermission('products.delete')

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: res } = await productsService.list({ limit: 100 })
      setData(res.data || [])
    } catch (err) { showApiError(err, 'Failed to load products') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleOpen = (item?: Product) => {
    if (item) {
      setEditItem(item)
      setForm({ name: item.name, composition: item.composition || '', mrp: item.mrp, tp: item.tp, casting: item.casting })
    } else {
      setEditItem(null)
      setForm({ name: '', composition: '', mrp: 0, tp: 0, casting: 0 })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editItem) {
        await productsService.update(editItem._id, form)
        showSuccess('Product updated')
      } else {
        await productsService.create(form)
        showSuccess('Product created')
      }
      setOpen(false)
      fetchData()
    } catch (err: any) { showApiError(err, 'Error saving product') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await productsService.remove(deleteId)
      showSuccess('Product deleted successfully')
      setConfirmOpen(false)
      fetchData()
    } catch (err) { showApiError(err, 'Error deleting product') }
    finally { setDeleting(false) }
  }, [deleteId])

  const columns = useMemo<ColumnDef<Product, any>[]>(() => [
    columnHelper.accessor('name', { header: 'Name', cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography> }),
    columnHelper.accessor('mrp', { header: 'MRP', cell: ({ row }) => `₨ ${row.original.mrp?.toFixed(2)}` }),
    columnHelper.accessor('tp', { header: 'TP', cell: ({ row }) => `₨ ${row.original.tp?.toFixed(2)}` }),
    columnHelper.accessor('casting', { header: 'Casting', cell: ({ row }) => `₨ ${row.original.casting?.toFixed(2)}` }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex gap-1'>
          <IconButton size='small' onClick={() => setViewItem(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
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
      <CardHeader title='Products' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>Add Product</Button>}
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
              <tr><td colSpan={columns.length} className='text-center p-6'>No products found</td></tr>
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
        <DialogTitle>{editItem ? 'Edit Product' : 'Add Product'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}><CustomTextField required fullWidth label='Name' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Composition' value={form.composition} onChange={e => setForm(p => ({ ...p, composition: e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField required fullWidth label='MRP' type='number' value={form.mrp} onChange={e => setForm(p => ({ ...p, mrp: +e.target.value }))} /></Grid>
            <Grid size={{ xs: 6 }}><CustomTextField required fullWidth label='TP' type='number' value={form.tp} onChange={e => setForm(p => ({ ...p, tp: +e.target.value }))} /></Grid>
            <Grid size={{ xs: 12 }}><CustomTextField required fullWidth label='Casting' type='number' value={form.casting} onChange={e => setForm(p => ({ ...p, casting: +e.target.value }))} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Product Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Name</Typography><Typography fontWeight={500}>{viewItem.name}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Composition</Typography><Typography>{viewItem.composition || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>MRP</Typography><Typography>₨ {viewItem.mrp?.toFixed(2)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>TP</Typography><Typography>₨ {viewItem.tp?.toFixed(2)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Casting</Typography><Typography>₨ {viewItem.casting?.toFixed(2)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Status</Typography><Typography>{viewItem.isActive ? 'Active' : 'Inactive'}</Typography></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewItem(null)}>Close</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete Product?'
        description='This product will be removed. You can contact support to restore it if needed.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default ProductListPage
