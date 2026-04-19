'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { ordersService } from '@/services/orders.service'
import tableStyles from '@core/styles/table.module.css'

type Order = { _id: string; orderNumber: string; pharmacyId: any; distributorId: any; medicalRepId: any; status: string; totalOrderedAmount: number; createdAt: string }

const statusColors: Record<string, 'success' | 'warning' | 'info' | 'error' | 'default'> = {
  PENDING: 'warning', PARTIALLY_DELIVERED: 'info', DELIVERED: 'success', PARTIALLY_RETURNED: 'warning', RETURNED: 'error', CANCELLED: 'default'
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<Order>()

const OrderListPage = () => {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('orders.create')
  const canEdit = hasPermission('orders.edit')
  const [data, setData] = useState<Order[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try { const { data: res } = await ordersService.list({ limit: 100 }); setData(res.data || []) }
      catch (err) { showApiError(err, 'Failed to load orders') }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  const columns = useMemo<ColumnDef<Order, any>[]>(() => [
    columnHelper.accessor(
      (r) => {
        const name = typeof r.pharmacyId === 'object' && r.pharmacyId?.name ? String(r.pharmacyId.name) : ''
        return `${name} ${r.orderNumber}`.trim()
      },
      {
        id: 'pharmacy',
        header: 'Pharmacy',
        cell: ({ row }) => {
          const name =
            typeof row.original.pharmacyId === 'object' && row.original.pharmacyId?.name
              ? row.original.pharmacyId.name
              : null
          return (
            <Typography
              fontWeight={500}
              color='primary'
              className='cursor-pointer'
              onClick={() => router.push(`/orders/${row.original._id}`)}
            >
              {name ?? '—'}
            </Typography>
          )
        }
      }
    ),
    columnHelper.accessor('status', { header: 'Status', cell: ({ row }) => <Chip label={row.original.status} color={statusColors[row.original.status] || 'default'} size='small' variant='tonal' /> }),
    columnHelper.accessor('totalOrderedAmount', { header: 'Amount', cell: ({ row }) => `₨ ${row.original.totalOrderedAmount?.toFixed(2)}` }),
    columnHelper.display({ id: 'date', header: 'Date', cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString() }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex items-center'>
          {canEdit && row.original.status === 'PENDING' && (
            <IconButton size='small' aria-label='Edit order' onClick={() => router.push(`/orders/${row.original._id}/edit`)}>
              <i className='tabler-edit text-textSecondary' />
            </IconButton>
          )}
          <IconButton size='small' aria-label='View order' onClick={() => router.push(`/orders/${row.original._id}`)}>
            <i className='tabler-eye text-textSecondary' />
          </IconButton>
        </div>
      )
    })
  ], [router, canEdit])

  const table = useReactTable({
    data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel()
  })

  return (
    <Card>
      <CardHeader title='Orders' />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />
        {canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push('/orders/add')}>Create Order</Button>}
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : <div className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''} onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{{ asc: ' 🔼', desc: ' 🔽' }[h.column.getIsSorted() as string] ?? null}</div>}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No orders found</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
    </Card>
  )
}

export default OrderListPage
