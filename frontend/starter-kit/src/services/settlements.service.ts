import api from './api'

export const settlementsService = {
  list: (params?: any) => api.get('/settlements', { params }),
  create: (data: any) => api.post('/settlements', data),
  getById: (id: string) => api.get(`/settlements/${id}`)
}
