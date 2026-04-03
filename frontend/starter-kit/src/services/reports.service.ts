import api from './api'

export const reportsService = {
  dashboard: () => api.get('/reports/dashboard'),
  sales: (params?: any) => api.get('/reports/sales', { params }),
  profit: (params?: any) => api.get('/reports/profit', { params }),
  expenses: (params?: any) => api.get('/reports/expenses', { params }),
  inventoryValuation: () => api.get('/reports/inventory-valuation'),
  doctorROI: () => api.get('/reports/doctor-roi'),
  repPerformance: () => api.get('/reports/rep-performance'),
  outstanding: () => api.get('/reports/outstanding'),
  cashFlow: (params?: any) => api.get('/reports/cash-flow', { params })
}
