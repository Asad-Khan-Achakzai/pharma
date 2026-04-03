import api from './api'

export const weeklyPlansService = {
  list: (params?: any) => api.get('/weekly-plans', { params }),
  create: (data: any) => api.post('/weekly-plans', data),
  update: (id: string, data: any) => api.put(`/weekly-plans/${id}`, data),
  getByRep: (id: string) => api.get(`/weekly-plans/rep/${id}`)
}
