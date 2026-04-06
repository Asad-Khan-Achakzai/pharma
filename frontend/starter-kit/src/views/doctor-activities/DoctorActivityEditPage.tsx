'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
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
import { useAuth } from '@/contexts/AuthContext'

const toDateInput = (iso: string | undefined) => {
  if (!iso) return ''
  const x = new Date(iso)
  if (Number.isNaN(x.getTime())) return ''
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const d = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DoctorActivityEditPage = () => {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const { hasPermission } = useAuth()
  const canEdit = hasPermission('doctors.edit')

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

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [actRes, dr, ur] = await Promise.all([
        doctorActivitiesService.getById(id),
        doctorsService.list({ limit: 500 }),
        usersService.list({ limit: 200, role: 'MEDICAL_REP', isActive: 'true' })
      ])
      const a = actRes.data.data
      setDoctors(dr.data.data || [])
      setReps(ur.data.data || [])
      setForm({
        doctorId: a?.doctorId?._id ?? a?.doctorId ?? '',
        medicalRepId: a?.medicalRepId?._id ?? a?.medicalRepId ?? '',
        investedAmount: String(a?.investedAmount ?? ''),
        commitmentAmount: String(a?.commitmentAmount ?? ''),
        startDate: toDateInput(a?.startDate),
        endDate: toDateInput(a?.endDate)
      })
    } catch (e) {
      showApiError(e, 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

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
    if (!isValid || !id) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        doctorId: form.doctorId,
        investedAmount: Number(form.investedAmount),
        commitmentAmount: Number(form.commitmentAmount),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        medicalRepId: form.medicalRepId ? form.medicalRepId : null
      }
      await doctorActivitiesService.update(id, payload)
      showSuccess('Activity updated. Achieved TP was recalculated if doctor or dates changed.')
      router.push(`/doctor-activities/${id}`)
    } catch (e) {
      showApiError(e, 'Could not save activity')
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

  if (!canEdit) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }} className='p-6'>
          <Typography color='error' className='mbe-4'>
            You don&apos;t have permission to edit doctor activities.
          </Typography>
          <Button component={Link} href={id ? `/doctor-activities/${id}` : '/doctor-activities/list'} variant='contained'>
            Back
          </Button>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Button component={Link} href='/doctor-activities/list' className='mbe-4' startIcon={<i className='tabler-arrow-left' />}>
          Back to list
        </Button>
        <Card>
          <CardHeader
            title='Edit doctor activity'
            subheader='Change doctor, rep, amounts, or period. If you change the doctor or dates, achieved sales are recomputed from deliveries (TP) in the new range.'
          />
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
              label='Medical rep'
              value={form.medicalRepId}
              onChange={e => setForm(f => ({ ...f, medicalRepId: e.target.value }))}
            >
              <MenuItem value=''>— Not set —</MenuItem>
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
              {saving ? <CircularProgress size={22} color='inherit' /> : 'Save changes'}
            </Button>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default DoctorActivityEditPage
