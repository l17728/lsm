import React from 'react';
import { Modal, Table, Tag, Space } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { ShortcutConfig } from '../hooks/useKeyboardShortcuts';

interface KeyboardHelpModalProps {
  visible: boolean;
  onClose: () => void;
  shortcuts: ShortcutConfig[];
}

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({
  visible,
  onClose,
  shortcuts,
}) => {
  // Group shortcuts by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutConfig[]>);

  const columns = [
    {
      title: '快捷键',
      dataIndex: 'key',
      key: 'key',
      render: (key: string, record: ShortcutConfig) => (
        <Space size="small">
          {record.ctrl && <Tag color="blue">Ctrl</Tag>}
          {record.shift && <Tag color="green">Shift</Tag>}
          {record.alt && <Tag color="orange">Alt</Tag>}
          <Tag color="purple" style={{ minWidth: 30, textAlign: 'center' }}>
            {key === ' ' ? 'Space' : key.toUpperCase()}
          </Tag>
        </Space>
      ),
    },
    {
      title: '功能',
      dataIndex: 'description',
      key: 'description',
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined />
          <span>快捷键帮助</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: '#666' }}>
          使用快捷键可以快速执行常用操作，提升工作效率。
        </p>
      </div>

      {Object.entries(grouped).map(([category, categoryShortcuts]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#333' }}>
            {category}
          </h3>
          <Table
            columns={columns}
            dataSource={categoryShortcuts}
            rowKey={(record) => `${record.category}-${record.key}`}
            pagination={false}
            size="small"
            showHeader={false}
          />
        </div>
      ))}

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
        <h4 style={{ marginBottom: 8 }}>提示</h4>
        <ul style={{ margin: 0, paddingLeft: 20, color: '#666' }}>
          <li>快捷键在所有页面都可用</li>
          <li>在输入框中时，部分快捷键会被禁用</li>
          <li>可以通过设置自定义快捷键（即将推出）</li>
        </ul>
      </div>
    </Modal>
  );
};

export default KeyboardHelpModal;
