import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZES } from '../../src/constants';
import { useAuthStore } from '../../src/store/authStore';
import { Redirect } from 'expo-router';

// Tab icons (simple text-based for MVP)
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{name}</Text>
);

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Show nothing while checking auth state
  if (isLoading) {
    return null;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '仪表盘',
          tabBarIcon: ({ focused }) => <TabIcon name="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="servers"
        options={{
          title: '服务器',
          tabBarIcon: ({ focused }) => <TabIcon name="🖥️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: '任务',
          tabBarIcon: ({ focused }) => <TabIcon name="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ focused }) => <TabIcon name="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 8,
    height: 60,
  },
  tabBarLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
});