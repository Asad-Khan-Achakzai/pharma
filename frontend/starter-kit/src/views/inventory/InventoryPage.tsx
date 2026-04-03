'use client'

import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import CircularProgress from '@mui/material/CircularProgress'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'

import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { showApiError } from '@/utils/apiErrors'
import { inventoryService } from '@/services/inventory.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'

import tableStyles from '@core/styles/table.module.css'

const LOW_STOCK_THRESHOLD = 50

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type InventoryRow = {
  _id: string
  productId: any
  distributorId: any
  quantity: number
  avgCostPerUnit: number
}

type SummaryRow = {
  productId: string
  productName: string
  composition: string
  mrp: number
  tp: number
  casting: number
  totalQuantity: number
  totalValue: number
  distributorCount: number
  avgCostPerUnit: number
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const detailHelper = createColumnHelper<InventoryRow>()
const summaryHelper = createColumnHelper<SummaryRow>()

const InventoryPage = () => {
  const [tab, setTab] = useState('detail')
  const [detailData, setDetailData] = useState<InventoryRow[]>([])
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([])
  const [totals, setTotals] = useState({ totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
  const [distributors, setDistributors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [filterDistributor, setFilterDistributor] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewDetail, setViewDetail] = useState<InventoryRow | null>(null)
  const [viewSummary, setViewSummary] = useState<SummaryRow | null>(null)

  const fetchLookups = async () => {
    try {
      const [d, p] = await Promise.all([
        distributorsService.list({ limit: 200 }),
        productsService.list({ limit: 200 })
      ])
      setDistributors(d.data.data || [])
      setProducts(p.data.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load filters')
    }
  }

  const fetchData = async (distId?: string, prodId?: string) => {
    setLoading(true)
    try {
      const params: any = { limit: 500 }
      if (distId) params.distributorId = distId
      if (prodId) params.productId = prodId

      const [detailRes, summaryRes] = await Promise.all([
        inventoryService.getAll(params),
        inventoryService.getSummary()
      ])

      setDetailData(detailRes.data.data || [])
      const sData = summaryRes.data.data
      setSummaryData(sData.byProduct || [])
      setTotals(sData.totals || { totalUnits: 0, totalValue: 0, uniqueProducts: 0 })
    } catch (err) {
      showApiError(err, 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLookups()
  }, [])

  useEffect(() => {
    fetchData(filterDistributor, filterProduct)
  }, [filterDistributor, filterProduct])

  const detailTotals = useMemo(() => {
    return detailData.reduce(
      (acc, row) => {
        acc.units += row.quantity
        acc.value += row.quantity * row.avgCostPerUnit
        return acc
      },
      { units: 0, value: 0 }
    )
  }, [detailData])

  const detailColumns = useMemo<ColumnDef<InventoryRow, any>[]>(
    () => [
      detailHelper.accessor((r) => r.productId?.name, {
        id: 'productName',
        header: 'Product',
        cell: ({ getValue }) => <Typography fontWeight={500}>{getValue() || '-'}</Typography>
      }),
      detailHelper.accessor((r) => r.distributorId?.name, {
        id: 'distributorName',
        header: 'Distributor',
        cell: ({ getValue }) => getValue() || '-'
      }),
      detailHelper.accessor('quantity', {
        header: 'Quantity',
        cell: ({ row }) => {
          const qty = row.original.quantity
          return qty <= LOW_STOCK_THRESHOLD ? (
            <Chip label={qty} color='warning' size='small' variant='tonal' />
          ) : (
            <Typography>{qty}</Typography>
          )
        }
      }),
      detailHelper.display({
        id: 'totalValue',
        header: 'Total Value',
        cell: ({ row }) => formatPKR(row.original.quantity * row.original.avgCostPerUnit)
      }),
      detailHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <IconButton size='small' onClick={() => setViewDetail(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
      })
    ],
    []
  )

  const summaryColumns = useMemo<ColumnDef<SummaryRow, any>[]>(
    () => [
      summaryHelper.accessor('productName', {
        header: 'Product',
        cell: ({ getValue }) => <Typography fontWeight={500}>{getValue()}</Typography>
      }),
      summaryHelper.accessor('totalQuantity', {
        header: 'Total Qty',
        cell: ({ row }) => {
          const qty = row.original.totalQuantity
          return qty <= LOW_STOCK_THRESHOLD ? (
            <Chip label={qty} color='warning' size='small' variant='tonal' />
          ) : (
            <Typography>{qty}</Typography>
          )
        }
      }),
      summaryHelper.accessor('totalValue', {
        header: 'Total Value',
        cell: ({ row }) => formatPKR(row.original.totalValue)
      }),
      summaryHelper.accessor('distributorCount', {
        header: 'Distributors',
        cell: ({ getValue }) => getValue()
      }),
      summaryHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <IconButton size='small' onClick={() => setViewSummary(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
      })
    ],
    []
  )

  const detailTable = useReactTable({
    data: detailData,
    columns: detailColumns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { globalFilter },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const summaryTable = useReactTable({
    data: summaryData,
    columns: summaryColumns,
    filterFns: { fuzzy: fuzzyFilter },
    state: { globalFilter },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const kpis = [
    { title: 'Unique Products', value: totals.uniqueProducts.toString(), icon: 'tabler-packages', color: 'primary' },
    { title: 'Total Units', value: totals.totalUnits.toLocaleString(), icon: 'tabler-box', color: 'info' },
    { title: 'Inventory Value', value: formatPKR(totals.totalValue), icon: 'tabler-coin', color: 'success' },
  // TODO: Commented for now as we don't needed at this time
    // {
    //   title: 'Low Stock Items',
    //   value: summaryData.filter((r) => r.totalQuantity <= LOW_STOCK_THRESHOLD).length.toString(),
    //   icon: 'tabler-alert-triangle',
    //   color: 'warning'
    // }
  ]

  const renderTable = (table: any, cols: any[]) => (
    <>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map((hg: any) => (
              <tr key={hg.id}>
                {hg.headers.map((h: any) => (
                  <th key={h.id}>
                    {h.isPlaceholder ? null : (
                      <div
                        className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {{ asc: ' 🔼', desc: ' 🔽' }[h.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={cols.length} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className='text-center p-6'>
                  No data found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row: any) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell: any) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePaginationComponent table={table} />
    </>
  )

  return (
    <Grid container spacing={6}>
      {kpis.map((kpi, i) => (
        <Grid key={i} size={{ xs: 12, sm: 4 }}>
          <Card>
            <CardContent className='flex flex-col items-center gap-2 p-6'>
              <i className={`${kpi.icon} text-3xl text-${kpi.color}`} />
              <Typography variant='h5'>{loading ? '-' : kpi.value}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {kpi.title}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Inventory' />
          <CardContent>
            <Grid container spacing={4} className='mbe-4'>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  select
                  fullWidth
                  label='Distributor'
                  value={filterDistributor}
                  onChange={(e) => setFilterDistributor(e.target.value)}
                  size='small'
                >
                  <MenuItem value=''>All Distributors</MenuItem>
                  {distributors.map((d) => (
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
                  label='Product'
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  size='small'
                >
                  <MenuItem value=''>All Products</MenuItem>
                  {products.map((p) => (
                    <MenuItem key={p._id} value={p._id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  fullWidth
                  label='Search'
                  value={globalFilter ?? ''}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  placeholder='Search...'
                  size='small'
                />
              </Grid>
            </Grid>
          </CardContent>
          <CardContent className='p-0'>
            <TabContext value={tab}>
              <TabList onChange={(_, v) => setTab(v)} className='pli-6'>
                <Tab label='Detailed View' value='detail' />
                <Tab label='Product Summary' value='summary' />
              </TabList>
              <TabPanel value='detail' className='p-0'>
                {renderTable(detailTable, detailColumns)}
                {!loading && detailData.length > 0 && (
                  <div className='flex justify-end gap-6 p-4 border-bs'>
                    <Typography variant='body2'>
                      <strong>Total Units:</strong> {detailTotals.units.toLocaleString()}
                    </Typography>
                    <Typography variant='body2'>
                      <strong>Total Value:</strong> {formatPKR(detailTotals.value)}
                    </Typography>
                  </div>
                )}
              </TabPanel>
              <TabPanel value='summary' className='p-0'>
                {renderTable(summaryTable, summaryColumns)}
              </TabPanel>
            </TabContext>
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={!!viewDetail} onClose={() => setViewDetail(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Inventory Details</DialogTitle>
        <DialogContent>
          {viewDetail && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Product</Typography><Typography fontWeight={500}>{viewDetail.productId?.name || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Composition</Typography><Typography>{viewDetail.productId?.composition || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Distributor</Typography><Typography>{viewDetail.distributorId?.name || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Quantity</Typography><Typography>{viewDetail.quantity}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Avg Cost/Unit</Typography><Typography>{formatPKR(viewDetail.avgCostPerUnit)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Total Value</Typography><Typography fontWeight={500}>{formatPKR(viewDetail.quantity * viewDetail.avgCostPerUnit)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>MRP</Typography><Typography>{formatPKR(viewDetail.productId?.mrp || 0)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>TP</Typography><Typography>{formatPKR(viewDetail.productId?.tp || 0)}</Typography></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewDetail(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={!!viewSummary} onClose={() => setViewSummary(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Product Inventory Summary</DialogTitle>
        <DialogContent>
          {viewSummary && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Product</Typography><Typography fontWeight={500}>{viewSummary.productName}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Composition</Typography><Typography>{viewSummary.composition || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Total Quantity</Typography><Typography>{viewSummary.totalQuantity}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Distributors</Typography><Typography>{viewSummary.distributorCount}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Avg Cost/Unit</Typography><Typography>{formatPKR(viewSummary.avgCostPerUnit)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Total Value</Typography><Typography fontWeight={500}>{formatPKR(viewSummary.totalValue)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>MRP</Typography><Typography>{formatPKR(viewSummary.mrp)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>TP</Typography><Typography>{formatPKR(viewSummary.tp)}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Casting</Typography><Typography>{formatPKR(viewSummary.casting)}</Typography></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewSummary(null)}>Close</Button></DialogActions>
      </Dialog>
    </Grid>
  )
}

export default InventoryPage
