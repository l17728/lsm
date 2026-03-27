import apiClient from './api'

// Types
export interface Reservation {
  id: string
  userId: string
  userName: string
  serverId: string
  serverName: string
  gpuIds: string[]
  startTime: string
  endTime: string
  status: 'pending' | 'approved' | 'active' | 'completed' | 'cancelled'
  purpose: string
  createdAt: string
  updatedAt: string
}

export interface TimeSlot {
  serverId: string
  gpuId?: string
  startTime: Date
  endTime: Date
  status: 'available' | 'reserved' | 'occupied' | 'maintenance'
  reservationId?: string
}

export interface Server {
  id: string
  name: string
  gpus: GPU[]
  availableGpuCount: number
  status: 'online' | 'offline' | 'maintenance'
}

export interface GPU {
  id: string
  name: string
  status: 'available' | 'occupied' | 'reserved' | 'maintenance'
}

export interface UserQuota {
  maxHoursPerWeek: number
  usedHoursThisWeek: number
  maxConcurrentReservations: number
  currentReservations: number
}

export interface ReservationFormValues {
  mode: 'single-gpu' | 'multi-gpu' | 'whole-server' | 'time-slot'
  serverId: string
  gpuIds: string[]
  startTime: Date | string
  endTime: Date | string
  purpose: string
}

export interface ReservationFilters {
  status?: string
  serverId?: string
  startDate?: string
  endDate?: string
  userId?: string
}

export interface FetchParams {
  startDate?: string
  endDate?: string
  serverId?: string
  status?: string
  page?: number
  limit?: number
}

export interface CalendarData {
  slots: TimeSlot[]
  reservations: Reservation[]
}

// Reservation API
export const reservationApi = {
  // 获取所有预约
  getAll: (params?: FetchParams) =>
    apiClient.get('/reservations', { params }),

  // 获取我的预约
  getMyReservations: (params?: FetchParams) =>
    apiClient.get('/reservations/my', { params }),

  // 获取单个预约
  getById: (id: string) =>
    apiClient.get(`/reservations/${id}`),

  // 创建预约
  create: (data: ReservationFormValues) =>
    apiClient.post('/reservations', data),

  // 更新预约
  update: (id: string, data: Partial<ReservationFormValues>) =>
    apiClient.put(`/reservations/${id}`, data),

  // 取消预约
  cancel: (id: string) =>
    apiClient.post(`/reservations/${id}/cancel`),

  // 释放预约 (提前结束)
  release: (id: string) =>
    apiClient.post(`/reservations/${id}/release`),

  // 获取日历数据
  getCalendar: (params: { startDate: string; endDate: string; serverId?: string }) =>
    apiClient.get('/reservations/calendar', { params }),

  // 获取可用服务器和 GPU
  getAvailableServers: (params?: { startTime?: string; endTime?: string }) =>
    apiClient.get('/reservations/available-servers', { params }),

  // 检查时间冲突
  checkConflicts: (data: { serverId: string; gpuIds: string[]; startTime: string; endTime: string }) =>
    apiClient.post('/reservations/check-conflicts', data),

  // 获取建议时间
  getSuggestedTimes: (data: { serverId: string; gpuIds: string[]; duration: number }) =>
    apiClient.post('/reservations/suggest-times', data),

  // 获取用户配额
  getUserQuota: () =>
    apiClient.get('/reservations/quota'),

  // 管理员审批
  approve: (id: string) =>
    apiClient.post(`/reservations/${id}/approve`),

  // 管理员拒绝
  reject: (id: string, reason?: string) =>
    apiClient.post(`/reservations/${id}/reject`, { reason }),
}

export default reservationApi