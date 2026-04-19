'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { ordersService } from '@/services/orders.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'
import { doctorsService } from '@/services/doctors.service'

type LineItem = { productId: string; quantity: number; distributorDiscount: number; clinicDiscount: number }

const defaultLineItem = (distDisc: number, pharmDisc: number): LineItem => ({
  productId: '',
  quantity: 1,
  distributorDiscount: distDisc,
  clinicDiscount: pharmDisc
})

const EditOrderPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const router = useRouter()
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [pharmacyId, setPharmacyId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([defaultLineItem(0, 0)])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const isFormValid = pharmacyId !== '' && distributorId !== '' && items.length > 0 && items.every(i => i.productId !== '' && i.quantity > 0)

  const getDiscountDefaults = () => {
    const ph = pharmacies.find(p => p._id === pharmacyId)
    const dist = distributors.find(d => d._id === distributorId)
    return { d: dist?.discountOnTP ?? 0, p: ph?.discountOnTP ?? 0 }
  }

  const applyDiscountsForPharmacyAndDistributor = (nextPharmacyId: string, nextDistributorId: string) => {
    const ph = pharmacies.find(p => p._id === nextPharmacyId)
    const dist = distributors.find(d => d._id === nextDistributorId)
    const dDisc = dist?.discountOnTP ?? 0
    const pDisc = ph?.discountOnTP ?? 0
    setItems(prev => prev.map(it => ({ ...it, distributorDiscount: dDisc, clinicDiscount: pDisc })))
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [ph, di, pr, doc, orderRes] = await Promise.all([
          pharmaciesService.list({ limit: 100 }),
          distributorsService.list({ limit: 100 }),
          productsService.list({ limit: 100 }),
          doctorsService.list({ limit: 100 }),
          ordersService.getById(params.id)
        ])
        setPharmacies(ph.data.data || [])
        setDistributors(di.data.data || [])
        setProducts(pr.data.data || [])
        setDoctors(doc.data.data || [])

        const order = orderRes.data?.data
        if (!order) {
          showApiError(null, 'Order not found')
          router.replace('/orders/list')
          return
        }
        if (order.status !== 'PENDING') {
          showApiError(null, 'Only pending orders can be edited')
          router.replace(`/orders/${params.id}`)
          return
        }

        setPharmacyId(String(order.pharmacyId?._id || order.pharmacyId))
        setDistributorId(String(order.distributorId?._id || order.distributorId))
        setDoctorId(order.doctorId ? String(order.doctorId._id || order.doctorId) : '')
        setNotes(order.notes || '')
        setItems(
          order.items.map((it: any) => ({
            productId: String(it.productId?._id || it.productId),
            quantity: it.quantity,
            distributorDiscount: it.distributorDiscount ?? 0,
            clinicDiscount: it.clinicDiscount ?? 0
          }))
        )
      } catch (err) {
        showApiError(err, 'Failed to load order')
        router.replace('/orders/list')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [params.id, router])

  const addItem = () => {
    const { d, p } = getDiscountDefaults()
    setItems(prev => [...prev, defaultLineItem(d, p)])
  }
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: string, value: any) =>
    setItems(prev => prev.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))

  const handleSubmit = async () => {
    if (!pharmacyId || !distributorId) {
      showApiError(null, 'Select pharmacy and distributor')
      return
    }
    if (items.some(i => !i.productId || i.quantity < 1)) {
      showApiError(null, 'Fill all items')
      return
    }
    setSubmitting(true)
    try {
      await ordersService.update(params.id, {
        pharmacyId,
        distributorId,
        doctorId: doctorId || null,
        items,
        notes
      })
      showSuccess('Order updated')
      router.push(`/orders/${params.id}`)
    } catch (err) {
      showApiError(err, 'Failed to update order')
    } finally {
      setSubmitting(false)
    }
  }

  const { d: previewDistDisc, p: previewPharmDisc } = pharmacyId && distributorId ? getDiscountDefaults() : { d: 0, p: 0 }

  return (
    <Card>
      <CardHeader
        title={
          <div className='flex items-center gap-1'>
            <IconButton aria-label='Back to order' onClick={() => router.push(`/orders/${params.id}`)} size='small' className='-mis-1'>
              <i className='tabler-arrow-left' />
            </IconButton>
            <Typography component='span' variant='h5'>
              Edit Order
            </Typography>
          </div>
        }
      />
      {loading ? (
        <CardContent className='flex justify-center items-center min-bs-[240px]'>
          <CircularProgress />
        </CardContent>
      ) : (
        <CardContent>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                required
                select
                fullWidth
                label='Pharmacy'
                value={pharmacyId}
                onChange={e => {
                  const v = e.target.value
                  setPharmacyId(v)
                  applyDiscountsForPharmacyAndDistributor(v, distributorId)
                }}
              >
                {pharmacies.map(p => (
                  <MenuItem key={p._id} value={p._id}>
                    {p.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                required
                select
                fullWidth
                label='Distributor'
                value={distributorId}
                onChange={e => {
                  const v = e.target.value
                  setDistributorId(v)
                  applyDiscountsForPharmacyAndDistributor(pharmacyId, v)
                }}
              >
                {distributors.map(d => (
                  <MenuItem key={d._id} value={d._id}>
                    {d.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField select fullWidth label='Doctor (optional)' value={doctorId} onChange={e => setDoctorId(e.target.value)}>
                <MenuItem value=''>None</MenuItem>
                {doctors.map(d => (
                  <MenuItem key={d._id} value={d._id}>
                    {d.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>

            {pharmacyId && distributorId && (
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Default discounts (on TP): distributor {previewDistDisc}% · pharmacy {previewPharmDisc}% — applied when you change pharmacy or
                  distributor; override per line below.
                </Typography>
              </Grid>
            )}

            {items.map((item, i) => (
              <Grid container spacing={3} key={i} size={{ xs: 12 }}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <CustomTextField required select fullWidth label='Product' value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                    {products.map(p => (
                      <MenuItem key={p._id} value={p._id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </CustomTextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <CustomTextField required fullWidth label='Qty' type='number' value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <CustomTextField
                    fullWidth
                    label='Dist. Disc. % (on TP)'
                    type='number'
                    value={item.distributorDiscount}
                    onChange={e => updateItem(i, 'distributorDiscount', +e.target.value)}
                    helperText='From distributor'
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <CustomTextField
                    fullWidth
                    label='Pharmacy Disc. % (on TP)'
                    type='number'
                    value={item.clinicDiscount}
                    onChange={e => updateItem(i, 'clinicDiscount', +e.target.value)}
                    helperText='After distributor discount'
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 1 }} className='flex items-center'>
                  {items.length > 1 && (
                    <IconButton onClick={() => removeItem(i)}>
                      <i className='tabler-trash text-error' />
                    </IconButton>
                  )}
                </Grid>
              </Grid>
            ))}

            <Grid size={{ xs: 12 }}>
              <Button variant='outlined' onClick={addItem} startIcon={<i className='tabler-plus' />}>
                Add Item
              </Button>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField fullWidth label='Notes' multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button variant='contained' onClick={handleSubmit} disabled={submitting || !isFormValid}>
                {submitting ? 'Saving...' : 'Save changes'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      )}
    </Card>
  )
}

export default EditOrderPage
