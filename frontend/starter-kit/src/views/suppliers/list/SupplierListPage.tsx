'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
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
import { supplierService } from '@/services/supplier.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { normalizeDocs } from '@/utils/apiList'

import tableStyles from '@core/styles/table.module.css'

type SupplierRow = {
  _id: string
  name: string
  phone?: string
  email?: string
  address?: string
  openingBalance?: number
  notes?: string
  isActive?: boolean
}

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const columnHelper = createColumnHelper<SupplierRow>()

const SupplierListPage = () => {
  const [data, setData] = useState<SupplierRow[]>([])
  const [payableById, setPayableById] = useState<Record<string, number>>({})
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<SupplierRow | null>(null)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    openingBalance: 0,
    notes: '',
    isActive: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [payOpen, setPayOpen] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [ledgerSupplier, setLedgerSupplier] = useState<SupplierRow | null>(null)
  const [ledgerAmount, setLedgerAmount] = useState('')
  const [ledgerNotes, setLedgerNotes] = useState('')
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK' | 'CHEQUE' | 'OTHER'>('BANK')
  const [ledgerRef, setLedgerRef] = useState('')
  const [ledgerSaving, setLedgerSaving] = useState(false)

  const isFormValid = form.name.trim() !== ''

  const { hasPermission } = useAuth()
  const canView = hasPermission('suppliers.view')
  const canManage = hasPermission('suppliers.manage')

  const fetchPayables = useCallback(async () => {
    try {
      const res = await supplierService.balancesSummary()
      const payload = (res.data as any)?.data ?? res.data
      const rows = (payload?.rows || []) as { supplierId?: string; payable?: number }[]
      const map: Record<string, number> = {}
      for (const r of rows) {
        const id = r.supplierId != null ? String(r.supplierId) : ''
        if (id) map[id] = r.payable ?? 0
      }
      setPayableById(map)
    } catch {
      setPayableById({})
    }
  }, [])

  const fetchData = async () => {
    if (!canView) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await supplierService.list({ limit: '100' })
      setData(normalizeDocs<SupplierRow>(res))
      await fetchPayables()
    } catch (err) {
      showApiError(err, 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [canView])

  const handleOpen = (item?: SupplierRow) => {
    if (item) {
      setEditItem(item)
      setForm({
        name: item.name,
        phone: item.phone || '',
        email: item.email || '',
        address: item.address || '',
        openingBalance: item.openingBalance ?? 0,
        notes: item.notes || '',
        isActive: item.isActive !== false
      })
    } else {
      setEditItem(null)
      setForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        openingBalance: 0,
        notes: '',
        isActive: true
      })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        openingBalance: Number(form.openingBalance) || 0,
        notes: form.notes || undefined,
        isActive: form.isActive
      }
      if (editItem) {
        await supplierService.update(editItem._id, payload)
        showSuccess('Supplier updated')
      } else {
        await supplierService.create(payload)
        showSuccess('Supplier created')
      }
      setOpen(false)
      fetchData()
    } catch (err: any) {
      showApiError(err, 'Error saving supplier')
    } finally {
      setSaving(false)
    }
  }

  const openDeleteConfirm = (id: string) => {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await supplierService.remove(deleteId)
      showSuccess('Supplier deleted')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting supplier')
    } finally {
      setDeleting(false)
    }
  }, [deleteId])

  const submitLedger = async (mode: 'payment' | 'purchase') => {
    if (!ledgerSupplier) return
    const amount = parseFloat(ledgerAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      showApiError(null, 'Enter a valid positive amount')
      return
    }
    setLedgerSaving(true)
    try {
      if (mode === 'payment') {
        const res = await supplierService.recordPayment(ledgerSupplier._id, {
          amount,
          notes: ledgerNotes || undefined,
          paymentMethod: payMethod,
          referenceNumber: ledgerRef || undefined
        })
        const payload = (res.data as any)?.data ?? res.data
        const warnings = (payload as { warnings?: string[] })?.warnings
        showSuccess(warnings?.length ? `Payment recorded. ${warnings[0]}` : 'Payment recorded')
        setPayOpen(false)
      } else {
        const body = { amount, notes: ledgerNotes || undefined }
        await supplierService.recordPurchase(ledgerSupplier._id, body as { amount: number; notes?: string })
        showSuccess('Purchase / adjustment recorded')
        setPurchaseOpen(false)
      }
      setLedgerSupplier(null)
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to save')
    } finally {
      setLedgerSaving(false)
    }
  }

  const openLedger = useCallback((supplier: SupplierRow, mode: 'payment' | 'purchase') => {
    setLedgerSupplier(supplier)
    setLedgerAmount('')
    setLedgerNotes('')
    setLedgerRef('')
    setPayMethod('BANK')
    if (mode === 'payment') setPayOpen(true)
    else setPurchaseOpen(true)
  }, [])

  const columns = useMemo<ColumnDef<SupplierRow, any>[]>(() => {
    return [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography>
      }),
      columnHelper.accessor('phone', { header: 'Phone' }),
      columnHelper.accessor('email', { header: 'Email' }),
      columnHelper.display({
        id: 'payable',
        header: 'Payable',
        cell: ({ row }) => {
          const p = payableById[row.original._id]
          return p != null ? (
            <Typography color={p > 0 ? 'warning.main' : 'text.secondary'}>{formatPKR(p)}</Typography>
          ) : (
            '—'
          )
        }
      }),
      columnHelper.display({
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (row.original.isActive === false ? 'Inactive' : 'Active')
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex flex-wrap gap-0'>
            <Link href={`/suppliers/${row.original._id}`} className='inline-flex items-center' title='Supplier detail'>
              <i className='tabler-external-link text-textSecondary' />
            </Link>
            {canManage && (
              <>
                <IconButton size='small' title='Payment to supplier' onClick={() => openLedger(row.original, 'payment')}>
                  <i className='tabler-cash text-textSecondary' />
                </IconButton>
                <IconButton size='small' title='Manual purchase / liability' onClick={() => openLedger(row.original, 'purchase')}>
                  <i className='tabler-file-plus text-textSecondary' />
                </IconButton>
              </>
            )}
            {canManage && (
              <IconButton size='small' onClick={() => handleOpen(row.original)}>
                <i className='tabler-edit text-textSecondary' />
              </IconButton>
            )}
            {canManage && (
              <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}>
                <i className='tabler-trash text-textSecondary' />
              </IconButton>
            )}
          </div>
        )
      })
    ]
  }, [canManage, payableById, openLedger, handleOpen, openDeleteConfirm])

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

  if (!canView) {
    return (
      <Card>
        <CardContent className='p-6'>
          <Typography color='text.secondary'>You do not have permission to view suppliers.</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Suppliers (factories)'
        subheader='Create suppliers here, then select them on stock transfers to track payables. PURCHASE lines are liabilities only, not expenses.'
      />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder='Search...'
        />
        {canManage && (
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>
            Add supplier
          </Button>
        )}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>
                    {h.isPlaceholder ? null : (
                      <div
                        className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={h.column.getToggleSortingHandler()}
                      >
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
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className='text-center p-6'>
                  No suppliers yet. Add one or grant suppliers.view on your user.
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
        <DialogTitle>{editItem ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                required
                fullWidth
                label='Name'
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label='Phone' value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField fullWidth label='Email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField fullWidth label='Address' value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Opening balance owed (PKR)'
                type='number'
                value={form.openingBalance}
                onChange={e => setForm(p => ({ ...p, openingBalance: +e.target.value }))}
                helperText='Amount you already owed before using this ledger'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                select
                label='Status'
                value={form.isActive ? 'active' : 'inactive'}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'active' }))}
              >
                <MenuItem value='active'>Active</MenuItem>
                <MenuItem value='inactive'>Inactive</MenuItem>
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Notes'
                multiline
                minRows={2}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={saving || !isFormValid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Payment to {ledgerSupplier?.name}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <CustomTextField
            fullWidth
            label='Amount (PKR)'
            type='number'
            value={ledgerAmount}
            onChange={e => setLedgerAmount(e.target.value)}
          />
          <CustomTextField
            fullWidth
            select
            label='Payment method'
            value={payMethod}
            onChange={e => setPayMethod(e.target.value as typeof payMethod)}
          >
            <MenuItem value='CASH'>Cash</MenuItem>
            <MenuItem value='BANK'>Bank</MenuItem>
            <MenuItem value='CHEQUE'>Cheque</MenuItem>
            <MenuItem value='OTHER'>Other</MenuItem>
          </CustomTextField>
          <CustomTextField
            fullWidth
            label='Reference (cheque no / transaction id)'
            value={ledgerRef}
            onChange={e => setLedgerRef(e.target.value)}
          />
          <CustomTextField fullWidth label='Notes' value={ledgerNotes} onChange={e => setLedgerNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayOpen(false)}>Cancel</Button>
          <Button variant='contained' disabled={ledgerSaving} onClick={() => submitLedger('payment')}>
            {ledgerSaving ? 'Saving...' : 'Record payment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={purchaseOpen} onClose={() => setPurchaseOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Manual purchase / liability — {ledgerSupplier?.name}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <Typography variant='caption' color='text.secondary'>
            Increases payable (e.g. stock received without a transfer). Not a PnL expense.
          </Typography>
          <CustomTextField
            fullWidth
            label='Amount (PKR)'
            type='number'
            value={ledgerAmount}
            onChange={e => setLedgerAmount(e.target.value)}
          />
          <CustomTextField fullWidth label='Notes' value={ledgerNotes} onChange={e => setLedgerNotes(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurchaseOpen(false)}>Cancel</Button>
          <Button variant='contained' disabled={ledgerSaving} onClick={() => submitLedger('purchase')}>
            {ledgerSaving ? 'Saving...' : 'Record'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete supplier?'
        description='Remove this supplier. Existing ledger entries stay in the database for audit; you may hide inactive suppliers instead.'
        confirmText='Delete'
        loading={deleting}
      />
    </Card>
  )
}

export default SupplierListPage
