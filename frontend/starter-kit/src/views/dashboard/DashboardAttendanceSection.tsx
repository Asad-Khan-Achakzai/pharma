'use client'

import { memo, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import MenuItem from '@mui/material/MenuItem'
import type { ApexOptions } from 'apexcharts'
import CustomTextField from '@core/components/mui/TextField'
import AppReactApexCharts from '@/libs/styles/AppReactApexCharts'
import type { TodayBoard, TodayEmployee } from './dashboard.types'

const statusDisplay = (s: string) => {
  switch (s) {
    case 'PRESENT':
      return 'Present'
    case 'HALF_DAY':
      return 'Half-Day'
    case 'ABSENT':
      return 'Absent'
    case 'LEAVE':
      return 'Leave'
    case 'NOT_MARKED':
      return 'Not marked'
    default:
      return s
  }
}

const statusChipColor = (s: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
  if (s === 'PRESENT') return 'success'
  if (s === 'HALF_DAY') return 'info'
  if (s === 'LEAVE') return 'default'
  if (s === 'ABSENT' || s === 'NOT_MARKED') return 'error'
  return 'default'
}

const DashboardAttendanceSection = memo(function DashboardAttendanceSection({
  showCompanyAttendance,
  showMyAttendance,
  meTodayLoading,
  meToday,
  checkingIn,
  checkingOut,
  handleCheckIn,
  handleCheckOut,
  teamAttendanceLoading,
  todayBoard,
  isAdmin,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  filterStatus,
  setFilterStatus,
  tableRows,
  adminAttendanceBusy,
  openStatusMenu,
  donutOptions,
  donutSeries,
  formatPstHm
}: {
  showCompanyAttendance: boolean
  showMyAttendance: boolean
  meTodayLoading: boolean
  meToday: any
  checkingIn: boolean
  checkingOut: boolean
  handleCheckIn: () => Promise<void>
  handleCheckOut: () => Promise<void>
  teamAttendanceLoading: boolean
  todayBoard: TodayBoard | null
  isAdmin: boolean
  sortBy: 'name' | 'status'
  setSortBy: (v: 'name' | 'status') => void
  sortDir: 'asc' | 'desc'
  setSortDir: (v: 'asc' | 'desc') => void
  filterStatus: string
  setFilterStatus: (v: string) => void
  tableRows: TodayEmployee[]
  adminAttendanceBusy: boolean
  openStatusMenu: (e: MouseEvent<HTMLElement>, row: TodayEmployee) => void
  donutOptions: ApexOptions
  donutSeries: number[]
  formatPstHm: (iso: string | undefined) => string | null
}) {
  if (!showCompanyAttendance && !showMyAttendance) return null
  return (
    <Grid size={{ xs: 12 }}>
      <Grid container spacing={4}>
        {showMyAttendance && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title='My attendance today' />
              <CardContent className='flex flex-col gap-3 items-start'>
                {meTodayLoading ? (
                  <Box
                    sx={{ width: '100%' }}
                    aria-busy
                    aria-label='Loading your attendance'
                  >
                    <Skeleton variant='rounded' width='42%' height={28} animation='wave' sx={{ mb: 1.5 }} />
                    <Skeleton variant='text' width='55%' animation='wave' />
                    <Skeleton variant='text' width='48%' animation='wave' sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      <Skeleton variant='rounded' width={100} height={32} />
                      <Skeleton variant='rounded' width={100} height={32} />
                    </Box>
                  </Box>
                ) : (
                  <>
                    <Typography component='div' variant='body2' className='flex items-center gap-2 flex-wrap'>
                      <span>Status:</span>
                      <Chip
                        size='small'
                        label={
                          meToday?.uiStatus === 'CHECKED_OUT'
                            ? 'Checked out'
                            : meToday?.uiStatus === 'PRESENT'
                              ? 'Present'
                              : 'Not marked'
                        }
                        color={
                          meToday?.uiStatus === 'CHECKED_OUT'
                            ? 'default'
                            : meToday?.uiStatus === 'PRESENT'
                              ? 'success'
                              : 'warning'
                        }
                        variant='tonal'
                      />
                    </Typography>
                    {meToday?.checkInTime && (
                      <Typography variant='body2' color='text.secondary'>
                        Check-in (PT): {formatPstHm(meToday.checkInTime as string) ?? '—'}
                      </Typography>
                    )}
                    {meToday?.checkOutTime && (
                      <Typography variant='body2' color='text.secondary'>
                        Check-out (PT): {formatPstHm(meToday.checkOutTime as string) ?? '—'}
                      </Typography>
                    )}
                    {meToday?.pstDate && (
                      <Typography variant='caption' color='text.disabled'>
                        Business date (Pacific): {meToday.pstDate}
                      </Typography>
                    )}
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        variant='contained'
                        size='small'
                        onClick={handleCheckIn}
                        disabled={
                          meTodayLoading ||
                          checkingIn ||
                          checkingOut ||
                          !meToday?.canCheckIn
                        }
                      >
                        {checkingIn ? 'Checking in...' : 'Check In'}
                      </Button>
                      <Button
                        variant='tonal'
                        color='secondary'
                        size='small'
                        onClick={handleCheckOut}
                        disabled={
                          meTodayLoading ||
                          checkingIn ||
                          checkingOut ||
                          !meToday?.canCheckOut
                        }
                      >
                        {checkingOut ? 'Checking out...' : 'Check Out'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
        {showCompanyAttendance && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title='Employees Working Today'
                subheader={
                  teamAttendanceLoading ? (
                    <Box sx={{ pt: 0.5, width: '100%' }} aria-hidden>
                      <Skeleton variant='text' width='58%' height={20} animation='wave' />
                    </Box>
                  ) : todayBoard?.summary ? (
                    <div>
                      <Typography variant='body2' color='text.secondary' component='span' display='block'>
                        {`Total present: ${todayBoard.summary.present} · Staff tracked: ${todayBoard.summary.totalEmployees}`}
                      </Typography>
                      {isAdmin && (
                        <Typography variant='caption' color='text.secondary' display='block' className='mt-1'>
                          As an admin, use <strong>Set status</strong> to mark present, half-day, leave, or absent.
                        </Typography>
                      )}
                    </div>
                  ) : undefined
                }
              />
              <CardContent>
                {teamAttendanceLoading ? (
                  <Box sx={{ width: '100%' }} aria-busy aria-label='Loading team attendance'>
                    <Skeleton variant='rounded' width='42%' height={28} animation='wave' sx={{ mb: 1.5 }} />
                    <Skeleton variant='text' width='88%' animation='wave' />
                    <Skeleton variant='text' width='76%' animation='wave' />
                    <Skeleton variant='text' width='64%' animation='wave' sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      <Skeleton variant='rounded' width={100} height={32} />
                      <Skeleton variant='rounded' width={100} height={32} />
                    </Box>
                  </Box>
                ) : todayBoard?.summary ? (
                  <Grid container spacing={4}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                      <div className='flex flex-wrap gap-4 mbe-4'>
                        <CustomTextField
                          select
                          size='small'
                          label='Sort by'
                          value={sortBy}
                          onChange={e => setSortBy(e.target.value as 'name' | 'status')}
                          sx={{ minWidth: 140 }}
                        >
                          <MenuItem value='name'>Name</MenuItem>
                          <MenuItem value='status'>Status</MenuItem>
                        </CustomTextField>
                        <CustomTextField
                          select
                          size='small'
                          label='Order'
                          value={sortDir}
                          onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
                          sx={{ minWidth: 120 }}
                        >
                          <MenuItem value='asc'>A → Z</MenuItem>
                          <MenuItem value='desc'>Z → A</MenuItem>
                        </CustomTextField>
                        <CustomTextField
                          select
                          size='small'
                          label='Filter status'
                          value={filterStatus}
                          onChange={e => setFilterStatus(e.target.value)}
                          sx={{ minWidth: 160 }}
                        >
                          <MenuItem value=''>All</MenuItem>
                          <MenuItem value='PRESENT'>Present</MenuItem>
                          <MenuItem value='HALF_DAY'>Half-Day</MenuItem>
                          <MenuItem value='ABSENT'>Absent</MenuItem>
                          <MenuItem value='LEAVE'>Leave</MenuItem>
                          <MenuItem value='NOT_MARKED'>Not marked</MenuItem>
                        </CustomTextField>
                      </div>
                      <TableContainer component={Paper} variant='outlined'>
                        <Table size='small'>
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell align='right'>Check-in (PT)</TableCell>
                              <TableCell align='right'>Check-out (PT)</TableCell>
                              {isAdmin && <TableCell align='right'>Actions</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {tableRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={isAdmin ? 5 : 4} align='center'>
                                  <Typography color='text.secondary' variant='body2'>
                                    No rows match the current filters.
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : (
                              tableRows.map(row => (
                                <TableRow
                                  key={row.employeeId}
                                  hover
                                  sx={row.hasCheckedOut ? { bgcolor: 'action.hover' } : undefined}
                                >
                                  <TableCell>
                                    <Typography fontWeight={500}>{row.name}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      size='small'
                                      variant='tonal'
                                      label={statusDisplay(row.status)}
                                      color={statusChipColor(row.status)}
                                    />
                                  </TableCell>
                                  <TableCell align='right'>
                                    {row.checkInTime ?? '—'}
                                  </TableCell>
                                  <TableCell align='right'>
                                    {row.checkOutTime ?? '—'}
                                  </TableCell>
                                  {isAdmin && (
                                    <TableCell align='right'>
                                      <Button
                                        size='small'
                                        variant='outlined'
                                        disabled={adminAttendanceBusy}
                                        onClick={e => openStatusMenu(e, row)}
                                        endIcon={<i className='tabler-chevron-down text-base' />}
                                      >
                                        Set status
                                      </Button>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                      <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
                        Today&apos;s distribution
                      </Typography>
                      <AppReactApexCharts
                        type='donut'
                        width='100%'
                        height={320}
                        options={donutOptions}
                        series={donutSeries}
                      />
                    </Grid>
                  </Grid>
                ) : (
                  <Typography color='text.secondary' variant='body2' className='p-2'>
                    Team attendance could not be loaded. Try refreshing the page.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Grid>
  )
})

export default DashboardAttendanceSection
