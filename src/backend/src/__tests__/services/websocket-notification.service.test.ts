import { WebSocketNotificationService } from '../../services/websocket-notification.service';
import {
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
} from '../../services/notification-history.service';

jest.mock('../../middleware/logging.middleware', () => ({
  safeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock notification-history.service so we don't hit the DB
jest.mock('../../services/notification-history.service', () => {
  const NotificationSeverity = {
    CRITICAL: 'CRITICAL',
    WARNING: 'WARNING',
    INFO: 'INFO',
    SUCCESS: 'SUCCESS',
  };
  const NotificationType = {
    ALERT_CPU: 'ALERT_CPU',
    ALERT_MEMORY: 'ALERT_MEMORY',
    ALERT_GPU: 'ALERT_GPU',
    ALERT_TEMP: 'ALERT_TEMP',
    ALERT_SERVER_OFFLINE: 'ALERT_SERVER_OFFLINE',
    TASK_CREATED: 'TASK_CREATED',
    TASK_STARTED: 'TASK_STARTED',
    TASK_COMPLETED: 'TASK_COMPLETED',
    TASK_FAILED: 'TASK_FAILED',
    TASK_CANCELLED: 'TASK_CANCELLED',
    SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
    SYSTEM_UPDATE: 'SYSTEM_UPDATE',
    SYSTEM_RESTART: 'SYSTEM_RESTART',
    BATCH_STARTED: 'BATCH_STARTED',
    BATCH_PROGRESS: 'BATCH_PROGRESS',
    BATCH_COMPLETED: 'BATCH_COMPLETED',
    BATCH_FAILED: 'BATCH_FAILED',
  };
  const NotificationPriority = {
    URGENT: 'URGENT',
    HIGH: 'HIGH',
    NORMAL: 'NORMAL',
    LOW: 'LOW',
  };
  const NotificationChannel = {
    WEBSOCKET: 'WEBSOCKET',
    EMAIL: 'EMAIL',
    SYSTEM: 'SYSTEM',
  };
  const notificationHistoryService = {
    saveNotification: jest.fn().mockResolvedValue(undefined),
  };
  return { NotificationSeverity, NotificationType, NotificationPriority, NotificationChannel, notificationHistoryService };
});

const makeSocketIo = () => {
  const mockEmit = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
  return {
    io: { to: mockTo, emit: mockEmit } as any,
    mockTo,
    mockEmit,
  };
};

describe('WebSocketNotificationService', () => {
  let service: WebSocketNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebSocketNotificationService();
  });

  it('should broadcast alert to all clients when no recipientIds provided', async () => {
    const { io, mockEmit } = makeSocketIo();
    service.initialize(io);

    await service.sendAlert({
      type: NotificationType.ALERT_CPU,
      severity: NotificationSeverity.WARNING,
      title: 'High CPU',
      message: 'CPU usage above 90%',
    });

    expect(mockEmit).toHaveBeenCalledWith('notification:alert', expect.objectContaining({
      type: NotificationType.ALERT_CPU,
      severity: NotificationSeverity.WARNING,
      title: 'High CPU',
      isRead: false,
    }));
  });

  it('should send alert to specific users when recipientIds are provided', async () => {
    const { io, mockTo, mockEmit } = makeSocketIo();
    service.initialize(io);

    await service.sendAlert({
      type: NotificationType.ALERT_GPU,
      severity: NotificationSeverity.CRITICAL,
      title: 'GPU Overheat',
      message: 'GPU temperature critical',
      recipientIds: ['user-1', 'user-2'],
    });

    expect(mockTo).toHaveBeenCalledWith('user:user-1');
    expect(mockTo).toHaveBeenCalledWith('user:user-2');
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });

  it('should send batch progress to specific user', async () => {
    const { io, mockTo, mockEmit } = makeSocketIo();
    service.initialize(io);

    await service.sendBatchProgress('user-1', {
      batchId: 'batch-abc',
      operation: 'GPU Batch Reset',
      total: 10,
      completed: 5,
      failed: 0,
      progress: 50.0,
      status: 'running',
    });

    expect(mockTo).toHaveBeenCalledWith('user:user-1');
    expect(mockEmit).toHaveBeenCalledWith('notification:batch', expect.objectContaining({
      type: NotificationType.BATCH_PROGRESS,
      metadata: expect.objectContaining({ batchId: 'batch-abc', progress: 50.0 }),
    }));
  });

  it('should send task notification with correct severity and event name', async () => {
    const { io, mockTo, mockEmit } = makeSocketIo();
    service.initialize(io);

    await service.sendTaskNotification(
      'user-1',
      'task-99',
      'My Task',
      NotificationType.TASK_COMPLETED,
      'completed'
    );

    expect(mockTo).toHaveBeenCalledWith('user:user-1');
    expect(mockEmit).toHaveBeenCalledWith('notification:task', expect.objectContaining({
      type: NotificationType.TASK_COMPLETED,
      severity: NotificationSeverity.SUCCESS,
      metadata: expect.objectContaining({ taskId: 'task-99', taskName: 'My Task' }),
    }));
  });

  it('should queue and then process notifications', async () => {
    const { io, mockTo, mockEmit } = makeSocketIo();
    service.initialize(io);

    service.queueNotification('user-3', {
      type: NotificationType.SYSTEM_MAINTENANCE,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.NORMAL,
      title: 'Maintenance',
      message: 'Scheduled maintenance at 02:00',
      channels: [],
    });

    expect(service.getQueueSize()).toBe(1);

    await service.processQueue();

    expect(service.getQueueSize()).toBe(0);
    // sendAlert routes to specific user when recipientIds set
    expect(mockTo).toHaveBeenCalledWith('user:user-3');
  });

  it('should clear the notification queue', () => {
    service.queueNotification('user-4', {
      type: NotificationType.SYSTEM_UPDATE,
      severity: NotificationSeverity.INFO,
      priority: NotificationPriority.LOW,
      title: 'Update',
      message: 'System updated',
      channels: [],
    });

    expect(service.getQueueSize()).toBe(1);
    service.clearQueue();
    expect(service.getQueueSize()).toBe(0);
  });
});
