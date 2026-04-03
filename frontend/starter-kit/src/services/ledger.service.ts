import api from './api'

export const ledgerService = {
  list: (params?: any) => api.get('/ledger', { params }),
  getByPharmacy: (id: string, params?: any) => api.get(`/ledger/pharmacy/${id}`, { params }),
  getBalance: (pharmacyId: string) => api.get(`/ledger/pharmacy/${pharmacyId}/balance`)
}
