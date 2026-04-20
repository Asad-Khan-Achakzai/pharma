'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import MenuItem from '@mui/material/MenuItem'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import { usersService } from '@/services/users.service'
import tableStyles from '@core/styles/table.module.css'

type Plan = {
  _id: string
  medicalRepId: any
  weekStartDate: string
  weekEndDate: string
  status: string
  notes?: string
  doctorVisits?: any[]
  distributorVisits?: any[]
  planItems?: any[]
  planItemsCount?: number
}

const columnHelper = createColumnHelper<Plan>()

const WeeklyPlansPage = () => {
  const router = useRouter()
  const { hasPermission, user } = useAuth()
  const canCreate = hasPermission('weeklyPlans.create')
  const canListUsers = hasPermission('users.view')
  const [data, setData] = useState<Plan[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    medicalRepId: '',
    weekStartDate: '',
    weekEndDate: '',
    notes: '',
    status: 'DRAFT'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isFormValid =
    form.weekStartDate !== '' &&
    form.weekEndDate !== '' &&
    (canListUsers ? form.medicalRepId !== '' : Boolean(user?._id))

  const fetchData = async () => {
    setLoading(true)
    try {
      const r = await weeklyPlansService.list({ limit: 100 })
      setData(r.data.data || [])
      if (canListUsers) {
        const u = await usersService.list({ role: 'MEDICAL_REP', limit: 100 })
        setReps(u.data.data || [])
      } else {
        setReps([])
      }
    } catch (err) {
      showApiError(err, 'Failed to load weekly plans')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchData()
  }, [])

  const handleSave = async () => {
    const medicalRepId = canListUsers ? form.medicalRepId : user?._id
    if (!medicalRepId) {
      showApiError(null, 'Could not determine assignee')
      return
    }
    setSaving(true)
    try {
      await weeklyPlansService.create({
        medicalRepId,
        weekStartDate: form.weekStartDate,
        weekEndDate: form.weekEndDate,
        notes: form.notes || undefined,
        status: form.status
      })
      showSuccess('Plan created')
      setOpen(false)
      setForm({
        medicalRepId: '',
        weekStartDate: '',
        weekEndDate: '',
        notes: '',
        status: 'DRAFT'
      })
      fetchData()
    } catch (err) {
      showApiError(err, 'Failed to create plan')
    } finally {
      setSaving(false)
    }
  }

  const itemCount = (p: Plan) =>
    (p.planItemsCount ?? 0) > 0
      ? p.planItemsCount!
      : (p.doctorVisits?.length || 0) + (p.distributorVisits?.length || 0)

  const columns = useMemo<ColumnDef<Plan, any>[]>(
    () => [
      columnHelper.display({
        id: 'rep',
        header: 'Rep',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.medicalRepId?.name || '-'}</Typography>
      }),
      columnHelper.display({
        id: 'week',
        header: 'Week',
        cell: ({ row }) =>
          `${new Date(row.original.weekStartDate).toLocaleDateString()} - ${new Date(row.original.weekEndDate).toLocaleDateString()}`
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status
          const color =
            s === 'COMPLETED' || s === 'REVIEWED'
              ? 'success'
              : s === 'ACTIVE' || s === 'SUBMITTED'
                ? 'info'
                : 'default'
          return <Chip label={s} color={color as any} size='small' variant='tonal' />
        }
      }),
      columnHelper.display({
        id: 'visits',
        header: 'Items',
        cell: ({ row }) => {
          const n = itemCount(row.original)
          const legacy = (row.original.doctorVisits?.length || 0) + (row.original.distributorVisits?.length || 0)
          const hasNew = (row.original.planItemsCount ?? 0) > 0
          return !hasNew && legacy > 0 ? `${legacy} (legacy)` : `${n} scheduled`
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button size='small' variant='outlined' onClick={() => router.push(`/weekly-plans/${row.original._id}`)}>
            Open
          </Button>
        )
      })
    ],
    [router]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader
        title='Weekly Plans'
        action={
          canCreate && (
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              onClick={() => {
                setForm({
                  medicalRepId: canListUsers ? '' : user?._id || '',
                  weekStartDate: '',
                  weekEndDate: '',
                  notes: '',
                  status: 'DRAFT'
                })
                setOpen(true)
              }}
            >
              New Plan
            </Button>
          )
        }
      />
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
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
                  No plans
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
        <DialogTitle>Create Weekly Plan</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            {canListUsers ? (
              <Grid size={{ xs: 12 }}>
                <CustomTextField
                  required
                  select
                  fullWidth
                  label='Medical rep'
                  value={form.medicalRepId}
                  onChange={e => setForm(p => ({ ...p, medicalRepId: e.target.value }))}
                >
                  {reps.map((u: any) => (
                    <MenuItem key={u._id} value={u._id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
            ) : (
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  This plan will be assigned to you ({user?.name || 'current user'}).
                </Typography>
              </Grid>
            )}
            <Grid size={{ xs: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Week start'
                type='date'
                value={form.weekStartDate}
                onChange={e => setForm(p => ({ ...p, weekStartDate: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Week end'
                type='date'
                value={form.weekEndDate}
                onChange={e => setForm(p => ({ ...p, weekEndDate: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                select
                fullWidth
                label='Status'
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              >
                <MenuItem value='DRAFT'>Draft</MenuItem>
                <MenuItem value='ACTIVE'>Active</MenuItem>
                <MenuItem value='COMPLETED'>Completed</MenuItem>
                <MenuItem value='SUBMITTED'>Submitted (legacy)</MenuItem>
                <MenuItem value='REVIEWED'>Reviewed (legacy)</MenuItem>
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Notes'
                multiline
                rows={2}
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={saving || !isFormValid}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
export default WeeklyPlansPage
