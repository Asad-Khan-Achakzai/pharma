import api from './api'

export const doctorsService = {
  list: (params?: any) => api.get('/doctors', { params }),
  create: (data: any) => api.post('/doctors', data),
  getById: (id: string) => api.get(`/doctors/${id}`),
  update: (id: string, data: any) => api.put(`/doctors/${id}`, data),
  remove: (id: string) => api.delete(`/doctors/${id}`)
}

export const doctorActivitiesService = {
  list: (params?: any) => api.get('/doctor-activities', { params }),
  create: (data: any) => api.post('/doctor-activities', data),
  getById: (id: string) => api.get(`/doctor-activities/${id}`),
  update: (id: string, data: any) => api.put(`/doctor-activities/${id}`, data),
  recalculate: (id: string) => api.post(`/doctor-activities/${id}/recalculate`),
  getByDoctor: (id: string) => api.get(`/doctor-activities/doctor/${id}`)
}
