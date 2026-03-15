import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: COLORS.textSecondary,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: COLORS.primary,
        };
      case 'danger':
        return {
          backgroundColor: COLORS.error,
        };
      default:
        return {
          backgroundColor: COLORS.primary,
        };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: SPACING.sm,
          paddingHorizontal: SPACING.md,
        };
      case 'large':
        return {
          paddingVertical: SPACING.lg,
          paddingHorizontal: SPACING.xl,
        };
      default:
        return {
          paddingVertical: SPACING.md,
          paddingHorizontal: SPACING.lg,
        };
    }
  };

  const getTextColor = (): string => {
    if (variant === 'outline') return COLORS.primary;
    return COLORS.textInverse;
  };

  const getTextSize = (): number => {
    switch (size) {
      case 'small':
        return FONT_SIZES.sm;
      case 'large':
        return FONT_SIZES.md;
      default:
        return FONT_SIZES.base;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.buttonText,
              { color: getTextColor(), fontSize: getTextSize() },
              disabled && styles.buttonTextDisabled,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  buttonText: {
    fontWeight: '600',
  },
  buttonTextDisabled: {
    opacity: 0.7,
  },
});