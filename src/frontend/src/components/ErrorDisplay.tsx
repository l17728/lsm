import React from 'react';
import { Alert, message, notification } from 'antd';
import { ApiError, ApiErrorType } from '../services/apiClient';

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
  if (!error) return null;

  const getMessage = (type: ApiErrorType) => {
    switch (type) {
      case ApiErrorType.VALIDATION_ERROR:
        return {
          title: '输入验证失败',
          description: '请检查您的输入是否正确',
        };
      case ApiErrorType.AUTHENTICATION_ERROR:
        return {
          title: '登录已过期',
          description: '请重新登录',
        };
      case ApiErrorType.AUTHORIZATION_ERROR:
        return {
          title: '权限不足',
          description: '您没有执行此操作的权限',
        };
      case ApiErrorType.NOT_FOUND_ERROR:
        return {
          title: '资源未找到',
          description: '请求的资源不存在',
        };
      case ApiErrorType.NETWORK_ERROR:
        return {
          title: '网络错误',
          description: '请检查网络连接后重试',
        };
      default:
        return {
          title: '发生错误',
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
                查看详情
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
              关闭
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
    message: '操作失败',
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
    message: '操作成功',
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
    message.loading({ content: '处理中...', key: 'loading', duration: 0 });
  } else {
    message.destroy('loading');
  }
};

/**
 * Format validation errors for display
 */
export const formatValidationErrors = (details: any): string => {
  if (!details || !Array.isArray(details)) {
    return '输入数据格式不正确';
  }

  return details
    .map((err: any) => `${err.field || '字段'}: ${err.message}`)
    .join('; ');
};

/**
 * Error boundary component
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
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
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Alert
          type="error"
          message="组件渲染失败"
          description={
            <div>
              <p>抱歉，页面出现了一些问题</p>
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
                刷新页面
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
