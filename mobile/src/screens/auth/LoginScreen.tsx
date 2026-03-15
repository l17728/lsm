import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Input } from '../../components';
import { COLORS, SPACING, FONT_SIZES } from '../../constants';
import { useAuthStore } from '../../store/authStore';
import { apiService } from '../../services/api';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  const validate = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};
    
    if (!username.trim()) {
      newErrors.username = '请输入用户名';
    }
    
    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 6) {
      newErrors.password = '密码至少6位';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const response = await apiService.login({ username, password });
      
      if (response.success && response.data) {
        login(response.data.token, response.data.user);
        router.replace('/(tabs)');
      } else {
        Alert.alert('登录失败', response.error || '请检查用户名和密码');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('登录失败', error.response?.data?.error || '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>LSM</Text>
            <Text style={styles.title}>实验室服务器管理系统</Text>
            <Text style={styles.subtitle}>Laboratory Server Management</Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <Input
              label="用户名"
              placeholder="请输入用户名"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.username}
            />

            <Input
              label="密码"
              placeholder="请输入密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
            />

            <Button
              title="登录"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>v3.1.0 MVP</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  logo: {
    fontSize: 60,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  form: {
    marginBottom: SPACING.xxl,
  },
  loginButton: {
    marginTop: SPACING.lg,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
});