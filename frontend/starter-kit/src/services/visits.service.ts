import api from './api'

export const visitsService = {
  unplanned: (data: Record<string, unknown>) => api.post('/visits/unplanned', data)
}
