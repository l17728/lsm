/**
 * ClusterService Unit Tests
 *
 * Tests for cluster management service.
 * Covers: CRUD operations, server assignment, allocation, and resource tracking.
 */

// Mock prisma first before any imports
jest.mock('../../utils/prisma', () => {
  const mockPrisma = {
    cluster: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    clusterServer: {
      create: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    clusterAllocation: {
      create: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    clusterReservation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    server: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

// Mock cacheService
jest.mock('../../services/cache.service', () => ({
  cacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    invalidatePattern: jest.fn().mockResolvedValue(undefined),
  },
}));

import { ClusterService } from '../../services/cluster.service';
import { cluster_status as ClusterStatus, cluster_type as ClusterType } from '@prisma/client';
import prisma from '../../utils/prisma';

// Get mocked prisma
const mockPrisma = prisma as jest.Mocked<any>;

// Helper: build a minimal cluster object
const makeCluster = (overrides: Record<string, any> = {}) => ({
  id: 'cluster-1',
  name: 'Test Cluster',
  code: 'TEST-001',
  description: 'Test cluster for unit tests',
  type: ClusterType.GENERAL,
  status: ClusterStatus.AVAILABLE,
  totalServers: 0,
  totalGpus: 0,
  totalCpuCores: 0,
  totalMemory: 0,
  usedServers: 0,
  usedGpus: 0,
  assignedTo: null,
  assignedAt: null,
  assignmentEnd: null,
  tags: [],
  capabilities: {},
  constraints: {},
  metadata: {},
  createdBy: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  servers: [],
  allocations: [],
  ...overrides,
});

// Helper: build a minimal server object
const makeServer = (overrides: Record<string, any> = {}) => ({
  id: 'server-1',
  name: 'Test Server',
  hostname: 'test-server',
  status: 'ONLINE',
  cpuCores: 8,
  totalMemory: 64,
  gpuCount: 2,
  gpus: [],
  clusterServers: [],
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('ClusterService', () => {
  let service: ClusterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClusterService();
  });

  // ─── createCluster ───────────────────────────────────────────────────────────
  describe('createCluster', () => {
    it('should create a new cluster successfully', async () => {
      const data = {
        name: 'New Cluster',
        code: 'NEW-001',
        description: 'Test',
        type: ClusterType.COMPUTE,
      };

      mockPrisma.cluster.findUnique.mockResolvedValue(null);
      mockPrisma.cluster.create.mockResolvedValue(makeCluster(data));

      const result = await service.createCluster(data, 'user-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('New Cluster');
      expect(mockPrisma.cluster.create).toHaveBeenCalled();
    });

    it('should throw error if code already exists', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());

      await expect(
        service.createCluster({ name: 'Test', code: 'TEST-001' }, 'user-1')
      ).rejects.toThrow('already exists');
    });
  });

  // ─── getAllClusters ──────────────────────────────────────────────────────────
  describe('getAllClusters', () => {
    it('should return all clusters', async () => {
      const clusters = [makeCluster(), makeCluster({ id: 'cluster-2', code: 'TEST-002' })];
      mockPrisma.cluster.findMany.mockResolvedValue(clusters);

      const result = await service.getAllClusters();

      expect(result).toHaveLength(2);
      expect(mockPrisma.cluster.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      mockPrisma.cluster.findMany.mockResolvedValue([]);

      await service.getAllClusters({ status: ClusterStatus.AVAILABLE });

      expect(mockPrisma.cluster.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ClusterStatus.AVAILABLE },
        })
      );
    });
  });

  // ─── getClusterById ──────────────────────────────────────────────────────────
  describe('getClusterById', () => {
    it('should return cluster by id', async () => {
      const cluster = makeCluster();
      mockPrisma.cluster.findUnique.mockResolvedValue(cluster);

      const result = await service.getClusterById('cluster-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('cluster-1');
    });

    it('should return null if not found', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(null);

      const result = await service.getClusterById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── updateCluster ───────────────────────────────────────────────────────────
  describe('updateCluster', () => {
    it('should update cluster', async () => {
      mockPrisma.cluster.update.mockResolvedValue(makeCluster({ name: 'Updated' }));

      const result = await service.updateCluster('cluster-1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });
  });

  // ─── deleteCluster ───────────────────────────────────────────────────────────
  describe('deleteCluster', () => {
    it('should delete cluster without active allocations', async () => {
      mockPrisma.clusterAllocation.count.mockResolvedValue(0);
      mockPrisma.cluster.delete.mockResolvedValue(makeCluster());

      await service.deleteCluster('cluster-1');

      expect(mockPrisma.cluster.delete).toHaveBeenCalledWith({ where: { id: 'cluster-1' } });
    });

    it('should throw error if cluster has active allocations', async () => {
      mockPrisma.clusterAllocation.count.mockResolvedValue(1);

      await expect(service.deleteCluster('cluster-1')).rejects.toThrow('active allocations');
    });
  });

  // ─── addServer ───────────────────────────────────────────────────────────────
  describe('addServer', () => {
    it('should add server to cluster', async () => {
      mockPrisma.server.findUnique.mockResolvedValue(makeServer());
      mockPrisma.clusterServer.findUnique.mockResolvedValue(null);
      mockPrisma.clusterServer.create.mockResolvedValue({ id: 'cs-1' });
      mockPrisma.clusterServer.findMany.mockResolvedValue([]);
      mockPrisma.cluster.update.mockResolvedValue(makeCluster());

      const result = await service.addServer('cluster-1', { serverId: 'server-1' }, 'user-1');

      expect(result).toBeDefined();
    });

    it('should throw if server not found', async () => {
      mockPrisma.server.findUnique.mockResolvedValue(null);

      await expect(
        service.addServer('cluster-1', { serverId: 'nonexistent' }, 'user-1')
      ).rejects.toThrow('Server not found');
    });

    it('should throw if server already in cluster', async () => {
      mockPrisma.server.findUnique.mockResolvedValue(makeServer());
      mockPrisma.clusterServer.findUnique.mockResolvedValue({ id: 'cs-1' });

      await expect(
        service.addServer('cluster-1', { serverId: 'server-1' }, 'user-1')
      ).rejects.toThrow('already in cluster');
    });
  });

  // ─── allocateCluster ─────────────────────────────────────────────────────────
  describe('allocateCluster', () => {
    it('should allocate cluster to user', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster());
      mockPrisma.cluster.update.mockResolvedValue(makeCluster({ status: ClusterStatus.ALLOCATED }));
      mockPrisma.clusterAllocation.create.mockResolvedValue({ id: 'alloc-1' });

      const result = await service.allocateCluster('cluster-1', {
        userId: 'user-1',
        startTime: new Date(),
        endTime: new Date(Date.now() + 86400000),
      });

      expect(result).toBeDefined();
    });

    it('should throw if cluster not found', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(null);

      await expect(
        service.allocateCluster('nonexistent', {
          userId: 'user-1',
          startTime: new Date(),
          endTime: new Date(),
        })
      ).rejects.toThrow('Cluster not found');
    });

    it('should throw if cluster not available', async () => {
      mockPrisma.cluster.findUnique.mockResolvedValue(makeCluster({ status: ClusterStatus.ALLOCATED }));

      await expect(
        service.allocateCluster('cluster-1', {
          userId: 'user-1',
          startTime: new Date(),
          endTime: new Date(),
        })
      ).rejects.toThrow('not available');
    });
  });

  // ─── getClusterStats ─────────────────────────────────────────────────────────
  describe('getClusterStats', () => {
    it('should return cluster statistics', async () => {
      mockPrisma.cluster.count.mockResolvedValue(10);
      mockPrisma.cluster.aggregate.mockResolvedValue({
        _sum: { totalServers: 20, totalGpus: 80, totalCpuCores: 160, totalMemory: 640 },
      });

      const result = await service.getClusterStats();

      expect(result.total).toBe(10);
    });
  });
});