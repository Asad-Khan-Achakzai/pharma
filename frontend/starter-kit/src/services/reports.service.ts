import api from './api'

export const reportsService = {
  dashboard: (config?: { signal?: AbortSignal }) => api.get('/reports/dashboard', config),
  sales: (params?: any) => api.get('/reports/sales', { params }),
  profit: (params?: any) => api.get('/reports/profit', { params }),
  expenses: (params?: any) => api.get('/reports/expenses', { params }),
  inventoryValuation: () => api.get('/reports/inventory-valuation'),
  doctorROI: () => api.get('/reports/doctor-roi'),
  repPerformance: () => api.get('/reports/rep-performance'),
  outstanding: () => api.get('/reports/outstanding'),
  cashFlow: (params?: any) => api.get('/reports/cash-flow', { params }),

  /** Full snapshot: balances + optional period (pass from/to for collections, settlements, cash summary). */
  financialOverview: (params?: Record<string, string | undefined>) =>
    api.get('/reports/financial/overview', { params }),
  pharmacyBalances: (params?: { pharmacyId?: string }) =>
    api.get('/reports/financial/pharmacy-balances', { params }),
  pharmacyBalanceDetail: (id: string) => api.get(`/reports/financial/pharmacies/${id}/detail`),
  distributorBalances: (params?: { distributorId?: string }) =>
    api.get('/reports/financial/distributor-balances', { params }),
  distributorBalanceDetail: (id: string) => api.get(`/reports/financial/distributors/${id}/detail`),
  collectionsPeriod: (params?: Record<string, string | undefined>) =>
    api.get('/reports/financial/collections', { params }),
  settlementsPeriod: (params?: Record<string, string | undefined>) =>
    api.get('/reports/financial/settlements', { params }),
  financialCashSummary: (params?: { from?: string; to?: string }) =>
    api.get('/reports/financial/cash-summary', { params }),

  /** Balance-sheet style: cash, receivables, supplier & distributor payables, net position */
  financialSummary: () => api.get('/reports/financial-summary'),
  financialFlowMonthly: (params?: { months?: number }) =>
    api.get('/reports/financial-flow-monthly', { params }),
  supplierBalanceReport: () => api.get('/reports/supplier-balance'),
  pharmacyBalanceAlias: (params?: { pharmacyId?: string }) =>
    api.get('/reports/pharmacy-balance', { params }),
  distributorBalanceAlias: (params?: { distributorId?: string }) =>
    api.get('/reports/distributor-balance', { params }),
  patchCompanyCashOpening: (payload: { cashOpeningBalance: number }) =>
    api.patch('/reports/company-cash-opening', payload),

  /** Profit & cost (transaction-based revenue) */
  profitSummary: (params?: Record<string, string | undefined>) => api.get('/reports/summary', { params }),
  profitRevenue: (params?: Record<string, string | undefined>) => api.get('/reports/revenue', { params }),
  profitCosts: (params?: Record<string, string | undefined>) => api.get('/reports/costs', { params }),
  productProfitability: (params?: Record<string, string | undefined>) =>
    api.get('/reports/product-profitability', { params }),
  profitTrends: (params?: Record<string, string | undefined>) => api.get('/reports/trends', { params }),

  visitSummary: (params: { weekStart: string; weekEnd: string; employeeId?: string }) =>
    api.get('/reports/visit-summary', { params }),
  visitByEmployee: (params: { weekStart: string; weekEnd: string }) =>
    api.get('/reports/visit-by-employee', { params })
}
