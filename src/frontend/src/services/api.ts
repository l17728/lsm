import axios from 'axios'
import { useAuthStore } from '../store/authStore'

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

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
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
  getCurrentUser: () => apiClient.get('/auth/me'),
  getUsers: () => apiClient.get('/auth/users'),
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
