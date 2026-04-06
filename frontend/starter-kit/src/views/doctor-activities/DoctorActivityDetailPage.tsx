'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import { doctorActivitiesService } from '@/services/doctors.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const DoctorActivityDetailPage = () => {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const { hasPermission } = useAuth()
  const canEdit = hasPermission('doctors.edit')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await doctorActivitiesService.getById(id)
      setData(res.data.data)
    } catch (e) {
      showApiError(e, 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleRecalculate = async () => {
    if (!id) return
    setBusy(true)
    try {
      const res = await doctorActivitiesService.recalculate(id)
      setData(res.data.data)
      showSuccess('Recalculated from delivered orders and returns (TP basis).')
    } catch (e) {
      showApiError(e, 'Recalculate failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !data) {
    return (
      <div className='flex justify-center p-12'>
        <CircularProgress />
      </div>
    )
  }

  const achieved = data.achievedSales ?? 0
  const commitment = data.commitmentAmount ?? 0
  const invested = data.investedAmount ?? 0
  const pct = commitment > 0 ? (achieved / commitment) * 100 : 0
  const remaining = commitment - achieved

  const m = data.metrics
  const achievedCasting = m?.achievedCasting ?? 0
  const grossOnVolume = m?.grossOnDeliveredVolume ?? 0
  const castingMult = m?.castingRecoveryVsInvestmentMultiple
  const castingPct = m?.castingRecoveryVsInvestmentPercent

  const statusColor: Record<string, 'primary' | 'success' | 'error' | 'default'> = {
    ACTIVE: 'primary',
    COMPLETED: 'success',
    FAILED: 'error'
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <div className='flex flex-wrap gap-2 mbe-4'>
          <Button component={Link} href='/doctor-activities/list' startIcon={<i className='tabler-arrow-left' />}>
            Back to list
          </Button>
          {canEdit && (
            <Button variant='contained' onClick={handleRecalculate} disabled={busy} startIcon={busy ? <CircularProgress size={18} color='inherit' /> : undefined}>
              {busy ? 'Recalculating…' : 'Recalculate from orders'}
            </Button>
          )}
        </div>

        <Card>
          <CardHeader
            title={data.doctorId?.name ?? 'Doctor activity'}
            subheader={
              <span className='flex flex-wrap items-center gap-2'>
                <Chip size='small' label={data.status} color={statusColor[data.status] ?? 'default'} />
                {data.medicalRepId?.name ? (
                  <Typography component='span' variant='body2' color='text.secondary'>
                    Rep: {data.medicalRepId.name}
                  </Typography>
                ) : null}
              </span>
            }
          />
          <CardContent className='flex flex-col gap-6'>
            <div>
              <Typography variant='overline' color='text.secondary'>
                Timeline
              </Typography>
              <Typography>
                {new Date(data.startDate).toLocaleDateString()} → {new Date(data.endDate).toLocaleDateString()}
              </Typography>
            </div>

            <Divider />

            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Invested
                </Typography>
                <Typography variant='h6'>{formatPKR(invested)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Commitment (TP sales target)
                </Typography>
                <Typography variant='h6'>{formatPKR(commitment)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Achieved (TP, delivered)
                </Typography>
                <Typography variant='h6'>{formatPKR(achieved)}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Remaining to commitment
                </Typography>
                <Typography variant='h6' color={remaining <= 0 ? 'success.main' : 'text.primary'}>
                  {remaining > 0 ? formatPKR(remaining) : remaining < 0 ? `Target exceeded by ${formatPKR(Math.abs(remaining))}` : formatPKR(0)}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Progress
                </Typography>
                <Typography variant='h6'>{pct.toFixed(1)}%</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Achieved at company cost (casting)
                </Typography>
                <Typography variant='h6'>{formatPKR(achievedCasting)}</Typography>
                <Typography variant='caption' color='text.secondary' className='block mbs-1'>
                  Value of delivered volume at your purchase price (casting), per order line.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Gross on volume (TP − casting)
                </Typography>
                <Typography variant='h6'>{formatPKR(grossOnVolume)}</Typography>
                <Typography variant='caption' color='text.secondary' className='block mbs-1'>
                  Trade-price sales value minus company cost on the same quantities.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Typography variant='caption' color='text.secondary'>
                  Recovery vs investment (casting ÷ invested)
                </Typography>
                <Typography variant='h6'>{invested > 0 && castingMult != null ? `${castingMult.toFixed(2)}×` : '—'}</Typography>
                <Typography variant='caption' color='text.secondary'>
                  {invested > 0 && castingPct != null
                    ? `${castingPct.toFixed(1)}% — company cost of goods (casting) vs amount invested in this doctor`
                    : ''}
                </Typography>
              </Grid>
            </Grid>

            <Box>
              <Typography variant='body2' className='mbe-1'>
                Commitment progress
              </Typography>
              <LinearProgress
                variant='determinate'
                value={Math.min(pct, 100)}
                sx={{
                  height: 12,
                  borderRadius: 1,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: pct >= 100 ? 'success.main' : 'primary.main'
                  }
                }}
              />
              {pct > 100 && (
                <Typography variant='caption' color='success.main' className='mbs-1 block'>
                  Performance above 100% of commitment — outstanding sales contribution.
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default DoctorActivityDetailPage
