import api from './api'

export const attendanceService = {
  mark: (body?: { checkOutTime?: string; notes?: string }) => api.post('/attendance/mark', body ?? {}),
  checkIn: () => api.post('/attendance/checkin', {}),
  checkOut: () => api.post('/attendance/checkout', {}),
  meToday: () => api.get('/attendance/me/today'),
  today: () => api.get('/attendance/today'),
  report: (params: { employeeId: string; startDate: string; endDate: string }) =>
    api.get('/attendance/report', { params }),
  monthlySummary: (params: { employeeId: string; month: string }) =>
    api.get('/attendance/monthly-summary', { params }),
  /** Admin only: mark employee absent for today (Pacific); clears mistaken check-in. */
  adminMarkAbsentToday: (body: { employeeId: string }) => api.post('/attendance/admin/mark-absent-today', body)
}
