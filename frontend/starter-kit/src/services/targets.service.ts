import api from './api'

export const targetsService = {
  list: (params?: any) => api.get('/targets', { params }),
  create: (data: any) => api.post('/targets', data),
  update: (id: string, data: any) => api.put(`/targets/${id}`, data),
  getByRep: (id: string) => api.get(`/targets/rep/${id}`)
}
