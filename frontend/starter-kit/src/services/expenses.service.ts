import api from './api'

export const expensesService = {
  list: (params?: any) => api.get('/expenses', { params }),
  create: (data: any) => api.post('/expenses', data),
  update: (id: string, data: any) => api.put(`/expenses/${id}`, data),
  remove: (id: string) => api.delete(`/expenses/${id}`)
}
