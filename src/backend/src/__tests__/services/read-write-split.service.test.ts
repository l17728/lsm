import { ReadWriteSplitDatabaseService, ConnectionType } from '../../services/read-write-split.service';

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock PrismaClient so no real DB connections are made
jest.mock('@prisma/client', () => {
  const mockPrismaInstance = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: jest.fn(),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  return { PrismaClient: jest.fn(() => mockPrismaInstance) };
});

describe('ReadWriteSplitDatabaseService', () => {
  let service: ReadWriteSplitDatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a new instance with read-replica disabled (default)
    service = new ReadWriteSplitDatabaseService({
      primaryUrl: 'postgresql://test:test@localhost:5432/testdb',
      replicaUrls: [],
      enableReadReplica: false,
      readQueryThreshold: 100,
    });
  });

  it('should return primary client for write operations', () => {
    const primary = service.getPrimary();
    expect(primary).toBeDefined();
  });

  it('should fall back to primary when no replicas are configured', () => {
    const replica = service.getReplica();
    const primary = service.getPrimary();
    // Both should be the same instance when no replicas
    expect(replica).toBe(primary);
  });

  it('should route read operations to primary when replicas disabled', () => {
    const client = service.getClient('read', false);
    const primary = service.getPrimary();
    expect(client).toBe(primary);
  });

  it('should always route write operations and critical reads to primary', () => {
    const writeClient = service.getClient('write');
    const criticalClient = service.getClient('read', true);
    const primary = service.getPrimary();
    expect(writeClient).toBe(primary);
    expect(criticalClient).toBe(primary);
  });

  it('should return correct stats when no replicas configured', () => {
    const stats = service.getStats();
    expect(stats.primaryConnected).toBe(true);
    expect(stats.replicaCount).toBe(0);
    expect(stats.readReplicaEnabled).toBe(false);
  });

  it('should execute read queries and return result', async () => {
    const mockData = [{ id: '1', name: 'test' }];
    const query = jest.fn().mockResolvedValue(mockData);

    const result = await service.read(query);

    expect(query).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockData);
  });

  it('should execute write queries and return result', async () => {
    const mockData = { id: '1', name: 'created' };
    const query = jest.fn().mockResolvedValue(mockData);

    const result = await service.write(query);

    expect(query).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockData);
  });

  it('should propagate errors from read queries', async () => {
    const query = jest.fn().mockRejectedValue(new Error('DB read error'));

    await expect(service.read(query)).rejects.toThrow('DB read error');
  });

  it('should return zero replication lag when no replicas', async () => {
    const lag = await service.getReplicationLag();
    expect(lag).toBe(0);
  });
});
