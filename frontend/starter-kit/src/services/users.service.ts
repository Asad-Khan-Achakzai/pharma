import api from './api'

export const usersService = {
  list: (params?: any) => api.get('/users', { params }),
  create: (data: any) => api.post('/users', data),
  getById: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  remove: (id: string) => api.delete(`/users/${id}`)
}
