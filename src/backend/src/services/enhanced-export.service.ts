import { PrismaClient } from '@prisma/client';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export interface ExportRecord {
  id: string;
  userId: string;
  type: 'CSV' | 'EXCEL' | 'PDF';
  dataType: 'SERVERS' | 'GPUS' | 'TASKS' | 'USERS' | 'METRICS';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  filePath?: string;
  fileSize?: number;
  recordCount?: number;
  filters?: any;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

/**
 * Enhanced Export Service with History Tracking
 */
export class EnhancedExportService {
  private exportDir: string;

  constructor() {
    this.exportDir = process.env.EXPORT_DIR || path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  /**
   * Ensure export directory exists
   */
  private ensureExportDir() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Create export record
   */
  async createExportRecord(
    userId: string,
    type: 'CSV' | 'EXCEL' | 'PDF',
    dataType: 'SERVERS' | 'GPUS' | 'TASKS' | 'USERS' | 'METRICS',
    filters?: any
  ): Promise<string> {
    const record = await prisma.exportHistory.create({
      data: {
        userId,
        type,
        dataType,
        status: 'PENDING',
        filters: filters || {},
      },
    });

    return record.id;
  }

  /**
   * Update export record status
   */
  async updateExportRecord(
    id: string,
    updates: Partial<{
      status: 'PENDING' | 'COMPLETED' | 'FAILED';
      filePath: string;
      fileSize: number;
      recordCount: number;
      errorMessage: string;
    }>
  ): Promise<void> {
    await prisma.exportHistory.update({
      where: { id },
      data: {
        ...updates,
        completedAt: updates.status !== 'PENDING' ? new Date() : undefined,
      },
    });
  }

  /**
   * Get user's export history
   */
  async getExportHistory(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ records: ExportRecord[]; total: number }> {
    const [records, total] = await Promise.all([
      prisma.exportHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.exportHistory.count({ where: { userId } }),
    ]);

    return { records, total };
  }

  /**
   * Get export record by ID
   */
  async getExportRecord(id: string, userId: string): Promise<ExportRecord | null> {
    return prisma.exportHistory.findFirst({
      where: { id, userId },
    });
  }

  /**
   * Export data to CSV
   */
  async exportToCSV<T>(data: T[], fields?: string[]): Promise<string> {
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
   * Export data to Excel using exceljs
   */
  async exportToExcel<T>(
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
        const buf = await workbook.xlsx.writeBuffer();
        return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
      }

      // Add title if provided
      if (title) {
        const lastCol = String.fromCharCode(65 + Math.min(Object.keys(data[0]).length - 1, 25));
        worksheet.mergeCells('A1', `${lastCol}1`);
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
        fgColor: { argb: 'FFE0E0E0' },
      };

      // Add data rows
      data.forEach((item: any) => {
        const row = headers.map((header) => item[header]);
        worksheet.addRow(row);
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        column.width = 20;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer as ArrayBuffer);
    } catch (error) {
      console.error('[Export] Excel export error:', error);
      throw new Error('Failed to export Excel');
    }
  }

  /**
   * Export servers with filters
   */
  async exportServers(userId: string, format: 'CSV' | 'EXCEL', filters?: any): Promise<{
    id: string;
    data: string | Buffer;
    filename: string;
  }> {
    const recordId = await this.createExportRecord(userId, format, 'SERVERS', filters);

    try {
      const where: any = {};
      if (filters?.status) where.status = filters.status;
      if (filters?.location) where.location = filters.location;

      const servers = await prisma.server.findMany({
        where,
        include: { gpus: true },
      });

      const data = servers.map((server) => ({
        ID: server.id,
        Name: server.name,
        Status: server.status,
        GPU_Count: server.gpuCount,
        Location: server.location,
        Created_At: server.createdAt.toISOString(),
      }));

      let exportData: string | Buffer;
      let filename: string;

      if (format === 'CSV') {
        exportData = await this.exportToCSV(data);
        filename = `servers_${Date.now()}.csv`;
      } else {
        exportData = await this.exportToExcel(data, 'Servers', 'Server Resource Report');
        filename = `servers_${Date.now()}.xlsx`;
      }

      // Save file
      const filePath = path.join(this.exportDir, filename);
      fs.writeFileSync(filePath, exportData);

      // Update record
      await this.updateExportRecord(recordId, {
        status: 'COMPLETED',
        filePath,
        fileSize: fs.statSync(filePath).size,
        recordCount: data.length,
      });

      return { id: recordId, data: exportData, filename };
    } catch (error: any) {
      await this.updateExportRecord(recordId, {
        status: 'FAILED',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Export GPUs with filters
   */
  async exportGpus(userId: string, format: 'CSV' | 'EXCEL', filters?: any): Promise<{
    id: string;
    data: string | Buffer;
    filename: string;
  }> {
    const recordId = await this.createExportRecord(userId, format, 'GPUS', filters);

    try {
      const where: any = {};
      if (filters?.allocated !== undefined) where.allocated = filters.allocated;
      if (filters?.model) where.model = filters.model;

      const gpus = await prisma.gpu.findMany({
        where,
        include: { server: true, allocations: true },
      });

      const data = gpus.map((gpu) => ({
        ID: gpu.id,
        Model: gpu.model,
        Memory_GB: gpu.memory,
        Allocated: gpu.allocated ? 'Yes' : 'No',
        Server_Name: gpu.server.name,
        Server_ID: gpu.serverId,
        Allocations_Count: gpu.allocations.length,
      }));

      let exportData: string | Buffer;
      let filename: string;

      if (format === 'CSV') {
        exportData = await this.exportToCSV(data);
        filename = `gpus_${Date.now()}.csv`;
      } else {
        exportData = await this.exportToExcel(data, 'GPUs', 'GPU Resource Report');
        filename = `gpus_${Date.now()}.xlsx`;
      }

      // Save file
      const filePath = path.join(this.exportDir, filename);
      fs.writeFileSync(filePath, exportData);

      // Update record
      await this.updateExportRecord(recordId, {
        status: 'COMPLETED',
        filePath,
        fileSize: fs.statSync(filePath).size,
        recordCount: data.length,
      });

      return { id: recordId, data: exportData, filename };
    } catch (error: any) {
      await this.updateExportRecord(recordId, {
        status: 'FAILED',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Export tasks with filters
   */
  async exportTasks(userId: string, format: 'CSV' | 'EXCEL', filters?: any): Promise<{
    id: string;
    data: string | Buffer;
    filename: string;
  }> {
    const recordId = await this.createExportRecord(userId, format, 'TASKS', filters);

    try {
      const where: any = {};
      if (filters?.status) where.status = filters.status;
      if (filters?.priority) where.priority = filters.priority;
      if (filters?.userId) where.userId = filters.userId;

      const tasks = await prisma.task.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      });

      const data = tasks.map((task) => ({
        ID: task.id,
        Name: task.name,
        Status: task.status,
        Priority: task.priority,
        User_Name: task.user.username,
        User_ID: task.userId,
        Created_At: task.createdAt.toISOString(),
        Completed_At: task.completedAt?.toISOString() || 'N/A',
      }));

      let exportData: string | Buffer;
      let filename: string;

      if (format === 'CSV') {
        exportData = await this.exportToCSV(data);
        filename = `tasks_${Date.now()}.csv`;
      } else {
        exportData = await this.exportToExcel(data, 'Tasks', 'Task Management Report');
        filename = `tasks_${Date.now()}.xlsx`;
      }

      // Save file
      const filePath = path.join(this.exportDir, filename);
      fs.writeFileSync(filePath, exportData);

      // Update record
      await this.updateExportRecord(recordId, {
        status: 'COMPLETED',
        filePath,
        fileSize: fs.statSync(filePath).size,
        recordCount: data.length,
      });

      return { id: recordId, data: exportData, filename };
    } catch (error: any) {
      await this.updateExportRecord(recordId, {
        status: 'FAILED',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Download export file
   */
  async downloadFile(recordId: string, userId: string): Promise<{
    filename: string;
    data: Buffer;
    contentType: string;
  }> {
    const record = await this.getExportRecord(recordId, userId);

    if (!record) {
      throw new Error('Export record not found');
    }

    if (record.status !== 'COMPLETED' || !record.filePath) {
      throw new Error('Export file not available');
    }

    if (!fs.existsSync(record.filePath)) {
      throw new Error('Export file not found on disk');
    }

    const data = fs.readFileSync(record.filePath);
    const filename = path.basename(record.filePath);
    const contentType = record.type === 'CSV' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return { filename, data, contentType };
  }

  /**
   * Cleanup old export files (older than 7 days)
   */
  async cleanupOldExports(maxAgeDays = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const oldRecords = await prisma.exportHistory.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        filePath: { not: null },
      },
    });

    let deletedCount = 0;

    for (const record of oldRecords) {
      if (record.filePath && fs.existsSync(record.filePath)) {
        fs.unlinkSync(record.filePath);
        deletedCount++;
      }
    }

    // Delete database records
    await prisma.exportHistory.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    console.log(`[Export] Cleaned up ${deletedCount} old export files`);
    return deletedCount;
  }
}

// Export singleton instance
export const enhancedExportService = new EnhancedExportService();
export default enhancedExportService;
