# LSM Mobile App

实验室服务器管理系统移动端应用 - v3.1.0 MVP

## 功能特性

### 已完成功能 (MVP)
- ✅ 登录认证界面
- ✅ 仪表盘（服务器/GPU/任务统计概览）
- ✅ 服务器列表页面
- ✅ 任务列表页面
- ✅ 个人中心页面
- ✅ 下拉刷新
- ✅ 身份认证状态持久化

### 技术栈
- **框架**: React Native + Expo
- **路由**: Expo Router (文件系统路由)
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
- **存储**: AsyncStorage
- **语言**: TypeScript

## 项目结构

```
mobile/
├── app/                    # Expo Router 路由
│   ├── (auth)/            # 认证相关页面
│   │   ├── login.tsx      # 登录页
│   │   └── _layout.tsx
│   ├── (tabs)/            # 主要 Tab 页面
│   │   ├── index.tsx      # 仪表盘
│   │   ├── servers.tsx    # 服务器列表
│   │   ├── tasks.tsx      # 任务列表
│   │   ├── profile.tsx    # 个人中心
│   │   └── _layout.tsx
│   ├── _layout.tsx        # 根布局
│   └── index.tsx          # 入口重定向
├── src/
│   ├── components/        # UI 组件
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Input.tsx
│   ├── screens/           # 页面组件
│   │   ├── auth/
│   │   ├── dashboard/
│   │   └── servers/
│   ├── services/          # API 服务
│   │   └── api.ts
│   ├── store/             # 状态管理
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   ├── hooks/             # 自定义 Hooks
│   ├── types/             # TypeScript 类型
│   ├── constants/         # 常量配置
│   └── utils/             # 工具函数
├── assets/                # 静态资源
├── app.json               # Expo 配置
├── package.json
└── tsconfig.json
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm start
```

### 运行平台
```bash
# iOS 模拟器
npm run ios

# Android 模拟器
npm run android

# Web 浏览器
npm run web
```

## API 配置

修改 `src/constants/index.ts` 中的 `API_CONFIG.BASE_URL` 来配置后端 API 地址：

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:4000/api', // 修改为你的后端地址
  TIMEOUT: 30000,
};
```

## 后端 API 接口

移动端使用以下后端 API：

### 认证
- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/logout` - 登出

### 服务器
- `GET /api/servers` - 获取服务器列表
- `GET /api/servers/stats` - 获取服务器统计
- `GET /api/servers/:id` - 获取服务器详情

### GPU
- `GET /api/gpu/stats` - GPU 统计
- `POST /api/gpu/allocate` - 分配 GPU
- `POST /api/gpu/release/:id` - 释放 GPU
- `GET /api/gpu/my-allocations` - 我的分配

### 任务
- `GET /api/tasks` - 任务列表
- `GET /api/tasks/stats` - 任务统计
- `POST /api/tasks` - 创建任务
- `POST /api/tasks/:id/cancel` - 取消任务

## 构建发布

### 构建 APK (Android)
```bash
eas build --platform android --profile preview
```

### 构建 IPA (iOS)
```bash
eas build --platform ios --profile preview
```

## 版本信息

- **版本**: 3.1.0
- **状态**: MVP (最小可行产品)
- **更新日期**: 2026-03-14