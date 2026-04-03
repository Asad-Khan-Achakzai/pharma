'use client'

import { useState, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError } from '@/utils/apiErrors'
import { inventoryService } from '@/services/inventory.service'

const InventoryPage = () => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try { const { data: res } = await inventoryService.getAll({ limit: 200 }); setData(res.data || []) }
      catch (err) { showApiError(err, 'Failed to load inventory') }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4'>Inventory Overview</Typography>
      </Grid>
      {loading ? (
        <Grid size={{ xs: 12 }} className='flex justify-center p-12'><CircularProgress /></Grid>
      ) : data.length === 0 ? (
        <Grid size={{ xs: 12 }}><Card><CardContent><Typography className='text-center'>No inventory data found</Typography></CardContent></Card></Grid>
      ) : data.map((item: any) => (
        <Grid key={item._id} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant='h6'>{item.productId?.name || 'Unknown Product'}</Typography>
              <Typography variant='body2' color='text.secondary'>Distributor: {item.distributorId?.name || '-'}</Typography>
              <div className='flex gap-2 mbs-3'>
                <Chip label={`Qty: ${item.quantity}`} color='primary' variant='tonal' />
                <Chip label={`Avg Cost: ₨ ${item.avgCostPerUnit?.toFixed(2)}`} variant='tonal' />
              </div>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

export default InventoryPage
