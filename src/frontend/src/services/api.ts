import axios, { AxiosError, AxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'

// Re-export API error types for unified access
export { ApiErrorType } from './apiErrors'
export type { ApiError } from './apiErrors'
export { createApiError } from './apiErrors'

const API_BASE_URL = '/api'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Flag to prevent multiple refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

/**
 * Retry a failed request with exponential back-off.
 *
 * Only network errors (no response) or 5xx server errors are retried.
 * 4xx client errors (401, 403, 404…) are NOT retried — those are permanent failures.
 */
const MAX_RETRIES = 2
const RETRY_DELAYS_MS = [500, 1000] // wait 500 ms, then 1000 ms

function shouldRetry(error: AxiosError): boolean {
  if (!error.response) {
    // Network error (ECONNREFUSED, timeout, etc.)
    return true
  }
  const status = error.response.status
  // Retry on 5xx server errors only
  return status >= 500
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Attempt to refresh the access token
 */
async function refreshAccessToken(): Promise<{ token: string; refreshToken: string }> {
  const refreshToken = useAuthStore.getState().refreshToken

  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
    refreshToken,
  })

  const { token, refreshToken: newRefreshToken, user } = response.data.data

  // Update auth store with new tokens
  useAuthStore.getState().updateTokens(token, newRefreshToken)

  return { token, refreshToken: newRefreshToken }
}

// Response interceptor to handle errors and retry logic
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number }

    // Handle 401 - try to refresh token first
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // If this is the refresh endpoint itself failing, logout immediately
      if (originalRequest.url?.includes('/auth/refresh')) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue this request while we're refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { token } = await refreshAccessToken()
        processQueue(null, token)

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    // Initialise retry counter on the request config
    if (originalRequest._retryCount === undefined) {
      originalRequest._retryCount = 0
    }

    if (shouldRetry(error) && originalRequest._retryCount < MAX_RETRIES) {
      originalRequest._retryCount++
      const delayMs = RETRY_DELAYS_MS[originalRequest._retryCount - 1] ?? 1000

      console.warn(
        `[API] retry attempt ${originalRequest._retryCount}/${MAX_RETRIES} for ${originalRequest.method?.toUpperCase()} ${originalRequest.url} ` +
        `(waiting ${delayMs}ms, reason: ${error.message})`
      )

      await sleep(delayMs)
      return apiClient(originalRequest)
    }

    return Promise.reject(error)
  }
)

export default apiClient

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post('/auth/login', { username, password }),
  register: (username: string, email: string, password: string) =>
    apiClient.post('/auth/register', { username, email, password }),
  logout: () => apiClient.post('/auth/logout'),
  refresh: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),
  getCurrentUser: () => apiClient.get('/auth/me'),
  getUsers: () => apiClient.get('/auth/users'),
  updateUser: (userId: string, data: { displayName?: string; welink?: string; phone?: string; role?: string }) =>
    apiClient.put(`/auth/users/${userId}`, data),
  updateUserRole: (userId: string, role: string) =>
    apiClient.put(`/auth/users/${userId}/role`, { role }),
  deleteUser: (userId: string) => apiClient.delete(`/auth/users/${userId}`),
}

// Server API
export const serverApi = {
  getAll: () => apiClient.get('/servers'),
  getById: (id: string) => apiClient.get(`/servers/${id}`),
  getStats: () => apiClient.get('/servers/stats'),
  getAvailable: () => apiClient.get('/servers/available'),
  create: (data: any) => apiClient.post('/servers', data),
  update: (id: string, data: any) => apiClient.put(`/servers/${id}`, data),
  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/servers/${id}/status`, { status }),
  delete: (id: string) => apiClient.delete(`/servers/${id}`),
  getMetrics: (id: string, startTime?: string, endTime?: string) =>
    apiClient.get(`/servers/${id}/metrics`, { params: { startTime, endTime } }),
  // Batch operations (Day 7)
  batchDelete: (ids: string[]) => apiClient.delete('/servers/batch', { data: { ids } }),
  batchUpdateStatus: (ids: string[], status: string) =>
    apiClient.patch('/servers/batch/status', { ids, status }),
}

// GPU API
export const gpuApi = {
  getStats: () => apiClient.get('/gpu/stats'),
  allocate: (gpuModel?: string, minMemory?: number) =>
    apiClient.post('/gpu/allocate', { gpuModel, minMemory }),
  release: (allocationId: string) => apiClient.post(`/gpu/release/${allocationId}`),
  getMyAllocations: () => apiClient.get('/gpu/my-allocations'),
  getAllAllocations: () => apiClient.get('/gpu/allocations'),
  getAllocation: (id: string) => apiClient.get(`/gpu/allocations/${id}`),
  getHistory: (limit?: number) => apiClient.get('/gpu/history', { params: { limit } }),
  terminate: (allocationId: string) =>
    apiClient.post(`/gpu/allocations/${allocationId}/terminate`),
  // Batch operations (Day 7)
  batchDelete: (ids: string[]) => apiClient.delete('/gpu/batch', { data: { ids } }),
  batchUpdateStatus: (ids: string[], status: string) =>
    apiClient.patch('/gpu/batch/status', { ids, status }),
}

// Task API
export const taskApi = {
  getAll: (status?: string, limit?: number) =>
    apiClient.get('/tasks', { params: { status, limit } }),
  getAllAdmin: (status?: string, limit?: number) =>
    apiClient.get('/tasks/all', { params: { status, limit } }),
  getById: (id: string) => apiClient.get(`/tasks/${id}`),
  getStats: () => apiClient.get('/tasks/stats'),
  getPending: () => apiClient.get('/tasks/pending'),
  create: (data: any) => apiClient.post('/tasks', data),
  update: (id: string, data: any) => apiClient.put(`/tasks/${id}`, data),
  cancel: (id: string) => apiClient.post(`/tasks/${id}/cancel`),
  delete: (id: string) => apiClient.delete(`/tasks/${id}`),
  // Batch operations (Day 7)
  batchDelete: (ids: string[]) => apiClient.delete('/tasks/batch', { data: { ids } }),
  batchUpdateStatus: (ids: string[], status: string) =>
    apiClient.patch('/tasks/batch/status', { ids, status }),
  batchCancel: (ids: string[]) => apiClient.post('/tasks/batch/cancel', { ids }),
}

// Monitoring API
export const monitoringApi = {
  getHealth: () => apiClient.get('/monitoring/health'),
  getClusterStats: () => apiClient.get('/monitoring/cluster-stats'),
  getAlerts: () => apiClient.get('/monitoring/alerts'),
  getMetrics: (serverId: string, startTime?: string, endTime?: string) =>
    apiClient.get(`/monitoring/servers/${serverId}/metrics`, {
      params: { startTime, endTime },
    }),
  collect: () => apiClient.post('/monitoring/collect'),
}

// Analytics API (v3.1.0)
export const analyticsApi = {
  getSummary: (params?: { startTime?: string; endTime?: string }) =>
    apiClient.get('/analytics/summary', { params }),
  getResourceTrends: (params?: { startTime?: string; endTime?: string }) =>
    apiClient.get('/analytics/resource-trends', { params }),
  getCostBreakdown: (params?: { startTime?: string; endTime?: string }) =>
    apiClient.get('/analytics/cost-breakdown', { params }),
  getServerUtilization: () => apiClient.get('/analytics/server-utilization'),
  getEfficiencyReport: () => apiClient.get('/analytics/efficiency-report'),
  exportReport: (params?: { startTime?: string; endTime?: string; format?: 'json' | 'csv' }) =>
    apiClient.get('/analytics/export', { params, responseType: 'blob' }),
}

// Cluster API
export const clusterApi = {
  getAll: (filters?: { status?: string; type?: string }) =>
    apiClient.get('/clusters', { params: filters }),
  getById: (id: string) => apiClient.get(`/clusters/${id}`),
  getStats: () => apiClient.get('/clusters/stats'),
  getAvailableServers: () => apiClient.get('/clusters/available-servers'),
  create: (data: {
    name: string
    code: string
    description?: string
    type?: string
    tags?: string[]
  }) => apiClient.post('/clusters', data),
  update: (id: string, data: {
    name?: string
    description?: string
    type?: string
    status?: string
  }) => apiClient.put(`/clusters/${id}`, data),
  delete: (id: string) => apiClient.delete(`/clusters/${id}`),
  addServer: (clusterId: string, data: {
    serverId: string
    priority?: number
    role?: string
  }) => apiClient.post(`/clusters/${clusterId}/servers`, data),
  removeServer: (clusterId: string, serverId: string) =>
    apiClient.delete(`/clusters/${clusterId}/servers/${serverId}`),
  allocate: (clusterId: string, data: {
    userId: string
    teamId?: string
    startTime: string
    endTime: string
    purpose?: string
  }) => apiClient.post(`/clusters/${clusterId}/allocate`, data),
  release: (clusterId: string) => apiClient.post(`/clusters/${clusterId}/release`),
}

// Cluster Reservation API (for MANAGER users)
export const clusterReservationApi = {
  // Get all reservations (filtered)
  getAll: (filters?: {
    status?: string
    clusterId?: string
    userId?: string
    startTime?: string
    endTime?: string
  }) => apiClient.get('/cluster-reservations', { params: filters }),
  
  // Get my reservations
  getMy: () => apiClient.get('/cluster-reservations/my'),
  
  // Get pending reservations (SUPER_ADMIN only)
  getPending: () => apiClient.get('/cluster-reservations/pending'),
  
  // Get reservation by ID
  getById: (id: string) => apiClient.get(`/cluster-reservations/${id}`),
  
  // Create reservation request
  create: (data: {
    clusterId: string
    startTime: string
    endTime: string
    purpose?: string
    teamId?: string
  }) => apiClient.post('/cluster-reservations', data),
  
  // Approve reservation (SUPER_ADMIN only)
  approve: (id: string) => apiClient.put(`/cluster-reservations/${id}/approve`),
  
  // Reject reservation (SUPER_ADMIN only)
  reject: (id: string, reason?: string) =>
    apiClient.put(`/cluster-reservations/${id}/reject`, { reason }),
  
  // Cancel reservation (owner only)
  cancel: (id: string) => apiClient.put(`/cluster-reservations/${id}/cancel`),
  
  // Release resources early (owner only)
  release: (id: string) => apiClient.put(`/cluster-reservations/${id}/release`),

  // Get AI-recommended time slots
  recommendTimeSlots: (params: {
    clusterId: string
    duration: number
    preferredStartTime?: string
    preferredEndTime?: string
  }) => apiClient.get('/cluster-reservations/recommend-time-slots', { params }),
}
