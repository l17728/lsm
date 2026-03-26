/**
 * Docs Routes Integration Tests
 */

import request from 'supertest';
import express from 'express';
import docsRoutes from '../../routes/docs.routes';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  authMiddleware: (req: any, _res: any, next: any) => {
    if (!req.user) req.user = { userId: 'user-1', username: 'testuser', role: 'USER' };
    next();
  },
  AuthRequest: {},
}));

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/docs', docsRoutes);

describe('Docs Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GET / ====================

  describe('GET /api/docs', () => {
    it('should return list of available documents', async () => {
      const response = await request(app).get('/api/docs');

      expect(response.status).toBe(200);
      expect(response.body.documents).toBeDefined();
      expect(Array.isArray(response.body.documents)).toBe(true);
      expect(response.body.documents.length).toBeGreaterThan(0);
    });

    it('should include id, title, and filename in each document', async () => {
      const response = await request(app).get('/api/docs');

      expect(response.status).toBe(200);
      const doc = response.body.documents[0];
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('title');
      expect(doc).toHaveProperty('filename');
    });

    it('should include known document IDs', async () => {
      const response = await request(app).get('/api/docs');

      expect(response.status).toBe(200);
      const ids = response.body.documents.map((d: any) => d.id);
      expect(ids).toContain('user-manual');
      expect(ids).toContain('api-docs');
    });
  });

  // ==================== GET /:docId ====================

  describe('GET /api/docs/:docId', () => {
    it('should return document content when file exists', async () => {
      const mockContent = '# User Manual\nThis is the user manual.';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

      const response = await request(app).get('/api/docs/user-manual');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('user-manual');
      expect(response.body.title).toBeDefined();
      expect(response.body.content).toBe(mockContent);
    });

    it('should return 404 for unknown document ID', async () => {
      const response = await request(app).get('/api/docs/non-existent-doc');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Document not found');
    });

    it('should return 500 when file cannot be read', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const response = await request(app).get('/api/docs/api-docs');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to read document');
    });

    it('should return document content for operations-manual', async () => {
      const mockContent = '# Operations Manual\nOps guide here.';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

      const response = await request(app).get('/api/docs/operations-manual');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('operations-manual');
      expect(response.body.content).toBe(mockContent);
    });

    it('should return document content for release-notes', async () => {
      const mockContent = '# Release Notes v3.1.0';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

      const response = await request(app).get('/api/docs/release-notes');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('release-notes');
    });
  });
});
