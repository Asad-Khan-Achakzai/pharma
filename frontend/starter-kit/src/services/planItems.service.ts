import api from './api'

export const planItemsService = {
  listToday: (params?: { date?: string; employeeId?: string }) =>
    api.get('/plan-items/today', { params }),
  update: (planItemId: string, data: { status?: string; notes?: string }) =>
    api.put(`/plan-items/${planItemId}`, data),
  markVisit: (planItemId: string, data: Record<string, unknown>) =>
    api.post(`/plan-items/${planItemId}/mark-visit`, data)
}
