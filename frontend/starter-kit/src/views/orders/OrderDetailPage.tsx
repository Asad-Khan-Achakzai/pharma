'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { ordersService } from '@/services/orders.service'
import { lineTotalQuantity } from '@/utils/bonus'

const statusColors: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
  PENDING: 'warning', PARTIALLY_DELIVERED: 'info', DELIVERED: 'success', PARTIALLY_RETURNED: 'warning', RETURNED: 'error', CANCELLED: 'default'
}

const OrderDetailPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const router = useRouter()
  const params = use(paramsPromise)
  const [order, setOrder] = useState<any>(null)
  const [deliverOpen, setDeliverOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [deliverItems, setDeliverItems] = useState<any[]>([])
  const [returnItems, setReturnItems] = useState<any[]>([])
  const [loadError, setLoadError] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [returning, setReturning] = useState(false)
  const { hasPermission } = useAuth()
  const hasDeliverPerm = hasPermission('orders.deliver')
  const hasReturnPerm = hasPermission('orders.return')
  const hasEditPerm = hasPermission('orders.edit')

  const fetchOrder = async () => {
    try {
      const { data: res } = await ordersService.getById(params.id)
      setOrder(res.data)
      setLoadError(false)
    } catch (err) {
      setLoadError(true)
      showApiError(err, 'Failed to load order')
    }
  }

  useEffect(() => { fetchOrder() }, [params.id])

  const openDeliver = () => {
    const items = order.items
      .filter((i: any) => {
        const lineMax = lineTotalQuantity(i.quantity, i.bonusQuantity ?? 0)
        return i.deliveredQty < lineMax
      })
      .map((i: any) => {
        const lineMax = lineTotalQuantity(i.quantity, i.bonusQuantity ?? 0)
        const remaining = lineMax - i.deliveredQty
        return {
          productId: i.productId?._id || i.productId,
          productName: i.productName,
          maxQty: remaining,
          quantity: remaining
        }
      })
    setDeliverItems(items)
    setDeliverOpen(true)
  }

  const openReturn = () => {
    const items = order.items.filter((i: any) => i.deliveredQty > i.returnedQty).map((i: any) => ({ productId: i.productId?._id || i.productId, productName: i.productName, maxQty: i.deliveredQty - i.returnedQty, quantity: 0, reason: '' }))
    setReturnItems(items)
    setReturnOpen(true)
  }

  const handleDeliver = async () => {
    const validItems = deliverItems.filter(i => i.quantity > 0).map(i => ({ productId: i.productId, quantity: i.quantity }))
    if (validItems.length === 0) { showApiError(null, 'Select items to deliver'); return }
    setDelivering(true)
    try {
      await ordersService.deliver(params.id, { items: validItems })
      showSuccess('Delivery recorded'); setDeliverOpen(false); fetchOrder()
    } catch (err) { showApiError(err, 'Delivery failed') }
    finally { setDelivering(false) }
  }

  const handleReturn = async () => {
    const validItems = returnItems.filter(i => i.quantity > 0).map(i => ({ productId: i.productId, quantity: i.quantity, reason: i.reason }))
    if (validItems.length === 0) { showApiError(null, 'Select items to return'); return }
    setReturning(true)
    try {
      await ordersService.returnOrder(params.id, { items: validItems })
      showSuccess('Return recorded'); setReturnOpen(false); fetchOrder()
    } catch (err) { showApiError(err, 'Return failed') }
    finally { setReturning(false) }
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className='flex flex-col gap-4'>
          <Button variant='text' startIcon={<i className='tabler-arrow-left' />} onClick={() => router.push('/orders/list')}>
            Back to orders
          </Button>
          <Typography color='error'>Failed to load order. It may not exist or you may not have access.</Typography>
        </CardContent>
      </Card>
    )
  }
  if (!order) return <Card><CardContent className='flex justify-center items-center min-bs-[200px]'><CircularProgress /></CardContent></Card>

  const canDeliver = hasDeliverPerm && ['PENDING', 'PARTIALLY_DELIVERED'].includes(order.status)
  const canReturn = hasReturnPerm && ['DELIVERED', 'PARTIALLY_DELIVERED', 'PARTIALLY_RETURNED'].includes(order.status)
  const canEditPending = hasEditPerm && order.status === 'PENDING'

  const pk = (n: number | null | undefined) =>
    n != null && !Number.isNaN(n)
      ? `₨ ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—'
  const hasOrderFinancialSnap =
    order.finalCompanyRevenue != null ||
    order.pharmacyDiscountAmount != null ||
    order.totalAmount != null
  const grossTotal = order.totalAmount ?? order.totalOrderedAmount

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardHeader
            title={
              <div className='flex items-center gap-1'>
                <IconButton
                  aria-label='Back to orders list'
                  onClick={() => router.push('/orders/list')}
                  size='small'
                  className='-mis-1'
                >
                  <i className='tabler-arrow-left' />
                </IconButton>
                <Typography component='span' variant='h5'>
                  Order {order.orderNumber}
                </Typography>
              </div>
            }
            action={
              <div className='flex flex-wrap gap-2'>
                {canEditPending && (
                  <Button component={Link} href={`/orders/${params.id}/edit`} variant='outlined'>
                    Edit order
                  </Button>
                )}
                {canDeliver && <Button variant='contained' color='success' onClick={openDeliver}>Deliver</Button>}
                {canReturn && <Button variant='outlined' color='error' onClick={openReturn}>Return</Button>}
              </div>
            }
          />
          <CardContent>
            <div className='flex flex-wrap gap-4 mbe-4'>
              <Chip label={order.status} color={statusColors[order.status] || 'default'} />
              <Typography>Date: {new Date(order.createdAt).toLocaleDateString()}</Typography>
            </div>
            {hasOrderFinancialSnap ? (
              <Box className='mbe-4 rounded p-4' sx={{ border: 1, borderColor: 'divider' }}>
                <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
                  Order financial snapshot (at order time)
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Total amount (gross TP)
                    </Typography>
                    <Typography fontWeight={600}>{pk(grossTotal)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Pharmacy discount
                    </Typography>
                    <Typography fontWeight={600}>{pk(order.pharmacyDiscountAmount)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Amount after pharmacy discount
                    </Typography>
                    <Typography fontWeight={600}>{pk(order.amountAfterPharmacyDiscount)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Distributor commission (on gross TP)
                    </Typography>
                    <Typography fontWeight={600}>{pk(order.distributorCommissionAmount)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Final company revenue
                    </Typography>
                    <Typography fontWeight={600} color='primary.main'>
                      {pk(order.finalCompanyRevenue)}
                    </Typography>
                  </Grid>
                  {order.totalBonusQuantity != null && order.totalBonusQuantity > 0 && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='body2' color='text.secondary'>
                        Total bonus units (order)
                      </Typography>
                      <Typography fontWeight={600}>{order.totalBonusQuantity}</Typography>
                    </Grid>
                  )}
                  {order.totalCastingCost != null && order.totalCastingCost > 0 && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant='body2' color='text.secondary'>
                        Inventory cost snapshot (casting × units)
                      </Typography>
                      <Typography fontWeight={600}>{pk(order.totalCastingCost)}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            ) : (
              <Typography className='mbe-4'>
                Total (gross TP): ₨ {order.totalOrderedAmount?.toFixed(2)}
              </Typography>
            )}
            <Divider className='mbe-4' />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Pharmacy</Typography><Typography>{order.pharmacyId?.name}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Distributor</Typography><Typography>{order.distributorId?.name}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Doctor</Typography><Typography>{order.doctorId?.name || '-'}</Typography></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Typography variant='body2' color='text.secondary'>Rep</Typography><Typography>{order.medicalRepId?.name}</Typography></Grid>
            </Grid>
            <Divider className='mbs-4 mbe-4' />
            <Typography variant='h6' className='mbe-2'>Items</Typography>
            <Box
              sx={{
                overflowX: 'auto',
                maxWidth: '100%',
                WebkitOverflowScrolling: 'touch',
                mx: { xs: -2, sm: 0 },
                px: { xs: 2, sm: 0 }
              }}
            >
              <table
                style={{
                  width: '100%',
                  minWidth: hasOrderFinancialSnap ? 1180 : 720,
                  borderCollapse: 'collapse',
                  tableLayout: 'auto'
                }}
              >
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Product</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Paid</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Bonus</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Total</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Delivered</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Returned</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>TP</th>
                  <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Casting</th>
                  {hasOrderFinancialSnap && (
                    <>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Charged (TP×paid)</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Pharm. disc.</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Net</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap' }}>Dist. comm.</th>
                      <th style={{ padding: 8, whiteSpace: 'nowrap', minWidth: 112 }}>Company</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>{item.productName || item.productId?.name}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.quantity}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.bonusQuantity ?? 0}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{lineTotalQuantity(item.quantity, item.bonusQuantity ?? 0)}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.deliveredQty}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{item.returnedQty}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>₨ {item.tpAtTime?.toFixed(2)}</td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>₨ {item.castingAtTime?.toFixed(2)}</td>
                    {hasOrderFinancialSnap && (
                      <>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.grossAmount)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.pharmacyDiscountAmount)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.netAfterPharmacy)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{pk(item.distributorCommissionAmount)}</td>
                        <td style={{ padding: 8, whiteSpace: 'nowrap', minWidth: 112 }}>{pk(item.finalCompanyAmount)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        {order.deliveries?.length > 0 && (
          <Card className='mbe-4'>
            <CardHeader title='Delivery History' />
            <CardContent>
              {order.deliveries.map((d: any) => (
                <div key={d._id} className='mbe-3 pbe-3' style={{ borderBottom: '1px solid #eee' }}>
                  <Typography fontWeight={500}>{d.invoiceNumber}</Typography>
                  <Typography variant='body2'>Amount: ₨ {d.totalAmount?.toFixed(2)} | Profit: ₨ {d.totalProfit?.toFixed(2)}</Typography>
                  <Typography variant='body2' color='text.secondary'>{new Date(d.deliveredAt).toLocaleString()} by {d.deliveredBy?.name}</Typography>
                  {d.pdfUrl && <Button size='small' href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '')}${d.pdfUrl}`} target='_blank'>Download PDF</Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {order.returns?.length > 0 && (
          <Card>
            <CardHeader title='Return History' />
            <CardContent>
              {order.returns.map((r: any) => (
                <div key={r._id} className='mbe-3 pbe-3' style={{ borderBottom: '1px solid #eee' }}>
                  <Typography variant='body2'>Amount: ₨ {r.totalAmount?.toFixed(2)}</Typography>
                  <Typography variant='body2' color='text.secondary'>{new Date(r.returnedAt).toLocaleString()} by {r.returnedBy?.name}</Typography>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </Grid>

      <Dialog open={deliverOpen} onClose={() => setDeliverOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Deliver Items</DialogTitle>
        <DialogContent>
          {deliverItems.map((item, i) => (
            <div key={i} className='flex gap-4 items-center mbe-3 pbs-2'>
              <Typography className='flex-1'>{item.productName}</Typography>
              <CustomTextField label={`Max: ${item.maxQty}`} type='number' value={item.quantity}
                onChange={e => setDeliverItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(+e.target.value, it.maxQty) } : it))}
                style={{ width: 120 }} />
            </div>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setDeliverOpen(false)}>Cancel</Button><Button variant='contained' color='success' onClick={handleDeliver} disabled={delivering}>{delivering ? 'Confirming...' : 'Confirm Delivery'}</Button></DialogActions>
      </Dialog>

      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Return Items</DialogTitle>
        <DialogContent>
          {returnItems.map((item, i) => (
            <div key={i} className='flex gap-4 items-center mbe-3 pbs-2'>
              <Typography className='flex-1'>{item.productName}</Typography>
              <CustomTextField label={`Max: ${item.maxQty}`} type='number' value={item.quantity}
                onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Math.min(+e.target.value, it.maxQty) } : it))}
                style={{ width: 120 }} />
            </div>
          ))}
        </DialogContent>
        <DialogActions><Button onClick={() => setReturnOpen(false)}>Cancel</Button><Button variant='contained' color='error' onClick={handleReturn} disabled={returning}>{returning ? 'Confirming...' : 'Confirm Return'}</Button></DialogActions>
      </Dialog>
    </Grid>
  )
}

export default OrderDetailPage
