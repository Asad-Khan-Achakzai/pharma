'use client'

import { useState, useEffect, useRef, use } from 'react'
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

const EditOrderPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const router = useRouter()
  const { user } = useAuth()
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  /** Full list for the doctor dropdown (API max 100 per page); order’s doctor merged in if missing */
  const [allDoctors, setAllDoctors] = useState<any[]>([])
  const [assignableReps, setAssignableReps] = useState<any[]>([])
  const [pharmacyId, setPharmacyId] = useState('')
  const [distributorId, setDistributorId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [medicalRepId, setMedicalRepId] = useState('')
  /** If current order’s rep is not in assignable list (e.g. deactivated), show label in dropdown */
  const [fallbackRepName, setFallbackRepName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([defaultLineItem(0, 0, 0, 0)])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  /** After first pharmacy sync for this order, changing pharmacy uses strict “first linked” default */
  const pharmacyDoctorGateRef = useRef<'initial' | 'ready'>('initial')

  useEffect(() => {
    pharmacyDoctorGateRef.current = 'initial'
  }, [params.id])

  const isFormValid =
    pharmacyId !== '' &&
    distributorId !== '' &&
    medicalRepId !== '' &&
    items.length > 0 &&
    items.every(i => i.productId !== '' && i.quantity > 0)

  const getDiscountDefaults = () => {
    const ph = pharmacies.find(p => p._id === pharmacyId)
    const dist = distributors.find(d => d._id === distributorId)
    return { d: dist?.discountOnTP ?? 0, p: ph?.discountOnTP ?? 0 }
  }

  const getBonusScheme = () => {
    const ph = pharmacies.find(p => p._id === pharmacyId)
    return { buy: ph?.bonusScheme?.buyQty ?? 0, get: ph?.bonusScheme?.getQty ?? 0 }
  }

  const applyDiscountsForPharmacyAndDistributor = (nextPharmacyId: string, nextDistributorId: string) => {
    const ph = pharmacies.find(p => p._id === nextPharmacyId)
    const dist = distributors.find(d => d._id === nextDistributorId)
    const dDisc = dist?.discountOnTP ?? 0
    const pDisc = ph?.discountOnTP ?? 0
    const buy = ph?.bonusScheme?.buyQty ?? 0
    const get = ph?.bonusScheme?.getQty ?? 0
    setItems(prev =>
      prev.map(it => ({
        ...it,
        distributorDiscount: dDisc,
        clinicDiscount: pDisc,
        manualBonus: false,
        bonusQuantity: calculateBonus(it.quantity, buy, get)
      }))
    )
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [ph, di, pr, reps, docRes, orderRes] = await Promise.all([
          pharmaciesService.list({ limit: 100 }),
          distributorsService.list({ limit: 100 }),
          productsService.list({ limit: 100 }),
          ordersService.listAssignableReps(),
          doctorsService.list({ limit: 100, isActive: 'true' }),
          ordersService.getById(params.id)
        ])
        setPharmacies(ph.data.data || [])
        setDistributors(di.data.data || [])
        setProducts(pr.data.data || [])
        setAssignableReps(reps.data.data || [])

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

        const phId = String(order.pharmacyId?._id || order.pharmacyId)
        const phRow = (order.pharmacyId && typeof order.pharmacyId === 'object' ? order.pharmacyId : null) as any
        const schemeBuy = phRow?.bonusScheme?.buyQty ?? 0
        const schemeGet = phRow?.bonusScheme?.getQty ?? 0

        const docRaw = docRes.data.data || []
        let doctorOptions = [...docRaw].sort((a: any, b: any) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        )
        const orderDocId = order.doctorId ? String(order.doctorId._id || order.doctorId) : ''
        if (orderDocId && !doctorOptions.some((d: any) => String(d._id) === orderDocId)) {
          const row =
            order.doctorId && typeof order.doctorId === 'object'
              ? order.doctorId
              : { _id: orderDocId, name: 'Doctor' }
          doctorOptions.push(row as any)
          doctorOptions = [...doctorOptions].sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          )
        }
        setAllDoctors(doctorOptions)

        setPharmacyId(phId)
        setDistributorId(String(order.distributorId?._id || order.distributorId))
        setDoctorId(order.doctorId ? String(order.doctorId._id || order.doctorId) : '')
        const repOid = String(order.medicalRepId?._id || order.medicalRepId || '')
        setMedicalRepId(repOid)
        setFallbackRepName(
          order.medicalRepId && typeof order.medicalRepId === 'object' ? order.medicalRepId.name || '' : ''
        )
        setNotes(order.notes || '')
        setItems(
          order.items.map((it: any) => {
            const q = it.quantity
            const bq = it.bonusQuantity ?? 0
            const auto = calculateBonus(q, it.bonusScheme?.buyQty ?? schemeBuy, it.bonusScheme?.getQty ?? schemeGet)
            return {
              productId: String(it.productId?._id || it.productId),
              quantity: q,
              distributorDiscount: it.distributorDiscount ?? 0,
              clinicDiscount: it.clinicDiscount ?? 0,
              bonusQuantity: bq,
              manualBonus: bq !== auto
            }
          })
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

  const addItem = () => {
    const { d, p } = getDiscountDefaults()
    const { buy, get } = getBonusScheme()
    setItems(prev => [...prev, defaultLineItem(d, p, buy, get)])
  }
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const updateItem = (i: number, field: string, value: any) => {
    const { buy, get } = getBonusScheme()
    setItems(prev =>
      prev.map((item, idx) => {
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
      })
    )
  }

  const handleSubmit = async () => {
    if (!pharmacyId || !distributorId) {
      showApiError(null, 'Select pharmacy and distributor')
      return
    }
    if (!medicalRepId) {
      showApiError(null, 'Select medical rep')
      return
    }
    if (items.some(i => !i.productId || i.quantity < 1)) {
      showApiError(null, 'Fill all items')
      return
    }
    setSubmitting(true)
    try {
      const payloadItems = items.map(({ manualBonus: _m, ...rest }) => rest)
      await ordersService.update(params.id, {
        pharmacyId,
        distributorId,
        doctorId: doctorId || null,
        medicalRepId,
        items: payloadItems,
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
  const { buy: schemeBuy, get: schemeGet } = getBonusScheme()
  const distributor = distributors.find(d => d._id === distributorId)
  const financePreview = buildPreviewFromFormItems(items, products, distributor)

  let repOptions =
    assignableReps.length > 0
      ? assignableReps
      : user
        ? [{ _id: user._id, name: user.name, role: user.role }]
        : []
  if (
    medicalRepId &&
    !repOptions.some((u: any) => String(u._id) === String(medicalRepId))
  ) {
    repOptions = [
      { _id: medicalRepId, name: fallbackRepName || 'Assigned rep' },
      ...repOptions
    ]
  }

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
                helperText='Change who is credited for this order.'
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
                  Default discounts (on TP): distributor {previewDistDisc}% · pharmacy {previewPharmDisc}% — applied when you change pharmacy or
                  distributor; override per line below.
                </Typography>
                <Typography variant='body2' color='text.secondary' className='mts-1'>
                  Bonus scheme: {schemeBuy > 0 && schemeGet > 0 ? `${schemeBuy} + ${schemeGet}` : 'None'}
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
                <Grid size={{ xs: 4, sm: 2 }}>
                  <CustomTextField required fullWidth label='Paid qty' type='number' value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <CustomTextField
                    fullWidth
                    label='Bonus qty'
                    type='number'
                    value={item.bonusQuantity}
                    onChange={e => updateItem(i, 'bonusQuantity', +e.target.value)}
                    helperText={schemeBuy > 0 && schemeGet > 0 ? `Scheme ${schemeBuy}+${schemeGet}` : 'No scheme'}
                  />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
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
            {pharmacyId && distributorId && (
              <Grid size={{ xs: 12 }}>
                <OrderFormFinanceSummary preview={financePreview} />
              </Grid>
            )}
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
