import { toast } from 'react-toastify'

export const getApiErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (!error) return fallback

  const err = error as any

  if (err.response?.data?.message) return err.response.data.message
  if (err.response?.data?.error) return err.response.data.error
  if (err.message === 'Network Error') return 'Unable to connect to server'
  if (err.message) return err.message

  return fallback
}

export const showApiError = (error: unknown, fallback?: string) => {
  toast.error(getApiErrorMessage(error, fallback))
}

export const showSuccess = (message: string) => {
  toast.success(message)
}
