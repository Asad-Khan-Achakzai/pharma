'use client'

import { useState, useEffect, useCallback } from 'react'
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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { planItemsService } from '@/services/planItems.service'
import { visitsService } from '@/services/visits.service'
import { doctorsService } from '@/services/doctors.service'
import tableStyles from '@core/styles/table.module.css'

const TodayVisitsPage = () => {
  const { hasPermission } = useAuth()
  const canMark = hasPermission('weeklyPlans.markVisit')
  const [items, setItems] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [markOpen, setMarkOpen] = useState(false)
  const [unplannedOpen, setUnplannedOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [orderTaken, setOrderTaken] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [unplannedDoctor, setUnplannedDoctor] = useState('')
  const [unplannedNotes, setUnplannedNotes] = useState('')
  const [unplannedOrder, setUnplannedOrder] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const listRes = await planItemsService.listToday({ date })
      setItems(listRes.data.data || [])
      if (canMark) {
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
  }, [date, canMark])

  useEffect(() => {
    load()
  }, [load])

  const openMark = (i: any) => {
    setActiveItem(i)
    setNotes('')
    setOrderTaken(false)
    setMarkOpen(true)
  }

  const submitMark = async () => {
    if (!activeItem) return
    setSubmitting(true)
    try {
      await planItemsService.markVisit(activeItem._id, { notes, orderTaken })
      showSuccess('Visit recorded')
      setMarkOpen(false)
      load()
    } catch (e) {
      showApiError(e, 'Could not record visit')
    } finally {
      setSubmitting(false)
    }
  }

  const submitUnplanned = async () => {
    if (!unplannedDoctor) {
      showApiError(null, 'Select a doctor')
      return
    }
    setSubmitting(true)
    try {
      await visitsService.unplanned({
        doctorId: unplannedDoctor,
        notes: unplannedNotes,
        orderTaken: unplannedOrder
      })
      showSuccess('Unplanned visit logged')
      setUnplannedOpen(false)
      setUnplannedDoctor('')
      setUnplannedNotes('')
      setUnplannedOrder(false)
    } catch (e) {
      showApiError(e, 'Failed to log visit')
    } finally {
      setSubmitting(false)
    }
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
                  Today&apos;s visits
                </Typography>
              </div>
            }
            action={
              canMark && (
                <Button variant='outlined' onClick={() => setUnplannedOpen(true)}>
                  Unplanned visit
                </Button>
              )
            }
          />
          <CardContent>
            <CustomTextField
              type='date'
              label='Date (Pacific)'
              value={date}
              onChange={e => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              className='mbe-4'
              size='small'
            />
            {loading ? (
              <div className='flex justify-center p-8'>
                <CircularProgress />
              </div>
            ) : (
              <div className='overflow-x-auto'>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Doctor / task</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className='text-center p-6'>
                          No pending visits for this date.
                        </td>
                      </tr>
                    ) : (
                      items.map((it: any) => (
                        <tr key={it._id}>
                          <td>
                            <Typography fontWeight={500}>
                              {it.type === 'DOCTOR_VISIT' ? it.doctorId?.name || '—' : it.title || 'Other task'}
                            </Typography>
                          </td>
                          <td>{it.type}</td>
                          <td>
                            <Chip size='small' label={it.status} variant='tonal' />
                          </td>
                          <td>
                            {canMark && it.status === 'PENDING' && (
                              <Button size='small' variant='contained' onClick={() => openMark(it)}>
                                Mark visit
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <Typography variant='caption' color='text.secondary' display='block' className='mts-4'>
              You must be marked <strong>PRESENT</strong> for this date in attendance to log visits. After a doctor visit, you can{' '}
              <Link href='/orders/add'>create an order</Link>.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={markOpen} onClose={() => setMarkOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Mark visit</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <CustomTextField
            fullWidth
            multiline
            rows={3}
            label='Notes'
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <FormControlLabel
            control={<Switch checked={orderTaken} onChange={e => setOrderTaken(e.target.checked)} />}
            label='Order taken'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={submitMark} disabled={submitting}>
            {submitting ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={unplannedOpen} onClose={() => setUnplannedOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Unplanned visit</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <CustomTextField select fullWidth label='Doctor' required value={unplannedDoctor} onChange={e => setUnplannedDoctor(e.target.value)}>
            <MenuItem value=''>Select</MenuItem>
            {doctors.map((d: any) => (
              <MenuItem key={d._id} value={d._id}>
                {d.name}
              </MenuItem>
            ))}
          </CustomTextField>
          <CustomTextField
            fullWidth
            multiline
            rows={2}
            label='Notes'
            value={unplannedNotes}
            onChange={e => setUnplannedNotes(e.target.value)}
          />
          <FormControlLabel
            control={<Switch checked={unplannedOrder} onChange={e => setUnplannedOrder(e.target.checked)} />}
            label='Order taken'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnplannedOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={submitUnplanned} disabled={submitting}>
            {submitting ? 'Saving...' : 'Log visit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default TodayVisitsPage
