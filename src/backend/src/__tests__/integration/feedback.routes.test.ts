/**
 * Feedback Routes Integration Tests
 *
 * Tests for feedback and requirement analysis API endpoints
 */

import request from 'supertest';
import express from 'express';
import feedbackRoutes from '../../routes/feedback.routes';

// Mock feedback services
jest.mock('../../services/feedback', () => ({
  feedbackService: {
    queryFeedbacks: jest.fn(),
    createFeedback: jest.fn(),
    getFeedback: jest.fn(),
    updateStatus: jest.fn(),
  },
  requirementAnalyzerService: {
    getRequirements: jest.fn(),
    updateRequirementStatus: jest.fn(),
  },
  scheduledAnalyzerService: {
    getReports: jest.fn(),
    getReport: jest.fn(),
    triggerReport: jest.fn(),
    triggerScan: jest.fn(),
    getSummary: jest.fn(),
  },
  FeedbackType: { BUG: 'BUG', FEATURE: 'FEATURE', IMPROVEMENT: 'IMPROVEMENT' },
  FeedbackSeverity: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL' },
  FeedbackStatus: { OPEN: 'OPEN', IN_PROGRESS: 'IN_PROGRESS', RESOLVED: 'RESOLVED', CLOSED: 'CLOSED' },
  FeedbackTag: {},
  FeedbackSource: { WEB_FORM: 'WEB_FORM' },
  RequirementStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED', IMPLEMENTED: 'IMPLEMENTED' },
  RequirementPriority: { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH' },
}));

// Mock auth middleware
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) {
      req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    }
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => {
    if (req.user?.role === 'ADMIN') next();
    else res.status(403).json({ success: false, error: 'Admin access required' });
  },
  requireManager: (req: any, res: any, next: any) => {
    if (['ADMIN', 'MANAGER'].includes(req.user?.role)) next();
    else res.status(403).json({ success: false, error: 'Manager access required' });
  },
  AuthRequest: {},
}));

// Mock logging middleware
jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// App with USER role (default)
const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);

// App with ADMIN role
const adminApp = express();
adminApp.use(express.json());
adminApp.use((req: any, _res: any, next: any) => {
  req.user = { userId: 'admin-1', username: 'admin', role: 'ADMIN' };
  next();
});
adminApp.use('/api/feedback', feedbackRoutes);

// Import the mocked services for assertions
import {
  feedbackService,
  requirementAnalyzerService,
  scheduledAnalyzerService,
} from '../../services/feedback';

describe('Feedback Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET /issues ====================

  describe('GET /api/feedback/issues', () => {
    it('should return feedback issues list', async () => {
      (feedbackService.queryFeedbacks as jest.Mock).mockResolvedValue({ feedbacks: [], total: 0 });

      const response = await request(app).get('/api/feedback/issues');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination).toHaveProperty('total', 0);
    });
  });

  // ==================== POST /issues ====================

  describe('POST /api/feedback/issues', () => {
    it('should create a new feedback issue with valid data', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        type: 'BUG',
        title: 'Test',
        description: 'Test description',
        status: 'OPEN',
      };
      (feedbackService.createFeedback as jest.Mock).mockResolvedValue(mockFeedback);

      const response = await request(app)
        .post('/api/feedback/issues')
        .send({ type: 'BUG', title: 'Test', description: 'Test description' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockFeedback);
      expect(response.body.message).toBe('Feedback created successfully');
    });
  });

  // ==================== GET /issues/:id ====================

  describe('GET /api/feedback/issues/:id', () => {
    it('should return 404 when feedback is not found', async () => {
      (feedbackService.getFeedback as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/api/feedback/issues/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Feedback not found');
    });
  });

  // ==================== GET /requirements ====================

  describe('GET /api/feedback/requirements', () => {
    it('should return requirements list', async () => {
      (requirementAnalyzerService.getRequirements as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/api/feedback/requirements');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });

  // ==================== GET /stats ====================

  describe('GET /api/feedback/stats', () => {
    it('should return feedback statistics', async () => {
      const mockSummary = { totalFeedbacks: 10, openIssues: 5, resolvedIssues: 3 };
      (scheduledAnalyzerService.getSummary as jest.Mock).mockResolvedValue(mockSummary);

      const response = await request(app).get('/api/feedback/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSummary);
    });
  });

  // ==================== POST /reports/generate ====================

  describe('POST /api/feedback/reports/generate', () => {
    it('should return 403 for non-admin users', async () => {
      const response = await request(app).post('/api/feedback/reports/generate');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Admin access required');
    });

    it('should generate report successfully for admin', async () => {
      const mockReport = {
        id: 'report-1',
        createdAt: new Date().toISOString(),
        report: { summary: 'Analysis complete', issues: [], recommendations: [] },
      };
      (scheduledAnalyzerService.triggerReport as jest.Mock).mockResolvedValue(mockReport);

      const response = await request(adminApp).post('/api/feedback/reports/generate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockReport);
      expect(response.body.message).toBe('Report generated successfully');
    });
  });
});
