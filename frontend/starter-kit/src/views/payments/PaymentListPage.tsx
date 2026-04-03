'use client'
import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { useRouter } from 'next/navigation'
import { showApiError } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { paymentsService } from '@/services/payments.service'
import tableStyles from '@core/styles/table.module.css'

type Payment = { _id: string; pharmacyId: any; amount: number; paymentMethod: string; collectedBy: any; date: string }
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<Payment>()

const PaymentListPage = () => {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('payments.create')
  const [data, setData] = useState<Payment[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const f = async () => {
      setLoading(true)
      try { const { data: r } = await paymentsService.list({ limit: 100 }); setData(r.data || []) }
      catch (err) { showApiError(err, 'Failed to load payments') }
      finally { setLoading(false) }
    }
    f()
  }, [])

  const columns = useMemo<ColumnDef<Payment, any>[]>(() => [
    columnHelper.display({ id: 'pharmacy', header: 'Pharmacy', cell: ({ row }) => <Typography fontWeight={500}>{row.original.pharmacyId?.name || '-'}</Typography> }),
    columnHelper.accessor('amount', { header: 'Amount', cell: ({ row }) => `₨ ${row.original.amount?.toFixed(2)}` }),
    columnHelper.accessor('paymentMethod', { header: 'Method' }),
    columnHelper.display({ id: 'collectedBy', header: 'Collected By', cell: ({ row }) => row.original.collectedBy?.name || '-' }),
    columnHelper.display({ id: 'date', header: 'Date', cell: ({ row }) => new Date(row.original.date).toLocaleDateString() })
  ], [])

  const table = useReactTable({ data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Payments' action={<div className='flex gap-4 items-center'><CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />{canCreate && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push('/payments/add')}>Record Payment</Button>}</div>} />
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No payments</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
    </Card>
  )
}
export default PaymentListPage
