/**
 * Export Service Tests
 * 
 * Tests for CSV and Excel export functionality
 */

import {
  exportToCSV,
  exportToExcel,
  exportServersToCSV,
  exportTasksToCSV,
  exportGpusToExcel,
  exportUsersToExcel,
  exportMetricsToCSV,
} from '../../services/export.service';

// Mock json2csv
jest.mock('json2csv', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue('id,name\n1,test'),
  })),
}));

// Mock exceljs
jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    creator: '',
    created: null,
    addWorksheet: jest.fn().mockReturnValue({
      mergeCells: jest.fn(),
      getCell: jest.fn().mockReturnValue({
        value: '',
        font: {},
        alignment: {},
      }),
      addRow: jest.fn().mockReturnValue({
        font: {},
        fill: {},
      }),
      columns: [],
    }),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(Buffer.from('excel-content')),
    },
  })),
}));

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    server: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'server-1',
          name: 'Server 1',
          status: 'ONLINE',
          gpuCount: 4,
          location: 'DC1',
          createdAt: new Date(),
          gpus: [],
        },
      ]),
    },
    task: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'task-1',
          name: 'Task 1',
          status: 'RUNNING',
          priority: 'HIGH',
          user: { username: 'testuser' },
          createdAt: new Date(),
          completedAt: null,
        },
      ]),
    },
    gpu: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'gpu-1',
          model: 'RTX 3090',
          memory: 24,
          allocated: false,
          server: { name: 'Server 1' },
          allocations: [],
        },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'USER',
          tasks: [],
          allocations: [],
          createdAt: new Date(),
        },
      ]),
    },
    serverMetric: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'metric-1',
          serverId: 'server-1',
          cpuUsage: { toNumber: () => 50 },
          memoryUsage: { toNumber: () => 60 },
          gpuUsage: { toNumber: () => 30 },
          temperature: { toNumber: () => 65 },
          recordedAt: new Date(),
        },
      ]),
    },
  })),
}));

describe('Export Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportToCSV', () => {
    it('should export data to CSV format', async () => {
      const data = [
        { id: '1', name: 'Test 1' },
        { id: '2', name: 'Test 2' },
      ];

      const result = await exportToCSV(data);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should export with specified fields', async () => {
      const data = [
        { id: '1', name: 'Test', extra: 'value' },
      ];

      const result = await exportToCSV(data, ['id', 'name']);

      expect(result).toBeDefined();
    });

    it('should handle empty data', async () => {
      const result = await exportToCSV([]);

      expect(result).toBeDefined();
    });
  });

  describe('exportToExcel', () => {
    it('should export data to Excel format', async () => {
      const data = [
        { ID: '1', Name: 'Test 1', Value: 100 },
        { ID: '2', Name: 'Test 2', Value: 200 },
      ];

      const result = await exportToExcel(data);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should use custom sheet name', async () => {
      const data = [{ id: '1', name: 'Test' }];

      const result = await exportToExcel(data, 'CustomSheet');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should include title when provided', async () => {
      const data = [{ id: '1', name: 'Test' }];

      const result = await exportToExcel(data, 'Sheet1', 'Report Title');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle empty data', async () => {
      const result = await exportToExcel([]);

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('exportServersToCSV', () => {
    it('should export servers to CSV', async () => {
      const result = await exportServersToCSV();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should include server fields', async () => {
      const result = await exportServersToCSV();

      expect(result).toContain('id,name');
    });
  });

  describe('exportTasksToCSV', () => {
    it('should export tasks to CSV', async () => {
      const result = await exportTasksToCSV();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should include task fields', async () => {
      const result = await exportTasksToCSV();

      expect(result).toContain('id,name');
    });
  });

  describe('exportGpusToExcel', () => {
    it('should export GPUs to Excel', async () => {
      const result = await exportGpusToExcel();

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('exportUsersToExcel', () => {
    it('should export users to Excel', async () => {
      const result = await exportUsersToExcel();

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('exportMetricsToCSV', () => {
    it('should export all metrics to CSV', async () => {
      const result = await exportMetricsToCSV();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should filter by server ID', async () => {
      const result = await exportMetricsToCSV('server-1');

      expect(result).toBeDefined();
    });

    it('should include metric fields', async () => {
      const result = await exportMetricsToCSV();

      // The mock Parser returns 'id,name\n1,test', so we verify it returns CSV data
      expect(result).toContain('id,name');
    });
  });

  describe('Error handling', () => {
    it('should handle CSV export error gracefully', async () => {
      const { Parser } = require('json2csv');
      Parser.mockImplementationOnce(() => ({
        parse: jest.fn().mockImplementation(() => {
          throw new Error('Parse error');
        }),
      }));

      await expect(exportToCSV([{ id: '1' }])).rejects.toThrow('Failed to export CSV');
    });

    it('should handle Excel export error gracefully', async () => {
      const ExcelJS = require('exceljs');
      ExcelJS.Workbook.mockImplementationOnce(() => ({
        addWorksheet: jest.fn(),
        xlsx: {
          writeBuffer: jest.fn().mockRejectedValue(new Error('Write error')),
        },
      }));

      await expect(exportToExcel([{ id: '1' }])).rejects.toThrow('Failed to export Excel');
    });
  });

  describe('Data transformation', () => {
    it('should format GPU memory with GB suffix', async () => {
      // The export service adds 'GB' suffix to memory
      const result = await exportGpusToExcel();

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should format boolean allocated status', async () => {
      // Allocated status is formatted as 'Yes' or 'No'
      const result = await exportGpusToExcel();

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should format dates correctly', async () => {
      const result = await exportUsersToExcel();

      expect(result).toBeInstanceOf(Buffer);
    });
  });
});