'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import { doctorsService } from '@/services/doctors.service'
import { planItemsService } from '@/services/planItems.service'
import tableStyles from '@core/styles/table.module.css'

type PlanItemRow = {
  date: string
  type: 'DOCTOR_VISIT' | 'OTHER_TASK'
  doctorId: string
  title: string
  notes: string
}

const WeeklyPlanDetailPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('weeklyPlans.edit')
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)
  const [plan, setPlan] = useState<any>(null)
  const [doctors, setDoctors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<PlanItemRow[]>([
    { date: '', type: 'DOCTOR_VISIT', doctorId: '', title: '', notes: '' }
  ])

  const load = async () => {
    setLoading(true)
    try {
      const planRes = await weeklyPlansService.getById(params.id)
      setPlan(planRes.data.data)
      if (canEdit) {
        const docRes = await doctorsService.list({ limit: 500 })
        setDoctors(docRes.data.data || [])
      } else {
        setDoctors([])
      }
    } catch (e) {
      showApiError(e, 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [params.id, canEdit])

  const addRow = () =>
    setRows(r => [...r, { date: '', type: 'DOCTOR_VISIT', doctorId: '', title: '', notes: '' }])
  const updateRow = (i: number, patch: Partial<PlanItemRow>) =>
    setRows(prev => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const handleSaveItems = async () => {
    const items = rows
      .filter(r => r.date)
      .map(r => ({
        date: r.date,
        type: r.type,
        doctorId: r.type === 'DOCTOR_VISIT' ? r.doctorId : undefined,
        title: r.type === 'OTHER_TASK' ? r.title : undefined,
        notes: r.notes || undefined
      }))
    if (items.length === 0) {
      showApiError(null, 'Add at least one row with a date')
      return
    }
    if (items.some(i => i.type === 'DOCTOR_VISIT' && !i.doctorId)) {
      showApiError(null, 'Select a doctor for each doctor visit')
      return
    }
    if (items.some(i => i.type === 'OTHER_TASK' && !i.title?.trim())) {
      showApiError(null, 'Enter a title for each other task')
      return
    }
    setSaving(true)
    try {
      await weeklyPlansService.bulkPlanItems(params.id, items)
      showSuccess('Plan items saved')
      setRows([{ date: '', type: 'DOCTOR_VISIT', doctorId: '', title: '', notes: '' }])
      load()
    } catch (e) {
      showApiError(e, 'Failed to save plan items')
    } finally {
      setSaving(false)
    }
  }

  const weekLabel = () => {
    if (!plan) return ''
    const a = new Date(plan.weekStartDate).toLocaleDateString()
    const b = new Date(plan.weekEndDate).toLocaleDateString()
    return `${a} – ${b}`
  }

  const handleStatusChange = async (planItemId: string, status: string) => {
    setStatusSavingId(planItemId)
    try {
      await planItemsService.update(planItemId, { status })
      showSuccess('Status updated')
      const planRes = await weeklyPlansService.getById(params.id)
      setPlan(planRes.data.data)
    } catch (e) {
      showApiError(e, 'Failed to update status')
    } finally {
      setStatusSavingId(null)
    }
  }

  if (loading || !plan) {
    return (
      <Card>
        <CardContent className='flex justify-center p-12'>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={
              <div className='flex items-center gap-2'>
                <IconButton component={Link} href='/weekly-plans' size='small' aria-label='Back'>
                  <i className='tabler-arrow-left' />
                </IconButton>
                <Typography component='span' variant='h5'>
                  Weekly plan
                </Typography>
              </div>
            }
            subheaderTypographyProps={{ component: 'div' }}
            subheader={
              <div className='flex flex-wrap items-center gap-2'>
                <Typography component='span' variant='body2' color='text.secondary'>
                  {plan.medicalRepId?.name || 'Rep'} · {weekLabel()} ·
                </Typography>
                <Chip size='small' label={plan.status} variant='tonal' />
              </div>
            }
          />
          <CardContent>
            {plan.notes && (
              <Typography variant='body2' className='mbe-4' color='text.secondary'>
                {plan.notes}
              </Typography>
            )}
            <Typography variant='subtitle2' className='mbe-2'>
              Scheduled items
            </Typography>
            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Doctor / title</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(plan.planItems || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className='text-center p-4'>
                        No plan items yet.
                      </td>
                    </tr>
                  ) : (
                    plan.planItems.map((it: any) => (
                      <tr key={it._id}>
                        <td>{new Date(it.date).toLocaleDateString()}</td>
                        <td>{it.type}</td>
                        <td>
                          {it.type === 'DOCTOR_VISIT' ? it.doctorId?.name || '—' : it.title || '—'}
                        </td>
                        <td>
                          {canEdit ? (
                            <CustomTextField
                              select
                              size='small'
                              value={it.status}
                              onChange={e => handleStatusChange(it._id, e.target.value)}
                              disabled={statusSavingId === it._id}
                              sx={{ minWidth: 140 }}
                            >
                              <MenuItem value='PENDING'>Pending</MenuItem>
                              <MenuItem value='VISITED'>Visited</MenuItem>
                              <MenuItem value='MISSED'>Missed</MenuItem>
                            </CustomTextField>
                          ) : (
                            <Chip size='small' label={it.status} variant='tonal' />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {canEdit && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader title='Add plan items' subheader='One row per visit or task. Dates must fall within the plan week.' />
            <CardContent>
              <Grid container spacing={3}>
                {rows.map((row, i) => (
                  <Grid container spacing={2} key={i} size={{ xs: 12 }} className='mbe-3'>
                    <Grid size={{ xs: 12, sm: 2 }}>
                      <CustomTextField
                        fullWidth
                        type='date'
                        label='Date'
                        value={row.date}
                        onChange={e => updateRow(i, { date: e.target.value })}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 2 }}>
                      <CustomTextField
                        select
                        fullWidth
                        label='Type'
                        value={row.type}
                        onChange={e => updateRow(i, { type: e.target.value as PlanItemRow['type'] })}
                      >
                        <MenuItem value='DOCTOR_VISIT'>Doctor visit</MenuItem>
                        <MenuItem value='OTHER_TASK'>Other task</MenuItem>
                      </CustomTextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      {row.type === 'DOCTOR_VISIT' ? (
                        <CustomTextField
                          select
                          fullWidth
                          label='Doctor'
                          value={row.doctorId}
                          onChange={e => updateRow(i, { doctorId: e.target.value })}
                        >
                          <MenuItem value=''>Select</MenuItem>
                          {doctors.map((d: any) => (
                            <MenuItem key={d._id} value={d._id}>
                              {d.name}
                            </MenuItem>
                          ))}
                        </CustomTextField>
                      ) : (
                        <CustomTextField
                          fullWidth
                          label='Title'
                          value={row.title}
                          onChange={e => updateRow(i, { title: e.target.value })}
                        />
                      )}
                    </Grid>
                    <Grid size={{ xs: 12, sm: 3 }}>
                      <CustomTextField
                        fullWidth
                        label='Notes'
                        value={row.notes}
                        onChange={e => updateRow(i, { notes: e.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 2 }} className='flex items-end'>
                      {rows.length > 1 && (
                        <Button color='error' onClick={() => removeRow(i)}>
                          Remove
                        </Button>
                      )}
                    </Grid>
                  </Grid>
                ))}
                <Grid size={{ xs: 12 }}>
                  <Button variant='outlined' onClick={addRow} startIcon={<i className='tabler-plus' />}>
                    Add row
                  </Button>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button
                    variant='contained'
                    onClick={handleSaveItems}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}
                  >
                    {saving ? 'Saving...' : 'Save items'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default WeeklyPlanDetailPage
