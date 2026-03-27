// LSM v3.2.0 - Services Export

// Primary API client (recommended)
export { default as api } from './api'
export { ApiErrorType } from './apiErrors'
export type { ApiError } from './apiErrors'
export { createApiError } from './apiErrors'

// Legacy API client (deprecated - do not use for new code)
// This export is kept for backward compatibility only
export { default as apiClient } from './apiClient'

// Feature services
export { chatService, default } from './chat.service'
export { reservationApi } from './reservation.service'
export type { Reservation, TimeSlot, Server, GPU, UserQuota, ReservationFormValues, ReservationFilters } from './reservation.service'
export { default as websocket } from './websocket'