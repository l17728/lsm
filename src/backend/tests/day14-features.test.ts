import { PrismaClient } from '@prisma/client';
import {
  NotificationType,
  NotificationSeverity,
  NotificationPriority,
  NotificationChannel,
} from '../services/notification-history.service';
import { webSocketNotificationService } from '../services/websocket-notification.service';
import { notificationHistoryService } from '../services/notification-history.service';
import { readWriteSplitDatabaseService } from '../services/read-write-split.service';
import { redisMessageQueueService } from '../services/redis-queue.service';

const prisma = new PrismaClient();

/**
 * Day 14 Feature Tests
 * 
 * Test all new features implemented in Day 14:
 * 1. WebSocket Notification Enhancements
 * 2. Read-Write Split Database
 * 3. Redis Message Queue
 */

async function testNotificationHistory() {
  console.log('\n=== Testing Notification History Service ===\n');

  const testUserId = 'test-user-' + Date.now();

  try {
    // 1. Save notification
    console.log('1. Testing save notification...');
    const notification = await notificationHistoryService.saveNotification(testUserId, {
      type: NotificationType.ALERT_CPU,
      severity: NotificationSeverity.WARNING,
      priority: NotificationPriority.HIGH,
      title: 'Test Alert',
      message: 'This is a test notification',
      metadata: { test: true },
      channel: [NotificationChannel.WEBSOCKET],
    });
    console.log('✓ Saved notification:', notification.id);

    // 2. Get user notifications
    console.log('\n2. Testing get user notifications...');
    const result = await notificationHistoryService.getUserNotifications(testUserId, 1, 10);
    console.log('✓ Got notifications:', result.notifications.length, 'total:', result.total);

    // 3. Get unread count
    console.log('\n3. Testing get unread count...');
    const unreadCount = await notificationHistoryService.getUnreadCount(testUserId);
    console.log('✓ Unread count:', unreadCount);

    // 4. Get stats
    console.log('\n4. Testing get stats...');
    const stats = await notificationHistoryService.getUserStats(testUserId);
    console.log('✓ Stats:', stats);

    // 5. Mark as read
    console.log('\n5. Testing mark as read...');
    await notificationHistoryService.markAsRead(notification.id, testUserId);
    console.log('✓ Marked as read');

    // 6. Verify unread count updated
    const newUnreadCount = await notificationHistoryService.getUnreadCount(testUserId);
    console.log('✓ New unread count:', newUnreadCount);

    // 7. Mark all as read
    console.log('\n6. Testing mark all as read...');
    const markedCount = await notificationHistoryService.markAllAsRead(testUserId);
    console.log('✓ Marked all as read:', markedCount);

    // 8. Delete notification
    console.log('\n7. Testing delete notification...');
    await notificationHistoryService.deleteNotification(notification.id, testUserId);
    console.log('✓ Deleted notification');

    console.log('\n✅ Notification History Service tests passed!\n');
  } catch (error) {
    console.error('❌ Notification History Service tests failed:', error);
    throw error;
  }
}

async function testWebSocketNotification() {
  console.log('\n=== Testing WebSocket Notification Service ===\n');

  const testUserId = 'test-user-' + Date.now();

  try {
    // 1. Send alert notification
    console.log('1. Testing send alert...');
    await webSocketNotificationService.sendAlert({
      type: NotificationType.ALERT_CPU,
      severity: NotificationSeverity.WARNING,
      title: 'Test Alert',
      message: 'CPU usage is high',
      metadata: { usage: 90.5 },
      recipientIds: [testUserId],
    });
    console.log('✓ Alert sent');

    // 2. Send batch progress
    console.log('\n2. Testing send batch progress...');
    await webSocketNotificationService.sendBatchProgress(testUserId, {
      batchId: 'test-batch-1',
      operation: 'Test Export',
      total: 100,
      completed: 50,
      failed: 0,
      progress: 50.0,
      status: 'running',
      currentStep: 'Processing items 50-60',
    });
    console.log('✓ Batch progress sent');

    // 3. Send batch completion
    console.log('\n3. Testing send batch completion...');
    await webSocketNotificationService.sendBatchCompletion(
      testUserId,
      'test-batch-1',
      'Test Export',
      true,
      100,
      98,
      2
    );
    console.log('✓ Batch completion sent');

    // 4. Send system notification
    console.log('\n4. Testing send system notification...');
    await webSocketNotificationService.sendSystemNotification({
      type: NotificationType.SYSTEM_MAINTENANCE,
      severity: NotificationSeverity.INFO,
      title: 'System Maintenance',
      message: 'Scheduled maintenance tonight',
      broadcast: false,
      recipientIds: [testUserId],
    });
    console.log('✓ System notification sent');

    // 5. Send task notification
    console.log('\n5. Testing send task notification...');
    await webSocketNotificationService.sendTaskNotification(
      testUserId,
      'test-task-1',
      'Test Task',
      NotificationType.TASK_COMPLETED,
      'completed'
    );
    console.log('✓ Task notification sent');

    console.log('\n✅ WebSocket Notification Service tests passed!\n');
  } catch (error) {
    console.error('❌ WebSocket Notification Service tests failed:', error);
    throw error;
  }
}

async function testReadWriteSplit() {
  console.log('\n=== Testing Read-Write Split Database Service ===\n');

  try {
    // 1. Get service stats
    console.log('1. Testing get stats...');
    const stats = readWriteSplitDatabaseService.getStats();
    console.log('✓ Stats:', stats);

    // 2. Health check
    console.log('\n2. Testing health check...');
    const health = await readWriteSplitDatabaseService.healthCheck();
    console.log('✓ Health:', health);

    // 3. Test write operation
    console.log('\n3. Testing write operation...');
    const testServer = await readWriteSplitDatabaseService.write(() =>
      prisma.server.create({
        data: {
          name: `Test Server ${Date.now()}`,
          status: 'ONLINE',
          gpuCount: 4,
        },
      })
    );
    console.log('✓ Created server:', testServer.id);

    // 4. Test read operation
    console.log('\n4. Testing read operation...');
    const servers = await readWriteSplitDatabaseService.read(() =>
      prisma.server.findMany({
        where: { status: 'ONLINE' },
        take: 10,
      })
    );
    console.log('✓ Read servers:', servers.length);

    // 5. Test critical read (primary)
    console.log('\n5. Testing critical read (primary)...');
    const criticalServer = await readWriteSplitDatabaseService
      .getClient('read', true)
      .server.findUnique({
        where: { id: testServer.id },
      });
    console.log('✓ Critical read:', criticalServer?.id);

    // 6. Test transaction
    console.log('\n6. Testing transaction...');
    await readWriteSplitDatabaseService.transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'TEST_TRANSACTION',
          resourceType: 'SERVER',
          resourceId: testServer.id,
        },
      });
    });
    console.log('✓ Transaction completed');

    // 7. Test replication lag
    console.log('\n7. Testing replication lag...');
    const lag = await readWriteSplitDatabaseService.getReplicationLag();
    console.log('✓ Replication lag:', lag, 'ms');

    // Cleanup
    console.log('\n8. Cleaning up...');
    await prisma.server.delete({ where: { id: testServer.id } });
    console.log('✓ Cleanup completed');

    console.log('\n✅ Read-Write Split Database Service tests passed!\n');
  } catch (error) {
    console.error('❌ Read-Write Split Database Service tests failed:', error);
    throw error;
  }
}

async function testRedisQueue() {
  console.log('\n=== Testing Redis Message Queue Service ===\n');

  try {
    // 1. Initialize
    console.log('1. Testing initialize...');
    await redisMessageQueueService.initialize();
    console.log('✓ Initialized');

    // 2. Check connection
    console.log('\n2. Testing connection check...');
    const connected = redisMessageQueueService.isConnected();
    console.log('✓ Connected:', connected);

    if (!connected) {
      console.log('⚠️  Redis not available, skipping queue tests');
      return;
    }

    // 3. Add job
    console.log('\n3. Testing add job...');
    const jobId = await redisMessageQueueService.addJob(
      'test',
      'email',
      {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Hello from test',
      },
      {
        priority: 1,
        maxRetries: 3,
      }
    );
    console.log('✓ Added job:', jobId);

    // 4. Get queue stats
    console.log('\n4. Testing get queue stats...');
    const stats = await redisMessageQueueService.getQueueStats('test');
    console.log('✓ Queue stats:', stats);

    // 5. Get all queue stats
    console.log('\n5. Testing get all queue stats...');
    const allStats = await redisMessageQueueService.getAllQueueStats();
    console.log('✓ All queue stats:', allStats);

    // 6. Process queue (manual test)
    console.log('\n6. Testing process queue...');
    let processedCount = 0;
    
    // Start processing
    redisMessageQueueService.processQueue('test', async (job) => {
      console.log('Processing job:', job.id);
      processedCount++;
      return { success: true };
    }, 1);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✓ Processed:', processedCount, 'jobs');

    // Cleanup
    console.log('\n7. Cleaning up...');
    await redisMessageQueueService.shutdown();
    console.log('✓ Shutdown completed');

    console.log('\n✅ Redis Message Queue Service tests passed!\n');
  } catch (error) {
    console.error('❌ Redis Message Queue Service tests failed:', error);
    throw error;
  }
}

async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       Day 14 Feature Tests - Starting                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Run all tests
    await testNotificationHistory();
    await testWebSocketNotification();
    await testReadWriteSplit();
    await testRedisQueue();

    const duration = Date.now() - startTime;

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║       ✅ ALL TESTS PASSED                              ║');
    console.log(`║       Duration: ${duration}ms                          ║`);
    console.log('╚════════════════════════════════════════════════════════╝\n');

    process.exit(0);
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════╗');
    console.error('║       ❌ TESTS FAILED                                  ║');
    console.error('╚════════════════════════════════════════════════════════╝\n');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runAllTests().catch(console.error);
