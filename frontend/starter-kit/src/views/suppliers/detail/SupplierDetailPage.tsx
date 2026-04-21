'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import CustomTextField from '@core/components/mui/TextField'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { supplierService } from '@/services/supplier.service'
import { useAuth } from '@/contexts/AuthContext'

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (d: string | Date | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB')
}

const toInputDate = (d: string | Date | undefined) => {
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

type LedgerRow = {
  _id: string
  type: string
  amount: number
  date?: string
  referenceType?: string
  referenceId?: string | null
  notes?: string
  runningBalance?: number
  paymentMethod?: string
  referenceNumber?: string
  voucherNumber?: string
}

type PaymentRow = LedgerRow & {
  verificationStatus?: string
  attachmentUrl?: string
  createdBy?: { name?: string; email?: string }
}

const SupplierDetailPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const supplierId = params.id
  const { hasPermission } = useAuth()
  const canView = hasPermission('suppliers.view')
  const canManage = hasPermission('suppliers.manage')

  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<{ name?: string } | null>(null)
  const [balance, setBalance] = useState<any>(null)
  const [ledgerPayload, setLedgerPayload] = useState<{
    openingBalance?: number
    docs?: LedgerRow[]
    total?: number
    summary?: { closingBalance?: number; totalPurchase?: number; totalPayment?: number }
  } | null>(null)
  const [paymentsPayload, setPaymentsPayload] = useState<{ docs?: PaymentRow[]; totalPaid?: number } | null>(null)
  const [viewPayment, setViewPayment] = useState<PaymentRow | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    amount: '',
    date: '',
    notes: '',
    paymentMethod: 'BANK' as 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER',
    referenceNumber: ''
  })
  const [editSaving, setEditSaving] = useState(false)

  const [reverseOpen, setReverseOpen] = useState(false)
  const [reverseId, setReverseId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseSaving, setReverseSaving] = useState(false)

  const openEdit = (row: PaymentRow) => {
    setEditingId(row._id)
    setEditForm({
      amount: String(row.amount ?? ''),
      date: toInputDate(row.date),
      notes: row.notes || '',
      paymentMethod: (row.paymentMethod as typeof editForm.paymentMethod) || 'OTHER',
      referenceNumber: row.referenceNumber || ''
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const amount = parseFloat(editForm.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      showApiError(null, 'Enter a valid positive amount')
      return
    }
    setEditSaving(true)
    try {
      const res = await supplierService.updatePayment(supplierId, editingId, {
        amount,
        date: editForm.date || undefined,
        notes: editForm.notes || undefined,
        paymentMethod: editForm.paymentMethod,
        referenceNumber: editForm.referenceNumber || undefined
      })
      const payload = (res.data as any)?.data ?? res.data
      const warnings = (payload as { warnings?: string[] })?.warnings
      showSuccess(warnings?.length ? `Payment updated. ${warnings[0]}` : 'Payment updated')
      setEditOpen(false)
      setEditingId(null)
      setViewPayment(null)
      await loadAll()
    } catch (err) {
      showApiError(err, 'Could not update payment')
    } finally {
      setEditSaving(false)
    }
  }

  const openReverse = (row: PaymentRow) => {
    setReverseId(row._id)
    setReverseReason('')
    setReverseOpen(true)
  }

  const confirmReverse = async () => {
    if (!reverseId) return
    setReverseSaving(true)
    try {
      await supplierService.reversePayment(supplierId, reverseId, {
        reversalReason: reverseReason.trim() || undefined
      })
      showSuccess('Payment reversed. It no longer reduces supplier payables.')
      setReverseOpen(false)
      setReverseId(null)
      setViewPayment(null)
      await loadAll()
    } catch (err) {
      showApiError(err, 'Could not reverse payment')
    } finally {
      setReverseSaving(false)
    }
  }

  const loadAll = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    try {
      const [sRes, bRes, lRes, pRes] = await Promise.all([
        supplierService.getById(supplierId),
        supplierService.balance(supplierId),
        supplierService.ledger(supplierId, { limit: '100', page: '1' }),
        supplierService.listPayments(supplierId)
      ])
      const sData = (sRes.data as any)?.data ?? sRes.data
      const bData = (bRes.data as any)?.data ?? bRes.data
      const lData = (lRes.data as any)?.data ?? lRes.data
      const pData = (pRes.data as any)?.data ?? pRes.data
      setSupplier(sData)
      setBalance(bData)
      setLedgerPayload(lData)
      setPaymentsPayload(pData)
    } catch (err) {
      showApiError(err, 'Failed to load supplier')
    } finally {
      setLoading(false)
    }
  }, [canView, supplierId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const downloadInvoice = async (row: PaymentRow) => {
    try {
      const { blob, filename } = await supplierService.downloadPaymentInvoice(row._id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('Download started')
    } catch (err) {
      showApiError(err, 'Could not download PDF')
    }
  }

  if (!canView) {
    return (
      <Card>
        <CardContent className='p-6'>
          <Typography color='text.secondary'>You do not have permission to view suppliers.</Typography>
        </CardContent>
      </Card>
    )
  }

  if (loading && !supplier) {
    return (
      <Box className='flex justify-center p-8'>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      <Card className='mbe-6'>
        <CardHeader
          title={supplier?.name || 'Supplier'}
          subheader={
            <Button component={Link} href='/suppliers/list' size='small' startIcon={<i className='tabler-arrow-left' />}>
              Back to suppliers
            </Button>
          }
        />
        <CardContent>
          {balance && (
            <div className='flex flex-wrap gap-6'>
              <div>
                <Typography variant='caption' color='text.secondary'>
                  Net payable
                </Typography>
                <Typography variant='h6'>{formatPKR(balance.netPayable ?? balance.payable)}</Typography>
              </div>
              <div>
                <Typography variant='caption' color='text.secondary'>
                  Total purchase (casting)
                </Typography>
                <Typography>{formatPKR(balance.totalPurchaseCasting ?? balance.totalPurchase)}</Typography>
              </div>
              <div>
                <Typography variant='caption' color='text.secondary'>
                  Total payments
                </Typography>
                <Typography>{formatPKR(balance.totalPayments ?? balance.totalPayment)}</Typography>
              </div>
              <div>
                <Typography variant='caption' color='text.secondary'>
                  Last payment
                </Typography>
                <Typography>
                  {balance.lastPaymentDate ? formatDate(balance.lastPaymentDate) : '—'} ·{' '}
                  {balance.lastPaymentAmount != null ? formatPKR(balance.lastPaymentAmount) : '—'}
                </Typography>
              </div>
            </div>
          )}
          {balance?.note && (
            <Typography variant='caption' color='text.secondary' className='block mbs-4'>
              {balance.note}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} className='border-be'>
          <Tab label='Full ledger' />
          <Tab label='Payment history' />
        </Tabs>
        <CardContent>
          {tab === 0 && ledgerPayload && (
            <>
              <Typography variant='body2' color='text.secondary' className='mbe-4'>
                Opening balance: {formatPKR(ledgerPayload.openingBalance ?? 0)} · Closing:{' '}
                {formatPKR(ledgerPayload.summary?.closingBalance ?? 0)} (chronological by date)
                {(ledgerPayload.total ?? 0) > (ledgerPayload.docs?.length ?? 0) && (
                  <span className='block mbs-1'>
                    Showing {(ledgerPayload.docs || []).length} of {ledgerPayload.total} rows (max 100 per page — use
                    Reports or API pagination for full export).
                  </span>
                )}
              </Typography>
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align='right'>Amount</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell align='right'>Running balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ledgerPayload.docs || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align='center'>
                          No ledger entries
                        </TableCell>
                      </TableRow>
                    ) : (
                      (ledgerPayload.docs || []).map(row => (
                        <TableRow key={row._id}>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell align='right'>{formatPKR(row.amount)}</TableCell>
                          <TableCell>
                            {row.referenceType}
                            {row.referenceId ? ` · ${String(row.referenceId).slice(-6)}` : ''}
                          </TableCell>
                          <TableCell align='right'>{formatPKR(row.runningBalance ?? 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {tab === 1 && paymentsPayload && (
            <>
              <Typography variant='body2' color='text.secondary' className='mbe-2'>
                Edit to fix amount or details. Reverse removes a mistaken payment from payables (kept in audit as
                soft-deleted).
              </Typography>
              <Typography variant='body2' className='mbe-4'>
                Total paid (all time): <strong>{formatPKR(paymentsPayload.totalPaid ?? 0)}</strong>
              </Typography>
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align='right'>Amount</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Reference</TableCell>
                      <TableCell>Notes</TableCell>
                      <TableCell align='right'>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(paymentsPayload.docs || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align='center'>
                          No payments recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      (paymentsPayload.docs || []).map(row => (
                        <TableRow key={row._id}>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell align='right'>{formatPKR(row.amount)}</TableCell>
                          <TableCell>{row.paymentMethod || '—'}</TableCell>
                          <TableCell>{row.referenceNumber || '—'}</TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>{row.notes || '—'}</TableCell>
                          <TableCell align='right'>
                            <IconButton size='small' title='View' onClick={() => setViewPayment(row)}>
                              <i className='tabler-eye' />
                            </IconButton>
                            <IconButton size='small' title='Download invoice' onClick={() => downloadInvoice(row)}>
                              <i className='tabler-file-download' />
                            </IconButton>
                            {canManage && (
                              <>
                                <IconButton size='small' title='Edit payment' onClick={() => openEdit(row)}>
                                  <i className='tabler-edit' />
                                </IconButton>
                                <IconButton
                                  size='small'
                                  title='Reverse payment'
                                  color='warning'
                                  onClick={() => openReverse(row)}
                                >
                                  <i className='tabler-arrow-back-up' />
                                </IconButton>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(viewPayment)} onClose={() => setViewPayment(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Payment details</DialogTitle>
        <DialogContent>
          {viewPayment && (
            <div className='flex flex-col gap-2 text-body-2'>
              <Typography>
                <strong>Voucher:</strong> {viewPayment.voucherNumber || viewPayment._id}
              </Typography>
              <Typography>
                <strong>Date:</strong> {formatDate(viewPayment.date)}
              </Typography>
              <Typography>
                <strong>Amount:</strong> {formatPKR(viewPayment.amount)}
              </Typography>
              <Typography>
                <strong>Method:</strong> {viewPayment.paymentMethod || '—'}
              </Typography>
              <Typography>
                <strong>Reference:</strong> {viewPayment.referenceNumber || '—'}
              </Typography>
              <Typography>
                <strong>Verification:</strong> {viewPayment.verificationStatus || '—'}
              </Typography>
              {viewPayment.attachmentUrl && (
                <Typography>
                  <strong>Attachment:</strong>{' '}
                  <a href={viewPayment.attachmentUrl} target='_blank' rel='noreferrer'>
                    Link
                  </a>
                </Typography>
              )}
              <Typography>
                <strong>Notes:</strong> {viewPayment.notes || '—'}
              </Typography>
              {viewPayment.createdBy && (
                <Typography>
                  <strong>Recorded by:</strong> {viewPayment.createdBy.name || viewPayment.createdBy.email || '—'}
                </Typography>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className='flex-wrap gap-2'>
          <Button onClick={() => setViewPayment(null)}>Close</Button>
          {viewPayment && canManage && (
            <>
              <Button
                variant='tonal'
                color='secondary'
                onClick={() => {
                  openEdit(viewPayment)
                  setViewPayment(null)
                }}
              >
                Edit
              </Button>
              <Button
                variant='tonal'
                color='warning'
                onClick={() => {
                  openReverse(viewPayment)
                  setViewPayment(null)
                }}
              >
                Reverse
              </Button>
            </>
          )}
          {viewPayment && (
            <Button variant='contained' onClick={() => downloadInvoice(viewPayment)}>
              Download PDF
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !editSaving && setEditOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Edit payment</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <CustomTextField
            fullWidth
            label='Amount (PKR)'
            type='number'
            value={editForm.amount}
            onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
          />
          <CustomTextField
            fullWidth
            type='date'
            label='Date'
            slotProps={{ inputLabel: { shrink: true } }}
            value={editForm.date}
            onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
          />
          <CustomTextField
            fullWidth
            select
            label='Payment method'
            value={editForm.paymentMethod}
            onChange={e =>
              setEditForm(f => ({ ...f, paymentMethod: e.target.value as typeof editForm.paymentMethod }))
            }
          >
            <MenuItem value='CASH'>Cash</MenuItem>
            <MenuItem value='BANK'>Bank</MenuItem>
            <MenuItem value='CHEQUE'>Cheque</MenuItem>
            <MenuItem value='OTHER'>Other</MenuItem>
          </CustomTextField>
          <CustomTextField
            fullWidth
            label='Reference (cheque no / transaction id)'
            value={editForm.referenceNumber}
            onChange={e => setEditForm(f => ({ ...f, referenceNumber: e.target.value }))}
          />
          <CustomTextField
            fullWidth
            label='Notes'
            value={editForm.notes}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void saveEdit()} disabled={editSaving}>
            {editSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reverseOpen} onClose={() => !reverseSaving && setReverseOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Reverse payment?</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pbs-4'>
          <Typography variant='body2' color='text.secondary'>
            This marks the payment as removed (soft-deleted). Supplier payables will increase again by this amount.
            The row stays in the audit trail.
          </Typography>
          <CustomTextField
            fullWidth
            label='Reason (optional)'
            multiline
            minRows={2}
            value={reverseReason}
            onChange={e => setReverseReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReverseOpen(false)} disabled={reverseSaving}>
            Cancel
          </Button>
          <Button variant='contained' color='warning' onClick={() => void confirmReverse()} disabled={reverseSaving}>
            {reverseSaving ? 'Working...' : 'Reverse payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default SupplierDetailPage
