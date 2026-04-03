'use client'
import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError } from '@/utils/apiErrors'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import api from '@/services/api'
import tableStyles from '@core/styles/table.module.css'

type AuditEntry = { _id: string; userId: any; action: string; entityType: string; entityId: string; timestamp: string }
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<AuditEntry>()

const AuditLogPage = () => {
  const [data, setData] = useState<AuditEntry[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try { const { data: r } = await api.get('/audit-logs', { params: { limit: 200 } }); setData(r.data || []) }
      catch (err) { showApiError(err, 'Failed to load audit log') }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  const columns = useMemo<ColumnDef<AuditEntry, any>[]>(() => [
    columnHelper.display({ id: 'user', header: 'User', cell: ({ row }) => <Typography fontWeight={500}>{row.original.userId?.name || '-'}</Typography> }),
    columnHelper.accessor('action', { header: 'Action' }),
    columnHelper.accessor('entityType', { header: 'Entity' }),
    columnHelper.display({ id: 'date', header: 'Date', cell: ({ row }) => new Date(row.original.timestamp).toLocaleString() })
  ], [])

  const table = useReactTable({ data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel() })

  return (
    <Card>
      <CardHeader title='Audit Log' action={<CustomTextField value={globalFilter ?? ''} onChange={(e) => setGlobalFilter(e.target.value)} placeholder='Search...' />} />
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No audit entries</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />
    </Card>
  )
}
export default AuditLogPage
