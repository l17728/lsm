// User types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    token: string;
  };
  error?: string;
}

// Server types
export interface Server {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'maintenance';
  cpuCores?: number;
  memoryGB?: number;
  gpuCount?: number;
  gpus?: GPU[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ServerStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
}

// GPU types
export interface GPU {
  id: string;
  name: string;
  model: string;
  memoryGB: number;
  status: 'available' | 'allocated' | 'maintenance';
  serverId?: string;
  serverName?: string;
  allocatedTo?: string;
  allocatedAt?: string;
}

export interface GPUAllocation {
  id: string;
  gpuId: string;
  gpuModel: string;
  userId: string;
  username: string;
  serverId: string;
  serverName: string;
  status: 'active' | 'released' | 'terminated';
  allocatedAt: string;
  releasedAt?: string;
  notes?: string;
}

export interface GPUStats {
  total: number;
  available: number;
  allocated: number;
  maintenance: number;
  byModel: Record<string, number>;
}

// Task types
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  userId: string;
  username?: string;
  serverId?: string;
  serverName?: string;
  gpuIds?: string[];
  gpus?: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

// Dashboard stats
export interface DashboardStats {
  servers: ServerStats;
  gpus: GPUStats;
  tasks: TaskStats;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}