/**
 * LSM v3.2.0 Decision Service Unit Tests
 */

import { DecisionService, decisionService } from '../decision.service';
import { DecisionCategory } from '../../../models/approval';
import { user_role as UserRole } from '@prisma/client';

describe('DecisionService', () => {
  let service: DecisionService;
  beforeEach(() => { service = new DecisionService(); });

  describe('evaluate()', () => {
    it('should auto-approve low-risk query operations', () => {
      const result = service.evaluate({
        type: 'query:status', userId: 'u1', userRole: UserRole.USER, payload: {},
      });
      expect(result.category).toBe(DecisionCategory.AUTO);
      expect(result.autoApproved).toBe(true);
      expect(result.riskScore).toBeLessThanOrEqual(2.0);
    });

    it('should require approval for permission operations', () => {
      const result = service.evaluate({
        type: 'permission:grant', userId: 'u1', userRole: UserRole.USER, payload: {},
      });
      expect(result.category).toBe(DecisionCategory.APPROVAL);
      expect(result.autoApproved).toBe(false);
    });

    it('should require notification for task delete by regular user', () => {
      const result = service.evaluate({
        type: 'task:delete', userId: 'u1', userRole: UserRole.USER, payload: {},
      });
      expect(result.requiresNotification).toBe(true);
    });

    it('should require NOTIFY for admin task operations', () => {
      const result = service.evaluate({
        type: 'task:create', userId: 'admin', userRole: UserRole.ADMIN, payload: {},
      });
      expect(result.category).toBe(DecisionCategory.NOTIFY);
    });
  });

  describe('calculateRiskFactors()', () => {
    it('should return preset factors for known operations', () => {
      const factors = service.calculateRiskFactors({
        type: 'query:status', userId: 'u1', userRole: UserRole.USER, payload: {},
      });
      expect(factors.dataImpact).toBe(1);
      expect(factors.reversibility).toBe(5);
    });

    it('should reduce reversibility for force operations', () => {
      const factors = service.calculateRiskFactors({
        type: 'resource:release', userId: 'u1', userRole: UserRole.USER, payload: {}, context: { force: true },
      });
      expect(factors.reversibility).toBeLessThan(5);
    });

    it('should increase resource impact for batch operations', () => {
      const factors = service.calculateRiskFactors({
        type: 'task:create', userId: 'u1', userRole: UserRole.USER, payload: {}, context: { batch: true },
      });
      expect(factors.resourceImpact).toBeGreaterThan(1);
    });

    it('should increase security impact when targeting others', () => {
      const factors = service.calculateRiskFactors({
        type: 'permission:grant', userId: 'u1', userRole: UserRole.USER, payload: {}, context: { targetOthers: 'u2' },
      });
      expect(factors.securityImpact).toBeGreaterThan(2);
    });
  });

  describe('calculateRiskScore()', () => {
    it('should calculate weighted average correctly', () => {
      const score = service.calculateRiskScore({
        dataImpact: 2, resourceImpact: 2, reversibility: 4, costImpact: 2, securityImpact: 2,
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(5);
    });

    it('should return higher score for higher risk factors', () => {
      const lowScore = service.calculateRiskScore({
        dataImpact: 1, resourceImpact: 1, reversibility: 5, costImpact: 1, securityImpact: 1,
      });
      const highScore = service.calculateRiskScore({
        dataImpact: 5, resourceImpact: 5, reversibility: 1, costImpact: 5, securityImpact: 5,
      });
      expect(lowScore).toBeLessThan(highScore);
    });
  });

  describe('getOperationCategory()', () => {
    it('should return AUTO for query/info/preference operations', () => {
      expect(service.getOperationCategory('query:status')).toBe(DecisionCategory.AUTO);
      expect(service.getOperationCategory('info:list')).toBe(DecisionCategory.AUTO);
      expect(service.getOperationCategory('preference:update')).toBe(DecisionCategory.AUTO);
    });

    it('should return APPROVAL for high-risk operations', () => {
      expect(service.getOperationCategory('permission:grant')).toBe(DecisionCategory.APPROVAL);
      expect(service.getOperationCategory('system:config')).toBe(DecisionCategory.APPROVAL);
      expect(service.getOperationCategory('data:delete')).toBe(DecisionCategory.APPROVAL);
    });

    it('should return NOTIFY for medium-risk operations', () => {
      expect(service.getOperationCategory('task:create')).toBe(DecisionCategory.NOTIFY);
      expect(service.getOperationCategory('reservation:update')).toBe(DecisionCategory.NOTIFY);
    });
  });

  describe('canAutoExecute()', () => {
    it('should return true for auto-approvable operations', () => {
      expect(service.canAutoExecute({
        type: 'preference:update', userId: 'u1', userRole: UserRole.USER, payload: {},
      })).toBe(true);
    });

    it('should return false for operations requiring approval', () => {
      expect(service.canAutoExecute({
        type: 'system:maintenance', userId: 'u1', userRole: UserRole.USER, payload: {},
      })).toBe(false);
    });
  });

  describe('getRiskAssessment()', () => {
    it('should return detailed risk assessment with all fields', () => {
      const assessment = service.getRiskAssessment({
        type: 'task:delete', userId: 'u1', userRole: UserRole.USER, payload: {},
      });
      expect(assessment).toHaveProperty('riskScore');
      expect(assessment).toHaveProperty('riskFactors');
      expect(assessment).toHaveProperty('breakdown');
      expect(assessment).toHaveProperty('recommendation');
    });
  });

  it('should export a singleton instance', () => {
    expect(decisionService).toBeInstanceOf(DecisionService);
  });
});