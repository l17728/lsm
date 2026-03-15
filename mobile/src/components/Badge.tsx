import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SERVER_STATUS, TASK_STATUS, GPU_STATUS, TASK_PRIORITY } from '../constants';

interface StatusBadgeProps {
  status: string;
  type: 'server' | 'task' | 'gpu';
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type,
  size = 'medium',
  style,
}) => {
  const getStatusConfig = () => {
    switch (type) {
      case 'server':
        return SERVER_STATUS[status as keyof typeof SERVER_STATUS] || { label: status, color: COLORS.textSecondary };
      case 'task':
        return TASK_STATUS[status as keyof typeof TASK_STATUS] || { label: status, color: COLORS.textSecondary };
      case 'gpu':
        return GPU_STATUS[status as keyof typeof GPU_STATUS] || { label: status, color: COLORS.textSecondary };
      default:
        return { label: status, color: COLORS.textSecondary };
    }
  };

  const config = getStatusConfig();
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.color + '20' },
        isSmall && styles.badgeSmall,
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }, isSmall && styles.textSmall]}>
        {config.label}
      </Text>
    </View>
  );
};

interface PriorityBadgeProps {
  priority: string;
  style?: ViewStyle;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, style }) => {
  const config = TASK_PRIORITY[priority as keyof typeof TASK_PRIORITY] || {
    label: priority,
    color: COLORS.textSecondary,
  };

  return (
    <View style={[styles.priorityBadge, { backgroundColor: config.color + '15' }, style]}>
      <Text style={[styles.priorityText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

interface ListItemProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  rightContent,
  onPress,
  style,
}) => {
  const content = (
    <View style={styles.listItemContent}>
      <Text style={styles.listItemTitle} numberOfLines={1}>
        {title}
      </Text>
      {subtitle && (
        <Text style={styles.listItemSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  );

  const right = rightContent && <View style={styles.listItemRight}>{rightContent}</View>;

  if (onPress) {
    return (
      <TouchableOpacity style={[styles.listItem, style]} onPress={onPress} activeOpacity={0.7}>
        {content}
        {right}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.listItem, style]}>
      {content}
      {right}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeSmall: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs,
  },
  text: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  textSmall: {
    fontSize: 10,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  priorityText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.base,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: FONT_SIZES.base,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  listItemSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  listItemRight: {
    marginLeft: SPACING.sm,
  },
});