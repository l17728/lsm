import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Settings, BellOff } from 'lucide-react';

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

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
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
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      >
        <Bell className="w-6 h-6" />
        {stats.unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
            {stats.unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              通知中心
              <span className="ml-2 text-sm text-gray-500">({stats.unreadCount} 未读)</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={markAllAsRead}
                className="p-1 text-gray-500 hover:text-gray-700"
                title="全部标记为已读"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <BellOff className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-4 py-2 text-sm ${
                filter === 'all'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 px-4 py-2 text-sm ${
                filter === 'unread'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              未读
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">加载中...</div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">暂无通知</div>
            ) : (
              filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    notification.status === 'PENDING' ? 'bg-blue-50' : ''
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
                        <span className="text-xs text-gray-500">
                          {getTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">
                        {notification.subject}
                      </h4>
                      <p className="text-sm text-gray-600">{notification.body}</p>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      {notification.status === 'PENDING' && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-green-600"
                          title="标记为已读"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 text-center">
            <button
              onClick={() => {/* Navigate to all notifications page */}}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              查看全部通知
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
