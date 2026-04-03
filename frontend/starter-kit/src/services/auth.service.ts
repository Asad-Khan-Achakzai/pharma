import api from './api'

export const authService = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh-token', { refreshToken }),
  getMe: () => api.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.put('/auth/change-password', data)
}
