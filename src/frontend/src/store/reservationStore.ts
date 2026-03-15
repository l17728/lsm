import { create } from 'zustand'
import dayjs from 'dayjs'
import reservationApi, { 
  Reservation, 
  ReservationFormValues, 
  ReservationFilters,
  FetchParams,
  UserQuota,
  Server,
  TimeSlot
} from '../services/reservation.service'

interface ReservationState {
  // 当前视图日期
  currentDate: Date
  // 视图模式
  viewMode: 'day' | 'week' | 'month'
  // 选中的服务器
  selectedServerId: string | null
  // 预约列表
  reservations: Reservation[]
  // 日历数据
  calendarData: TimeSlot[]
  // 可用服务器列表
  availableServers: Server[]
  // 用户配额
  userQuota: UserQuota | null
  // 加载状态
  loading: boolean
  // 筛选条件
  filters: ReservationFilters
  // 分页
  pagination: {
    page: number
    limit: number
    total: number
  }
  // 错误信息
  error: string | null

  // Actions
  setCurrentDate: (date: Date) => void
  setViewMode: (mode: 'day' | 'week' | 'month') => void
  setSelectedServerId: (id: string | null) => void
  setFilters: (filters: ReservationFilters) => void
  clearError: () => void
  
  // API Actions
  fetchReservations: (params?: FetchParams) => Promise<void>
  fetchMyReservations: (params?: FetchParams) => Promise<void>
  fetchCalendarData: (startDate: Date, endDate: Date, serverId?: string) => Promise<void>
  fetchAvailableServers: (startTime?: string, endTime?: string) => Promise<void>
  fetchUserQuota: () => Promise<void>
  createReservation: (data: ReservationFormValues) => Promise<Reservation>
  updateReservation: (id: string, data: Partial<ReservationFormValues>) => Promise<void>
  cancelReservation: (id: string) => Promise<void>
  releaseReservation: (id: string) => Promise<void>
  approveReservation: (id: string) => Promise<void>
  rejectReservation: (id: string, reason?: string) => Promise<void>
}

export const useReservationStore = create<ReservationState>((set, get) => ({
  currentDate: new Date(),
  viewMode: 'day',
  selectedServerId: null,
  reservations: [],
  calendarData: [],
  availableServers: [],
  userQuota: null,
  loading: false,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },
  error: null,

  // Setters
  setCurrentDate: (date) => set({ currentDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedServerId: (id) => set({ selectedServerId: id }),
  setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),
  clearError: () => set({ error: null }),

  // Fetch reservations (admin view)
  fetchReservations: async (params) => {
    set({ loading: true, error: null })
    try {
      const response = await reservationApi.getAll(params)
      set({ 
        reservations: response.data.data || [],
        pagination: {
          page: params?.page || 1,
          limit: params?.limit || 20,
          total: response.data.total || 0,
        },
        loading: false 
      })
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '获取预约列表失败',
        loading: false 
      })
    }
  },

  // Fetch my reservations
  fetchMyReservations: async (params) => {
    set({ loading: true, error: null })
    try {
      const response = await reservationApi.getMyReservations(params)
      set({ 
        reservations: response.data.data || [],
        pagination: {
          page: params?.page || 1,
          limit: params?.limit || 20,
          total: response.data.total || 0,
        },
        loading: false 
      })
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '获取我的预约失败',
        loading: false 
      })
    }
  },

  // Fetch calendar data
  fetchCalendarData: async (startDate, endDate, serverId) => {
    set({ loading: true, error: null })
    try {
      const response = await reservationApi.getCalendar({
        startDate: dayjs(startDate).format('YYYY-MM-DD'),
        endDate: dayjs(endDate).format('YYYY-MM-DD'),
        serverId,
      })
      set({ 
        calendarData: response.data.slots || [],
        loading: false 
      })
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '获取日历数据失败',
        loading: false 
      })
    }
  },

  // Fetch available servers
  fetchAvailableServers: async (startTime, endTime) => {
    set({ loading: true, error: null })
    try {
      const response = await reservationApi.getAvailableServers({
        startTime,
        endTime,
      })
      set({ 
        availableServers: response.data.data || [],
        loading: false 
      })
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '获取可用服务器失败',
        loading: false 
      })
    }
  },

  // Fetch user quota
  fetchUserQuota: async () => {
    try {
      const response = await reservationApi.getUserQuota()
      set({ userQuota: response.data })
    } catch (error: any) {
      console.error('获取配额失败:', error)
    }
  },

  // Create reservation
  createReservation: async (data) => {
    set({ loading: true, error: null })
    try {
      const response = await reservationApi.create(data)
      const newReservation = response.data.data
      set((state) => ({
        reservations: [...state.reservations, newReservation],
        loading: false,
      }))
      return newReservation
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '创建预约失败',
        loading: false 
      })
      throw error
    }
  },

  // Update reservation
  updateReservation: async (id, data) => {
    set({ loading: true, error: null })
    try {
      await reservationApi.update(id, data)
      set((state) => ({
        reservations: state.reservations.map((r) =>
          r.id === id ? { 
            ...r, 
            ...(data.startTime ? { startTime: typeof data.startTime === 'string' ? data.startTime : data.startTime.toISOString() } : {}),
            ...(data.endTime ? { endTime: typeof data.endTime === 'string' ? data.endTime : data.endTime.toISOString() } : {}),
            purpose: data.purpose ?? r.purpose,
            gpuIds: data.gpuIds ?? r.gpuIds,
            serverId: data.serverId ?? r.serverId,
          } : r
        ),
        loading: false,
      }))
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '更新预约失败',
        loading: false 
      })
      throw error
    }
  },

  // Cancel reservation
  cancelReservation: async (id) => {
    set({ loading: true, error: null })
    try {
      await reservationApi.cancel(id)
      set((state) => ({
        reservations: state.reservations.map((r) =>
          r.id === id ? { ...r, status: 'cancelled' as const } : r
        ),
        loading: false,
      }))
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '取消预约失败',
        loading: false 
      })
      throw error
    }
  },

  // Release reservation (end early)
  releaseReservation: async (id) => {
    set({ loading: true, error: null })
    try {
      await reservationApi.release(id)
      set((state) => ({
        reservations: state.reservations.map((r) =>
          r.id === id ? { ...r, status: 'completed' as const } : r
        ),
        loading: false,
      }))
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '释放预约失败',
        loading: false 
      })
      throw error
    }
  },

  // Approve reservation (admin)
  approveReservation: async (id) => {
    set({ loading: true, error: null })
    try {
      await reservationApi.approve(id)
      set((state) => ({
        reservations: state.reservations.map((r) =>
          r.id === id ? { ...r, status: 'approved' as const } : r
        ),
        loading: false,
      }))
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '审批预约失败',
        loading: false 
      })
      throw error
    }
  },

  // Reject reservation (admin)
  rejectReservation: async (id, reason) => {
    set({ loading: true, error: null })
    try {
      await reservationApi.reject(id, reason)
      set((state) => ({
        reservations: state.reservations.map((r) =>
          r.id === id ? { ...r, status: 'cancelled' as const } : r
        ),
        loading: false,
      }))
    } catch (error: any) {
      set({ 
        error: error.response?.data?.message || '拒绝预约失败',
        loading: false 
      })
      throw error
    }
  },
}))

export default useReservationStore