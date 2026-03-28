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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const filteredErrors = errors.filter(error => 
    searchText === '' || 
    error.name.toLowerCase().includes(searchText.toLowerCase()) ||
    error.error.toLowerCase().includes(searchText.toLowerCase()) ||
    (error.type && error.type.toLowerCase().includes(searchText.toLowerCase()))
  );

  const displayErrors = (filteredErrors || []).slice(0, maxDisplay);

  const handleRetrySelected = async () => {
    if (!onRetry || selectedRowKeys.length === 0) return;
    
    try {
      await onRetry(selectedRowKeys as string[]);
      antdMessage.success(t('messages.retrySuccess', { count: selectedRowKeys.length }));
      setSelectedRowKeys([]);
    } catch (error: any) {
      antdMessage.error(t('messages.retryFailed'));
    }
  };

  const handleRetryAll = async () => {
    if (!onRetryAll) return;
    
    try {
      await onRetryAll();
      antdMessage.success(t('messages.retryAllSuccess'));
    } catch (error: any) {
      antdMessage.error(t('messages.retryFailed'));
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
      `    ${t('errorDetails.type')}: ${error.type || t('errorDetails.unknown')}\n` +
      `    ${t('errorDetails.errorMessage')}: ${error.error}\n` +
      `    ${t('errorDetails.errorCode')}: ${error.errorCode || 'N/A'}\n` +
      `    ${t('errorDetails.timestamp')}: ${error.timestamp || 'N/A'}\n` +
      `    ${t('errorDetails.retryCount')}: ${error.retryCount || 0}\n`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-log-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    
    antdMessage.success(t('messages.logExported'));
  };

  const handleCopyError = (text: string) => {
    navigator.clipboard.writeText(text);
    antdMessage.success(t('messages.copied'));
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
      title: t('errorDetails.name'),
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
      title: t('errorDetails.type'),
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type?: string) => (
        type ? <Tag color="blue">{type}</Tag> : <Tag>{t('errorDetails.unknown')}</Tag>
      ),
    },
    {
      title: t('errorDetails.errorMessage'),
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
      title: t('errorDetails.retryCount'),
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 80,
      render: (count?: number) => count || 0,
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {showRetry && record.canRetry !== false && onRetry && (
            <Tooltip title={t('errorDetails.retryItem')}>
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => onRetry([record.id])}
              />
            </Tooltip>
          )}
          <Tooltip title={t('errorDetails.copyError')}>
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
          {t('common.close')}
        </Button>,
        showExport && (
          <Button 
            key="export" 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
          >
            {t('errorDetails.exportLog')}
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
            {t('common.retryAll')}
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
            {t('common.retrySelected')} ({selectedRowKeys.length})
          </Button>
        ),
      ]}
      width={900}
    >
      {/* Summary Alert */}
      {errors.length > 0 && (
        <Alert
          message={t('batch.selected', { count: errors.length })}
          description={
            <Space>
              <Text>
                {selectedRowKeys.length > 0 
                  ? t('errorDetails.selectedItems', { count: selectedRowKeys.length }) 
                  : t('errorDetails.selectFailedToRetry')}
              </Text>
              {filteredErrors.length > maxDisplay && (
                <Text type="secondary">
                  ({t('errorDetails.showingFirst', { count: maxDisplay })})
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
          placeholder={t('errorDetails.searchPlaceholder')}
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
            {t('common.clearSearch')}
          </Button>
        )}
      </div>

      {/* Error Table */}
      {displayErrors.length === 0 ? (
        <Empty 
          description={errors.length === 0 ? t('errorDetails.noErrors') : t('errorDetails.noMatch')} 
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
            showTotal: (total) => t('pagination.totalItems', { total }),
          }}
          expandable={{
            expandedRowKeys: [...expandedRowKeys],
            onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
            expandedRowRender: (record) => (
              <div style={{ margin: 0, padding: '16px', backgroundColor: 'var(--bg-secondary)' }}>
                <Paragraph>
                  <Text strong>{t('errorDetails.title')}</Text>
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
                    <Text strong>{t('errorDetails.errorCode')}</Text> <Text code>{record.errorCode}</Text>
                  </Paragraph>
                )}
                {record.timestamp && (
                  <Paragraph style={{ marginTop: 8 }}>
                    <Text strong>{t('errorDetails.timestamp')}</Text> {record.timestamp}
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
