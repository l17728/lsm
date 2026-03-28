import React, { useState, useEffect } from 'react';
import { BellOutlined as Bell, CheckOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface Notification {
  id: string;
  type: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'READ' | 'SENT';
  createdAt: string;
}

interface NotificationStats {
  unreadCount: number;
  total: number;
}

interface NotificationCenterProps {
  userId?: string;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ unreadCount: 0, total: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const [notificationsRes, unreadRes] = await Promise.all([
        fetch('/api/notifications/list', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/notifications/unread-count', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      const notificationsData = await notificationsRes.json();
      const unreadData = await unreadRes.json();

      if (notificationsData.success) {
        setNotifications(notificationsData.data.notifications);
        setStats({
          unreadCount: unreadData.data?.count || 0,
          total: notificationsData.data.pagination?.total || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, status: 'READ' as const } : n))
        );
        setStats(prev => ({ ...prev, unreadCount: Math.max(0, prev.unreadCount - 1) }));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'READ' as const })));
        setStats(prev => ({ ...prev, unreadCount: 0 }));
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setStats(prev => ({ ...prev, total: prev.total - 1 }));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Get severity color
  const getSeverityColor = (type: string) => {
    const colors: Record<string, string> = {
      CRITICAL: 'bg-red-100 border-red-500 text-red-800',
      WARNING: 'bg-yellow-100 border-yellow-500 text-yellow-800',
      INFO: 'bg-blue-100 border-blue-500 text-blue-800',
    };
    return colors[type.toUpperCase()] || colors.INFO;
  };

  // Get time ago
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return t('datetime.justNow');
    if (diff < 3600) return t('datetime.minutesAgo', { min: Math.floor(diff / 60) });
    if (diff < 86400) return t('datetime.hoursAgo', { hour: Math.floor(diff / 3600) });
    return t('datetime.daysAgo', { day: Math.floor(diff / 86400) });
  };

  useEffect(() => {
    fetchNotifications();

    // Setup WebSocket for real-time notifications
    const socket = (window as any).socket;
    if (socket) {
      socket.on('alert', (alert: any) => {
        setNotifications(prev => [
          {
            id: alert.id || Date.now().toString(),
            type: alert.type,
            subject: alert.title,
            body: alert.message,
            status: 'PENDING',
            createdAt: alert.timestamp || new Date().toISOString(),
          },
          ...prev,
        ]);
        setStats(prev => ({ ...prev, unreadCount: prev.unreadCount + 1, total: prev.total + 1 }));
      });
    }

    return () => {
      if (socket) {
        socket.off('alert');
      }
    };
  }, []);

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => n.status === 'PENDING')
    : notifications;

  return (
    <div className="relative notification-center">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 rounded-full transition-colors"
      >
        <Bell style={{ fontSize: 24 }} />
        {stats.unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
            {stats.unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="notification-dropdown absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('notification.title')}
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">({stats.unreadCount} {t('notification.unread')})</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={markAllAsRead}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title={t('notification.markAllRead')}
              >
                <CheckOutlined style={{ fontSize: 16 }} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Bell style={{ fontSize: 16 }} />
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="notification-filter flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-4 py-2 text-sm transition-colors ${
                filter === 'all'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t('notification.all')}
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 px-4 py-2 text-sm transition-colors ${
                filter === 'unread'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t('notification.unread')}
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('common.loading')}</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t('notification.noNotifications')}</div>
            ) : (
              filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    notification.status === 'PENDING' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${getSeverityColor(
                            notification.type
                          )}`}
                        >
                          {notification.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {notification.subject}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{notification.body}</p>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      {notification.status === 'PENDING' && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                          title={t('notification.markAsRead')}
                        >
                          <CheckOutlined style={{ fontSize: 16 }} />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title={t('common.delete')}
                      >
                        <DeleteOutlined style={{ fontSize: 16 }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
            <button
              onClick={() => {/* Navigate to all notifications page */}}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              {t('notification.viewAll')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
