import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatCard, Card, Button } from '../../components';
import { COLORS, SPACING, FONT_SIZES } from '../../constants';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.xl * 2 - SPACING.md) / 2;

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    serverStats,
    gpuStats,
    taskStats,
    lastRefresh,
    fetchAllStats,
    refresh,
  } = useAppStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchAllStats();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}，</Text>
          <Text style={styles.userName}>{user?.username || '用户'}</Text>
        </View>

        {/* Quick Actions */}
        <Card style={styles.quickActions}>
          <Text style={styles.sectionTitle}>快捷操作</Text>
          <View style={styles.actionButtons}>
            <Button
              title="申请 GPU"
              onPress={() => router.push('/gpu/allocate')}
              size="small"
              style={styles.actionButton}
            />
            <Button
              title="提交任务"
              onPress={() => router.push('/task/create')}
              size="small"
              variant="outline"
              style={styles.actionButton}
            />
          </View>
        </Card>

        {/* Server Stats */}
        <Text style={styles.sectionTitle}>服务器状态</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="总数量"
            value={serverStats?.total || 0}
            color={COLORS.primary}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="在线"
            value={serverStats?.online || 0}
            color={COLORS.success}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="离线"
            value={serverStats?.offline || 0}
            color={COLORS.error}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="维护中"
            value={serverStats?.maintenance || 0}
            color={COLORS.warning}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
        </View>

        {/* GPU Stats */}
        <Text style={styles.sectionTitle}>GPU 状态</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="总数"
            value={gpuStats?.total || 0}
            color={COLORS.primary}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="可用"
            value={gpuStats?.available || 0}
            color={COLORS.success}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="已分配"
            value={gpuStats?.allocated || 0}
            color={COLORS.info}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="维护中"
            value={gpuStats?.maintenance || 0}
            color={COLORS.warning}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
        </View>

        {/* Task Stats */}
        <Text style={styles.sectionTitle}>任务状态</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="待执行"
            value={taskStats?.pending || 0}
            color={COLORS.info}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="运行中"
            value={taskStats?.running || 0}
            color={COLORS.primary}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="已完成"
            value={taskStats?.completed || 0}
            color={COLORS.success}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
          <StatCard
            title="失败"
            value={taskStats?.failed || 0}
            color={COLORS.error}
            style={[styles.statCard, { width: CARD_WIDTH }]}
          />
        </View>

        {/* Last Refresh */}
        {lastRefresh && (
          <Text style={styles.lastRefresh}>
            最后更新: {new Date(lastRefresh).toLocaleTimeString()}
          </Text>
        )}
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
  header: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
  },
  greeting: {
    fontSize: FONT_SIZES.xxl,
    color: COLORS.textSecondary,
  },
  userName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  quickActions: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statCard: {
    marginBottom: SPACING.md,
  },
  lastRefresh: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});