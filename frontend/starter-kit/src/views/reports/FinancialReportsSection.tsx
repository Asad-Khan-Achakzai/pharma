'use client'

import { useState, useEffect, useCallback } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Skeleton from '@mui/material/Skeleton'
import { showApiError } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { reportsService } from '@/services/reports.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'
import FinancialPositionSection from '@/views/reports/FinancialPositionSection'
import TableSkeleton from '@/components/skeletons/TableSkeleton'

let financialReportsCache: {
  pharmacies: any[]
  distributors: any[]
  pharmacyBal: any
  distBal: any
  periodData: any
} | null = null

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** YYYY-MM-DD in local time for `<input type="date" />` */
const getLocalDateISO = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const FinancialReportsSection = () => {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(getLocalDateISO)
  const [pharmacyFilter, setPharmacyFilter] = useState('')
  const [distributorFilter, setDistributorFilter] = useState('')
  const [collectorType, setCollectorType] = useState('')
  const [settlementDirection, setSettlementDirection] = useState('')

  const [pharmacies, setPharmacies] = useState<any[]>(financialReportsCache?.pharmacies ?? [])
  const [distributors, setDistributors] = useState<any[]>(financialReportsCache?.distributors ?? [])

  const [pharmacyBal, setPharmacyBal] = useState<any>(financialReportsCache?.pharmacyBal ?? null)
  const [distBal, setDistBal] = useState<any>(financialReportsCache?.distBal ?? null)
  const [periodData, setPeriodData] = useState<any>(financialReportsCache?.periodData ?? null)
  const [loadingBal, setLoadingBal] = useState(!financialReportsCache?.pharmacyBal || !financialReportsCache?.distBal)
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  const [detailOpen, setDetailOpen] = useState<'pharmacy' | 'distributor' | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailBody, setDetailBody] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadBalances = useCallback(async () => {
    const hasCache = Boolean(financialReportsCache?.pharmacyBal && financialReportsCache?.distBal)
    if (!hasCache) setLoadingBal(true)
    try {
      const [pb, db] = await Promise.all([
        reportsService.pharmacyBalances(),
        reportsService.distributorBalances()
      ])
      const next = {
        pharmacies: financialReportsCache?.pharmacies ?? [],
        distributors: financialReportsCache?.distributors ?? [],
        pharmacyBal: pb.data.data,
        distBal: db.data.data,
        periodData: financialReportsCache?.periodData ?? null
      }
      financialReportsCache = next
      setPharmacyBal(next.pharmacyBal)
      setDistBal(next.distBal)
    } catch (err) {
      showApiError(err, 'Failed to load balances')
    } finally {
      setLoadingBal(false)
    }
  }, [])

  useEffect(() => {
    loadBalances()
  }, [loadBalances])

  useEffect(() => {
    const load = async () => {
      try {
        if (financialReportsCache?.pharmacies && financialReportsCache?.distributors) return
        const [pr, dr] = await Promise.all([
          pharmaciesService.list({ limit: 500 }),
          distributorsService.list({ limit: 500, isActive: 'true' })
        ])
        const next = {
          pharmacies: pr.data.data || [],
          distributors: dr.data.data || [],
          pharmacyBal: financialReportsCache?.pharmacyBal ?? null,
          distBal: financialReportsCache?.distBal ?? null,
          periodData: financialReportsCache?.periodData ?? null
        }
        financialReportsCache = next
        setPharmacies(next.pharmacies)
        setDistributors(next.distributors)
      } catch {
        /* optional */
      }
    }
    load()
  }, [])

  const loadPeriod = async () => {
    setLoadingPeriod(true)
    try {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      if (pharmacyFilter) params.pharmacyId = pharmacyFilter
      if (distributorFilter) params.distributorId = distributorFilter
      if (collectorType) params.collectorType = collectorType
      if (settlementDirection) params.direction = settlementDirection

      const res = await reportsService.financialOverview(params)
      const next = {
        pharmacies: financialReportsCache?.pharmacies ?? pharmacies,
        distributors: financialReportsCache?.distributors ?? distributors,
        pharmacyBal: financialReportsCache?.pharmacyBal ?? pharmacyBal,
        distBal: financialReportsCache?.distBal ?? distBal,
        periodData: res.data.data
      }
      financialReportsCache = next
      setPeriodData(next.periodData)
    } catch (err) {
      showApiError(err, 'Failed to load period report')
    } finally {
      setLoadingPeriod(false)
    }
  }

  const openPharmacyDetail = async (id: string) => {
    setDetailOpen('pharmacy')
    setDetailId(id)
    setLoadingDetail(true)
    setDetailBody(null)
    try {
      const res = await reportsService.pharmacyBalanceDetail(id)
      setDetailBody(res.data.data)
    } catch (err) {
      showApiError(err, 'Failed to load pharmacy ledger detail')
    } finally {
      setLoadingDetail(false)
    }
  }

  const openDistributorDetail = async (id: string) => {
    setDetailOpen('distributor')
    setDetailId(id)
    setLoadingDetail(true)
    setDetailBody(null)
    try {
      const res = await reportsService.distributorBalanceDetail(id)
      setDetailBody(res.data.data)
    } catch (err) {
      showApiError(err, 'Failed to load distributor clearing detail')
    } finally {
      setLoadingDetail(false)
    }
  }

  const pRows = pharmacyBal?.rows || []
  const pTotals = pharmacyBal?.totals
  const dRows = distBal?.rows || []
  const dTotals = distBal?.totals

  const col = periodData?.collections
  const setl = periodData?.settlements
  const cash = periodData?.cashSummary

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12 }}>
        <FinancialPositionSection />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Typography variant='body2' color='text.secondary' className='mbe-2'>
          Pharmacy columns reflect invoice receivables (deliveries minus collections/returns). Distributor columns
          reflect clearing (commission vs remittance). Use a date range to see collections, settlements, and a cash-style
          summary for that period.
        </Typography>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Current balances (all pharmacies & distributors)' />
          <CardContent>
            {loadingBal ? (
              <TableSkeleton columns={4} rows={6} />
            ) : (
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Typography variant='subtitle2' className='mbe-2'>
                    Pharmacy receivables
                  </Typography>
                  {pTotals && (
                    <Typography variant='body2' className='mbe-2'>
                      Total owed by pharmacies: <strong>{formatPKR(pTotals.totalReceivable)}</strong> · Pharmacy credit
                      balance: <strong>{formatPKR(pTotals.totalPharmacyCreditBalance)}</strong>
                    </Typography>
                  )}
                  <TableContainer component={Paper} variant='outlined'>
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell>Pharmacy</TableCell>
                          <TableCell align='right'>Owed to company</TableCell>
                          <TableCell align='right'>Credit / advance</TableCell>
                          <TableCell width={80} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4}>
                              No pharmacies
                            </TableCell>
                          </TableRow>
                        ) : (
                          pRows.map((row: any) => (
                            <TableRow key={row.pharmacyId}>
                              <TableCell>
                                {row.name}
                                <Typography variant='caption' display='block' color='text.secondary'>
                                  {row.city}
                                </Typography>
                              </TableCell>
                              <TableCell align='right'>{formatPKR(row.receivableFromPharmacy)}</TableCell>
                              <TableCell align='right'>{formatPKR(row.advanceOrCreditFromPharmacy)}</TableCell>
                              <TableCell>
                                <Button size='small' onClick={() => openPharmacyDetail(row.pharmacyId)}>
                                  Ledger
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                <Grid size={{ xs: 12, lg: 6 }}>
                  <Typography variant='subtitle2' className='mbe-2'>
                    Distributor clearing
                  </Typography>
                  {distBal?.helpShort && (
                    <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                      {distBal.helpShort}
                    </Typography>
                  )}
                  {dTotals && (
                    <Typography variant='body2' className='mbe-2'>
                      <strong>Remittance due</strong> (distributor collected cash for you):{' '}
                      <strong>{formatPKR(dTotals.sumRemittanceDueFromDistributors ?? 0)}</strong>
                      {' · '}
                      <strong>Commission payable</strong> (you collected; owe distributor on TP):{' '}
                      <strong>{formatPKR(dTotals.sumCommissionPayableByCompanyToDistributors ?? 0)}</strong>
                      {' · '}
                      Ledger net (audit): distributors {formatPKR(dTotals.sumNetOwedByDistributorsToCompany)} · company{' '}
                      {formatPKR(dTotals.sumNetOwedByCompanyToDistributors)}
                    </Typography>
                  )}
                  <TableContainer component={Paper} variant='outlined'>
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell>Distributor</TableCell>
                          <TableCell align='right'>Remittance due</TableCell>
                          <TableCell align='right'>Comm. payable</TableCell>
                          <TableCell align='right'>Ledger net</TableCell>
                          <TableCell width={80} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              No distributors
                            </TableCell>
                          </TableRow>
                        ) : (
                          dRows.map((row: any) => (
                            <TableRow key={row.distributorId}>
                              <TableCell>
                                {row.name}
                                <Typography variant='caption' display='block' color='text.secondary'>
                                  {row.city}
                                </Typography>
                              </TableCell>
                              <TableCell align='right'>{formatPKR(row.remittanceDueFromDistributor ?? 0)}</TableCell>
                              <TableCell align='right'>{formatPKR(row.commissionPayableByCompanyToDistributor ?? 0)}</TableCell>
                              <TableCell align='right'>{formatPKR(Math.max(0, row.netDistributorOwesCompany))}</TableCell>
                              <TableCell>
                                <Button size='small' onClick={() => openDistributorDetail(row.distributorId)}>
                                  Ledger
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Activity in date range' subheader='Collections, settlements, and net movement' />
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-wrap gap-4 items-end'>
              <CustomTextField
                label='From'
                type='date'
                value={from}
                onChange={e => setFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <CustomTextField
                label='To'
                type='date'
                value={to}
                onChange={e => setTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <CustomTextField
                select
                label='Pharmacy (collections filter)'
                value={pharmacyFilter}
                onChange={e => setPharmacyFilter(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value=''>All</MenuItem>
                {pharmacies.map(p => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.name}
                  </MenuItem>
                ))}
              </CustomTextField>
              <CustomTextField
                select
                label='Distributor (settlements filter)'
                value={distributorFilter}
                onChange={e => setDistributorFilter(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value=''>All</MenuItem>
                {distributors.map(d => (
                  <MenuItem key={d._id} value={d._id}>
                    {d.name}
                  </MenuItem>
                ))}
              </CustomTextField>
              <CustomTextField select label='Collector' value={collectorType} onChange={e => setCollectorType(e.target.value)} sx={{ minWidth: 140 }}>
                <MenuItem value=''>Any</MenuItem>
                <MenuItem value='COMPANY'>Company</MenuItem>
                <MenuItem value='DISTRIBUTOR'>Distributor</MenuItem>
              </CustomTextField>
              <CustomTextField select label='Settlement dir.' value={settlementDirection} onChange={e => setSettlementDirection(e.target.value)} sx={{ minWidth: 180 }}>
                <MenuItem value=''>Any</MenuItem>
                <MenuItem value='DISTRIBUTOR_TO_COMPANY'>Distributor → company</MenuItem>
                <MenuItem value='COMPANY_TO_DISTRIBUTOR'>Company → distributor</MenuItem>
              </CustomTextField>
              <Button
                variant='contained'
                onClick={loadPeriod}
                disabled={loadingPeriod || !to}
                startIcon={loadingPeriod ? <CircularProgress size={20} color='inherit' /> : undefined}
              >
                {loadingPeriod ? 'Loading…' : 'Load period report'}
              </Button>
            </div>
            {!to && (
              <Typography variant='caption' color='warning.main'>
                Set a &quot;To&quot; date to load period activity (From is optional — leave empty for all history up to To).
              </Typography>
            )}
            {to && !from && (
              <Typography variant='caption' color='text.secondary'>
                From is empty: activity includes all records through {to}.
              </Typography>
            )}

            {cash && (
              <Paper variant='outlined' className='p-4'>
                <Typography variant='subtitle1' className='mbe-2'>
                  Cash-style summary (period)
                </Typography>
                <Typography>Pharmacy collections: {formatPKR(cash.pharmacyCollectionsTotal)}</Typography>
                <Typography>Settlements in (distributor → company): {formatPKR(cash.settlementsInFromDistributors)}</Typography>
                <Typography>Settlements out (company → distributor): {formatPKR(cash.settlementsOutToDistributors)}</Typography>
                <Typography fontWeight={600} className='mt-2'>
                  Net movement: {formatPKR(cash.netCashStyleMovement)}
                </Typography>
                {cash.notes?.map((n: string, i: number) => (
                  <Typography key={i} variant='caption' display='block' color='text.secondary' className='mts-1'>
                    {n}
                  </Typography>
                ))}
              </Paper>
            )}

            {col && (
              <div>
                <Typography variant='subtitle1' className='mbe-1'>
                  Collections
                </Typography>
                <Typography variant='body2' className='mbe-2'>
                  Total {formatPKR(col.summary?.totalAmount)} ({col.summary?.count} records)
                </Typography>
                <div className='flex flex-wrap gap-2 mbe-2'>
                  {(col.byCollector || []).map((c: any) => (
                    <Chip key={c.collectorType} label={`${c.collectorType}: ${formatPKR(c.total)} (${c.count})`} size='small' variant='outlined' />
                  ))}
                </div>
                <TableContainer component={Paper} variant='outlined'>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Pharmacy</TableCell>
                        <TableCell align='right'>Amount</TableCell>
                        <TableCell align='right'>Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(col.byPharmacy || []).map((x: any) => (
                        <TableRow key={x.pharmacyId}>
                          <TableCell>{x.pharmacyName}</TableCell>
                          <TableCell align='right'>{formatPKR(x.total)}</TableCell>
                          <TableCell align='right'>{x.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            )}

            {setl && (
              <div>
                <Typography variant='subtitle1' className='mbe-1'>
                  Settlements
                </Typography>
                <Typography variant='body2'>
                  Distributor → company: {formatPKR(setl.distributorToCompany?.total)} ({setl.distributorToCompany?.count}{' '}
                  items) · Company → distributor: {formatPKR(setl.companyToDistributor?.total)} (
                  {setl.companyToDistributor?.count} items)
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={!!detailOpen} onClose={() => setDetailOpen(null)} maxWidth='sm' fullWidth>
        <DialogTitle>
          {detailOpen === 'pharmacy' ? 'Pharmacy ledger' : 'Distributor clearing'} detail
        </DialogTitle>
        <DialogContent>
          {loadingDetail ? (
            <div className='p-2'>
              <Skeleton variant='text' width='48%' height={26} animation='wave' />
              <Skeleton variant='text' width='65%' height={22} animation='wave' />
              <Skeleton variant='rounded' width='100%' height={180} animation='wave' />
            </div>
          ) : detailBody ? (
            <div className='flex flex-col gap-2 p-2'>
              {detailOpen === 'pharmacy' && (
                <>
                  <Typography fontWeight={600}>{detailBody.pharmacy?.name}</Typography>
                  <Typography variant='body2'>Net outstanding: {formatPKR(detailBody.netOutstanding)}</Typography>
                </>
              )}
              {detailOpen === 'distributor' && (
                <>
                  <Typography fontWeight={600}>{detailBody.distributor?.name}</Typography>
                  {detailBody.obligations && (
                    <Paper variant='outlined' className='p-3 mbe-2'>
                      <Typography variant='subtitle2' className='mbe-1'>
                        Business obligations
                      </Typography>
                      <Typography variant='body2'>
                        Remittance due from distributor: {formatPKR(detailBody.obligations.remittanceDueFromDistributor)}
                      </Typography>
                      <Typography variant='body2'>
                        Commission payable to distributor: {formatPKR(detailBody.obligations.commissionPayableByCompanyToDistributor)}
                      </Typography>
                    </Paper>
                  )}
                  <Typography variant='body2'>
                    Ledger net (DR−CR, all types): {formatPKR(detailBody.netDistributorOwesCompany)}
                  </Typography>
                  {detailBody.clearingHelp && (
                    <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                      {detailBody.clearingHelp}
                    </Typography>
                  )}
                  {detailBody.deliverySplit && (
                    <Paper variant='outlined' className='p-3 mbe-2'>
                      <Typography variant='subtitle2' className='mbe-1'>
                        Legacy DELIVERY ledger postings
                      </Typography>
                      <Typography variant='body2'>
                        Company share (debit): {formatPKR(detailBody.deliverySplit.companyShareOnDeliveries)}
                      </Typography>
                      <Typography variant='body2'>
                        Distributor commission on TP (credit): {formatPKR(detailBody.deliverySplit.distributorCommissionOnTp)}
                      </Typography>
                      <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                        {detailBody.deliverySplit.note}
                      </Typography>
                    </Paper>
                  )}
                </>
              )}
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Reference type</TableCell>
                    <TableCell align='right'>Debit</TableCell>
                    <TableCell align='right'>Credit</TableCell>
                    <TableCell align='right'>Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(detailBody.byReferenceType || []).map((r: any) => (
                    <TableRow key={r.referenceType}>
                      <TableCell>{r.referenceType}</TableCell>
                      <TableCell align='right'>{formatPKR(r.debit)}</TableCell>
                      <TableCell align='right'>{formatPKR(r.credit)}</TableCell>
                      <TableCell align='right'>{formatPKR(r.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default FinancialReportsSection
