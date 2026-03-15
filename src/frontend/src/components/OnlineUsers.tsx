import React, { useState, useEffect } from 'react';
import { Badge, List, Avatar, Tooltip, Tag, Space, Popover } from 'antd';
import { UserOutlined, WifiOutlined, WifiOutlined as WifiOfflineOutlined } from '@ant-design/icons';
import { wsService } from '../services/websocket';

interface OnlineUser {
  userId: string;
  username: string;
  sessionCount: number;
  firstConnectedAt: Date;
  lastActivityAt: Date;
}

interface OnlineUsersProps {
  showList?: boolean;
}

export const OnlineUsers: React.FC<OnlineUsersProps> = ({ showList = false }) => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Fetch initial online users
    fetchOnlineUsers();

    // Listen for WebSocket updates
    const handleOnlineUsers = (users: OnlineUser[]) => {
      setOnlineUsers(users);
    };
    wsService.on('users:online', handleOnlineUsers);

    return () => {
      wsService.off('users:online', handleOnlineUsers);
    };
  }, []);

  const fetchOnlineUsers = async () => {
    try {
      const res = await fetch('/api/websocket/online-users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setOnlineUsers(data.data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch online users:', error);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
  };

  const userListContent = (
    <div style={{ width: 300, maxHeight: 400, overflow: 'auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <strong>在线用户 ({onlineUsers.length})</strong>
      </div>
      <List
        dataSource={onlineUsers}
        renderItem={(user) => (
          <List.Item style={{ padding: '12px 16px' }}>
            <List.Item.Meta
              avatar={
                <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
              }
              title={
                <Space>
                  <span>{user.username}</span>
                  {user.sessionCount > 1 && (
                    <Tag color="blue">{user.sessionCount} 个会话</Tag>
                  )}
                </Space>
              }
              description={
                <Space size="small">
                  <span style={{ fontSize: 12 }}>
                    最后活动：{getTimeAgo(user.lastActivityAt.toISOString())}
                  </span>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  if (!showList) {
    return (
      <Tooltip title={`当前在线：${onlineUsers.length} 人`}>
        <Badge count={onlineUsers.length} offset={[-5, 5]} color="#52c41a">
          <WifiOutlined style={{ fontSize: 20, color: '#52c41a' }} />
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Popover
      content={userListContent}
      title={null}
      trigger="click"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <Badge count={onlineUsers.length} offset={[-5, 5]} color="#52c41a">
        <Space>
          <WifiOutlined style={{ fontSize: 20, color: '#52c41a' }} />
          <span style={{ fontSize: 14 }}>{onlineUsers.length} 在线</span>
        </Space>
      </Badge>
    </Popover>
  );
};

export default OnlineUsers;
