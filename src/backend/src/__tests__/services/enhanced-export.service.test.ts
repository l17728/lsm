/**
 * EnhancedExportService Unit Tests
 *
 * Tests for export record CRUD and data-export helpers.
 * Prisma models, ExcelJS and the file system are mocked so no real I/O occurs.
 */

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock Prisma models used by enhanced-export.service.ts
const mockExportHistory = {
  create: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  findFirst: jest.fn(),
  deleteMany: jest.fn(),
};
const mockServer = { findMany: jest.fn() };
const mockGpu = { findMany: jest.fn() };
const mockTask = { findMany: jest.fn() };

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    exportHistory: mockExportHistory,
    server: mockServer,
    gpu: mockGpu,
    task: mockTask,
  })),
}));

// Mock json2csv Parser
jest.mock('json2csv', () => ({
  Parser: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue('id,name\n1,Test'),
  })),
}));

// Mock ExcelJS so writeBuffer returns a valid Buffer
jest.mock('exceljs', () => {
  const addRow = jest.fn();
  const worksheet = {
    mergeCells: jest.fn(),
    getCell: jest.fn().mockReturnValue({ value: '', font: {}, alignment: {} }),
    addRow: addRow.mockReturnValue({ font: {} }),
    columns: [{ width: 0 }],
  };
  const workbook = {
    creator: '',
    created: new Date(),
    addWorksheet: jest.fn().mockReturnValue(worksheet),
    xlsx: { writeBuffer: jest.fn().mockResolvedValue(Buffer.from('xlsx')) },
  };
  return { default: { Workbook: jest.fn().mockImplementation(() => workbook) } };
});

// Mock fs so no real files are created
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('data')),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  unlinkSync: jest.fn(),
}));

import { EnhancedExportService } from '../../services/enhanced-export.service';

describe('EnhancedExportService', () => {
  let service: EnhancedExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EnhancedExportService();
  });

  describe('createExportRecord', () => {
    it('should create a PENDING export history record and return its id', async () => {
      mockExportHistory.create.mockResolvedValue({ id: 'export-1' });

      const id = await service.createExportRecord('user-1', 'CSV', 'SERVERS');

      expect(id).toBe('export-1');
      expect(mockExportHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: 'CSV',
            dataType: 'SERVERS',
            status: 'PENDING',
          }),
        })
      );
    });
  });

  describe('updateExportRecord', () => {
    it('should update status to COMPLETED with completedAt set', async () => {
      mockExportHistory.update.mockResolvedValue({});

      await service.updateExportRecord('export-1', {
        status: 'COMPLETED',
        recordCount: 42,
      });

      expect(mockExportHistory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'export-1' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            recordCount: 42,
            completedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('getExportHistory', () => {
    it('should return paginated records and total count', async () => {
      const mockRecords = [{ id: 'export-1' }, { id: 'export-2' }];
      mockExportHistory.findMany.mockResolvedValue(mockRecords);
      mockExportHistory.count.mockResolvedValue(2);

      const result = await service.getExportHistory('user-1');

      expect(result.records).toEqual(mockRecords);
      expect(result.total).toBe(2);
      expect(mockExportHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          skip: 0,
          take: 20,
        })
      );
    });
  });

  describe('getExportRecord', () => {
    it('should return the record when found', async () => {
      const mockRecord = { id: 'export-1', userId: 'user-1', status: 'COMPLETED' };
      mockExportHistory.findFirst.mockResolvedValue(mockRecord);

      const result = await service.getExportRecord('export-1', 'user-1');

      expect(result).toEqual(mockRecord);
      expect(mockExportHistory.findFirst).toHaveBeenCalledWith({
        where: { id: 'export-1', userId: 'user-1' },
      });
    });

    it('should return null when record is not found', async () => {
      mockExportHistory.findFirst.mockResolvedValue(null);

      const result = await service.getExportRecord('missing', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('exportToCSV', () => {
    it('should return a CSV string from the supplied data', async () => {
      const data = [{ id: '1', name: 'Server A' }];

      const result = await service.exportToCSV(data);

      expect(typeof result).toBe('string');
    });
  });

  describe('cleanupOldExports', () => {
    it('should delete DB records older than maxAgeDays', async () => {
      mockExportHistory.findMany.mockResolvedValue([
        { id: 'old-1', filePath: '/exports/old.csv' },
      ]);
      mockExportHistory.deleteMany.mockResolvedValue({ count: 1 });

      const count = await service.cleanupOldExports(7);

      expect(count).toBeGreaterThanOrEqual(0);
      expect(mockExportHistory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
    });
  });
});
