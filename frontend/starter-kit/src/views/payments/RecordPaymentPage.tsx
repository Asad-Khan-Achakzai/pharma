'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { paymentsService } from '@/services/payments.service'
import { pharmaciesService } from '@/services/pharmacies.service'

const RecordPaymentPage = () => {
  const router = useRouter()
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [form, setForm] = useState({ pharmacyId: '', amount: 0, paymentMethod: 'CASH', referenceNumber: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const isFormValid = form.pharmacyId !== '' && form.amount > 0 && form.paymentMethod !== ''

  useEffect(() => {
    const f = async () => {
      setLoadingData(true)
      try { const { data: r } = await pharmaciesService.list({ limit: 100 }); setPharmacies(r.data || []) }
      catch (err) { showApiError(err, 'Failed to load pharmacies') }
      finally { setLoadingData(false) }
    }
    f()
  }, [])

  const handleSubmit = async () => {
    if (!form.pharmacyId || form.amount <= 0) { showApiError(null, 'Fill required fields'); return }
    setSaving(true)
    try { await paymentsService.create(form); showSuccess('Payment recorded'); router.push('/payments/list') }
    catch (err) { showApiError(err, 'Failed to record payment') }
    finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader title='Record Payment' />
      <CardContent>
        {loadingData ? (
          <div className='flex justify-center p-12'><CircularProgress /></div>
        ) : (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required select fullWidth label='Pharmacy' value={form.pharmacyId} onChange={e => setForm(p => ({ ...p, pharmacyId: e.target.value }))}>{pharmacies.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}</CustomTextField></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Amount (PKR)' type='number' value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required select fullWidth label='Payment Method' value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}><MenuItem value='CASH'>Cash</MenuItem><MenuItem value='CHEQUE'>Cheque</MenuItem><MenuItem value='BANK_TRANSFER'>Bank Transfer</MenuItem><MenuItem value='UPI'>UPI</MenuItem></CustomTextField></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Reference Number' value={form.referenceNumber} onChange={e => setForm(p => ({ ...p, referenceNumber: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Notes' multiline rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Grid>
          <Grid size={{ xs: 12 }}><Button variant='contained' onClick={handleSubmit} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Record Payment'}</Button></Grid>
        </Grid>
        )}
      </CardContent>
    </Card>
  )
}
export default RecordPaymentPage
