'use client'
import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError } from '@/utils/apiErrors'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { ledgerService } from '@/services/ledger.service'
import tableStyles from '@core/styles/table.module.css'

type LedgerEntry = { _id: string; entityType: string; entityId: string; type: string; amount: number; referenceType: string; description: string; date: string }
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<LedgerEntry>()

const LedgerPage = () => {
  const [data, setData] = useState<LedgerEntry[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const f = async () => {
      setLoading(true)
      try { const { data: r } = await ledgerService.list({ limit: 200 }); setData(r.data || []) }
      catch (err) { showApiError(err, 'Failed to load ledger') }
      finally { setLoading(false) }
    }
    f()
  }, [])

  const columns = useMemo<ColumnDef<LedgerEntry, any>[]>(() => [
    columnHelper.accessor('type', { header: 'Type', cell: ({ row }) => <Chip label={row.original.type} color={row.original.type === 'DEBIT' ? 'error' : 'success'} size='small' variant='tonal' /> }),
    columnHelper.accessor('amount', { header: 'Amount', cell: ({ row }) => <Typography fontWeight={500}>₨ {row.original.amount?.toFixed(2)}</Typography> }),
    columnHelper.accessor('referenceType', { header: 'Reference' }),
    columnHelper.accessor('description', { header: 'Description' }),
    columnHelper.display({ id: 'date', header: 'Date', cell: ({ row }) => new Date(row.original.date).toLocaleDateString() })
  ], [])

  const table = useReactTable({ data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Ledger' action={<CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />} />
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No entries</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
    </Card>
  )
}
export default LedgerPage
