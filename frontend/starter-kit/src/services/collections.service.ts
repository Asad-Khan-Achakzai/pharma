import api from './api'

export const collectionsService = {
  list: (params?: any) => api.get('/collections', { params }),
  create: (data: any) => api.post('/collections', data),
  getById: (id: string) => api.get(`/collections/${id}`),
  getByPharmacy: (id: string) => api.get(`/collections/pharmacy/${id}`)
}
