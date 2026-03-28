/**
 * Alert Rules Service Tests
 * 
 * Tests for alert rule management, evaluation, and escalation
 */

// Mock dependencies before import
jest.mock('../../services/notification.service', () => ({
  notificationService: {
    sendAlert: jest.fn().mockResolvedValue(undefined),
  },
  AlertSeverity: {
    CRITICAL: 'CRITICAL',
    WARNING: 'WARNING',
    INFO: 'INFO',
  },
  AlertType: {
    SYSTEM: 'SYSTEM',
    PERFORMANCE: 'PERFORMANCE',
    RESOURCE: 'RESOURCE',
    SECURITY: 'SECURITY',
    TASK: 'TASK',
  },
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'admin-1', email: 'admin@test.com' }]),
    },
    alert: {
      create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      count: jest.fn().mockResolvedValue(10),
      update: jest.fn().mockResolvedValue({}),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  })),
}));

import { AlertRulesService } from '../../services/alert-rules.service';
import { notificationService } from '../../services/notification.service';
import { AlertSeverity, AlertType } from '../../services/notification.service';

describe('AlertRulesService', () => {
  let alertRulesService: AlertRulesService;

  beforeEach(() => {
    jest.clearAllMocks();
    alertRulesService = new AlertRulesService();
  });

  describe('Initialization', () => {
    it('should initialize with default rules', () => {
      const rules = alertRulesService.getRules();

      expect(rules.length).toBeGreaterThan(0);
    });

    it('should have CPU critical rule', () => {
      const rules = alertRulesService.getRules();
      const cpuRule = rules.find(r => r.id === 'rule_cpu_critical');

      expect(cpuRule).toBeDefined();
      expect(cpuRule?.threshold).toBe(90);
      expect(cpuRule?.severity).toBe('CRITICAL');
    });

    it('should have memory warning rule', () => {
      const rules = alertRulesService.getRules();
      const memoryRule = rules.find(r => r.id === 'rule_memory_warning');

      expect(memoryRule).toBeDefined();
      expect(memoryRule?.threshold).toBe(80);
    });

    it('should have server offline rule', () => {
      const rules = alertRulesService.getRules();
      const offlineRule = rules.find(r => r.id === 'rule_server_offline');

      expect(offlineRule).toBeDefined();
      expect(offlineRule?.condition).toContain('OFFLINE');
    });
  });

  describe('getRules', () => {
    it('should return all rules', () => {
      const rules = alertRulesService.getRules();

      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('getRule', () => {
    it('should return specific rule by ID', () => {
      const rule = alertRulesService.getRule('rule_cpu_critical');

      expect(rule).toBeDefined();
      expect(rule?.name).toContain('CPU');
    });

    it('should return undefined for non-existent rule', () => {
      const rule = alertRulesService.getRule('nonexistent_rule');

      expect(rule).toBeUndefined();
    });
  });

  describe('upsertRule', () => {
    it('should create a new rule', () => {
      const newRule = alertRulesService.upsertRule({
        name: 'Custom Rule',
        type: 'PERFORMANCE' as any,
        severity: 'WARNING' as any,
        condition: 'custom_metric > threshold',
        threshold: 50,
        recipients: ['admin@test.com'],
      });

      expect(newRule.id).toBeDefined();
      expect(newRule.name).toBe('Custom Rule');
      expect(newRule.enabled).toBe(true);
    });

    it('should update existing rule', () => {
      const updated = alertRulesService.upsertRule({
        id: 'rule_cpu_critical',
        threshold: 95,
      });

      expect(updated.threshold).toBe(95);
    });
  });

  describe('deleteRule', () => {
    it('should delete existing rule', () => {
      const deleted = alertRulesService.deleteRule('rule_gpu_high');

      expect(deleted).toBe(true);
      expect(alertRulesService.getRule('rule_gpu_high')).toBeUndefined();
    });

    it('should return false for non-existent rule', () => {
      const deleted = alertRulesService.deleteRule('nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('toggleRule', () => {
    it('should disable a rule', () => {
      const rule = alertRulesService.toggleRule('rule_cpu_critical', false);

      expect(rule?.enabled).toBe(false);
    });

    it('should enable a rule', () => {
      alertRulesService.toggleRule('rule_cpu_critical', false);
      const rule = alertRulesService.toggleRule('rule_cpu_critical', true);

      expect(rule?.enabled).toBe(true);
    });
  });

  describe('evaluateMetrics', () => {
    it('should trigger alert for high CPU usage', async () => {
      await alertRulesService.evaluateMetrics({
        serverId: 'server-1',
        cpuUsage: 95,
      });

      expect(notificationService.sendAlert).toHaveBeenCalled();
    });

    it('should trigger alert for high memory usage', async () => {
      (notificationService.sendAlert as jest.Mock).mockClear();

      await alertRulesService.evaluateMetrics({
        serverId: 'server-1',
        memoryUsage: 85,
      });

      expect(notificationService.sendAlert).toHaveBeenCalled();
    });

    it('should trigger alert for offline server', async () => {
      (notificationService.sendAlert as jest.Mock).mockClear();

      await alertRulesService.evaluateMetrics({
        serverId: 'server-1',
        serverStatus: 'OFFLINE',
      });

      expect(notificationService.sendAlert).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return alert metrics', async () => {
      const metrics = await alertRulesService.getMetrics();

      expect(metrics).toHaveProperty('totalAlerts');
      expect(metrics).toHaveProperty('activeAlerts');
      expect(metrics).toHaveProperty('acknowledgedAlerts');
      expect(metrics).toHaveProperty('resolvedAlerts');
    });
  });

  describe('Alert Rule Properties', () => {
    it('should have all required properties', () => {
      const rules = alertRulesService.getRules();

      rules.forEach(rule => {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('type');
        expect(rule).toHaveProperty('severity');
        expect(rule).toHaveProperty('condition');
        expect(rule).toHaveProperty('threshold');
        expect(rule).toHaveProperty('enabled');
        expect(rule).toHaveProperty('recipients');
        expect(rule).toHaveProperty('createdAt');
        expect(rule).toHaveProperty('updatedAt');
      });
    });
  });
});