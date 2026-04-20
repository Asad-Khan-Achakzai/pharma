'use client'

import { useState, useEffect, useRef } from 'react'
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
import { useAuth } from '@/contexts/AuthContext'
import { ordersService } from '@/services/orders.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'
import { doctorsService } from '@/services/doctors.service'
import { buildPreviewFromFormItems } from '@/utils/orderFinancialPreview'
import { calculateBonus } from '@/utils/bonus'
import OrderFormFinanceSummary from '@/views/orders/OrderFormFinanceSummary'

type LineItem = {
  productId: string
  quantity: number
  distributorDiscount: number
  clinicDiscount: number
  bonusQuantity: number
  manualBonus: boolean
}

const defaultLineItem = (distDisc: number, pharmDisc: number, buy: number, get: number): LineItem => ({
  productId: '',
  quantity: 1,
  distributorDiscount: distDisc,
  clinicDiscount: pharmDisc,
  bonusQuantity: calculateBonus(1, buy, get),
  manualBonus: false
})

const CreateOrderPage = () => {
  const router = useRouter()
  const { user } = useAuth()
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  /** Full list for the doctor dropdown (API max 100 per page) */
  const [allDoctors, setAllDoctors] = useState<any[]>([])
  const [assignableReps, setAssignableReps] = useState<any[]>([])
  const [pharmacyId, setPharmacyId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [medicalRepId, setMedicalRepId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([defaultLineItem(0, 0, 0, 0)])
  const [loadingData, setLoadingData] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  /** After first pharmacy sync, changing pharmacy uses strict “first linked” default */
  const pharmacyDoctorGateRef = useRef<'initial' | 'ready'>('initial')

  const isFormValid =
    pharmacyId !== '' &&
    distributorId !== '' &&
    medicalRepId !== '' &&
    items.length > 0 &&
    items.every(i => i.productId !== '' && i.quantity > 0)

  useEffect(() => {
    const fetch = async () => {
      setLoadingData(true)
      try {
        const [ph, di, pr, reps, docRes] = await Promise.all([
          pharmaciesService.list({ limit: 100 }),
          distributorsService.list({ limit: 100 }),
          productsService.list({ limit: 100 }),
          ordersService.listAssignableReps(),
          doctorsService.list({ limit: 100, isActive: 'true' })
        ])
        setPharmacies(ph.data.data || [])
        setDistributors(di.data.data || [])
        setProducts(pr.data.data || [])
        setAssignableReps(reps.data.data || [])
        const docRaw = docRes.data.data || []
        setAllDoctors(
          [...docRaw].sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          )
        )
      } catch (err) { showApiError(err, 'Failed to load data') }
      finally { setLoadingData(false) }
    }
    fetch()
  }, [])

  useEffect(() => {
    if (user?._id) setMedicalRepId(prev => (prev ? prev : user._id))
  }, [user])

  /** Default doctor from pharmacy-linked list; dropdown still lists all doctors */
  useEffect(() => {
    if (!pharmacyId) {
      setDoctorId('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await doctorsService.list({ pharmacyId, limit: 100, isActive: 'true' })
        const raw = res.data.data || []
        const list = [...raw].sort((a: any, b: any) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        )
        if (cancelled) return
        setDoctorId(prev => {
          const ids = new Set(list.map((d: any) => String(d._id)))
          if (pharmacyDoctorGateRef.current === 'initial') {
            pharmacyDoctorGateRef.current = 'ready'
            if (prev && ids.has(String(prev))) return prev
            if (prev) return prev
            return list[0]?._id ? String(list[0]._id) : ''
          }
          if (prev && ids.has(String(prev))) return prev
          return list[0]?._id ? String(list[0]._id) : ''
        })
      } catch {
        if (!cancelled) setDoctorId('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pharmacyId])

  const getDiscountDefaults = () => {
    const ph = pharmacies.find(p => p._id === pharmacyId)
    const dist = distributors.find(d => d._id === distributorId)
    return { d: dist?.discountOnTP ?? 0, p: ph?.discountOnTP ?? 0 }
  }

  const getBonusScheme = () => {
    const ph = pharmacies.find(p => p._id === pharmacyId)
    return { buy: ph?.bonusScheme?.buyQty ?? 0, get: ph?.bonusScheme?.getQty ?? 0 }
  }

  /** When pharmacy or distributor changes, refill discounts and auto bonus from scheme */
  useEffect(() => {
    if (!pharmacyId || !distributorId) return
    const ph = pharmacies.find(p => p._id === pharmacyId)
    const dist = distributors.find(d => d._id === distributorId)
    if (!ph || !dist) return
    const d = dist.discountOnTP ?? 0
    const p = ph.discountOnTP ?? 0
    const buy = ph.bonusScheme?.buyQty ?? 0
    const get = ph.bonusScheme?.getQty ?? 0
    setItems(prev => prev.map(it => ({
      ...it,
      distributorDiscount: d,
      clinicDiscount: p,
      manualBonus: false,
      bonusQuantity: calculateBonus(it.quantity, buy, get)
    })))
  }, [pharmacyId, distributorId, pharmacies, distributors])

  const addItem = () => {
    const { d, p } = getDiscountDefaults()
    const { buy, get } = getBonusScheme()
    setItems(prev => [...prev, defaultLineItem(d, p, buy, get)])
  }
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const updateItem = (i: number, field: string, value: any) => {
    const { buy, get } = getBonusScheme()
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      if (field === 'quantity') {
        const q = +value
        return {
          ...item,
          quantity: q,
          manualBonus: false,
          bonusQuantity: calculateBonus(q, buy, get)
        }
      }
      if (field === 'bonusQuantity') {
        const b = Math.max(0, +value)
        return { ...item, bonusQuantity: b, manualBonus: true }
      }
      return { ...item, [field]: value }
    }))
  }

  const handleSubmit = async () => {
    if (!pharmacyId || !distributorId) { showApiError(null, 'Select pharmacy and distributor'); return }
    if (!medicalRepId) { showApiError(null, 'Select medical rep'); return }
    if (items.some(i => !i.productId || i.quantity < 1)) { showApiError(null, 'Fill all items'); return }
    setSubmitting(true)
    try {
      const payloadItems = items.map(({ manualBonus: _m, ...rest }) => rest)
      await ordersService.create({
        pharmacyId,
        distributorId,
        doctorId: doctorId || undefined,
        medicalRepId,
        items: payloadItems,
        notes
      })
      showSuccess('Order created')
      router.push('/orders/list')
    } catch (err) { showApiError(err, 'Failed to create order') }
    finally { setSubmitting(false) }
  }

  const { d: previewDistDisc, p: previewPharmDisc } = pharmacyId && distributorId ? getDiscountDefaults() : { d: 0, p: 0 }
  const { buy: schemeBuy, get: schemeGet } = getBonusScheme()
  const distributor = distributors.find(d => d._id === distributorId)
  const financePreview = buildPreviewFromFormItems(items, products, distributor)
  const repOptions =
    assignableReps.length > 0
      ? assignableReps
      : user
        ? [{ _id: user._id, name: user.name, role: user.role }]
        : []

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
            <CustomTextField
              select
              fullWidth
              label='Doctor (optional)'
              value={doctorId}
              onChange={e => setDoctorId(e.target.value)}
              disabled={!pharmacyId}
              helperText={
                pharmacyId
                  ? 'List shows all doctors. Default picks the first linked to this pharmacy when you change pharmacy; choose None or any doctor.'
                  : 'Select a pharmacy first'
              }
            >
              <MenuItem value=''>None</MenuItem>
              {allDoctors.map(d => (
                <MenuItem key={d._id} value={d._id}>
                  {d.name}
                </MenuItem>
              ))}
            </CustomTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CustomTextField
              required
              select
              fullWidth
              label='Medical rep (assigned to order)'
              value={medicalRepId}
              onChange={e => setMedicalRepId(e.target.value)}
              helperText='Defaults to you. Change if this order is for another rep.'
            >
              {repOptions.map((u: any) => (
                <MenuItem key={u._id} value={u._id}>
                  {u.name}
                  {u.role ? ` · ${String(u.role).replace(/_/g, ' ')}` : ''}
                </MenuItem>
              ))}
            </CustomTextField>
          </Grid>

          {pharmacyId && distributorId && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='body2' color='text.secondary'>
                Default discounts (on TP): distributor {previewDistDisc}% · pharmacy {previewPharmDisc}% — applied to all lines; you can override per line below.
              </Typography>
              <Typography variant='body2' color='text.secondary' className='mts-1'>
                Bonus scheme (Buy X Get Y): {schemeBuy > 0 && schemeGet > 0 ? `${schemeBuy} + ${schemeGet}` : 'None'} — bonus units are free (no TP); inventory cost uses paid + bonus.
              </Typography>
            </Grid>
          )}

          {items.map((item, i) => (
            <Grid container spacing={3} key={i} size={{ xs: 12 }}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <CustomTextField required select fullWidth label='Product' value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                  {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <CustomTextField required fullWidth label='Paid qty' type='number' value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <CustomTextField fullWidth label='Bonus qty' type='number' value={item.bonusQuantity} onChange={e => updateItem(i, 'bonusQuantity', +e.target.value)} helperText={schemeBuy > 0 && schemeGet > 0 ? `Scheme ${schemeBuy}+${schemeGet}` : 'No scheme'} />
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <CustomTextField fullWidth label='Dist. Disc. % (on TP)' type='number' value={item.distributorDiscount} onChange={e => updateItem(i, 'distributorDiscount', +e.target.value)} helperText='From distributor' />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }}>
                <CustomTextField fullWidth label='Pharmacy Disc. % (on TP)' type='number' value={item.clinicDiscount} onChange={e => updateItem(i, 'clinicDiscount', +e.target.value)} helperText='After distributor discount' />
              </Grid>
              <Grid size={{ xs: 6, sm: 1 }} className='flex items-center'>
                {items.length > 1 && <IconButton onClick={() => removeItem(i)}><i className='tabler-trash text-error' /></IconButton>}
              </Grid>
            </Grid>
          ))}

          <Grid size={{ xs: 12 }}><Button variant='outlined' onClick={addItem} startIcon={<i className='tabler-plus' />}>Add Item</Button></Grid>
          {pharmacyId && distributorId && (
            <Grid size={{ xs: 12 }}>
              <OrderFormFinanceSummary preview={financePreview} />
            </Grid>
          )}
          <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Notes' multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><Button variant='contained' onClick={handleSubmit} disabled={submitting || !isFormValid}>{submitting ? 'Creating...' : 'Create Order'}</Button></Grid>
        </Grid>
      </CardContent>
      )}
    </Card>
  )
}

export default CreateOrderPage
