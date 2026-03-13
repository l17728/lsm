import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

/**
 * Export data to CSV
 */
export async function exportToCSV<T>(
  data: T[],
  fields?: string[]
): Promise<string> {
  try {
    const parser = new Parser({ fields });
    const csv = parser.parse(data);
    return csv;
  } catch (error) {
    console.error('[Export] CSV export error:', error);
    throw new Error('Failed to export CSV');
  }
}

/**
 * Export data to Excel
 */
export async function exportToExcel<T>(
  data: T[],
  sheetName: string = 'Sheet1'
): Promise<Buffer> {
  try {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  } catch (error) {
    console.error('[Export] Excel export error:', error);
    throw new Error('Failed to export Excel');
  }
}

/**
 * Export servers to CSV
 */
export async function exportServersToCSV(): Promise<string> {
  const servers = await prisma.server.findMany({
    include: {
      gpus: true,
    },
  });

  const data = servers.map((server) => ({
    id: server.id,
    name: server.name,
    status: server.status,
    gpuCount: server.gpuCount,
    location: server.location,
    createdAt: server.createdAt.toISOString(),
  }));

  return exportToCSV(data, ['id', 'name', 'status', 'gpuCount', 'location', 'createdAt']);
}

/**
 * Export tasks to CSV
 */
export async function exportTasksToCSV(): Promise<string> {
  const tasks = await prisma.task.findMany({
    include: {
      user: true,
    },
  });

  const data = tasks.map((task) => ({
    id: task.id,
    name: task.name,
    status: task.status,
    priority: task.priority,
    userName: task.user.username,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt?.toISOString() || 'N/A',
  }));

  return exportToCSV(data, ['id', 'name', 'status', 'priority', 'userName', 'createdAt', 'completedAt']);
}

/**
 * Export GPUs to Excel
 */
export async function exportGpusToExcel(): Promise<Buffer> {
  const gpus = await prisma.gpu.findMany({
    include: {
      server: true,
      allocations: true,
    },
  });

  const data = gpus.map((gpu) => ({
    id: gpu.id,
    model: gpu.model,
    memory: gpu.memory,
    allocated: gpu.allocated,
    serverName: gpu.server.name,
    allocationCount: gpu.allocations.length,
  }));

  return exportToExcel(data, 'GPUs');
}

/**
 * Export users to Excel
 */
export async function exportUsersToExcel(): Promise<Buffer> {
  const users = await prisma.user.findMany({
    include: {
      tasks: true,
      allocations: true,
    },
  });

  const data = users.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    taskCount: user.tasks.length,
    allocationCount: user.allocations.length,
    createdAt: user.createdAt.toISOString(),
  }));

  return exportToExcel(data, 'Users');
}

/**
 * Export metrics to CSV
 */
export async function exportMetricsToCSV(serverId?: string): Promise<string> {
  const where = serverId ? { serverId } : {};
  
  const metrics = await prisma.serverMetric.findMany({
    where,
    orderBy: { recordedAt: 'desc' },
    take: 1000,
  });

  const data = metrics.map((metric) => ({
    id: metric.id,
    serverId: metric.serverId,
    cpuUsage: metric.cpuUsage?.toNumber() || 0,
    memoryUsage: metric.memoryUsage?.toNumber() || 0,
    gpuUsage: metric.gpuUsage?.toNumber() || 0,
    temperature: metric.temperature?.toNumber() || 0,
    recordedAt: metric.recordedAt.toISOString(),
  }));

  return exportToCSV(data, ['id', 'serverId', 'cpuUsage', 'memoryUsage', 'gpuUsage', 'temperature', 'recordedAt']);
}
