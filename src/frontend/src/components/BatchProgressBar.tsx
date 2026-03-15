/**
 * Batch Operation Progress Bar Component
 * 
 * Features:
 * - Real-time progress display
 * - Success/failure counting
 * - Cancel operation support
 * - Background task support
 * 
 * @author LSM Project Team
 * @date 2026-03-13
 */

import React, { useState, useEffect } from 'react';
import { Progress, Button, Space, Alert, Modal, Typography } from 'antd';
import { 
  LoadingOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  StopOutlined,
  InfoCircleOutlined 
} from '@ant-design/icons';

const { Text } = Typography;

export interface BatchProgressItem {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  retryCount?: number;
}

export interface BatchProgressBarProps {
  visible: boolean;
  title: string;
  total: number;
  processed: number;
  successCount: number;
  failureCount: number;
  isProcessing: boolean;
  items?: BatchProgressItem[];
  onCancel?: () => void;
  onClose?: () => void;
  showDetails?: boolean;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const BatchProgressBar: React.FC<BatchProgressBarProps> = ({
  visible,
  title,
  total,
  processed,
  successCount,
  failureCount,
  isProcessing,
  items = [],
  onCancel,
  onClose,
  showDetails = false,
  autoClose = false,
  autoCloseDelay = 3000,
}) => {
  const [internalVisible, setInternalVisible] = useState(visible);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    setInternalVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (autoClose && !isProcessing && processed >= total && internalVisible) {
      const timer = setTimeout(() => {
        setInternalVisible(false);
        onClose?.();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [processed, total, isProcessing, autoClose, autoCloseDelay, internalVisible, onClose]);

  const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

  const getStatusColor = () => {
    if (!isProcessing) {
      return failureCount > 0 ? 'exception' : 'success';
    }
    return 'active';
  };

  const getStatusIcon = () => {
    if (isProcessing) {
      return <LoadingOutlined spin />;
    }
    if (failureCount > 0) {
      return <CloseCircleOutlined />;
    }
    return <CheckCircleOutlined />;
  };

  const getStatusText = () => {
    if (isProcessing) {
      return `处理中 ${processed}/${total}`;
    }
    if (failureCount > 0) {
      return `完成 ${processed}/${total} (失败 ${failureCount})`;
    }
    return `完成 ${processed}/${total}`;
  };

  const handleViewDetails = () => {
    setShowDetailModal(true);
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleClose = () => {
    setInternalVisible(false);
    onClose?.();
  };

  return (
    <>
      <Modal
        title={
          <Space>
            {getStatusIcon()}
            <span>{title}</span>
          </Space>
        }
        open={internalVisible}
        footer={null}
        closable={false}
        maskClosable={false}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={progress}
            status={getStatusColor()}
            format={() => getStatusText()}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
        </div>

        {/* Statistics */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-around', 
          marginBottom: 16,
          padding: '12px 16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 6,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {total}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>总数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
              {processed}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已处理</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
              {successCount}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>成功</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f5222d' }}>
              {failureCount}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>失败</div>
          </div>
        </div>

        {/* Error Summary */}
        {failureCount > 0 && (
          <Alert
            message={`${failureCount} 项操作失败`}
            description={
              showDetails && items.length > 0 ? (
                <Button type="link" onClick={handleViewDetails} style={{ padding: 0 }}>
                  查看失败详情
                </Button>
              ) : (
                '部分项目处理失败，请查看日志或重试'
              )
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {isProcessing && onCancel && (
            <Button 
              danger 
              icon={<StopOutlined />} 
              onClick={handleCancel}
            >
              取消操作
            </Button>
          )}
          {!isProcessing && (
            <Space>
              {failureCount > 0 && showDetails && (
                <Button onClick={handleViewDetails}>
                  查看失败详情
                </Button>
              )}
              <Button onClick={handleClose}>
                关闭
              </Button>
            </Space>
          )}
        </div>

        {/* Processing Items List (Optional) */}
        {showDetails && items.length > 0 && (
          <div style={{ 
            marginTop: 16, 
            maxHeight: 200, 
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            padding: 8,
          }}>
            {items.slice(0, 10).map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  borderBottom: index < items.length - 1 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <span style={{ marginRight: 8 }}>
                  {item.status === 'pending' && <InfoCircleOutlined style={{ color: '#1890ff' }} />}
                  {item.status === 'processing' && <LoadingOutlined spin style={{ color: '#1890ff' }} />}
                  {item.status === 'success' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  {item.status === 'error' && <CloseCircleOutlined style={{ color: '#f5222d' }} />}
                </span>
                <Text 
                  ellipsis 
                  style={{ 
                    flex: 1, 
                    color: item.status === 'error' ? '#f5222d' : 'var(--text-primary)',
                    textDecoration: item.status === 'error' ? 'line-through' : 'none',
                  }}
                >
                  {item.name}
                </Text>
                {item.error && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    {item.error}
                  </Text>
                )}
              </div>
            ))}
            {items.length > 10 && (
              <div style={{ textAlign: 'center', padding: 8, color: 'var(--text-secondary)' }}>
                还有 {items.length - 10} 项...
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="失败详情"
        open={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {items
            .filter(item => item.status === 'error')
            .map((item, index) => (
              <Alert
                key={item.id}
                message={item.name}
                description={item.error || '未知错误'}
                type="error"
                showIcon
                style={{ marginBottom: index < items.filter(i => i.status === 'error').length - 1 ? 8 : 0 }}
              />
            ))
          }
        </div>
      </Modal>
    </>
  );
};

export default BatchProgressBar;
