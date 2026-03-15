import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_CONFIG } from '../constants';
import { useAuthStore } from '../store/authStore';
import {
  AuthResponse,
  ApiResponse,
  User,
  LoginCredentials,
  Server,
  ServerStats,
  GPU,
  GPUStats,
  GPUAllocation,
  Task,
  TaskStats,
  DashboardStats,
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().token;
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== Auth API ====================
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/auth/login', credentials);
    return response.data;
  }

  async register(data: { username: string; email: string; password: string }): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/auth/register', data);
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.api.get<ApiResponse<User>>('/auth/me');
    return response.data;
  }

  async logout(): Promise<ApiResponse<null>> {
    const response = await this.api.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  }

  // ==================== Server API ====================
  async getServers(): Promise<ApiResponse<Server[]>> {
    const response = await this.api.get<ApiResponse<Server[]>>('/servers');
    return response.data;
  }

  async getServer(id: string): Promise<ApiResponse<Server>> {
    const response = await this.api.get<ApiResponse<Server>>(`/servers/${id}`);
    return response.data;
  }

  async getServerStats(): Promise<ApiResponse<ServerStats>> {
    const response = await this.api.get<ApiResponse<ServerStats>>('/servers/stats');
    return response.data;
  }

  async getAvailableServers(): Promise<ApiResponse<Server[]>> {
    const response = await this.api.get<ApiResponse<Server[]>>('/servers/available');
    return response.data;
  }

  // ==================== GPU API ====================
  async getGPUStats(): Promise<ApiResponse<GPUStats>> {
    const response = await this.api.get<ApiResponse<GPUStats>>('/gpu/stats');
    return response.data;
  }

  async allocateGPU(params?: { gpuModel?: string; minMemory?: number }): Promise<ApiResponse<GPUAllocation>> {
    const response = await this.api.post<ApiResponse<GPUAllocation>>('/gpu/allocate', params);
    return response.data;
  }

  async releaseGPU(allocationId: string): Promise<ApiResponse<null>> {
    const response = await this.api.post<ApiResponse<null>>(`/gpu/release/${allocationId}`);
    return response.data;
  }

  async getMyAllocations(): Promise<ApiResponse<GPUAllocation[]>> {
    const response = await this.api.get<ApiResponse<GPUAllocation[]>>('/gpu/my-allocations');
    return response.data;
  }

  async getAllAllocations(): Promise<ApiResponse<GPUAllocation[]>> {
    const response = await this.api.get<ApiResponse<GPUAllocation[]>>('/gpu/allocations');
    return response.data;
  }

  // ==================== Task API ====================
  async getTasks(params?: { status?: string; limit?: number }): Promise<ApiResponse<Task[]>> {
    const response = await this.api.get<ApiResponse<Task[]>>('/tasks', { params });
    return response.data;
  }

  async getTask(id: string): Promise<ApiResponse<Task>> {
    const response = await this.api.get<ApiResponse<Task>>(`/tasks/${id}`);
    return response.data;
  }

  async getTaskStats(): Promise<ApiResponse<TaskStats>> {
    const response = await this.api.get<ApiResponse<TaskStats>>('/tasks/stats');
    return response.data;
  }

  async createTask(data: Partial<Task>): Promise<ApiResponse<Task>> {
    const response = await this.api.post<ApiResponse<Task>>('/tasks', data);
    return response.data;
  }

  async cancelTask(id: string): Promise<ApiResponse<null>> {
    const response = await this.api.post<ApiResponse<null>>(`/tasks/${id}/cancel`);
    return response.data;
  }

  // ==================== Monitoring API ====================
  async getHealth(): Promise<ApiResponse<{ status: string }>> {
    const response = await this.api.get<ApiResponse<{ status: string }>>('/monitoring/health');
    return response.data;
  }

  async getClusterStats(): Promise<ApiResponse<DashboardStats>> {
    const response = await this.api.get<ApiResponse<DashboardStats>>('/monitoring/cluster-stats');
    return response.data;
  }

  // ==================== Dashboard API ====================
  async getDashboardStats(): Promise<DashboardStats> {
    const [servers, gpus, tasks] = await Promise.all([
      this.getServerStats(),
      this.getGPUStats(),
      this.getTaskStats(),
    ]);

    return {
      servers: servers.data || { total: 0, online: 0, offline: 0, maintenance: 0 },
      gpus: gpus.data || { total: 0, available: 0, allocated: 0, maintenance: 0, byModel: {} },
      tasks: tasks.data || { total: 0, pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0 },
    };
  }
}

export const apiService = new ApiService();
export default apiService;