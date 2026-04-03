import api from './api'

export const paymentsService = {
  list: (params?: any) => api.get('/payments', { params }),
  create: (data: any) => api.post('/payments', data),
  getById: (id: string) => api.get(`/payments/${id}`),
  getByPharmacy: (id: string) => api.get(`/payments/pharmacy/${id}`)
}
