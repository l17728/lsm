import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  style,
  padding = SPACING.base,
}) => {
  return (
    <View style={[styles.card, { padding }, style]}>
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </View>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  color = COLORS.primary,
  icon,
  style,
}) => {
  return (
    <View style={[styles.statCard, style]}>
      <View style={styles.statHeader}>
        {icon && <View style={styles.statIcon}>{icon}</View>}
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.base,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statIcon: {
    marginRight: SPACING.sm,
  },
  statTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
  },
  statSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});