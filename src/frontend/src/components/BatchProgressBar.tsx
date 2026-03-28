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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      return t('batch.processing', { processed, total });
    }
    if (failureCount > 0) {
      return t('batch.completedWith', { processed, total, failed: failureCount });
    }
    return t('batch.completedTotal', { processed, total });
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
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.total')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1890ff' }}>
              {processed}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.processed')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
              {successCount}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.succeeded')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f5222d' }}>
              {failureCount}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('common.failed')}</div>
          </div>
        </div>

        {/* Error Summary */}
        {failureCount > 0 && (
          <Alert
            message={t('batch.operationFailed', { count: failureCount })}
            description={
              showDetails && items.length > 0 ? (
                <Button type="link" onClick={handleViewDetails} style={{ padding: 0 }}>
                  {t('batch.viewFailedDetails')}
                </Button>
              ) : (
                t('batch.partialFailure')
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
              {t('batch.cancelOperation')}
            </Button>
          )}
          {!isProcessing && (
            <Space>
              {failureCount > 0 && showDetails && (
                <Button onClick={handleViewDetails}>
                  {t('batch.viewFailedDetails')}
                </Button>
              )}
              <Button onClick={handleClose}>
                {t('common.close')}
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
            {(items || []).slice(0, 10).map((item, index) => (
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
                {t('batch.itemsRemaining', { count: items.length - 10 })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={t('errorDetails.title')}
        open={showDetailModal}
        onCancel={() => setShowDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetailModal(false)}>
            {t('common.close')}
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
                description={item.error || t('common.unknownError')}
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
