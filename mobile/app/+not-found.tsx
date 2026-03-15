import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '页面未找到' }} />
      <View style={styles.container}>
        <Text style={styles.title}>404</Text>
        <Text style={styles.text}>页面未找到</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>返回首页</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 10,
  },
  link: {
    marginTop: 20,
  },
  linkText: {
    color: '#1890ff',
    fontSize: 16,
  },
});