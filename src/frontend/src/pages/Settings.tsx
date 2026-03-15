import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Switch,
  Button,
  Card,
  Divider,
  Space,
  message,
  TimePicker,
  Slider,
  Radio,
} from 'antd';
import {
  SaveOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  BellOutlined,
  TableOutlined,
  EyeOutlined,
} from '@ant-design/icons';

interface Preferences {
  theme: {
    enabled: boolean;
    mode: 'light' | 'dark' | 'system';
    accentColor: string;
  };
  language: {
    code: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  notifications: {
    email: boolean;
    websocket: boolean;
    desktop: boolean;
    sound: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  pagination: {
    pageSize: number;
    defaultSort: string;
    defaultOrder: 'asc' | 'desc';
  };
  display: {
    compactMode: boolean;
    showAnimations: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
  };
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: {
    enabled: false,
    mode: 'system',
    accentColor: '#667eea',
  },
  language: {
    code: 'zh-CN',
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
  },
  notifications: {
    email: true,
    websocket: true,
    desktop: true,
    sound: true,
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  },
  pagination: {
    pageSize: 20,
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
  },
  display: {
    compactMode: false,
    showAnimations: true,
    autoRefresh: true,
    refreshInterval: 30,
  },
};

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [form] = Form.useForm();

  // Fetch preferences
  const fetchPreferences = async () => {
    try {
      const res = await fetch('/api/preferences', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        setPreferences(data.data);
        form.setFieldsValue(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  // Save preferences
  const savePreferences = async (values: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (data.success) {
        message.success('偏好设置保存成功');
        setPreferences(data.data);
      } else {
        message.error('保存失败：' + data.error);
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      message.error('保存失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // Quick toggle dark mode
  const toggleDarkMode = async () => {
    try {
      const res = await fetch('/api/preferences/toggle-dark-mode', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await res.json();
      if (data.success) {
        message.success('暗黑模式已切换');
        fetchPreferences();
      }
    } catch (error) {
      console.error('Failed to toggle dark mode:', error);
    }
  };

  return (
    <div className="settings-page" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>系统设置</h1>
          <p style={{ color: '#666' }}>个性化您的使用体验</p>
        </div>
        <Space>
          <Button onClick={toggleDarkMode}>
            <ThunderboltOutlined />
            切换暗黑模式
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
            保存设置
          </Button>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={savePreferences}
        initialValues={preferences}
      >
        {/* Theme Settings */}
        <Card
          title={<><ThunderboltOutlined /> 主题设置</>}
          style={{ marginBottom: 24 }}
        >
          <Form.Item label="暗黑模式" name={['theme', 'enabled']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item label="主题模式" name={['theme', 'mode']}>
            <Radio.Group>
              <Radio.Button value="light">浅色</Radio.Button>
              <Radio.Button value="dark">深色</Radio.Button>
              <Radio.Button value="system">跟随系统</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="强调色" name={['theme', 'accentColor']}>
            <Input type="color" style={{ width: 100 }} />
          </Form.Item>
        </Card>

        {/* Language Settings */}
        <Card
          title={<><GlobalOutlined /> 语言与地区</>}
          style={{ marginBottom: 24 }}
        >
          <Form.Item label="语言" name={['language', 'code']}>
            <Select>
              <Select.Option value="zh-CN">简体中文</Select.Option>
              <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="时区" name={['language', 'timezone']}>
            <Select>
              <Select.Option value="Asia/Shanghai">中国标准时间 (UTC+8)</Select.Option>
              <Select.Option value="Asia/Tokyo">日本标准时间 (UTC+9)</Select.Option>
              <Select.Option value="America/New_York">美国东部时间 (UTC-5)</Select.Option>
              <Select.Option value="Europe/London">格林威治标准时间 (UTC+0)</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="日期格式" name={['language', 'dateFormat']}>
            <Select>
              <Select.Option value="YYYY-MM-DD">2026-03-14</Select.Option>
              <Select.Option value="MM/DD/YYYY">03/14/2026</Select.Option>
              <Select.Option value="DD/MM/YYYY">14/03/2026</Select.Option>
              <Select.Option value="YYYY 年 MM 月 DD 日">2026 年 03 月 14 日</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="时间格式" name={['language', 'timeFormat']}>
            <Radio.Group>
              <Radio.Button value="24h">24 小时制 (14:30)</Radio.Button>
              <Radio.Button value="12h">12 小时制 (2:30 PM)</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Card>

        {/* Notification Settings */}
        <Card
          title={<><BellOutlined /> 通知设置</>}
          style={{ marginBottom: 24 }}
        >
          <Form.Item label="邮件通知" name={['notifications', 'email']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item label="WebSocket 实时通知" name={['notifications', 'websocket']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item label="桌面通知" name={['notifications', 'desktop']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item label="提示音" name={['notifications', 'sound']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Divider />

          <Form.Item label="免打扰时段" name={['notifications', 'quietHours', 'enabled']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Space>
            <Form.Item
              label="开始时间"
              name={['notifications', 'quietHours', 'start']}
              style={{ marginBottom: 0 }}
            >
              <TimePicker format="HH:mm" />
            </Form.Item>
            <Form.Item
              label="结束时间"
              name={['notifications', 'quietHours', 'end']}
              style={{ marginBottom: 0 }}
            >
              <TimePicker format="HH:mm" />
            </Form.Item>
          </Space>
        </Card>

        {/* Pagination Settings */}
        <Card
          title={<><TableOutlined /> 分页设置</>}
          style={{ marginBottom: 24 }}
        >
          <Form.Item label="每页显示条数" name={['pagination', 'pageSize']}>
            <Slider min={10} max={100} step={10} marks={{ 10: '10', 50: '50', 100: '100' }} />
          </Form.Item>

          <Form.Item label="默认排序字段" name={['pagination', 'defaultSort']}>
            <Select>
              <Select.Option value="createdAt">创建时间</Select.Option>
              <Select.Option value="updatedAt">更新时间</Select.Option>
              <Select.Option value="name">名称</Select.Option>
              <Select.Option value="status">状态</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="默认排序顺序" name={['pagination', 'defaultOrder']}>
            <Radio.Group>
              <Radio.Button value="desc">降序</Radio.Button>
              <Radio.Button value="asc">升序</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Card>

        {/* Display Settings */}
        <Card
          title={<><EyeOutlined /> 显示设置</>}
        >
          <Form.Item label="紧凑模式" name={['display', 'compactMode']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item label="动画效果" name={['display', 'showAnimations']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item label="自动刷新" name={['display', 'autoRefresh']} valuePropName="checked">
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          <Form.Item
            label="刷新间隔 (秒)"
            name={['display', 'refreshInterval']}
            dependencies={['display', 'autoRefresh']}
          >
            <Slider min={5} max={120} step={5} disabled={!form.getFieldValue(['display', 'autoRefresh'])} />
          </Form.Item>
        </Card>

        {/* Save Button */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            onClick={() => form.submit()}
            loading={loading}
          >
            保存所有设置
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default Settings;
