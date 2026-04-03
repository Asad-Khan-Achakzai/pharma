'use client'

import { useState, useEffect } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { reportsService } from '@/services/reports.service'

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ReportsPage = () => {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [profit, setProfit] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [outstanding, setOutstanding] = useState<any[]>([])
  const [doctorROI, setDoctorROI] = useState<any[]>([])
  const [repPerf, setRepPerf] = useState<any[]>([])
  const [invVal, setInvVal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = { from: from || undefined, to: to || undefined }
      const [profitRes, expRes, outRes, roiRes, repRes, invRes] = await Promise.all([
        reportsService.profit(params),
        reportsService.expenses(params),
        reportsService.outstanding(),
        reportsService.doctorROI(),
        reportsService.repPerformance(),
        reportsService.inventoryValuation()
      ])
      setProfit(profitRes.data.data)
      setExpenses(expRes.data.data || [])
      setOutstanding(outRes.data.data || [])
      setDoctorROI(roiRes.data.data || [])
      setRepPerf(repRes.data.data || [])
      setInvVal(invRes.data.data || [])
    } catch (err) { showApiError(err, 'Failed to load reports') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex gap-4 items-end'>
            <CustomTextField label='From' type='date' value={from} onChange={e => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <CustomTextField label='To' type='date' value={to} onChange={e => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <Button variant='contained' onClick={fetchReports} disabled={loading} startIcon={loading ? <CircularProgress size={20} color='inherit' /> : undefined}>{loading ? 'Loading...' : 'Apply Filter'}</Button>
          </CardContent>
        </Card>
      </Grid>

      {loading ? (
        <Grid size={{ xs: 12 }} className='flex justify-center p-12'><CircularProgress /></Grid>
      ) : (
        <>
      {profit && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title='Profit Summary' />
            <CardContent>
              <Typography>Gross Profit: {formatPKR(profit.grossProfit)}</Typography>
              <Typography>Net Profit: {formatPKR(profit.netProfit)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Expenses Breakdown' />
          <CardContent>
            {expenses.length === 0 ? <Typography>No expenses</Typography> : expenses.map((e: any) => (
              <div key={e._id} className='flex justify-between mbe-2'>
                <Typography>{e._id}</Typography>
                <Typography fontWeight={500}>{formatPKR(e.total)} ({e.count})</Typography>
              </div>
            ))}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Outstanding Receivables' />
          <CardContent>
            {outstanding.length === 0 ? <Typography>No outstanding</Typography> : outstanding.map((o: any) => (
              <div key={o._id} className='flex justify-between mbe-2'>
                <Typography>{o.pharmacyName} ({o.city})</Typography>
                <Typography fontWeight={500} color='error'>{formatPKR(o.outstanding)}</Typography>
              </div>
            ))}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Doctor ROI' />
          <CardContent>
            {doctorROI.length === 0 ? <Typography>No data</Typography> : doctorROI.map((d: any) => (
              <div key={d._id} className='flex justify-between mbe-2'>
                <Typography>{d.doctorName}</Typography>
                <Typography fontWeight={500}>{d.roi?.toFixed(1)}%</Typography>
              </div>
            ))}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Rep Performance' />
          <CardContent>
            {repPerf.length === 0 ? <Typography>No data</Typography> : repPerf.map((r: any) => (
              <div key={r._id} className='flex justify-between mbe-2'>
                <Typography>{r.repName} ({r.month})</Typography>
                <Typography fontWeight={500}>Sales: {r.salesPercent?.toFixed(0)}% | Packs: {r.packsPercent?.toFixed(0)}%</Typography>
              </div>
            ))}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Inventory Valuation' />
          <CardContent>
            {invVal.length === 0 ? <Typography>No data</Typography> : invVal.map((v: any) => (
              <div key={v._id} className='flex justify-between mbe-2'>
                <Typography>{v.distributorName} ({v.totalQuantity} units)</Typography>
                <Typography fontWeight={500}>{formatPKR(v.totalValue)}</Typography>
              </div>
            ))}
          </CardContent>
        </Card>
      </Grid>
        </>
      )}
    </Grid>
  )
}

export default ReportsPage
