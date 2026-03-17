# LSM 开发环境指南

> 记录 LSM 项目的开发调试流程

## 环境架构

| 环境 | 前端端口 | 后端端口 | 说明 |
|------|---------|---------|------|
| **开发环境** | 8081 | 8080 | 直接运行，支持热重载 |
| **生产环境** | 80 | 8080 | Docker 容器部署 |

## 开发环境启动

### 一键启动
```bash
cd /root/.openclaw/workspace/lsm-project
./scripts/dev.sh start
```

### 其他命令
```bash
./scripts/dev.sh stop     # 停止开发环境
./scripts/dev.sh restart  # 重启开发环境
./scripts/dev.sh status   # 查看运行状态
./scripts/dev.sh logs     # 查看日志
```

### 访问地址
- 前端: http://localhost:8081 (Vite 开发服务器)
- 后端: http://localhost:8080 (Node.js + ts-node-dev)

## 开发流程

```
┌─────────────────────────────────────────────────────────────┐
│                    开发调试流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 修改代码                                                 │
│     ├── 前端: src/frontend/src/**                           │
│     └── 后端: src/backend/src/**                            │
│                                                              │
│  2. 自动热重载                                               │
│     ├── 前端: Vite HMR (保存即刷新)                         │
│     └── 后端: ts-node-dev (保存即重启)                      │
│                                                              │
│  3. 测试验证                                                 │
│     └── 浏览器访问 http://localhost:8081                    │
│                                                              │
│  4. 测试通过后打包部署                                       │
│     ├── cd lsm-project                                       │
│     ├── docker-compose build backend frontend               │
│     └── docker-compose up -d                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 生产环境部署

### 构建并部署
```bash
cd /root/.openclaw/workspace/lsm-project

# 构建后端
cd src/backend
npm run build
cd ../..

# 构建 Docker 镜像
docker-compose build backend frontend

# 启动生产容器
docker-compose up -d
```

### 端口分配
- 80: 生产前端 (Docker Nginx)
- 8080: 后端 API
- 8081: 开发前端 (非 Docker 时)

## 注意事项

1. **开发环境与生产环境互斥**
   - 开发环境使用 8081 端口
   - 生产环境的 Docker 容器也绑定 8081
   - 启动开发环境前需要停止 Docker 前端容器: `docker stop lsm-frontend`

2. **数据库连接**
   - 开发环境连接 Docker 中的 PostgreSQL (端口 15432)
   - 数据库配置在 `.env` 文件中

3. **Redis 连接**
   - 开发环境连接 Docker 中的 Redis (端口 16379)

## 故障排查

### 前端无法访问后端 API
检查 vite.config.ts 中的 proxy 配置：
```typescript
server: {
  port: 8081,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

### 后端启动失败
检查环境变量和数据库连接：
```bash
cd src/backend
cat .env  # 确认 DATABASE_URL 配置正确
npx prisma generate  # 重新生成 Prisma Client
```

---

*创建时间: 2026-03-17*
*最后更新: 2026-03-17*