'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { superAdminService } from '@/services/superAdmin.service'
import { showApiError } from '@/utils/apiErrors'

type Company = {
  _id: string
  name: string
  city?: string
  phone?: string
  email?: string
  country?: string
  state?: string
  address?: string
  currency?: string
  isActive?: boolean
  createdAt?: string
}

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const emptyForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  country: 'Pakistan',
  phone: '',
  email: '',
  currency: 'PKR',
  isActive: true
}

const SuperAdminPage = () => {
  const router = useRouter()
  const { switchCompanyContext } = useAuth()
  const [rows, setRows] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [summaryCompany, setSummaryCompany] = useState<Company | null>(null)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await superAdminService.listCompanies({ limit: 100, page: 1 })
      setRows(data.data || [])
    } catch (e) {
      showApiError(e, 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm(emptyForm)
    setCreateOpen(true)
  }

  const openEdit = (c: Company) => {
    setEditingId(c._id)
    setForm({
      name: c.name,
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      country: c.country || 'Pakistan',
      phone: c.phone || '',
      email: c.email || '',
      currency: c.currency || 'PKR',
      isActive: c.isActive !== false
    })
    setEditOpen(true)
  }

  const submitCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await superAdminService.createCompany({
        ...form,
        email: form.email.trim() || undefined
      })
      setCreateOpen(false)
      await load()
    } catch (e) {
      showApiError(e, 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const submitEdit = async () => {
    if (!editingId || !form.name.trim()) return
    setSaving(true)
    try {
      await superAdminService.updateCompany(editingId, {
        ...form,
        email: form.email.trim() || undefined
      })
      setEditOpen(false)
      await load()
    } catch (e) {
      showApiError(e, 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const openSummary = async (c: Company) => {
    setSummaryCompany(c)
    setSummaryData(null)
    setSummaryOpen(true)
    setSummaryLoading(true)
    try {
      const { data } = await superAdminService.getCompanySummary(c._id)
      setSummaryData(data.data)
    } catch (e) {
      showApiError(e, 'Failed to load summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  const enterCompany = async (c: Company) => {
    try {
      await switchCompanyContext(c._id)
      router.push('/home')
    } catch (e) {
      showApiError(e, 'Could not enter company context')
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Super Admin Dashboard'
            subheader='Manage tenant companies and choose which organization you operate in.'
            action={
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
                Create Company
              </Button>
            }
          />
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-wrap gap-2 items-center'>
              <Chip color='warning' variant='tonal' label='SUPER ADMIN MODE' size='small' />
              <Typography variant='body2' color='text.secondary'>
                Business APIs use your selected company context only — never pass company id from the client for data queries.
              </Typography>
            </div>

            <TableContainer component={Paper} variant='outlined'>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Company</TableCell>
                    <TableCell>City</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton animation='wave' height={36} />
                          </TableCell>
                        </TableRow>
                      ))
                    : rows.map(row => (
                        <TableRow key={row._id} hover>
                          <TableCell>
                            <Typography fontWeight={600}>{row.name}</Typography>
                            {row.email ? (
                              <Typography variant='caption' color='text.secondary' display='block'>
                                {row.email}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell>{row.city || '—'}</TableCell>
                          <TableCell>{row.phone || '—'}</TableCell>
                          <TableCell>
                            <Chip
                              size='small'
                              label={row.isActive === false ? 'Inactive' : 'Active'}
                              color={row.isActive === false ? 'default' : 'success'}
                              variant='tonal'
                            />
                          </TableCell>
                          <TableCell>
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleDateString('en-PK', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : '—'}
                          </TableCell>
                          <TableCell align='right'>
                            <Button size='small' variant='tonal' className='mie-2' onClick={() => enterCompany(row)}>
                              Enter company
                            </Button>
                            <Button size='small' variant='outlined' className='mie-2' onClick={() => openSummary(row)}>
                              View summary
                            </Button>
                            <Button size='small' variant='text' onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!loading && rows.length === 0 ? (
              <Typography color='text.secondary' className='text-center p-4'>
                No companies yet. Create one to get started.
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Create company</DialogTitle>
        <DialogContent className='flex flex-col gap-4'>
          <TextField
            required
            label='Name'
            fullWidth
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Address'
            fullWidth
            multiline
            minRows={2}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='City'
            fullWidth
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='State'
            fullWidth
            value={form.state}
            onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Country'
            fullWidth
            value={form.country}
            onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Phone'
            fullWidth
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Email'
            type='email'
            fullWidth
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            margin='normal'
          />
          <TextField
            select
            label='Currency'
            fullWidth
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            margin='normal'
          >
            <MenuItem value='PKR'>PKR</MenuItem>
            <MenuItem value='USD'>USD</MenuItem>
            <MenuItem value='EUR'>EUR</MenuItem>
          </TextField>
          <TextField
            select
            label='Status'
            fullWidth
            value={form.isActive ? 'true' : 'false'}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))}
            margin='normal'
          >
            <MenuItem value='true'>Active</MenuItem>
            <MenuItem value='false'>Inactive</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={submitCreate} disabled={saving || !form.name.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Edit company</DialogTitle>
        <DialogContent className='flex flex-col gap-4'>
          <TextField
            required
            label='Name'
            fullWidth
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Address'
            fullWidth
            multiline
            minRows={2}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='City'
            fullWidth
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='State'
            fullWidth
            value={form.state}
            onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Country'
            fullWidth
            value={form.country}
            onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Phone'
            fullWidth
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Email'
            type='email'
            fullWidth
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            margin='normal'
          />
          <TextField
            select
            label='Currency'
            fullWidth
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            margin='normal'
          >
            <MenuItem value='PKR'>PKR</MenuItem>
            <MenuItem value='USD'>USD</MenuItem>
            <MenuItem value='EUR'>EUR</MenuItem>
          </TextField>
          <TextField
            select
            label='Status'
            fullWidth
            value={form.isActive ? 'true' : 'false'}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))}
            margin='normal'
          >
            <MenuItem value='true'>Active</MenuItem>
            <MenuItem value='false'>Inactive</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={submitEdit} disabled={saving || !form.name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>Company summary — {summaryCompany?.name}</DialogTitle>
        <DialogContent>
          {summaryLoading ? (
            <Skeleton variant='rounded' height={200} animation='wave' />
          ) : summaryData ? (
            <Grid container spacing={3} className='mbe-2'>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Active users
                    </Typography>
                    <Typography variant='h5'>{summaryData.totalUsers ?? 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Total orders
                    </Typography>
                    <Typography variant='h5'>{summaryData.totalOrders ?? 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Revenue (transactions)
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summaryData.totalRevenue ?? 0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Payroll (net salary total)
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summaryData.totalPayroll ?? 0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Expenses
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summaryData.totalExpenses ?? 0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Typography color='text.secondary'>No data.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default SuperAdminPage
