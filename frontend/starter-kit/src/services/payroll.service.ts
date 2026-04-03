import api from './api'

export const payrollService = {
  list: (params?: any) => api.get('/payroll', { params }),
  create: (data: any) => api.post('/payroll', data),
  update: (id: string, data: any) => api.put(`/payroll/${id}`, data),
  pay: (id: string) => api.post(`/payroll/${id}/pay`)
}
