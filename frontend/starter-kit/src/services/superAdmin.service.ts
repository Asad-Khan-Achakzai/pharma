import api from './api'

export const superAdminService = {
  listCompanies: (params?: Record<string, string | number | undefined>) =>
    api.get('/super-admin/companies', { params }),
  createCompany: (data: Record<string, unknown>) => api.post('/super-admin/companies', data),
  updateCompany: (id: string, data: Record<string, unknown>) => api.patch(`/super-admin/companies/${id}`, data),
  getCompanySummary: (id: string) => api.get(`/super-admin/companies/${id}/summary`),
  switchCompany: (companyId: string) => api.post('/super-admin/switch-company', { companyId })
}
