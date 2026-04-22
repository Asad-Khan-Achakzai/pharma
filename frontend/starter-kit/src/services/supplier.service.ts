import api from './api'

function parseFilenameFromDisposition(cd: string | undefined, fallback: string) {
  if (!cd) return fallback
  const m = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(cd)
  if (m?.[1]) return decodeURIComponent(m[1].replace(/"/g, '').trim())
  return fallback
}

export const supplierService = {
  list: (params?: Record<string, string | undefined>) => api.get('/suppliers', { params }),
  balancesSummary: (config?: { signal?: AbortSignal }) => api.get('/suppliers/balances/summary', config),
  getById: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/suppliers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/suppliers/${id}`, data),
  remove: (id: string) => api.delete(`/suppliers/${id}`),
  ledger: (id: string, params?: Record<string, string | undefined>) => api.get(`/suppliers/${id}/ledger`, { params }),
  balance: (id: string) => api.get(`/suppliers/${id}/balance`),
  listPayments: (id: string) => api.get(`/suppliers/${id}/payments`),
  recentPayments: (params?: { limit?: number; signal?: AbortSignal }) => {
    const { signal, limit } = params ?? {}
    return api.get('/suppliers/payments/recent', {
      params: limit != null ? { limit } : undefined,
      signal
    })
  },
  downloadPaymentInvoice: async (ledgerId: string) => {
    const res = await api.get(`/suppliers/payments/${ledgerId}/invoice`, { responseType: 'blob' })
    const cd = res.headers['content-disposition'] as string | undefined
    const filename = parseFilenameFromDisposition(cd, `Supplier_Payment_${ledgerId}.pdf`)
    return { blob: res.data as Blob, filename }
  },
  recordPayment: (
    id: string,
    data: {
      amount: number
      date?: string
      notes?: string
      paymentMethod: 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER'
      referenceNumber?: string
      attachmentUrl?: string
      verificationStatus?: 'VERIFIED' | 'UNVERIFIED'
    }
  ) => api.post(`/suppliers/${id}/payments`, data),
  updatePayment: (
    supplierId: string,
    ledgerId: string,
    data: {
      amount?: number
      date?: string
      notes?: string
      paymentMethod?: 'CASH' | 'BANK' | 'CHEQUE' | 'OTHER'
      referenceNumber?: string
      attachmentUrl?: string
      verificationStatus?: 'VERIFIED' | 'UNVERIFIED'
    }
  ) => api.patch(`/suppliers/${supplierId}/payments/${ledgerId}`, data),
  reversePayment: (supplierId: string, ledgerId: string, data?: { reversalReason?: string }) =>
    api.post(`/suppliers/${supplierId}/payments/${ledgerId}/reverse`, data ?? {}),
  recordPurchase: (id: string, data: { amount: number; date?: string; notes?: string }) =>
    api.post(`/suppliers/${id}/purchases`, data)
}
