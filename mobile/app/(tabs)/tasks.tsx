import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBadge, PriorityBadge, ListItem } from '../../src/components';
import { COLORS, SPACING, FONT_SIZES } from '../../src/constants';
import { useAppStore } from '../../src/store/appStore';
import { Task } from '../../src/types';

export default function TasksScreen() {
  const router = useRouter();
  const { tasks, tasksLoading, taskStats, fetchTasks, fetchTaskStats } = useAppStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchTasks();
    fetchTaskStats();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchTasks(), fetchTaskStats()]);
    setRefreshing(false);
  }, [fetchTasks, fetchTaskStats]);

  const renderTask = ({ item }: { item: Task }) => {
    return (
      <ListItem
        title={item.name}
        subtitle={`优先级: ${item.priority}`}
        rightContent={
          <View style={styles.taskRight}>
            <StatusBadge status={item.status} type="task" size="small" />
          </View>
        }
        onPress={() => router.push(`/tasks/${item.id}`)}
      />
    );
  };

  const renderEmpty = () => {
    if (tasksLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>暂无任务数据</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{taskStats?.total || 0}</Text>
          <Text style={styles.statLabel}>总数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.info }]}>
            {taskStats?.pending || 0}
          </Text>
          <Text style={styles.statLabel}>待执行</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>
            {taskStats?.running || 0}
          </Text>
          <Text style={styles.statLabel}>运行中</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        renderItem={renderTask}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: SPACING.md,
  },
  taskRight: {
    alignItems: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.base,
    color: COLORS.textSecondary,
  },
});