'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import { doctorActivitiesService } from '@/services/doctors.service'
import { showApiError } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/AuthContext'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type DoctorActivityRow = {
  _id: string
  doctorId?: { name?: string }
  medicalRepId?: { name?: string }
  investedAmount: number
  commitmentAmount: number
  achievedSales: number
  startDate: string
  endDate: string
  status: string
}

const progressPercent = (achieved: number, commitment: number) => {
  if (!commitment || commitment <= 0) return 0
  return (achieved / commitment) * 100
}

const statusChip = (status: string) => {
  const map: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
    ACTIVE: 'primary',
    COMPLETED: 'success',
    FAILED: 'error'
  }
  const color = map[status] ?? 'default'
  return <Chip size='small' label={status} color={color} variant={status === 'ACTIVE' ? 'outlined' : 'filled'} />
}

const ProgressCell = ({ achieved, commitment }: { achieved: number; commitment: number }) => {
  const pct = progressPercent(achieved, commitment)
  const capped = Math.min(pct, 100)
  const over = pct > 100
  const remaining = commitment - achieved

  return (
    <Box sx={{ minWidth: 160 }}>
      <Typography variant='caption' color='text.secondary' className='block'>
        {pct.toFixed(1)}% of commitment
        {over && (
          <Typography component='span' variant='caption' color='success.main' className='mie-1'>
            {' '}
            (over-achieved)
          </Typography>
        )}
      </Typography>
      <LinearProgress
        variant='determinate'
        value={capped}
        sx={{
          height: 8,
          borderRadius: 1,
          mt: 0.5,
          '& .MuiLinearProgress-bar': {
            backgroundColor: over ? 'success.main' : pct >= 100 ? 'success.main' : 'primary.main'
          }
        }}
      />
      <Typography variant='caption' color='text.secondary' className='block mbs-1'>
        Remaining: {remaining > 0 ? formatPKR(remaining) : remaining < 0 ? `−${formatPKR(Math.abs(remaining))} (above target)` : formatPKR(0)}
      </Typography>
    </Box>
  )
}

const DoctorActivitiesListPage = () => {
  const [rows, setRows] = useState<DoctorActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('doctors.create')
  const canEdit = hasPermission('doctors.edit')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await doctorActivitiesService.list({ limit: 100, ...(statusFilter ? { status: statusFilter } : {}) })
      setRows(res.data.data || [])
    } catch (e) {
      showApiError(e, 'Failed to load doctor activities')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [rows]
  )

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Doctor activities'
            subheader='Track investments vs TP-based sales on delivered orders (within each activity period).'
            action={
              canCreate && (
                <Button variant='contained' component={Link} href='/doctor-activities/add'>
                  New activity
                </Button>
              )
            }
          />
          <CardContent>
            <div className='flex flex-wrap gap-4 mbe-4 items-end'>
              <CustomTextField
                select
                label='Status'
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value=''>All</MenuItem>
                <MenuItem value='ACTIVE'>Active</MenuItem>
                <MenuItem value='COMPLETED'>Completed</MenuItem>
                <MenuItem value='FAILED'>Failed</MenuItem>
              </CustomTextField>
              <Button variant='outlined' onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className='flex justify-center p-8'>
                <CircularProgress />
              </div>
            ) : sorted.length === 0 ? (
              <Typography color='text.secondary'>No activities yet. Create one to start tracking ROI.</Typography>
            ) : (
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Doctor</TableCell>
                      <TableCell align='right'>Invested</TableCell>
                      <TableCell align='right'>Commitment</TableCell>
                      <TableCell align='right'>Achieved (TP)</TableCell>
                      <TableCell>Progress</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align='right'> </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sorted.map(row => (
                      <TableRow key={row._id} hover>
                        <TableCell>
                          <Typography fontWeight={600}>{row.doctorId?.name ?? '—'}</Typography>
                          {row.medicalRepId?.name ? (
                            <Typography variant='caption' color='text.secondary' className='block'>
                              Rep: {row.medicalRepId.name}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align='right'>{formatPKR(row.investedAmount)}</TableCell>
                        <TableCell align='right'>{formatPKR(row.commitmentAmount)}</TableCell>
                        <TableCell align='right'>{formatPKR(row.achievedSales)}</TableCell>
                        <TableCell>
                          <ProgressCell achieved={row.achievedSales} commitment={row.commitmentAmount} />
                        </TableCell>
                        <TableCell>{statusChip(row.status)}</TableCell>
                        <TableCell align='right'>
                          <div className='flex flex-wrap gap-1 justify-end'>
                            <Button size='small' component={Link} href={`/doctor-activities/${row._id}`}>
                              View
                            </Button>
                            {canEdit && (
                              <Button size='small' variant='outlined' component={Link} href={`/doctor-activities/${row._id}/edit`}>
                                Edit
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default DoctorActivitiesListPage
