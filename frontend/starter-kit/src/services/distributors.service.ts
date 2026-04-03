import api from './api'

export const distributorsService = {
  list: (params?: any) => api.get('/distributors', { params }),
  create: (data: any) => api.post('/distributors', data),
  getById: (id: string) => api.get(`/distributors/${id}`),
  update: (id: string, data: any) => api.put(`/distributors/${id}`, data),
  remove: (id: string) => api.delete(`/distributors/${id}`)
}
