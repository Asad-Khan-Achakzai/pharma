import api from './api'

export const ordersService = {
  list: (params?: any) => api.get('/orders', { params }),
  /** Active company users for medical rep / order assignment (orders.create) */
  listAssignableReps: () => api.get('/orders/assignable-reps'),
  create: (data: any) => api.post('/orders', data),
  getById: (id: string) => api.get(`/orders/${id}`),
  update: (id: string, data: any) => api.put(`/orders/${id}`, data),
  deliver: (id: string, data: any) => api.post(`/orders/${id}/deliver`, data),
  returnOrder: (id: string, data: any) => api.post(`/orders/${id}/return`, data),
  cancel: (id: string) => api.delete(`/orders/${id}`)
}
