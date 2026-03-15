/**
 * Batch Operation Confirm Dialog Component
 * 
 * Features:
 * - Reusable confirmation dialog
 * - Batch delete confirmation
 * - Batch status change confirmation
 * - Dangerous operation secondary confirmation
 * - Custom warning messages
 * 
 * @author LSM Project Team
 * @date 2026-03-13
 */

import React, { useState } from 'react';
import { Modal, Form, Input, Alert, Typography, Space, Checkbox } from 'antd';
import { 
  ExclamationCircleOutlined, 
  WarningOutlined, 
  InfoCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  StopOutlined 
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;

export type ConfirmDialogType = 'delete' | 'status_change' | 'custom' | 'dangerous';

export interface ConfirmDialogProps {
  visible: boolean;
  type?: ConfirmDialogType;
  title?: string;
  message: string;
  itemCount?: number;
  itemLabel?: string;
  actionLabel?: string;
  warningMessage?: string;
  requireConfirmation?: boolean;
  confirmationText?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  danger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  type = 'custom',
  title,
  message,
  itemCount,
  itemLabel = '项',
  actionLabel = '确认',
  warningMessage,
  requireConfirmation = false,
  confirmationText = '我已知晓风险，确认执行',
  loading = false,
  onConfirm,
  onCancel,
  danger = false,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const getDefaultTitle = () => {
    switch (type) {
      case 'delete':
        return '确认删除';
      case 'status_change':
        return '确认状态变更';
      case 'dangerous':
        return '危险操作确认';
      default:
        return '确认操作';
    }
  };

  const getIcon = () => {
    if (danger || type === 'delete' || type === 'dangerous') {
      return <ExclamationCircleOutlined style={{ color: '#f5222d', fontSize: 24 }} />;
    }
    if (type === 'status_change') {
      return <EditOutlined style={{ color: '#1890ff', fontSize: 24 }} />;
    }
    return <InfoCircleOutlined style={{ color: '#1890ff', fontSize: 24 }} />;
  };

  const getDefaultWarning = () => {
    switch (type) {
      case 'delete':
        return '删除操作不可恢复，请谨慎操作。';
      case 'dangerous':
        return '此操作可能对系统造成影响，请确保您了解所有风险。';
      default:
        return undefined;
    }
  };

  const dialogTitle = title || getDefaultTitle();
  const dialogWarning = warningMessage || getDefaultWarning();

  const canConfirm = () => {
    if (loading) return false;
    if (requireConfirmation && confirmationText) {
      return confirmed && confirmInput === confirmationText;
    }
    if (requireConfirmation) {
      return confirmed;
    }
    return true;
  };

  const handleConfirm = async () => {
    if (!canConfirm()) return;
    
    try {
      await onConfirm();
    } catch (error) {
      // Error is handled by the parent component
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    setConfirmInput('');
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          {getIcon()}
          <span style={{ color: danger ? '#f5222d' : 'var(--text-primary)' }}>
            {dialogTitle}
          </span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      onOk={handleConfirm}
      confirmLoading={loading}
      okText={actionLabel}
      cancelText="取消"
      okButtonProps={{ 
        danger: danger || type === 'delete',
        disabled: !canConfirm(),
      }}
      width={500}
    >
      <div style={{ padding: '16px 0' }}>
        {/* Main Message */}
        <Paragraph style={{ fontSize: 16, marginBottom: 16 }}>
          {message}
        </Paragraph>

        {/* Item Count */}
        {itemCount !== undefined && itemCount > 0 && (
          <Alert
            message={`${itemCount} ${itemLabel}将被影响`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Warning Message */}
        {dialogWarning && (
          <Alert
            message={dialogWarning}
            type={danger || type === 'delete' ? 'warning' : 'info'}
            showIcon
            icon={danger || type === 'delete' ? <WarningOutlined /> : <InfoCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Extra Confirmation for Dangerous Operations */}
        {requireConfirmation && (
          <div style={{ 
            marginTop: 16, 
            padding: 16, 
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
          }}>
            <Checkbox
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ display: 'block', marginBottom: 12 }}
            >
              <Text strong>{confirmationText}</Text>
            </Checkbox>
            
            {confirmationText && (
              <Input
                placeholder={`请输入"${confirmationText}"以确认`}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                disabled={!confirmed}
                autoComplete="off"
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

/**
 * Pre-configured dialog creators for common scenarios
 */
export const ConfirmDialogPresets = {
  /**
   * Batch delete confirmation
   */
  delete: (props: Omit<ConfirmDialogProps, 'type' | 'danger'>) => (
    <ConfirmDialog
      {...props}
      type="delete"
      danger
      requireConfirmation={props.itemCount !== undefined && props.itemCount > 5}
      confirmationText={props.itemCount !== undefined && props.itemCount > 5 ? '确认删除' : undefined}
    />
  ),

  /**
   * Batch status change confirmation
   */
  statusChange: (props: Omit<ConfirmDialogProps, 'type'>) => (
    <ConfirmDialog
      {...props}
      type="status_change"
      danger={false}
    />
  ),

  /**
   * Dangerous operation confirmation
   */
  dangerous: (props: Omit<ConfirmDialogProps, 'type' | 'danger'>) => (
    <ConfirmDialog
      {...props}
      type="dangerous"
      danger
      requireConfirmation
      confirmationText="我已知晓风险，确认执行"
    />
  ),
};

export default ConfirmDialog;
