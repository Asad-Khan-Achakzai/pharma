import type { AxiosResponse } from 'axios'
import api from './api'

/**
 * Coalesce duplicate in-flight GETs (e.g. React Strict Mode double effect) when no AbortSignal.
 * Pass `{ signal }` from a caller that must cancel (we use this only for explicit cancel cases).
 */
let meTodayInFlight: Promise<AxiosResponse<unknown>> | null = null
let todayInFlight: Promise<AxiosResponse<unknown>> | null = null

export const attendanceService = {
  mark: (body?: { checkOutTime?: string; notes?: string }) => api.post('/attendance/mark', body ?? {}),
  checkIn: () => api.post('/attendance/checkin', {}),
  checkOut: () => api.post('/attendance/checkout', {}),
  meToday: (config?: { signal?: AbortSignal }) => {
    if (config?.signal) {
      return api.get('/attendance/me/today', config)
    }
    if (!meTodayInFlight) {
      meTodayInFlight = api.get('/attendance/me/today').finally(() => {
        meTodayInFlight = null
      })
    }
    return meTodayInFlight
  },
  today: (config?: { signal?: AbortSignal }) => {
    if (config?.signal) {
      return api.get('/attendance/today', config)
    }
    if (!todayInFlight) {
      todayInFlight = api.get('/attendance/today').finally(() => {
        todayInFlight = null
      })
    }
    return todayInFlight
  },
  report: (params: { employeeId: string; startDate: string; endDate: string }) =>
    api.get('/attendance/report', { params }),
  monthlySummary: (params: { employeeId: string; month: string }) =>
    api.get('/attendance/monthly-summary', { params }),
  /** Admin only: mark employee absent for today (Pacific); clears mistaken check-in. */
  adminMarkAbsentToday: (body: { employeeId: string }) => api.post('/attendance/admin/mark-absent-today', body),
  /** Admin only: set today's status (Pacific) — present, absent, half-day, or leave. */
  adminSetTodayStatus: (body: { employeeId: string; status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' }) =>
    api.post('/attendance/admin/set-today-status', body)
}
