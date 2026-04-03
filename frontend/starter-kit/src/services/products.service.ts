import api from './api'

export const productsService = {
  list: (params?: any) => api.get('/products', { params }),
  create: (data: any) => api.post('/products', data),
  getById: (id: string) => api.get(`/products/${id}`),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  remove: (id: string) => api.delete(`/products/${id}`)
}
