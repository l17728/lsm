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
import { useTranslation } from 'react-i18next';
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
  itemLabel: propsItemLabel,
  actionLabel: propsActionLabel,
  warningMessage,
  requireConfirmation = false,
  confirmationText: propsConfirmationText,
  loading = false,
  onConfirm,
  onCancel,
  danger = false,
}) => {
  const { t } = useTranslation();
  const [confirmed, setConfirmed] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');

  const itemLabelText = propsItemLabel || t('confirmDialog.item');
  const actionLabelText = propsActionLabel || t('confirmDialog.confirm');
  const confirmationTextDefault = t('confirmDialog.confirmText');
  const finalConfirmationText = propsConfirmationText || confirmationTextDefault;

  const getDefaultTitle = () => {
    switch (type) {
      case 'delete':
        return t('confirmDialog.confirmDelete');
      case 'status_change':
        return t('confirmDialog.confirmStatusChange');
      case 'dangerous':
        return t('confirmDialog.dangerConfirm');
      default:
        return t('confirmDialog.confirmAction');
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
        return t('confirmDialog.deleteWarning');
      case 'dangerous':
        return t('confirmDialog.systemImpactWarning');
      default:
        return undefined;
    }
  };

  const dialogTitle = title || getDefaultTitle();
  const dialogWarning = warningMessage || getDefaultWarning();

  const canConfirm = () => {
    if (loading) return false;
    if (requireConfirmation && finalConfirmationText) {
      return confirmed && confirmInput === finalConfirmationText;
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
      okText={actionLabelText}
      cancelText={t('common.cancel')}
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
            message={`${itemCount} ${itemLabelText}${t('batch.willBeAffected')}`}
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
              <Text strong>{finalConfirmationText}</Text>
            </Checkbox>
            
            {propsConfirmationText && (
              <Input
                placeholder={t('confirmDialog.enterToConfirm', { text: finalConfirmationText })}
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
 * Note: confirmationText should be a translation key string, the component will translate it
 */
export const ConfirmDialogPresets = {
  /**
   * Batch delete confirmation
   */
  delete: (props: Omit<ConfirmDialogProps, 'type' | 'danger'>) => {
    const { t } = useTranslation();
    return (
      <ConfirmDialog
        {...props}
        type="delete"
        danger
        requireConfirmation={props.itemCount !== undefined && props.itemCount > 5}
        confirmationText={props.itemCount !== undefined && props.itemCount > 5 ? t('confirmDialog.confirmDelete') : undefined}
      />
    );
  },

  /**
   * Batch status change confirmation
   */
  statusChange: (props: Omit<ConfirmDialogProps, 'type'>) => {
    const { t } = useTranslation();
    return (
      <ConfirmDialog
        {...props}
        type="status_change"
        danger={false}
      />
    );
  },

  /**
   * Dangerous operation confirmation
   */
  dangerous: (props: Omit<ConfirmDialogProps, 'type' | 'danger'>) => {
    const { t } = useTranslation();
    return (
      <ConfirmDialog
        {...props}
        type="dangerous"
        danger
        requireConfirmation
        confirmationText={t('confirmDialog.confirmText')}
      />
    );
  },
};

export default ConfirmDialog;
