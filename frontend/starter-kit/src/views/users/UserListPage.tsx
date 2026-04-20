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
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { usersService } from '@/services/users.service'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'

type User = { _id: string; name: string; email: string; role: string; phone: string; permissions: string[]; isActive: boolean; lastLoginAt?: string | null }

const PERMISSION_GROUPS: Record<string, string[]> = {
  dashboard: ['dashboard.view'],
  products: ['products.view', 'products.create', 'products.edit', 'products.delete'],
  distributors: ['distributors.view', 'distributors.create', 'distributors.edit', 'distributors.delete'],
  inventory: ['inventory.view', 'inventory.transfer'],
  pharmacies: ['pharmacies.view', 'pharmacies.create', 'pharmacies.edit', 'pharmacies.delete'],
  doctors: ['doctors.view', 'doctors.create', 'doctors.edit', 'doctors.delete'],
  orders: ['orders.view', 'orders.create', 'orders.edit', 'orders.deliver', 'orders.return'],
  payments: ['payments.view', 'payments.create'],
  ledger: ['ledger.view'],
  targets: ['targets.view', 'targets.create', 'targets.edit'],
  weeklyPlans: ['weeklyPlans.view', 'weeklyPlans.create', 'weeklyPlans.edit', 'weeklyPlans.markVisit'],
  expenses: ['expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'],
  payroll: ['payroll.view', 'payroll.create', 'payroll.edit', 'payroll.pay'],
  reports: ['reports.view'],
  users: ['users.view', 'users.create', 'users.edit', 'users.delete']
}

const ALL_PERMISSIONS: string[] = Object.values(PERMISSION_GROUPS).flat()

/** Always granted for Medical Rep users; cannot be removed in the UI. */
const DASHBOARD_VIEW = 'dashboard.view'

const ensureDashboardPermission = (perms: string[]) =>
  perms.includes(DASHBOARD_VIEW) ? perms : [...perms, DASHBOARD_VIEW]

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<User>()

const UserListPage = () => {
  const [data, setData] = useState<User[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEDICAL_REP', phone: '', permissions: [] as string[] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<User | null>(null)

  const isFormValid = form.name.trim() !== '' && form.email.trim() !== '' && form.role !== '' && (editItem ? true : form.password.trim() !== '')

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('users.create')
  const canEdit = hasPermission('users.edit')
  const canDelete = hasPermission('users.delete')

  const fetchData = async () => {
    setLoading(true)
    try { const { data: r } = await usersService.list({ limit: 100 }); setData(r.data || []) } catch (err) { showApiError(err, 'Failed to load users') }
    finally { setLoading(false) }
  }
  useEffect(() => { fetchData() }, [])

  const handleOpen = (item?: User) => {
    if (item) {
      setEditItem(item)
      setForm({
        name: item.name,
        email: item.email,
        password: '',
        role: item.role,
        phone: item.phone || '',
        permissions: item.role === 'MEDICAL_REP' ? ensureDashboardPermission(item.permissions || []) : item.permissions || []
      })
    } else {
      setEditItem(null)
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'MEDICAL_REP',
        phone: '',
        permissions: [DASHBOARD_VIEW]
      })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: any = { ...form }
      if (payload.role === 'MEDICAL_REP' && Array.isArray(payload.permissions)) {
        payload.permissions = ensureDashboardPermission(payload.permissions)
      }
      if (editItem) { delete payload.password; await usersService.update(editItem._id, payload); showSuccess('User updated') }
      else { await usersService.create(payload); showSuccess('User created') }
      setOpen(false); fetchData()
    } catch (e: any) { showApiError(e, 'Error saving user') }
    finally { setSaving(false) }
  }

  const openDeleteConfirm = (id: string) => { setDeleteId(id); setConfirmOpen(true) }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try { await usersService.remove(deleteId); showSuccess('User deleted successfully'); setConfirmOpen(false); fetchData() }
    catch (err) { showApiError(err, 'Error deleting user') }
    finally { setDeleting(false) }
  }, [deleteId])

  const togglePermission = (perm: string) => {
    if (perm === DASHBOARD_VIEW) return
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }))
  }

  const selectAllPermissions = useCallback(() => {
    setForm(prev => ({ ...prev, permissions: ensureDashboardPermission([...ALL_PERMISSIONS]) }))
  }, [])

  const clearAllPermissions = useCallback(() => {
    setForm(prev => ({ ...prev, permissions: [DASHBOARD_VIEW] }))
  }, [])

  const columns = useMemo<ColumnDef<User, any>[]>(() => [
    columnHelper.accessor('name', { header: 'Name', cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography> }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('role', {
      header: 'Role',
      cell: ({ row }) => (
        <Chip
          label={row.original.role}
          color={
            row.original.role === 'ADMIN'
              ? 'primary'
              : row.original.role === 'SUPER_ADMIN'
                ? 'secondary'
                : 'default'
          }
          size='small'
          variant='tonal'
        />
      )
    }),
    columnHelper.display({ id: 'status', header: 'Status', cell: ({ row }) => <Chip label={row.original.isActive ? 'Active' : 'Inactive'} color={row.original.isActive ? 'success' : 'error'} size='small' variant='tonal' /> }),
    columnHelper.display({ id: 'actions', header: 'Actions', cell: ({ row }) => (
      <div className='flex gap-1'>
        <IconButton size='small' onClick={() => setViewItem(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
        {canEdit && <IconButton size='small' onClick={() => handleOpen(row.original)}><i className='tabler-edit text-textSecondary' /></IconButton>}
        {canDelete && <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}><i className='tabler-trash text-textSecondary' /></IconButton>}
      </div>
    ) })
  ], [canEdit, canDelete])

  const table = useReactTable({ data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Users' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>Add User</Button>}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No users</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>{editItem ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Name' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></Grid>
            {!editItem && <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Password' type='password' value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></Grid>}
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required select fullWidth label='Role' value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}><MenuItem value='ADMIN'>Admin</MenuItem><MenuItem value='MEDICAL_REP'>Medical Rep</MenuItem></CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Phone' value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Grid>
            {form.role === 'MEDICAL_REP' && (
              <Grid size={{ xs: 12 }}>
                <div className='flex flex-wrap items-center justify-between gap-2 mbe-2'>
                  <Typography variant='h6'>Permissions</Typography>
                  <div className='flex flex-wrap gap-2'>
                    <Button size='small' variant='outlined' onClick={selectAllPermissions}>
                      Select all
                    </Button>
                    <Button size='small' variant='outlined' onClick={clearAllPermissions}>
                      Clear all
                    </Button>
                  </div>
                </div>
                {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
                  <div key={group} className='mbe-2'>
                    <Typography variant='subtitle2' className='capitalize mbe-1'>{group}</Typography>
                    <div className='flex flex-wrap gap-1'>
                      {perms.map(perm => {
                        const isLockedDashboard = perm === DASHBOARD_VIEW
                        return (
                          <FormControlLabel
                            key={perm}
                            control={
                              <Checkbox
                                size='small'
                                checked={isLockedDashboard ? true : form.permissions.includes(perm)}
                                disabled={isLockedDashboard}
                                onChange={() => togglePermission(perm)}
                              />
                            }
                            label={perm.split('.')[1]}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Name</Typography><Typography fontWeight={500}>{viewItem.name}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Email</Typography><Typography>{viewItem.email}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Role</Typography><Chip label={viewItem.role} color={viewItem.role === 'ADMIN' ? 'primary' : viewItem.role === 'SUPER_ADMIN' ? 'secondary' : 'default'} size='small' variant='tonal' /></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Status</Typography><Chip label={viewItem.isActive ? 'Active' : 'Inactive'} color={viewItem.isActive ? 'success' : 'error'} size='small' variant='tonal' /></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Phone</Typography><Typography>{viewItem.phone || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Last Login</Typography><Typography>{viewItem.lastLoginAt ? new Date(viewItem.lastLoginAt).toLocaleString() : '-'}</Typography></Grid>
              {viewItem.permissions && viewItem.permissions.length > 0 && (
                <Grid size={{ xs: 12 }}><Typography variant='body2' color='text.secondary' className='mbe-1'>Permissions</Typography><div className='flex flex-wrap gap-1'>{viewItem.permissions.map(p => <Chip key={p} label={p} size='small' variant='tonal' />)}</div></Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewItem(null)}>Close</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete User?'
        description='This user will be removed and will no longer be able to log in.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}
export default UserListPage
