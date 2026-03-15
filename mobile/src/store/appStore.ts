import { create } from 'zustand';
import { Server, ServerStats, GPUStats, TaskStats, GPUAllocation, Task } from '../types';
import { apiService } from '../services/api';

interface AppState {
  // Server state
  servers: Server[];
  serverStats: ServerStats | null;
  serversLoading: boolean;
  
  // GPU state
  gpuStats: GPUStats | null;
  myAllocations: GPUAllocation[];
  gpuLoading: boolean;
  
  // Task state
  tasks: Task[];
  taskStats: TaskStats | null;
  tasksLoading: boolean;
  
  // Refresh timestamp
  lastRefresh: number | null;
  
  // Actions
  fetchServers: () => Promise<void>;
  fetchServerStats: () => Promise<void>;
  fetchGPUStats: () => Promise<void>;
  fetchMyAllocations: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchTaskStats: () => Promise<void>;
  fetchAllStats: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  servers: [],
  serverStats: null,
  serversLoading: false,
  
  gpuStats: null,
  myAllocations: [],
  gpuLoading: false,
  
  tasks: [],
  taskStats: null,
  tasksLoading: false,
  
  lastRefresh: null,

  // Server actions
  fetchServers: async () => {
    set({ serversLoading: true });
    try {
      const response = await apiService.getServers();
      if (response.success && response.data) {
        set({ servers: response.data, serversLoading: false });
      } else {
        set({ serversLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
      set({ serversLoading: false });
    }
  },

  fetchServerStats: async () => {
    try {
      const response = await apiService.getServerStats();
      if (response.success && response.data) {
        set({ serverStats: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch server stats:', error);
    }
  },

  // GPU actions
  fetchGPUStats: async () => {
    try {
      const response = await apiService.getGPUStats();
      if (response.success && response.data) {
        set({ gpuStats: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch GPU stats:', error);
    }
  },

  fetchMyAllocations: async () => {
    set({ gpuLoading: true });
    try {
      const response = await apiService.getMyAllocations();
      if (response.success && response.data) {
        set({ myAllocations: response.data, gpuLoading: false });
      } else {
        set({ gpuLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch allocations:', error);
      set({ gpuLoading: false });
    }
  },

  // Task actions
  fetchTasks: async () => {
    set({ tasksLoading: true });
    try {
      const response = await apiService.getTasks();
      if (response.success && response.data) {
        set({ tasks: response.data, tasksLoading: false });
      } else {
        set({ tasksLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      set({ tasksLoading: false });
    }
  },

  fetchTaskStats: async () => {
    try {
      const response = await apiService.getTaskStats();
      if (response.success && response.data) {
        set({ taskStats: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch task stats:', error);
    }
  },

  // Fetch all stats
  fetchAllStats: async () => {
    const { fetchServerStats, fetchGPUStats, fetchTaskStats } = get();
    await Promise.all([
      fetchServerStats(),
      fetchGPUStats(),
      fetchTaskStats(),
    ]);
  },

  // Refresh all data
  refresh: async () => {
    const { fetchServers, fetchAllStats, fetchMyAllocations, fetchTasks } = get();
    await Promise.all([
      fetchServers(),
      fetchAllStats(),
      fetchMyAllocations(),
      fetchTasks(),
    ]);
    set({ lastRefresh: Date.now() });
  },
}));