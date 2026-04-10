'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'

import { rankItem } from '@tanstack/match-sorter-utils'
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

import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { salaryStructureService } from '@/services/salaryStructure.service'
import { usersService } from '@/services/users.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

import tableStyles from '@core/styles/table.module.css'

type LineIn = { name: string; type: 'fixed' | 'percentage'; value: number }

type StructureRow = {
  _id: string
  employeeId: { name?: string }
  basicSalary: number
  dailyAllowance?: number
  effectiveFrom: string
  isActive: boolean
  allowances: LineIn[]
  deductions: LineIn[]
  commission?: { type?: string; value?: number }
}

const roundPKR = (n: number) => Math.round(n * 100) / 100

const lineAmount = (basic: number, item: LineIn) => {
  if (item.type === 'fixed') return roundPKR(item.value)
  return roundPKR((basic * item.value) / 100)
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const r = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank: r })
  return r.passed
}

const columnHelper = createColumnHelper<StructureRow>()

const SalaryStructurePage = () => {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payroll.create')

  const [rows, setRows] = useState<StructureRow[]>([])
  const [users, setUsers] = useState<{ _id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employeeId: '',
    basicSalary: 0,
    dailyAllowance: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    allowances: [] as LineIn[],
    deductions: [] as LineIn[],
    commissionPct: 0
  })
  const [previewSales, setPreviewSales] = useState(0)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([
        salaryStructureService.list({ limit: 100 }),
        usersService.list({ limit: 200 })
      ])
      setRows(s.data.data || [])
      setUsers(u.data.data || [])
    } catch (e) {
      showApiError(e, 'Failed to load salary structures')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const preview = useMemo(() => {
    const basic = form.basicSalary
    let allowSum = 0
    for (const a of form.allowances) allowSum += lineAmount(basic, a)
    allowSum = roundPKR(allowSum)
    let dedSum = 0
    for (const d of form.deductions) dedSum += lineAmount(basic, d)
    dedSum = roundPKR(dedSum)
    const comm = roundPKR((previewSales * (form.commissionPct || 0)) / 100)
    const gross = roundPKR(basic + allowSum + comm)
    const net = roundPKR(gross - dedSum)
    return { allowSum, dedSum, comm, gross, net }
  }, [form, previewSales])

  const addLine = (kind: 'allowances' | 'deductions') => {
    setForm(f => ({
      ...f,
      [kind]: [...f[kind], { name: '', type: 'fixed', value: 0 }]
    }))
  }

  const updateLine = (kind: 'allowances' | 'deductions', index: number, patch: Partial<LineIn>) => {
    setForm(f => ({
      ...f,
      [kind]: f[kind].map((row, i) => (i === index ? { ...row, ...patch } : row))
    }))
  }

  const removeLine = (kind: 'allowances' | 'deductions', index: number) => {
    setForm(f => ({ ...f, [kind]: f[kind].filter((_, i) => i !== index) }))
  }

  const handleSave = async () => {
    if (!form.employeeId || form.basicSalary <= 0) {
      showApiError(new Error('Employee and basic salary are required'), 'Validation')
      return
    }
    setSaving(true)
    try {
      await salaryStructureService.create({
        employeeId: form.employeeId,
        basicSalary: form.basicSalary,
        dailyAllowance: form.dailyAllowance,
        effectiveFrom: form.effectiveFrom,
        allowances: form.allowances.filter(a => a.name.trim()),
        deductions: form.deductions.filter(d => d.name.trim()),
        commission: { type: 'percentage', value: form.commissionPct }
      })
      showSuccess('Salary structure saved')
      setOpen(false)
      fetchRows()
    } catch (e) {
      showApiError(e, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<StructureRow, any>[]>(
    () => [
      columnHelper.display({
        id: 'employee',
        header: 'Employee',
        cell: ({ row }) => <Typography fontWeight={500}>{row.original.employeeId?.name ?? '—'}</Typography>
      }),
      columnHelper.accessor('basicSalary', {
        header: 'Basic',
        cell: ({ row }) => <>₨ {row.original.basicSalary?.toFixed(2)}</>
      }),
      columnHelper.accessor('dailyAllowance', {
        header: 'Daily allow.',
        cell: ({ row }) => <>₨ {(row.original.dailyAllowance ?? 0).toFixed(2)}</>
      }),
      columnHelper.accessor('effectiveFrom', {
        header: 'Effective from',
        cell: ({ row }) => new Date(row.original.effectiveFrom).toLocaleDateString()
      }),
      columnHelper.accessor('isActive', {
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            size='small'
            variant='tonal'
            label={row.original.isActive ? 'Active' : 'Inactive'}
            color={row.original.isActive ? 'success' : 'default'}
          />
        )
      })
    ],
    []
  )

  const table = useReactTable({
    data: rows,
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

  return (
    <Card>
      <CardHeader title='Salary structures' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField
          value={globalFilter ?? ''}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder='Search...'
        />
        {canCreate && (
          <Button
            variant='contained'
            startIcon={<i className='tabler-plus' />}
            onClick={() => {
              setForm({
                employeeId: '',
                basicSalary: 0,
                dailyAllowance: 0,
                effectiveFrom: new Date().toISOString().slice(0, 10),
                allowances: [],
                deductions: [],
                commissionPct: 0
              })
              setPreviewSales(0)
              setOpen(true)
            }}
          >
            New structure
          </Button>
        )}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>
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
                  No structures
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>New salary structure</DialogTitle>
        <DialogContent>
          <Typography variant='caption' color='text.secondary' display='block' className='mbe-4'>
            Saving creates a new version and deactivates the previous active structure for this employee.
          </Typography>
          <Grid container spacing={4} className='pbs-2'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                select
                fullWidth
                label='Employee'
                value={form.employeeId}
                onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
              >
                {users.map(u => (
                  <MenuItem key={u._id} value={u._id}>
                    {u.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Basic salary'
                value={form.basicSalary}
                onChange={e => setForm(p => ({ ...p, basicSalary: +e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Daily allowance (per day)'
                value={form.dailyAllowance}
                onChange={e => setForm(p => ({ ...p, dailyAllowance: +e.target.value }))}
                helperText='Paid only when present (half day = 50%)'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <CustomTextField
                fullWidth
                type='date'
                label='Effective from'
                InputLabelProps={{ shrink: true }}
                value={form.effectiveFrom}
                onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <div className='flex items-center justify-between mbe-2'>
                <Typography variant='subtitle2'>Allowances</Typography>
                <Button size='small' onClick={() => addLine('allowances')}>
                  Add
                </Button>
              </div>
              {form.allowances.map((line, i) => (
                <Grid container spacing={2} key={`a-${i}`} className='mbe-2'>
                  <Grid size={{ xs: 5 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      label='Name'
                      value={line.name}
                      onChange={e => updateLine('allowances', i, { name: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      select
                      fullWidth
                      size='small'
                      label='Type'
                      value={line.type}
                      onChange={e => updateLine('allowances', i, { type: e.target.value as LineIn['type'] })}
                    >
                      <MenuItem value='fixed'>Fixed</MenuItem>
                      <MenuItem value='percentage'>% of basic</MenuItem>
                    </CustomTextField>
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      type='number'
                      label='Value'
                      value={line.value}
                      onChange={e => updateLine('allowances', i, { value: +e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 1 }} className='flex items-center'>
                    <IconButton size='small' onClick={() => removeLine('allowances', i)}>
                      <i className='tabler-trash' />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Grid>

            <Grid size={{ xs: 12 }}>
              <div className='flex items-center justify-between mbe-2'>
                <Typography variant='subtitle2'>Deductions</Typography>
                <Button size='small' onClick={() => addLine('deductions')}>
                  Add
                </Button>
              </div>
              {form.deductions.map((line, i) => (
                <Grid container spacing={2} key={`d-${i}`} className='mbe-2'>
                  <Grid size={{ xs: 5 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      label='Name'
                      value={line.name}
                      onChange={e => updateLine('deductions', i, { name: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      select
                      fullWidth
                      size='small'
                      label='Type'
                      value={line.type}
                      onChange={e => updateLine('deductions', i, { type: e.target.value as LineIn['type'] })}
                    >
                      <MenuItem value='fixed'>Fixed</MenuItem>
                      <MenuItem value='percentage'>% of basic</MenuItem>
                    </CustomTextField>
                  </Grid>
                  <Grid size={{ xs: 3 }}>
                    <CustomTextField
                      fullWidth
                      size='small'
                      type='number'
                      label='Value'
                      value={line.value}
                      onChange={e => updateLine('deductions', i, { value: +e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 1 }} className='flex items-center'>
                    <IconButton size='small' onClick={() => removeLine('deductions', i)}>
                      <i className='tabler-trash' />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Commission % (of monthly sales)'
                value={form.commissionPct}
                onChange={e => setForm(p => ({ ...p, commissionPct: +e.target.value }))}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                type='number'
                label='Preview monthly sales (estimate)'
                value={previewSales}
                onChange={e => setPreviewSales(+e.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider className='mbe-2' />
              <Typography variant='subtitle2' className='mbe-1'>
                Live preview (payroll run uses real order totals for commission)
              </Typography>
              <Typography variant='body2'>Gross: ₨ {preview.gross.toFixed(2)}</Typography>
              <Typography variant='body2'>Net: ₨ {preview.net.toFixed(2)}</Typography>
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
            disabled={saving || !form.employeeId || form.basicSalary <= 0}
            startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default SalaryStructurePage
