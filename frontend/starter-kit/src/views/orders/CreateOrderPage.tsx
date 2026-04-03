'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { ordersService } from '@/services/orders.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'
import { doctorsService } from '@/services/doctors.service'

const CreateOrderPage = () => {
  const router = useRouter()
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [pharmacyId, setPharmacyId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ productId: '', quantity: 1, distributorDiscount: 0, clinicDiscount: 0 }])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const isFormValid = pharmacyId !== '' && distributorId !== '' && items.length > 0 && items.every(i => i.productId !== '' && i.quantity > 0)

  useEffect(() => {
    const fetch = async () => {
      setLoadingData(true)
      try {
        const [ph, di, pr, doc] = await Promise.all([pharmaciesService.list({ limit: 100 }), distributorsService.list({ limit: 100 }), productsService.list({ limit: 100 }), doctorsService.list({ limit: 100 })])
        setPharmacies(ph.data.data || []); setDistributors(di.data.data || []); setProducts(pr.data.data || []); setDoctors(doc.data.data || [])
      } catch (err) { showApiError(err, 'Failed to load data') }
      finally { setLoadingData(false) }
    }
    fetch()
  }, [])

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: 1, distributorDiscount: 0, clinicDiscount: 0 }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: string, value: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleSubmit = async () => {
    if (!pharmacyId || !distributorId) { showApiError(null, 'Select pharmacy and distributor'); return }
    if (items.some(i => !i.productId || i.quantity < 1)) { showApiError(null, 'Fill all items'); return }
    setSubmitting(true)
    try {
      await ordersService.create({ pharmacyId, distributorId, doctorId: doctorId || undefined, items, notes })
      showSuccess('Order created')
      router.push('/orders/list')
    } catch (err) { showApiError(err, 'Failed to create order') }
    finally { setSubmitting(false) }
  }

  return (
    <Card>
      <CardHeader title='Create Order' />
      {loadingData ? (
        <CardContent className='flex justify-center items-center min-bs-[240px]'>
          <CircularProgress />
        </CardContent>
      ) : (
      <CardContent>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CustomTextField required select fullWidth label='Pharmacy' value={pharmacyId} onChange={e => setPharmacyId(e.target.value)}>
              {pharmacies.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
            </CustomTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CustomTextField required select fullWidth label='Distributor' value={distributorId} onChange={e => setDistributorId(e.target.value)}>
              {distributors.map(d => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
            </CustomTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CustomTextField select fullWidth label='Doctor (optional)' value={doctorId} onChange={e => setDoctorId(e.target.value)}>
              <MenuItem value=''>None</MenuItem>
              {doctors.map(d => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
            </CustomTextField>
          </Grid>

          {items.map((item, i) => (
            <Grid container spacing={3} key={i} size={{ xs: 12 }}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <CustomTextField required select fullWidth label='Product' value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                  {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <CustomTextField required fullWidth label='Qty' type='number' value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <CustomTextField fullWidth label='Dist. Disc. %' type='number' value={item.distributorDiscount} onChange={e => updateItem(i, 'distributorDiscount', +e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <CustomTextField fullWidth label='Clinic Disc. %' type='number' value={item.clinicDiscount} onChange={e => updateItem(i, 'clinicDiscount', +e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6, sm: 1 }} className='flex items-center'>
                {items.length > 1 && <IconButton onClick={() => removeItem(i)}><i className='tabler-trash text-error' /></IconButton>}
              </Grid>
            </Grid>
          ))}

          <Grid size={{ xs: 12 }}><Button variant='outlined' onClick={addItem} startIcon={<i className='tabler-plus' />}>Add Item</Button></Grid>
          <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Notes' multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><Button variant='contained' onClick={handleSubmit} disabled={submitting || !isFormValid}>{submitting ? 'Creating...' : 'Create Order'}</Button></Grid>
        </Grid>
      </CardContent>
      )}
    </Card>
  )
}

export default CreateOrderPage
