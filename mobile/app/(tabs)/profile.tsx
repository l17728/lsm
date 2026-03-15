import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Card, Button } from '../../src/components';
import { COLORS, SPACING, FONT_SIZES } from '../../src/constants';
import { useAuthStore } from '../../src/store/authStore';
import { apiService } from '../../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert(
      '退出登录',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.logout();
            } catch (error) {
              // Ignore logout API errors
            }
            logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const menuItems = [
    { icon: '⚙️', label: '系统设置', onPress: () => {} },
    { icon: '🔔', label: '通知设置', onPress: () => {} },
    { icon: '📖', label: '帮助文档', onPress: () => {} },
    { icon: '💬', label: '意见反馈', onPress: () => {} },
    { icon: '📱', label: '关于我们', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.username || '用户'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role === 'ADMIN' ? '管理员' : user?.role === 'MANAGER' ? '经理' : '用户'}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <Card style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder,
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </Card>

        {/* Logout Button */}
        <Button
          title="退出登录"
          onPress={handleLogout}
          variant="outline"
          style={styles.logoutButton}
        />

        {/* Version */}
        <Text style={styles.version}>LSM Mobile v3.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.white,
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  roleBadge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  roleText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  menuCard: {
    marginBottom: SPACING.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: SPACING.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: FONT_SIZES.base,
    color: COLORS.textPrimary,
  },
  menuArrow: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    marginTop: SPACING.lg,
  },
  version: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});