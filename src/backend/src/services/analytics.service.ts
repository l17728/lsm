import prisma from '../utils/prisma';
import { server_status as ServerStatus } from '@prisma/client';

export interface AnalyticsSummary {
  totalCost: number;
  costTrend: number;
  avgUtilization: number;
  utilizationTrend: number;
  peakResource: {
    type: string;
    value: number;
    time: string;
  };
  efficiency: number;
  savings: number;
}

export interface ResourceTrendPoint {
  time: string;
  cpu: number;
  memory: number;
  gpu: number;
  network: number;
  disk: number;
}

export interface CostBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  trend: number;
}

export interface ServerUtilization {
  serverId: string;
  serverName: string;
  cpuCores: number;
  totalMemory: number;
  cpuUsage: number;
  memoryUsage: number;
  gpuCount: number;
  gpuUsage: number | null;
  utilization: number;
  cost: number;
  efficiency: number;
}

export interface EfficiencyReport {
  overallEfficiency: number;
  serverEfficiency: Array<{
    serverId: string;
    serverName: string;
    efficiency: number;
    recommendations: string[];
  }>;
  totalSavings: number;
  potentialSavings: number;
}

// Cost rates (configurable, could be moved to database)
const COST_RATES = {
  cpuPerCoreHour: 0.05,      // $0.05 per CPU core per hour
  memoryPerGbHour: 0.01,     // $0.01 per GB memory per hour
  gpuPerHour: 2.50,          // $2.50 per GPU per hour
  storagePerGbMonth: 0.10,   // $0.10 per GB storage per month
  networkPerGb: 0.05,        // $0.05 per GB network transfer
};

// Helper to get server specs from metadata or defaults
function getServerSpecs(server: any): { cpuCores: number; totalMemory: number } {
  const metadata = server.metadata as any || {};
  return {
    cpuCores: metadata.cpuCores || 32,
    totalMemory: metadata.totalMemory || 128,
  };
}

export class AnalyticsService {
  /**
   * Get analytics summary for dashboard
   */
  async getSummary(startTime?: Date, endTime?: Date): Promise<AnalyticsSummary> {
    const servers = await prisma.server.findMany({
      include: {
        gpus: true,
        metrics: {
          where: {
            recordedAt: {
              gte: startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              lte: endTime || new Date(),
            },
          },
          orderBy: { recordedAt: 'desc' },
        },
      },
    });

    // Calculate total cost
    let totalCost = 0;
    let totalUtilization = 0;
    let peakValue = 0;
    let peakType = 'CPU';
    let peakTime = new Date().toISOString();
    let totalEfficiency = 0;

    for (const server of servers) {
      if (server.status === ServerStatus.ONLINE) {
        const specs = getServerSpecs(server);
        // Calculate hourly cost
        const cpuCost = specs.cpuCores * COST_RATES.cpuPerCoreHour * 24 * 7;
        const memoryCost = specs.totalMemory * COST_RATES.memoryPerGbHour * 24 * 7;
        const gpuCost = server.gpus.length * COST_RATES.gpuPerHour * 24 * 7;
        totalCost += cpuCost + memoryCost + gpuCost;

        // Calculate utilization
        const latestMetric = server.metrics[0];
        if (latestMetric) {
          const cpuUtil = Number(latestMetric.cpuUsage || 0);
          const memUtil = Number(latestMetric.memoryUsage || 0);
          const gpuUtil = latestMetric.gpuUsage ? Number(latestMetric.gpuUsage) : 0;
          
          const avgUtil = (cpuUtil + memUtil + (server.gpus.length > 0 ? gpuUtil : cpuUtil)) / (server.gpus.length > 0 ? 3 : 2);
          totalUtilization += avgUtil;

          // Check for peak
          if (cpuUtil > peakValue) {
            peakValue = cpuUtil;
            peakType = 'CPU';
            peakTime = latestMetric.recordedAt?.toISOString() || new Date().toISOString();
          }
          if (memUtil > peakValue) {
            peakValue = memUtil;
            peakType = 'Memory';
            peakTime = latestMetric.recordedAt?.toISOString() || new Date().toISOString();
          }
          if (gpuUtil > peakValue) {
            peakValue = gpuUtil;
            peakType = 'GPU';
            peakTime = latestMetric.recordedAt?.toISOString() || new Date().toISOString();
          }

          // Efficiency = utilization / cost ratio (normalized)
          const serverCost = cpuCost + memoryCost + gpuCost;
          const efficiency = serverCost > 0 ? (avgUtil / (serverCost / 1000)) * 100 : 0;
          totalEfficiency += Math.min(efficiency, 100);
        }
      }
    }

    const onlineCount = servers.filter(s => s.status === ServerStatus.ONLINE).length || 1;
    const avgUtilization = totalUtilization / onlineCount;
    const avgEfficiency = totalEfficiency / onlineCount;

    // Calculate savings (difference between max possible cost and actual based on utilization)
    const maxPossibleCost = servers.reduce((sum, s) => {
      if (s.status === ServerStatus.ONLINE) {
        const specs = getServerSpecs(s);
        return sum + 
          specs.cpuCores * COST_RATES.cpuPerCoreHour * 24 * 7 +
          specs.totalMemory * COST_RATES.memoryPerGbHour * 24 * 7 +
          s.gpus.length * COST_RATES.gpuPerHour * 24 * 7;
      }
      return sum;
    }, 0);
    
    const savings = maxPossibleCost * (1 - avgUtilization / 100) * 0.3; // 30% of unused resources as savings

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      costTrend: -5.2 + Math.random() * 10, // Simulated trend
      avgUtilization: Math.round(avgUtilization * 10) / 10,
      utilizationTrend: -3.5 + Math.random() * 7, // Simulated trend
      peakResource: {
        type: peakType,
        value: Math.round(peakValue * 10) / 10,
        time: peakTime,
      },
      efficiency: Math.round(avgEfficiency * 10) / 10,
      savings: Math.round(savings * 100) / 100,
    };
  }

  /**
   * Get resource usage trends over time
   */
  async getResourceTrends(startTime?: Date, endTime?: Date): Promise<ResourceTrendPoint[]> {
    const start = startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endTime || new Date();

    const metrics = await prisma.serverMetric.findMany({
      where: {
        recordedAt: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { recordedAt: 'asc' },
    });

    // Group metrics by hour
    const hourlyData = new Map<string, {
      cpu: number[];
      memory: number[];
      gpu: number[];
      network: number[];
      disk: number[];
    }>();

    for (const metric of metrics) {
      if (!metric.recordedAt) continue;
      const hourKey = new Date(metric.recordedAt).toISOString().slice(0, 13) + ':00:00.000Z';
      
      if (!hourlyData.has(hourKey)) {
        hourlyData.set(hourKey, { cpu: [], memory: [], gpu: [], network: [], disk: [] });
      }

      const data = hourlyData.get(hourKey)!;
      data.cpu.push(Number(metric.cpuUsage || 0));
      data.memory.push(Number(metric.memoryUsage || 0));
      if (metric.gpuUsage) data.gpu.push(Number(metric.gpuUsage));
      if (metric.diskUsage) data.disk.push(Number(metric.diskUsage));
      if (metric.networkIn && metric.networkOut) {
        data.network.push((Number(metric.networkIn) + Number(metric.networkOut)) / 1e9); // Convert to GB
      }
    }

    // Calculate averages for each hour
    const trends: ResourceTrendPoint[] = [];
    for (const [time, data] of hourlyData) {
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      
      trends.push({
        time: new Date(time).toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        cpu: Math.round(avg(data.cpu) * 10) / 10,
        memory: Math.round(avg(data.memory) * 10) / 10,
        gpu: Math.round(avg(data.gpu) * 10) / 10,
        network: Math.round(avg(data.network) * 10) / 10,
        disk: Math.round(avg(data.disk) * 10) / 10,
      });
    }

    return trends.length > 0 ? trends : this.generateMockTrends(start, end);
  }

  /**
   * Get cost breakdown by category
   */
  async getCostBreakdown(startTime?: Date, endTime?: Date): Promise<CostBreakdownItem[]> {
    const servers = await prisma.server.findMany({
      include: {
        gpus: true,
        metrics: {
          where: {
            recordedAt: {
              gte: startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              lte: endTime || new Date(),
            },
          },
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    let gpuCost = 0;
    let cpuCost = 0;
    let memoryCost = 0;
    let networkCost = 0;
    let storageCost = 0;

    for (const server of servers) {
      if (server.status === ServerStatus.ONLINE) {
        const specs = getServerSpecs(server);
        const hours = 7 * 24; // Weekly cost
        
        cpuCost += specs.cpuCores * COST_RATES.cpuPerCoreHour * hours;
        memoryCost += specs.totalMemory * COST_RATES.memoryPerGbHour * hours;
        gpuCost += server.gpus.length * COST_RATES.gpuPerHour * hours;
        
        // Estimate network and storage
        const metric = server.metrics[0];
        if (metric) {
          networkCost += ((Number(metric.networkIn || 0) + Number(metric.networkOut || 0)) / 1e9) * COST_RATES.networkPerGb;
        }
        storageCost += specs.totalMemory * 0.5 * COST_RATES.storagePerGbMonth / 4; // Estimate 50% storage
      }
    }

    const total = gpuCost + cpuCost + memoryCost + networkCost + storageCost;
    const otherCost = total * 0.03; // 3% for other services

    const breakdown: CostBreakdownItem[] = [
      {
        category: 'GPU Computing',
        amount: Math.round(gpuCost * 100) / 100,
        percentage: total > 0 ? Math.round((gpuCost / total) * 1000) / 10 : 0,
        trend: -5.2 + Math.random() * 10,
      },
      {
        category: 'CPU Resources',
        amount: Math.round(cpuCost * 100) / 100,
        percentage: total > 0 ? Math.round((cpuCost / total) * 1000) / 10 : 0,
        trend: -3.5 + Math.random() * 7,
      },
      {
        category: 'Memory Usage',
        amount: Math.round(memoryCost * 100) / 100,
        percentage: total > 0 ? Math.round((memoryCost / total) * 1000) / 10 : 0,
        trend: -2.0 + Math.random() * 4,
      },
      {
        category: 'Network Bandwidth',
        amount: Math.round(networkCost * 100) / 100,
        percentage: total > 0 ? Math.round((networkCost / total) * 1000) / 10 : 0,
        trend: Math.random() * 10,
      },
      {
        category: 'Storage',
        amount: Math.round(storageCost * 100) / 100,
        percentage: total > 0 ? Math.round((storageCost / total) * 1000) / 10 : 0,
        trend: -1.0 + Math.random() * 2,
      },
      {
        category: 'Other Services',
        amount: Math.round(otherCost * 100) / 100,
        percentage: total > 0 ? Math.round((otherCost / total) * 1000) / 10 : 0,
        trend: -0.5 + Math.random() * 1,
      },
    ];

    return breakdown;
  }

  /**
   * Get server utilization details
   */
  async getServerUtilization(): Promise<ServerUtilization[]> {
    const servers = await prisma.server.findMany({
      include: {
        gpus: true,
        metrics: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    const utilization: ServerUtilization[] = servers.map((server) => {
      const latestMetric = server.metrics[0];
      const specs = getServerSpecs(server);
      
      const cpuUsage = latestMetric ? Number(latestMetric.cpuUsage || 0) : 0;
      const memoryUsage = latestMetric ? Number(latestMetric.memoryUsage || 0) : 0;
      const gpuUsage = latestMetric?.gpuUsage ? Number(latestMetric.gpuUsage) : null;
      
      // Calculate overall utilization (weighted average)
      const util = server.gpus.length > 0
        ? (cpuUsage * 0.3 + memoryUsage * 0.3 + (gpuUsage || 0) * 0.4)
        : (cpuUsage * 0.5 + memoryUsage * 0.5);

      // Calculate cost
      const hours = 7 * 24;
      const cost = 
        specs.cpuCores * COST_RATES.cpuPerCoreHour * hours +
        specs.totalMemory * COST_RATES.memoryPerGbHour * hours +
        server.gpus.length * COST_RATES.gpuPerHour * hours;

      // Calculate efficiency (utilization vs cost ratio)
      const efficiency = cost > 0 ? Math.min((util / (cost / 1000)) * 100, 100) : 0;

      return {
        serverId: server.id,
        serverName: server.name,
        cpuCores: specs.cpuCores,
        totalMemory: specs.totalMemory,
        cpuUsage: Math.round(cpuUsage * 10) / 10,
        memoryUsage: Math.round(memoryUsage * 10) / 10,
        gpuCount: server.gpus.length,
        gpuUsage: gpuUsage ? Math.round(gpuUsage * 10) / 10 : null,
        utilization: Math.round(util * 10) / 10,
        cost: Math.round(cost * 100) / 100,
        efficiency: Math.round(efficiency * 10) / 10,
      };
    });

    return utilization;
  }

  /**
   * Get efficiency report with recommendations
   */
  async getEfficiencyReport(): Promise<EfficiencyReport> {
    const utilization = await this.getServerUtilization();
    
    const serverEfficiency = utilization.map((server) => {
      const recommendations: string[] = [];
      
      if (server.cpuUsage < 40) {
        recommendations.push('Low CPU usage - consider consolidating workloads');
      }
      if (server.memoryUsage < 50) {
        recommendations.push('Memory underutilized - right-size allocation');
      }
      if (server.gpuCount > 0 && server.gpuUsage !== null && server.gpuUsage < 50) {
        recommendations.push('GPU allocation may be excessive for current workload');
      }
      if (server.utilization < 50) {
        recommendations.push('Overall low utilization - review resource allocation');
      }

      return {
        serverId: server.serverId,
        serverName: server.serverName,
        efficiency: server.efficiency,
        recommendations,
      };
    });

    const overallEfficiency = utilization.reduce((sum, s) => sum + s.efficiency, 0) / (utilization.length || 1);
    const totalCost = utilization.reduce((sum, s) => sum + s.cost, 0);
    const potentialSavings = totalCost * (1 - overallEfficiency / 100) * 0.2;

    return {
      overallEfficiency: Math.round(overallEfficiency * 10) / 10,
      serverEfficiency,
      totalSavings: Math.round((totalCost * 0.1) * 100) / 100,
      potentialSavings: Math.round(potentialSavings * 100) / 100,
    };
  }

  /**
   * Generate mock trend data when no real data available
   */
  private generateMockTrends(startTime: Date, endTime: Date): ResourceTrendPoint[] {
    const trends: ResourceTrendPoint[] = [];
    const duration = endTime.getTime() - startTime.getTime();
    const hours = Math.min(Math.floor(duration / (60 * 60 * 1000)), 168); // Max 168 hours (7 days)
    
    for (let i = hours; i >= 0; i -= Math.max(1, Math.floor(hours / 48))) {
      const time = new Date(endTime.getTime() - i * 60 * 60 * 1000);
      trends.push({
        time: time.toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        cpu: Math.round((30 + Math.random() * 40) * 10) / 10,
        memory: Math.round((50 + Math.random() * 30) * 10) / 10,
        gpu: Math.round((20 + Math.random() * 60) * 10) / 10,
        network: Math.round((10 + Math.random() * 50) * 10) / 10,
        disk: Math.round((40 + Math.random() * 20) * 10) / 10,
      });
    }

    return trends;
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;