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
import { Card, StatusBadge, ListItem } from '../../components';
import { COLORS, SPACING, FONT_SIZES } from '../../constants';
import { useAppStore } from '../../store/appStore';
import { Server } from '../../types';

export default function ServersScreen() {
  const router = useRouter();
  const { servers, serversLoading, fetchServers, serverStats } = useAppStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchServers();
    setRefreshing(false);
  }, [fetchServers]);

  const renderServer = ({ item }: { item: Server }) => {
    return (
      <ListItem
        title={item.name}
        subtitle={`${item.ip} · ${item.gpuCount || 0} GPU`}
        rightContent={
          <StatusBadge status={item.status} type="server" size="small" />
        }
        onPress={() => router.push(`/servers/${item.id}`)}
      />
    );
  };

  const renderEmpty = () => {
    if (serversLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>暂无服务器数据</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{serverStats?.total || 0}</Text>
          <Text style={styles.statLabel}>总数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>
            {serverStats?.online || 0}
          </Text>
          <Text style={styles.statLabel}>在线</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.error }]}>
            {serverStats?.offline || 0}
          </Text>
          <Text style={styles.statLabel}>离线</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={servers}
        keyExtractor={(item) => item.id}
        renderItem={renderServer}
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
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
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