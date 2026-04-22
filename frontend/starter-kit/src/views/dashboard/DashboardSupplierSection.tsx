'use client'

import { memo } from 'react'
import Link from 'next/link'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'

const formatPKR = (v: number) => `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const DashboardSupplierSection = memo(function DashboardSupplierSection({
  canViewSuppliers,
  supplierPaymentsLoading,
  recentSupplierPayments,
  supplierPayablesLoading,
  topSuppliersPayable,
  nonCriticalReady
}: {
  canViewSuppliers: boolean
  supplierPaymentsLoading: boolean
  recentSupplierPayments: any[]
  supplierPayablesLoading: boolean
  topSuppliersPayable: any[]
  nonCriticalReady: boolean
}) {
  if (!canViewSuppliers || !nonCriticalReady) return null
  return (
    <Grid size={{ xs: 12 }}>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title='Recent supplier payments' subheader='Latest PAYMENT entries across suppliers' />
            <CardContent>
              {supplierPaymentsLoading ? (
                <Skeleton variant='rounded' width='100%' height={120} animation='wave' />
              ) : recentSupplierPayments.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No supplier payments yet.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant='outlined'>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Supplier</TableCell>
                        <TableCell align='right'>Amount</TableCell>
                        <TableCell>Method</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSupplierPayments.map((row: any) => {
                        const sid = row.supplierId
                        const sname =
                          typeof sid === 'object' && sid?.name ? sid.name : 'Supplier'
                        const href =
                          typeof sid === 'object' && sid?._id ? `/suppliers/${sid._id}` : '#'
                        return (
                          <TableRow key={String(row._id)}>
                            <TableCell>
                              {row.date ? new Date(row.date).toLocaleDateString('en-GB') : '—'}
                            </TableCell>
                            <TableCell>
                              {href !== '#' ? (
                                <Link href={href} className='text-primary'>
                                  {sname}
                                </Link>
                              ) : (
                                sname
                              )}
                            </TableCell>
                            <TableCell align='right'>{formatPKR(row.amount)}</TableCell>
                            <TableCell>{row.paymentMethod || '—'}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title='Top suppliers by payable' subheader='Opening + casting purchases − payments' />
            <CardContent>
              {supplierPayablesLoading ? (
                <Skeleton variant='rounded' width='100%' height={120} animation='wave' />
              ) : topSuppliersPayable.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No supplier balances loaded.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant='outlined'>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Supplier</TableCell>
                        <TableCell align='right'>Payable</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topSuppliersPayable.map((row: any) => (
                        <TableRow key={String(row.supplierId)}>
                          <TableCell>
                            <Link href={`/suppliers/${row.supplierId}`} className='text-primary'>
                              {row.name}
                            </Link>
                          </TableCell>
                          <TableCell align='right'>{formatPKR(row.payable)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Grid>
  )
})

export default DashboardSupplierSection
