'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import { doctorsService, doctorActivitiesService } from '@/services/doctors.service'
import { usersService } from '@/services/users.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'

const DoctorActivityCreatePage = () => {
  const router = useRouter()
  const [doctors, setDoctors] = useState<any[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    doctorId: '',
    medicalRepId: '',
    investedAmount: '',
    commitmentAmount: '',
    startDate: '',
    endDate: ''
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [dr, ur] = await Promise.all([
          doctorsService.list({ limit: 500 }),
          usersService.list({ limit: 200, role: 'MEDICAL_REP', isActive: 'true' })
        ])
        setDoctors(dr.data.data || [])
        setReps(ur.data.data || [])
      } catch (e) {
        showApiError(e, 'Failed to load form data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const startOk = form.startDate !== ''
  const endOk = form.endDate !== ''
  const datesLogical = !startOk || !endOk || new Date(form.startDate) < new Date(form.endDate)

  const isValid =
    form.doctorId &&
    form.investedAmount !== '' &&
    form.commitmentAmount !== '' &&
    startOk &&
    endOk &&
    datesLogical &&
    Number(form.investedAmount) >= 0 &&
    Number(form.commitmentAmount) > 0

  const handleSubmit = async () => {
    if (!isValid) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        doctorId: form.doctorId,
        investedAmount: Number(form.investedAmount),
        commitmentAmount: Number(form.commitmentAmount),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString()
      }
      payload.medicalRepId = form.medicalRepId || null

      const res = await doctorActivitiesService.create(payload)
      showSuccess('Activity created')
      const newId = res.data.data?._id
      if (newId) router.push(`/doctor-activities/${newId}`)
      else router.push('/doctor-activities/list')
    } catch (e) {
      showApiError(e, 'Could not create activity')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='flex justify-center p-12'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Button component={Link} href='/doctor-activities/list' className='mbe-4' startIcon={<i className='tabler-arrow-left' />}>
          Back
        </Button>
        <Card>
          <CardHeader title='New doctor activity' subheader='Investment vs TP sales commitment for a fixed period.' />
          <CardContent className='flex flex-col gap-4 max-is-[560px]'>
            <CustomTextField
              select
              required
              label='Doctor'
              value={form.doctorId}
              onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}
            >
              {doctors.map(d => (
                <MenuItem key={d._id} value={d._id}>
                  {d.name}
                </MenuItem>
              ))}
            </CustomTextField>

            <CustomTextField
              select
              label='Medical rep (optional)'
              value={form.medicalRepId}
              onChange={e => setForm(f => ({ ...f, medicalRepId: e.target.value }))}
              helperText='Leave empty if this activity is not tied to a specific rep.'
            >
              <MenuItem value=''>— None —</MenuItem>
              {reps.map((u: any) => (
                <MenuItem key={u._id} value={u._id}>
                  {u.name}
                </MenuItem>
              ))}
            </CustomTextField>

            <CustomTextField
              required
              label='Invested amount (PKR)'
              type='number'
              inputProps={{ min: 0, step: 0.01 }}
              value={form.investedAmount}
              onChange={e => setForm(f => ({ ...f, investedAmount: e.target.value }))}
            />
            <CustomTextField
              required
              label='Commitment — TP sales target (PKR)'
              type='number'
              inputProps={{ min: 0.01, step: 0.01 }}
              value={form.commitmentAmount}
              onChange={e => setForm(f => ({ ...f, commitmentAmount: e.target.value }))}
            />

            <CustomTextField
              required
              label='Start date'
              type='date'
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <CustomTextField
              required
              label='End date'
              type='date'
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            {!datesLogical && <Typography color='error'>End date must be after start date.</Typography>}

            <Button variant='contained' disabled={!isValid || saving} onClick={handleSubmit}>
              {saving ? <CircularProgress size={22} color='inherit' /> : 'Create activity'}
            </Button>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default DoctorActivityCreatePage
