import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';

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
 * Export data to Excel using exceljs (secure alternative to xlsx)
 */
export async function exportToExcel<T>(
  data: T[],
  sheetName: string = 'Sheet1',
  title?: string
): Promise<Buffer> {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LSM System';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet(sheetName);
    
    if (data.length === 0) {
      return await workbook.xlsx.writeBuffer();
    }
    
    // Add title if provided
    if (title) {
      worksheet.mergeCells('A1', `${String.fromCharCode(65 + Object.keys(data[0]).length - 1)}1`);
      const titleCell = worksheet.getCell('A1');
      titleCell.value = title;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'center' };
    }
    
    // Add headers
    const headers = Object.keys(data[0]);
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data rows
    data.forEach((item: any) => {
      const row = headers.map(header => item[header]);
      worksheet.addRow(row);
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 20;
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
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
    ID: gpu.id,
    Model: gpu.model,
    Memory: `${gpu.memory}GB`,
    Allocated: gpu.allocated ? 'Yes' : 'No',
    Server: gpu.server.name,
    Allocations: gpu.allocations.length,
  }));

  return exportToExcel(data, 'GPUs', 'GPU Resource Report');
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
    ID: user.id,
    Username: user.username,
    Email: user.email,
    Role: user.role,
    Tasks: user.tasks.length,
    Allocations: user.allocations.length,
    Created: user.createdAt.toISOString().split('T')[0],
  }));

  return exportToExcel(data, 'Users', 'User Management Report');
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
