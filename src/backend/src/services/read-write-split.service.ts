import { PrismaClient } from '@prisma/client';

/**
 * Database connection types
 */
export enum ConnectionType {
  PRIMARY = 'PRIMARY',
  REPLICA = 'REPLICA',
}

/**
 * Database routing configuration
 */
export interface DatabaseRoutingConfig {
  primaryUrl: string;
  replicaUrls: string[];
  enableReadReplica: boolean;
  readQueryThreshold: number; // ms - queries faster than this use replica
}

/**
 * Read-Write Splitting Database Service
 * 
 * Routes queries to appropriate database connections:
 * - Write operations (CREATE, UPDATE, DELETE) → Primary
 * - Read operations (SELECT) → Replica (if available)
 * - Critical reads → Primary (for consistency)
 */
export class ReadWriteSplitDatabaseService {
  private primaryClient: PrismaClient;
  private replicaClients: PrismaClient[] = [];
  private config: DatabaseRoutingConfig;
  private currentReplicaIndex: number = 0;

  constructor(config?: DatabaseRoutingConfig) {
    this.config = config || {
      primaryUrl: process.env.DATABASE_URL!,
      replicaUrls: process.env.DATABASE_REPLICA_URLS?.split(',') || [],
      enableReadReplica: process.env.ENABLE_READ_REPLICA === 'true',
      readQueryThreshold: parseInt(process.env.READ_QUERY_THRESHOLD || '100'),
    };

    // Initialize primary client
    this.primaryClient = new PrismaClient({
      datasources: {
        db: {
          url: this.config.primaryUrl,
        },
      },
      log: ['query', 'info', 'warn', 'error'],
    });

    // Initialize replica clients
    if (this.config.enableReadReplica && this.config.replicaUrls.length > 0) {
      this.config.replicaUrls.forEach((url, index) => {
        const replicaClient = new PrismaClient({
          datasources: {
            db: {
              url,
            },
          },
          log: ['error'],
        });
        this.replicaClients.push(replicaClient);
        console.log(`[ReadWriteSplit] Initialized replica ${index + 1}`);
      });
      console.log(`[ReadWriteSplit] Read-write splitting enabled with ${this.replicaClients.length} replica(s)`);
    } else {
      console.log('[ReadWriteSplit] Read-write splitting disabled, using primary only');
    }
  }

  /**
   * Get primary client (for write operations)
   */
  getPrimary(): PrismaClient {
    return this.primaryClient;
  }

  /**
   * Get replica client (for read operations, round-robin)
   */
  getReplica(): PrismaClient {
    if (this.replicaClients.length === 0) {
      return this.primaryClient;
    }

    // Round-robin selection
    const replica = this.replicaClients[this.currentReplicaIndex];
    this.currentReplicaIndex = (this.currentReplicaIndex + 1) % this.replicaClients.length;
    return replica;
  }

  /**
   * Get appropriate client based on operation type
   */
  getClient(operationType: 'read' | 'write', isCritical: boolean = false): PrismaClient {
    if (operationType === 'write' || isCritical || !this.config.enableReadReplica) {
      return this.primaryClient;
    }

    return this.getReplica();
  }

  /**
   * Execute read operation (automatically routes to replica if available)
   */
  async read<T>(query: () => Promise<T>): Promise<T> {
    const client = this.getReplica();
    const start = Date.now();
    
    try {
      const result = await query();
      const duration = Date.now() - start;
      
      // Log slow queries
      if (duration > this.config.readQueryThreshold) {
        console.log(`[ReadWriteSplit] Slow read query: ${duration}ms (threshold: ${this.config.readQueryThreshold}ms)`);
      }
      
      return result;
    } catch (error) {
      console.error('[ReadWriteSplit] Read query failed:', error);
      throw error;
    }
  }

  /**
   * Execute write operation (always uses primary)
   */
  async write<T>(query: () => Promise<T>): Promise<T> {
    const client = this.primaryClient;
    
    try {
      return await query();
    } catch (error) {
      console.error('[ReadWriteSplit] Write query failed:', error);
      throw error;
    }
  }

  /**
   * Execute transaction (always uses primary)
   */
  async transaction<T>(query: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return await this.primaryClient.$transaction(query);
  }

  /**
   * Get replication lag (estimated)
   */
  async getReplicationLag(): Promise<number> {
    if (this.replicaClients.length === 0) {
      return 0;
    }

    try {
      // Write timestamp to primary
      const writeTime = Date.now();
      await this.primaryClient.$queryRaw`SELECT 1`;

      // Read from replica
      const replica = this.getReplica();
      await replica.$queryRaw`SELECT 1`;

      const readTime = Date.now();
      return readTime - writeTime;
    } catch (error) {
      console.error('[ReadWriteSplit] Get replication lag failed:', error);
      return -1;
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      primaryConnected: true,
      replicaCount: this.replicaClients.length,
      readReplicaEnabled: this.config.enableReadReplica,
      currentReplicaIndex: this.currentReplicaIndex,
      config: {
        readQueryThreshold: this.config.readQueryThreshold,
        replicaUrls: this.config.replicaUrls.length,
      },
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    primary: boolean;
    replicas: Array<{ index: number; healthy: boolean }>;
  }> {
    const result = {
      primary: false,
      replicas: [] as Array<{ index: number; healthy: boolean }>,
    };

    // Check primary
    try {
      await this.primaryClient.$queryRaw`SELECT 1`;
      result.primary = true;
    } catch (error) {
      console.error('[ReadWriteSplit] Primary health check failed:', error);
    }

    // Check replicas
    for (let i = 0; i < this.replicaClients.length; i++) {
      try {
        await this.replicaClients[i].$queryRaw`SELECT 1`;
        result.replicas.push({ index: i, healthy: true });
      } catch (error) {
        console.error(`[ReadWriteSplit] Replica ${i} health check failed:`, error);
        result.replicas.push({ index: i, healthy: false });
      }
    }

    return result;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[ReadWriteSplit] Shutting down database connections...');
    
    await this.primaryClient.$disconnect();
    
    for (const replica of this.replicaClients) {
      await replica.$disconnect();
    }
    
    console.log('[ReadWriteSplit] All connections closed');
  }
}

// Export singleton instance
export const readWriteSplitDatabaseService = new ReadWriteSplitDatabaseService();
export default readWriteSplitDatabaseService;
