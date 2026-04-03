import api from './api'

export const inventoryService = {
  getAll: (params?: any) => api.get('/inventory', { params }),
  getSummary: () => api.get('/inventory/summary'),
  getByDistributor: (id: string) => api.get(`/inventory/distributor/${id}`),
  transfer: (data: any) => api.post('/inventory/transfer', data),
  getTransfers: (params?: any) => api.get('/inventory/transfers', { params })
}
