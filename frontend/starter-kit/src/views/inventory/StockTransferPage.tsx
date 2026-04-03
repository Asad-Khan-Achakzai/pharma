'use client'

import { useState, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { inventoryService } from '@/services/inventory.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'

const StockTransferPage = () => {
  const { hasPermission } = useAuth()
  const canTransfer = hasPermission('inventory.transfer')
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [distributorId, setDistributorId] = useState('')
  const [items, setItems] = useState([{ productId: '', quantity: 1, shippingCostPerUnit: 0 }])
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoadingData(true)
      try {
        const [d, p] = await Promise.all([distributorsService.list({ limit: 100 }), productsService.list({ limit: 100 })])
        setDistributors(d.data.data || [])
        setProducts(p.data.data || [])
      } catch (err) { showApiError(err, 'Failed to load data') }
      finally { setLoadingData(false) }
    }
    fetch()
  }, [])

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: 1, shippingCostPerUnit: 0 }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: string, value: any) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleSubmit = async () => {
    if (!distributorId) { showApiError(null, 'Select a distributor'); return }
    if (items.some(i => !i.productId || i.quantity < 1)) { showApiError(null, 'Fill all item fields'); return }
    setSaving(true)
    try {
      await inventoryService.transfer({ distributorId, items })
      showSuccess('Stock transferred successfully')
      setItems([{ productId: '', quantity: 1, shippingCostPerUnit: 0 }])
    } catch (err) { showApiError(err, 'Transfer failed') }
    finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader title='Stock Transfer' />
      <CardContent>
        {loadingData ? (
          <div className='flex justify-center p-12'><CircularProgress /></div>
        ) : (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <CustomTextField select fullWidth label='Distributor' value={distributorId} onChange={e => setDistributorId(e.target.value)}>
              {distributors.map(d => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
            </CustomTextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            {items.map((item, i) => (
              <Grid container spacing={3} key={i} className='mbe-3'>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <CustomTextField select fullWidth label='Product' value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                    {products.map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}
                  </CustomTextField>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <CustomTextField fullWidth label='Quantity' type='number' value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <CustomTextField fullWidth label='Shipping/Unit' type='number' value={item.shippingCostPerUnit} onChange={e => updateItem(i, 'shippingCostPerUnit', +e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }} className='flex items-center'>
                  {items.length > 1 && <IconButton onClick={() => removeItem(i)}><i className='tabler-trash text-error' /></IconButton>}
                </Grid>
              </Grid>
            ))}
            <Button variant='outlined' onClick={addItem} startIcon={<i className='tabler-plus' />}>Add Item</Button>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button variant='contained' onClick={handleSubmit} disabled={saving || !canTransfer} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Transferring...' : 'Transfer Stock'}</Button>
          </Grid>
        </Grid>
        )}
      </CardContent>
    </Card>
  )
}

export default StockTransferPage
