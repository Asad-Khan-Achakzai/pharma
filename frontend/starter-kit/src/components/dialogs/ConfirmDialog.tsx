'use client'

import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

export type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmColor?: 'error' | 'primary' | 'warning' | 'success' | 'info'
  icon?: string
  loading?: boolean
}

const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = "You won't be able to revert this!",
  confirmText = 'Yes, Delete',
  cancelText = 'Cancel',
  confirmColor = 'error',
  icon = 'tabler-alert-circle',
  loading = false
}: ConfirmDialogProps) => {
  return (
    <Dialog fullWidth maxWidth='xs' open={open} onClose={loading ? undefined : onClose}>
      <DialogContent className='flex items-center flex-col text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        <i className={`${icon} text-[88px] mbe-6 text-warning`} />
        <Typography variant='h4' className='mbe-2'>
          {title}
        </Typography>
        <Typography color='text.secondary'>{description}</Typography>
      </DialogContent>
      <DialogActions className='justify-center pbs-0 sm:pbe-16 sm:pli-16'>
        <Button
          variant='contained'
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color='inherit' /> : undefined}
        >
          {loading ? 'Please wait...' : confirmText}
        </Button>
        <Button variant='tonal' color='secondary' onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
