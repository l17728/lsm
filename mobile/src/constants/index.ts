// API Configuration
export const API_CONFIG = {
  // Development URL - change to your backend URL
  BASE_URL: 'http://localhost:4000/api',
  TIMEOUT: 30000,
};

// App Theme Colors
export const COLORS = {
  primary: '#1890ff',
  primaryDark: '#096dd9',
  primaryLight: '#40a9ff',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1890ff',
  
  // Neutral colors
  white: '#ffffff',
  black: '#000000',
  background: '#f5f5f5',
  card: '#ffffff',
  border: '#e8e8e8',
  divider: '#f0f0f0',
  
  // Text colors
  textPrimary: '#262626',
  textSecondary: '#8c8c8c',
  textDisabled: '#bfbfbf',
  textInverse: '#ffffff',
  
  // Status colors
  statusOnline: '#52c41a',
  statusOffline: '#ff4d4f',
  statusMaintenance: '#faad14',
  statusPending: '#1890ff',
  statusRunning: '#722ed1',
  statusCompleted: '#52c41a',
  statusFailed: '#ff4d4f',
  statusCancelled: '#8c8c8c',
};

// Font sizes
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Border radius
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Server status labels
export const SERVER_STATUS = {
  online: { label: '在线', color: COLORS.statusOnline },
  offline: { label: '离线', color: COLORS.statusOffline },
  maintenance: { label: '维护中', color: COLORS.statusMaintenance },
};

// Task status labels
export const TASK_STATUS = {
  pending: { label: '等待中', color: COLORS.statusPending },
  running: { label: '运行中', color: COLORS.statusRunning },
  completed: { label: '已完成', color: COLORS.statusCompleted },
  failed: { label: '失败', color: COLORS.statusFailed },
  cancelled: { label: '已取消', color: COLORS.statusCancelled },
};

// Task priority labels
export const TASK_PRIORITY = {
  low: { label: '低', color: COLORS.textSecondary },
  normal: { label: '普通', color: COLORS.info },
  high: { label: '高', color: COLORS.warning },
  urgent: { label: '紧急', color: COLORS.error },
};

// GPU status labels
export const GPU_STATUS = {
  available: { label: '可用', color: COLORS.statusOnline },
  allocated: { label: '已分配', color: COLORS.statusRunning },
  maintenance: { label: '维护中', color: COLORS.statusMaintenance },
};