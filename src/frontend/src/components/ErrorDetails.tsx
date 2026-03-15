/**
 * Error Details Display Component
 * 
 * Features:
 * - Batch operation failure details
 * - Individual error positioning
 * - Retry failed items functionality
 * - Error log export
 * 
 * @author LSM Project Team
 * @date 2026-03-13
 */

import React, { useState } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Alert, 
  Modal, 
  Typography, 
  Input,
  Empty,
  Tooltip,
  message as antdMessage
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  ExclamationCircleOutlined, 
  ReloadOutlined, 
  DownloadOutlined, 
  CopyOutlined,
  SearchOutlined,
  ClearOutlined,
  FileTextOutlined 
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export interface ErrorDetailItem {
  id: string;
  name: string;
  type?: string;
  error: string;
  errorCode?: string;
  timestamp?: string;
  retryCount?: number;
  canRetry?: boolean;
}

export interface ErrorDetailsProps {
  visible: boolean;
  title?: string;
  errors: ErrorDetailItem[];
  loading?: boolean;
  onRetry?: (ids: string[]) => void | Promise<void>;
  onRetryAll?: () => void | Promise<void>;
  onExport?: () => void;
  onClose?: () => void;
  showExport?: boolean;
  showRetry?: boolean;
  maxDisplay?: number;
}

export const ErrorDetails: React.FC<ErrorDetailsProps> = ({
  visible,
  title = '错误详情',
  errors = [],
  loading = false,
  onRetry,
  onRetryAll,
  onExport,
  onClose,
  showExport = true,
  showRetry = true,
  maxDisplay = 100,
}) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const filteredErrors = errors.filter(error => 
    searchText === '' || 
    error.name.toLowerCase().includes(searchText.toLowerCase()) ||
    error.error.toLowerCase().includes(searchText.toLowerCase()) ||
    (error.type && error.type.toLowerCase().includes(searchText.toLowerCase()))
  );

  const displayErrors = filteredErrors.slice(0, maxDisplay);

  const handleRetrySelected = async () => {
    if (!onRetry || selectedRowKeys.length === 0) return;
    
    try {
      await onRetry(selectedRowKeys as string[]);
      antdMessage.success(`已重试 ${selectedRowKeys.length} 项`);
      setSelectedRowKeys([]);
    } catch (error: any) {
      antdMessage.error('重试失败');
    }
  };

  const handleRetryAll = async () => {
    if (!onRetryAll) return;
    
    try {
      await onRetryAll();
      antdMessage.success('已重试所有失败项');
    } catch (error: any) {
      antdMessage.error('重试失败');
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
      return;
    }

    // Default export: download as text file
    const content = errors.map((error, index) => 
      `[${index + 1}] ${error.name}\n` +
      `    类型：${error.type || '未知'}\n` +
      `    错误：${error.error}\n` +
      `    代码：${error.errorCode || 'N/A'}\n` +
      `    时间：${error.timestamp || 'N/A'}\n` +
      `    重试次数：${error.retryCount || 0}\n`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-log-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    antdMessage.success('错误日志已导出');
  };

  const handleCopyError = (text: string) => {
    navigator.clipboard.writeText(text);
    antdMessage.success('已复制到剪贴板');
  };

  const columns: ColumnsType<ErrorDetailItem> = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => (
        <Text strong ellipsis style={{ maxWidth: 180 }}>
          {name}
        </Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type?: string) => (
        type ? <Tag color="blue">{type}</Tag> : <Tag>未知</Tag>
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (error: string) => (
        <Tooltip title={error}>
          <Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
            {error}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 80,
      render: (count?: number) => count || 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {showRetry && record.canRetry !== false && onRetry && (
            <Tooltip title="重试此项">
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => onRetry([record.id])}
              />
            </Tooltip>
          )}
          <Tooltip title="复制错误信息">
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopyError(`${record.name}: ${record.error}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const rowSelection: any = showRetry ? {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => setSelectedRowKeys(newSelectedRowKeys),
  } : undefined;

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
          <span>{title}</span>
          <Tag color="red">{errors.length}</Tag>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        showExport && (
          <Button 
            key="export" 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
          >
            导出日志
          </Button>
        ),
        showRetry && onRetryAll && errors.length > 0 && (
          <Button 
            key="retryAll" 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={handleRetryAll}
            loading={loading}
          >
            重试全部
          </Button>
        ),
        showRetry && onRetry && selectedRowKeys.length > 0 && (
          <Button 
            key="retrySelected" 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={handleRetrySelected}
            loading={loading}
          >
            重试选中 ({selectedRowKeys.length})
          </Button>
        ),
      ]}
      width={900}
    >
      {/* Summary Alert */}
      {errors.length > 0 && (
        <Alert
          message={`共 ${errors.length} 项失败`}
          description={
            <Space>
              <Text>
                {selectedRowKeys.length > 0 
                  ? `已选择 ${selectedRowKeys.length} 项` 
                  : '可勾选失败项进行重试'}
              </Text>
              {filteredErrors.length > maxDisplay && (
                <Text type="secondary">
                  (仅显示前 {maxDisplay} 项)
                </Text>
              )}
            </Space>
          }
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Search */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          placeholder="搜索名称、错误信息..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ width: 300 }}
        />
        {searchText && (
          <Button 
            icon={<ClearOutlined />} 
            onClick={() => setSearchText('')}
          >
            清除搜索
          </Button>
        )}
      </div>

      {/* Error Table */}
      {displayErrors.length === 0 ? (
        <Empty 
          description={errors.length === 0 ? '暂无错误' : '没有找到匹配的错误'} 
          style={{ padding: '40px 0' }}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={displayErrors}
          rowSelection={rowSelection}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 项`,
          }}
          expandable={{
            expandedRowKeys: [...expandedRowKeys],
            onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
            expandedRowRender: (record) => (
              <div style={{ margin: 0, padding: '16px', backgroundColor: 'var(--bg-secondary)' }}>
                <Paragraph>
                  <Text strong>错误详情：</Text>
                </Paragraph>
                <pre style={{ 
                  margin: 0, 
                  padding: 12, 
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 200,
                  fontSize: 12,
                  color: '#f5222d',
                }}>
                  {record.error}
                </pre>
                {record.errorCode && (
                  <Paragraph style={{ marginTop: 8 }}>
                    <Text strong>错误代码：</Text> <Text code>{record.errorCode}</Text>
                  </Paragraph>
                )}
                {record.timestamp && (
                  <Paragraph style={{ marginTop: 8 }}>
                    <Text strong>发生时间：</Text> {record.timestamp}
                  </Paragraph>
                )}
              </div>
            ),
          }}
        />
      )}
    </Modal>
  );
};

export default ErrorDetails;
