import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * @deprecated This file is deprecated. Use './api' instead.
 * 
 * This API client uses localStorage for token storage which is inconsistent
 * with the main api.ts that uses Zustand store. This causes authentication
 * issues when tokens are not synchronized.
 * 
 * For new code, import from './api' instead:
 *   import apiClient from './api'
 *   import { ApiError, ApiErrorType } from './api'
 * 
 * @see ./api.ts for the recommended API client
 */

// Import shared error types
import { ApiErrorType, ApiError, createApiError } from './apiErrors';

// Re-export for backward compatibility (deprecated)
export { ApiErrorType } from './apiErrors'
export type { ApiError } from './apiErrors'

/**
 * Create axios instance with base configuration
 * @deprecated Use api.ts instead
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - Add auth token
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - Handle errors
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<any>) => {
    const apiError: ApiError = {
      type: ApiErrorType.UNKNOWN_ERROR,
      message: 'An unexpected error occurred',
    };

    if (error.response) {
      const { status, data } = error.response;

      apiError.status = status;
      apiError.code = data?.error?.code;
      apiError.details = data?.error?.details;

      switch (status) {
        case 400:
          apiError.type = ApiErrorType.VALIDATION_ERROR;
          apiError.message = data?.error?.message || 'Invalid request';
          break;
        case 401:
          apiError.type = ApiErrorType.AUTHENTICATION_ERROR;
          apiError.message = 'Please login again';
          // Clear tokens and redirect to login
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
          break;
        case 403:
          apiError.type = ApiErrorType.AUTHORIZATION_ERROR;
          apiError.message = 'You do not have permission to perform this action';
          break;
        case 404:
          apiError.type = ApiErrorType.NOT_FOUND_ERROR;
          apiError.message = 'The requested resource was not found';
          break;
        case 429:
          apiError.message = 'Too many requests, please try again later';
          break;
        default:
          apiError.message = data?.error?.message || `Server error (${status})`;
      }
    } else if (error.request) {
      apiError.type = ApiErrorType.NETWORK_ERROR;
      apiError.message = 'Network error, please check your connection';
    } else {
      apiError.message = error.message || 'An unexpected error occurred';
    }

    // Show error notification
    showErrorNotification(apiError);

    return Promise.reject(apiError);
  }
);

/**
 * Show error notification
 */
function showErrorNotification(error: ApiError) {
  // You can integrate with your UI notification system here
  // For example, using Ant Design's message component:
  // message.error(error.message);

  console.error('[API Error]', {
    type: error.type,
    message: error.message,
    code: error.code,
    details: error.details,
  });
}

/**
 * Refresh access token
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post(
      `${apiClient.defaults?.baseURL}/auth/refresh`,
      { refreshToken }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);

    return accessToken;
  } catch (error) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw error;
  }
}

/**
 * Retry failed request with new token
 */
async function retryRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  try {
    const newToken = await refreshAccessToken();

    if (config.headers) {
      config.headers.Authorization = `Bearer ${newToken}`;
    }

    return await apiClient.request(config);
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * API service methods
 */
export const api = {
  // Auth
  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),

  register: (data: { username: string; email: string; password: string }) =>
    apiClient.post('/auth/register', data),

  logout: () => apiClient.post('/auth/logout'),

  refreshToken: () => apiClient.post('/auth/refresh'),

  getMe: () => apiClient.get('/auth/me'),

  // Servers
  getServers: () => apiClient.get('/servers'),

  createServer: (data: any) => apiClient.post('/servers', data),

  updateServer: (id: string, data: any) =>
    apiClient.put(`/servers/${id}`, data),

  deleteServer: (id: string) => apiClient.delete(`/servers/${id}`),

  // GPUs
  getGpus: () => apiClient.get('/gpus'),

  allocateGpu: (data: any) => apiClient.post('/gpus/allocate', data),

  releaseGpu: (id: string) => apiClient.post(`/gpus/release/${id}`),

  // Tasks
  getTasks: () => apiClient.get('/tasks'),

  createTask: (data: any) => apiClient.post('/tasks', data),

  updateTask: (id: string, data: any) =>
    apiClient.put(`/tasks/${id}`, data),

  cancelTask: (id: string) => apiClient.post(`/tasks/${id}/cancel`),

  // Monitoring
  getClusterStats: () => apiClient.get('/monitoring/cluster-stats'),

  getAlerts: () => apiClient.get('/monitoring/alerts'),

  // Custom request
  request: apiClient.request,
};

export default apiClient;
