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
        message.success('Preferences saved successfully');
        setPreferences(data.data);
      } else {
        message.error('Save failed: ' + data.error);
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
        message.error('Save failed, please try again');
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
        message.success('Dark mode toggled');
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
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>System Settings</h1>
          <p style={{ color: '#666' }}>Customize your experience</p>
        </div>
        <Space>
          <Button onClick={toggleDarkMode}>
            <ThunderboltOutlined />
            Toggle Dark Mode
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={loading}>
            Save Settings
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
          title={<><ThunderboltOutlined /> Theme Settings</>}
          style={{ marginBottom: 24 }}
        >
            <Form.Item label="Dark Mode" name={['theme', 'enabled']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

            <Form.Item label="Theme Mode" name={['theme', 'mode']}>
              <Radio.Group>
                <Radio.Button value="light">Light</Radio.Button>
                <Radio.Button value="dark">Dark</Radio.Button>
                <Radio.Button value="system">Follow System</Radio.Button>
              </Radio.Group>
          </Form.Item>

            <Form.Item label="Accent Color" name={['theme', 'accentColor']}>
            <Input type="color" style={{ width: 100 }} />
          </Form.Item>
        </Card>

        {/* Language Settings */}
        <Card
          title={<><GlobalOutlined /> Language & Region</>}
          style={{ marginBottom: 24 }}
        >
            <Form.Item label="Language" name={['language', 'code']}>
              <Select>
                <Select.Option value="zh-CN">Simplified Chinese</Select.Option>
                <Select.Option value="en-US">English</Select.Option>
            </Select>
          </Form.Item>

            <Form.Item label="Timezone" name={['language', 'timezone']}>
              <Select>
                <Select.Option value="Asia/Shanghai">China Standard Time (UTC+8)</Select.Option>
                <Select.Option value="Asia/Tokyo">Japan Standard Time (UTC+9)</Select.Option>
                <Select.Option value="America/New_York">Eastern Time (UTC-5)</Select.Option>
                <Select.Option value="Europe/London">Greenwich Mean Time (UTC+0)</Select.Option>
            </Select>
          </Form.Item>

            <Form.Item label="Date Format" name={['language', 'dateFormat']}>
              <Select>
                <Select.Option value="YYYY-MM-DD">2026-03-14</Select.Option>
                <Select.Option value="MM/DD/YYYY">03/14/2026</Select.Option>
                <Select.Option value="DD/MM/YYYY">14/03/2026</Select.Option>
                <Select.Option value="YYYY-MM-DD">2026-03-14</Select.Option>
            </Select>
          </Form.Item>

            <Form.Item label="Time Format" name={['language', 'timeFormat']}>
              <Radio.Group>
                <Radio.Button value="24h">24-hour (14:30)</Radio.Button>
                <Radio.Button value="12h">12-hour (2:30 PM)</Radio.Button>
              </Radio.Group>
          </Form.Item>
        </Card>

        {/* Notification Settings */}
        <Card
          title={<><BellOutlined /> Notification Settings</>}
          style={{ marginBottom: 24 }}
        >
            <Form.Item label="Email Notifications" name={['notifications', 'email']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

            <Form.Item label="WebSocket Real-time Notifications" name={['notifications', 'websocket']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

            <Form.Item label="Desktop Notifications" name={['notifications', 'desktop']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

            <Form.Item label="Sound Notification" name={['notifications', 'sound']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

          <Divider />

            <Form.Item label="Do Not Disturb" name={['notifications', 'quietHours', 'enabled']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

          <Space>
              <Form.Item
                label="Start Time"
                name={['notifications', 'quietHours', 'start']}
                style={{ marginBottom: 0 }}
              >
              <TimePicker format="HH:mm" />
            </Form.Item>
              <Form.Item
                label="End Time"
                name={['notifications', 'quietHours', 'end']}
                style={{ marginBottom: 0 }}
              >
              <TimePicker format="HH:mm" />
            </Form.Item>
          </Space>
        </Card>

        {/* Pagination Settings */}
        <Card
          title={<><TableOutlined /> Pagination Settings</>}
          style={{ marginBottom: 24 }}
        >
              <Form.Item label="Items per Page" name={['pagination', 'pageSize']}>
                <Slider min={10} max={100} step={10} marks={{ 10: '10', 50: '50', 100: '100' }} />
          </Form.Item>

              <Form.Item label="Default Sort Field" name={['pagination', 'defaultSort']}>
                <Select>
                  <Select.Option value="createdAt">Created At</Select.Option>
                  <Select.Option value="updatedAt">Updated At</Select.Option>
                  <Select.Option value="name">Name</Select.Option>
                  <Select.Option value="status">Status</Select.Option>
                </Select>
          </Form.Item>

              <Form.Item label="Default Sort Order" name={['pagination', 'defaultOrder']}>
                <Radio.Group>
                  <Radio.Button value="desc">Descending</Radio.Button>
                  <Radio.Button value="asc">Ascending</Radio.Button>
                </Radio.Group>
          </Form.Item>
        </Card>

        {/* Display Settings */}
        <Card
          title={<><EyeOutlined /> Display Settings</>}
        >
            <Form.Item label="Compact Mode" name={['display', 'compactMode']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

            <Form.Item label="Animation Effects" name={['display', 'showAnimations']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

            <Form.Item label="Auto Refresh" name={['display', 'autoRefresh']} valuePropName="checked">
              <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>

            <Form.Item
              label="Refresh Interval (seconds)"
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
              Save All Settings
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default Settings;
