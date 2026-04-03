import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' }
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) throw new Error('No refresh token')

      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'}/auth/refresh-token`,
        { refreshToken }
      )

      const newAccessToken = data.data.accessToken
      localStorage.setItem('accessToken', newAccessToken)
      localStorage.setItem('refreshToken', data.data.refreshToken)
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      processQueue(null, newAccessToken)
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
