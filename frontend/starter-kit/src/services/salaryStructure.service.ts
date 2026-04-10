import api from './api'

export const salaryStructureService = {
  list: (params?: Record<string, unknown>) => api.get('/salary-structures', { params }),
  getById: (id: string) => api.get(`/salary-structures/${id}`),
  getActive: (employeeId: string) => api.get(`/salary-structures/active/${employeeId}`),
  create: (data: Record<string, unknown>) => api.post('/salary-structures', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/salary-structures/${id}`, data)
}
