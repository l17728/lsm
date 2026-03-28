import React from 'react';
import { Alert, message, notification } from 'antd';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { ApiError, ApiErrorType } from '../services/api';

// Simple translation wrapper for non-component functions
const t = (key: string): string => {
  return i18n.t(key);
};

/**
 * Error Display Component Props
 */
interface ErrorDisplayProps {
  error: ApiError | null;
  onDismiss?: () => void;
}

/**
 * Error Display Component
 * Shows error message in a user-friendly way
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss }) => {
  const { t } = useTranslation();
  if (!error) return null;

  const getMessage = (type: ApiErrorType) => {
    switch (type) {
      case ApiErrorType.VALIDATION_ERROR:
        return {
          title: t('validation.inputValidationFailed'),
          description: t('validation.checkInput'),
        };
      case ApiErrorType.AUTHENTICATION_ERROR:
        return {
          title: t('validation.loginExpired'),
          description: t('validation.pleaseLoginAgain'),
        };
      case ApiErrorType.AUTHORIZATION_ERROR:
        return {
          title: t('validation.permissionDenied'),
          description: t('validation.noPermission'),
        };
      case ApiErrorType.NOT_FOUND_ERROR:
        return {
          title: t('validation.resourceNotFound'),
          description: t('validation.resourceNotExist'),
        };
      case ApiErrorType.NETWORK_ERROR:
        return {
          title: t('validation.networkError'),
          description: t('validation.checkNetwork'),
        };
      default:
        return {
          title: t('validation.errorOccurred'),
          description: error.message,
        };
    }
  };

  const { title, description } = getMessage(error.type);

  return (
    <Alert
      type="error"
      message={title}
      description={
        <div>
          <p>{description}</p>
          {error.details && (
            <details style={{ marginTop: '8px', fontSize: '12px' }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>
                {t('common.viewDetails')}
              </summary>
              <pre
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                marginTop: '8px',
                padding: '4px 12px',
                background: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {t('common.close')}
            </button>
          )}
        </div>
      }
      showIcon
      style={{ marginBottom: '16px' }}
    />
  );
};

/**
 * Show error notification
 */
export const showErrorNotification = (error: ApiError) => {
  notification.error({
    message: t('validation.errorOccurred'),
    description: error.message,
    duration: 4.5,
    placement: 'topRight',
  });
};

/**
 * Show success notification
 */
export const showSuccessNotification = (messageText: string) => {
  notification.success({
    message: t('validation.errorOccurred'),
    description: messageText,
    duration: 3,
    placement: 'topRight',
  });
};

/**
 * Show loading message
 */
export const showLoading = (loading: boolean) => {
  if (loading) {
    message.loading({ content: t('common.loading'), key: 'loading', duration: 0 });
  } else {
    message.destroy('loading');
  }
};

/**
 * Format validation errors for display
 */
export const formatValidationErrors = (details: any): string => {
  if (!details || !Array.isArray(details)) {
    return t('validation.inputFormatInvalid');
  }

  return details
    .map((err: any) => `${err.field || t('validation.field')}: ${err.message}`)
    .join('; ');
};

/**
 * Error boundary component with i18n support via HOC
 */
const ErrorBoundaryInner: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({ children, fallback }) => {
  const { t } = useTranslation();
  
  return (
    <ErrorBoundaryImpl t={t} children={children} fallback={fallback} />
  );
};

class ErrorBoundaryImpl extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; t: (key: string) => string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    const { t, fallback } = this.props;
    if (this.state.hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <Alert
          type="error"
          message={t('errorDisplay.componentRenderFailed')}
          description={
            <div>
              <p>{t('errorDisplay.pageError')}</p>
              {this.state.error && (
                <pre
                  style={{
                    marginTop: '8px',
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                  }}
                >
                  {this.state.error.message}
                </pre>
              )}
              <button
                onClick={() => window.location.reload()}
                style={{
                  marginTop: '8px',
                  padding: '4px 12px',
                  background: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {t('errorDisplay.refreshPage')}
              </button>
            </div>
          }
          showIcon
        />
      );
    }

    return this.props.children;
  }
}

// Export the HOC for easier use
export const ErrorBoundary = ErrorBoundaryInner;
