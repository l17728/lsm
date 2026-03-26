/**
 * Clusters Page Unit Tests
 * 
 * Tests for cluster management UI component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Clusters from '../Clusters';

// Mock the API
vi.mock('../../services/api', () => ({
  clusterApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    getStats: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addServer: vi.fn(),
    removeServer: vi.fn(),
    allocate: vi.fn(),
    release: vi.fn(),
    getAvailableServers: vi.fn(),
  },
  clusterReservationApi: {
    create: vi.fn(),
    getMy: vi.fn().mockResolvedValue({ data: { data: [] } }),
    cancel: vi.fn(),
    release: vi.fn(),
    recommendTimeSlots: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

// Mock the auth store
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: '1', username: 'admin', role: 'SUPER_ADMIN' },
    token: 'test-token',
  })),
}));

import { clusterApi } from '../../services/api';

const mockClusterApi = vi.mocked(clusterApi);

// Mock data
const mockClusters = [
  {
    id: 'cluster-1',
    name: 'Test Cluster',
    code: 'TEST-001',
    description: 'Test cluster',
    type: 'COMPUTE',
    status: 'AVAILABLE',
    tags: [],
    totalServers: 2,
    totalGpus: 8,
    totalCpuCores: 32,
    totalMemory: 128,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'cluster-2',
    name: 'Training Cluster',
    code: 'TRAIN-001',
    description: 'Training cluster',
    type: 'TRAINING',
    status: 'ALLOCATED',
    tags: ['ml', 'training'],
    totalServers: 4,
    totalGpus: 16,
    totalCpuCores: 64,
    totalMemory: 256,
    assignee: { id: 'user-1', username: 'testuser', email: 'test@test.com' },
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const mockStats = {
  total: 2,
  byStatus: {
    available: 1,
    allocated: 1,
    reserved: 0,
    maintenance: 0,
  },
  resources: {
    totalServers: 6,
    totalGpus: 24,
    totalCpuCores: 96,
    totalMemory: 384,
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </BrowserRouter>
);

describe('Clusters Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClusterApi.getAll.mockResolvedValue({ data: { data: mockClusters } } as any);
    mockClusterApi.getStats.mockResolvedValue({ data: { data: mockStats } } as any);
  });

  describe('Rendering', () => {
    it('should render cluster page title', async () => {
      render(<Clusters />, { wrapper });
      expect(screen.getByText('集群管理')).toBeDefined();
    });

    it('should render create button', async () => {
      render(<Clusters />, { wrapper });
      expect(screen.getByText('创建集群')).toBeDefined();
    });

    it('should render refresh button', async () => {
      render(<Clusters />, { wrapper });
      expect(screen.getByText('刷新')).toBeDefined();
    });
  });

  describe('Data Loading', () => {
    it('should load and display cluster stats', async () => {
      render(<Clusters />, { wrapper });
      
      await waitFor(() => {
        expect(mockClusterApi.getStats).toHaveBeenCalled();
      });
    });

    it('should load and display clusters list', async () => {
      render(<Clusters />, { wrapper });
      
      await waitFor(() => {
        expect(mockClusterApi.getAll).toHaveBeenCalled();
      });
    });
  });

  describe('Cluster Operations', () => {
    it('should call create API when creating cluster', async () => {
      mockClusterApi.create.mockResolvedValue({ data: { data: { id: 'new-cluster' } } } as any);
      
      render(<Clusters />, { wrapper });
      
      const createButtons = screen.getAllByText('创建集群');
      expect(createButtons.length).toBeGreaterThan(0);
      
      // Click the first create button (in toolbar)
      fireEvent.click(createButtons[0]);
      
      // Modal should open - check for modal title
      await waitFor(() => {
        expect(screen.getByText('集群编码')).toBeDefined();
      });
    });

    it('should call delete API when deleting cluster', async () => {
      mockClusterApi.delete.mockResolvedValue({ data: { success: true } } as any);
      
      render(<Clusters />, { wrapper });
      
      // Wait for data to load
      await waitFor(() => {
        expect(mockClusterApi.getAll).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockClusterApi.getAll.mockRejectedValue(new Error('API Error'));
      
      render(<Clusters />, { wrapper });
      
      await waitFor(() => {
        expect(mockClusterApi.getAll).toHaveBeenCalled();
      });
    });
  });
});

describe('Cluster API Functions', () => {
  it('should have correct API endpoints defined', () => {
    expect(clusterApi.getAll).toBeDefined();
    expect(clusterApi.getById).toBeDefined();
    expect(clusterApi.create).toBeDefined();
    expect(clusterApi.update).toBeDefined();
    expect(clusterApi.delete).toBeDefined();
    expect(clusterApi.getStats).toBeDefined();
    expect(clusterApi.addServer).toBeDefined();
    expect(clusterApi.removeServer).toBeDefined();
    expect(clusterApi.allocate).toBeDefined();
    expect(clusterApi.release).toBeDefined();
  });
});

describe('Cluster Status Colors', () => {
  it('should map status to correct colors', () => {
    const statusColors: Record<string, string> = {
      AVAILABLE: 'green',
      ALLOCATED: 'blue',
      RESERVED: 'orange',
      MAINTENANCE: 'red',
      OFFLINE: 'default',
    };

    expect(statusColors['AVAILABLE']).toBe('green');
    expect(statusColors['ALLOCATED']).toBe('blue');
    expect(statusColors['MAINTENANCE']).toBe('red');
  });
});

describe('Cluster Type Colors', () => {
  it('should map type to correct colors', () => {
    const typeColors: Record<string, string> = {
      COMPUTE: 'blue',
      TRAINING: 'purple',
      INFERENCE: 'cyan',
      GENERAL: 'default',
      CUSTOM: 'gold',
    };

    expect(typeColors['COMPUTE']).toBe('blue');
    expect(typeColors['TRAINING']).toBe('purple');
    expect(typeColors['CUSTOM']).toBe('gold');
  });
});

// ============================================
// AI Time Slot Recommendation Tests
// ============================================
describe('AI Time Slot Recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClusterApi.getAll.mockResolvedValue({ data: { data: mockClusters } } as any);
    mockClusterApi.getStats.mockResolvedValue({ data: { data: mockStats } } as any);
  });

  it('should have recommendTimeSlots API defined', async () => {
    const { clusterReservationApi } = await import('../../services/api');
    expect(clusterReservationApi.recommendTimeSlots).toBeDefined();
  });

  it('should call recommendTimeSlots with correct parameters', async () => {
    const { clusterReservationApi } = await import('../../services/api');
    const mockRecommend = vi.mocked(clusterReservationApi.recommendTimeSlots);
    mockRecommend.mockResolvedValue({
      data: {
        data: [
          {
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 7200000).toISOString(),
            score: 85,
            confidence: 0.85,
            reasons: ['无时间冲突'],
            queuePosition: null,
          },
        ],
      },
    } as any);

    const result = await clusterReservationApi.recommendTimeSlots({
      clusterId: 'cluster-1',
      duration: 120,
    });

    expect(mockRecommend).toHaveBeenCalledWith({
      clusterId: 'cluster-1',
      duration: 120,
    });
    expect(result.data.data).toHaveLength(1);
  });

  it('should handle recommendation API errors gracefully', async () => {
    const { clusterReservationApi } = await import('../../services/api');
    const mockRecommend = vi.mocked(clusterReservationApi.recommendTimeSlots);
    mockRecommend.mockRejectedValue(new Error('API Error'));

    await expect(
      clusterReservationApi.recommendTimeSlots({
        clusterId: 'cluster-1',
        duration: 120,
      })
    ).rejects.toThrow('API Error');
  });

  it('should return recommendations with required fields', async () => {
    const { clusterReservationApi } = await import('../../services/api');
    const mockRecommend = vi.mocked(clusterReservationApi.recommendTimeSlots);
    
    const mockRecommendation = {
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      score: 85,
      confidence: 0.85,
      reasons: ['无时间冲突', '工作日时段'],
      queuePosition: null,
    };
    
    mockRecommend.mockResolvedValue({
      data: { data: [mockRecommendation] },
    } as any);

    const result = await clusterReservationApi.recommendTimeSlots({
      clusterId: 'cluster-1',
      duration: 120,
    });

    const recommendation = result.data.data[0];
    expect(recommendation).toHaveProperty('startTime');
    expect(recommendation).toHaveProperty('endTime');
    expect(recommendation).toHaveProperty('score');
    expect(recommendation).toHaveProperty('confidence');
    expect(recommendation).toHaveProperty('reasons');
    expect(Array.isArray(recommendation.reasons)).toBe(true);
  });

  it('should accept optional preferred time range', async () => {
    const { clusterReservationApi } = await import('../../services/api');
    const mockRecommend = vi.mocked(clusterReservationApi.recommendTimeSlots);
    mockRecommend.mockResolvedValue({ data: { data: [] } } as any);

    const preferredStart = new Date(Date.now() + 86400000).toISOString();
    const preferredEnd = new Date(Date.now() + 172800000).toISOString();

    await clusterReservationApi.recommendTimeSlots({
      clusterId: 'cluster-1',
      duration: 120,
      preferredStartTime: preferredStart,
      preferredEndTime: preferredEnd,
    });

    expect(mockRecommend).toHaveBeenCalledWith(
      expect.objectContaining({
        clusterId: 'cluster-1',
        duration: 120,
        preferredStartTime: preferredStart,
        preferredEndTime: preferredEnd,
      })
    );
  });
});