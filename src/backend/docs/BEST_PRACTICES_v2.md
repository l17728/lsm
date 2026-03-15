# LSM 项目最佳实践 v2.0 (Best Practices)

**版本**: 2.0  
**创建日期**: 2026-03-13  
**状态**: 🟢 生产就绪  
**维护者**: AI 项目经理

---

## 📋 目录

1. [开发最佳实践](#开发最佳实践)
2. [运维最佳实践](#运维最佳实践)
3. [项目管理最佳实践](#项目管理最佳实践)
4. [代码规范](#代码规范)
5. [Git 工作流](#git-工作流)
6. [测试策略](#测试策略)
7. [性能优化](#性能优化)
8. [安全检查](#安全检查)

---

## 🎯 开发最佳实践

### 1. 文档驱动开发 (Documentation-First)

**原则**: 先写文档，再写代码

**流程**:
```
需求分析 → 技术方案 → 文档评审 → 代码实现 → 测试验证 → 文档更新
```

**实践要点**:
- ✅ 每个功能开发前创建技术方案文档
- ✅ API 变更先更新 Swagger/OpenAPI 规范
- ✅ 代码注释解释"为什么"而不是"是什么"
- ✅ README 保持最新，包含快速开始指南

**模板**:
```markdown
# 功能名称

## 背景
为什么需要这个功能

## 方案
如何实现

## API 变更
接口定义

## 测试计划
如何验证

## 风险评估
潜在问题
```

---

### 2. 类型安全优先 (Type Safety First)

**原则**: TypeScript 严格模式，零 `any` 容忍

**实践要点**:
```typescript
// ✅ 推荐：明确类型定义
interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
}

// ✅ 推荐：使用枚举
enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// ❌ 避免：any 类型
function getUser(id: any): any { }

// ❌ 避免：隐式 any
const users = []; // 应该是：const users: User[] = [];
```

**tsconfig.json 配置**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

### 3. 错误处理模式 (Error Handling Pattern)

**原则**: 统一错误格式，友好错误信息

**标准错误响应**:
```typescript
{
  success: false,
  error: {
    code: 'ERR_VALIDATION',
    message: '用户友好的错误信息',
    details: {
      field: 'email',
      issue: '无效的邮箱格式'
    },
    timestamp: '2026-03-13T14:00:00Z'
  }
}
```

**错误分类**:
```typescript
// 业务错误
class BusinessError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

// 系统错误
class SystemError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500
  ) {
    super(message);
  }
}
```

**全局错误中间件**:
```typescript
app.use((err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  if (err instanceof BusinessError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // 系统错误
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    }
  });
});
```

---

### 4. 异步操作处理 (Async Handling)

**原则**: 统一使用 async/await，避免回调地狱

**实践要点**:
```typescript
// ✅ 推荐：async/await + try/catch
async function getUserWithCache(userId: string): Promise<User> {
  try {
    // 尝试从缓存获取
    const cached = await cache.get(`user:${userId}`);
    if (cached) return cached;

    // 从数据库获取
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BusinessError('USER_NOT_FOUND', '用户不存在');

    // 写入缓存
    await cache.set(`user:${userId}`, user, 3600);
    return user;
  } catch (error) {
    logger.error('Failed to get user', { userId, error });
    throw error;
  }
}

// ✅ 推荐：并行处理独立操作
async function getDashboardData(userId: string) {
  const [servers, tasks, gpus] = await Promise.all([
    serverService.getUserServers(userId),
    taskService.getUserTasks(userId),
    gpuService.getUserAllocations(userId)
  ]);

  return { servers, tasks, gpus };
}

// ❌ 避免：串行处理独立操作
const servers = await serverService.getUserServers(userId);
const tasks = await taskService.getUserTasks(userId); // 不必要的等待
const gpus = await gpuService.getUserAllocations(userId);
```

---

### 5. 依赖注入 (Dependency Injection)

**原则**: 服务依赖通过构造函数注入，便于测试

**实践要点**:
```typescript
// ✅ 推荐：构造函数注入
class TaskService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService,
    private emailService: EmailService
  ) {}

  async createTask(data: CreateTaskDto) {
    // 使用依赖
    const task = await this.prisma.task.create({ data });
    await this.cache.invalidate('taskList');
    await this.emailService.sendTaskNotification(task);
    return task;
  }
}

// ✅ 测试时轻松 Mock
const mockPrisma = new MockPrisma();
const mockCache = new MockCache();
const mockEmail = new MockEmail();
const service = new TaskService(mockPrisma, mockCache, mockEmail);
```

---

## 🔧 运维最佳实践

### 1. Docker 多阶段构建

**原则**: 最小化镜像，最大化安全

**Backend Dockerfile**:
```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER nodejs

EXPOSE 4000
CMD ["node", "dist/index.js"]
```

**收益**:
- 镜像大小减少 75%
- 构建时间减少 40%
- 安全性提升 (非 root 用户)

---

### 2. 环境变量管理

**原则**: 敏感信息不提交，环境隔离配置

**目录结构**:
```
.env.example          # 模板 (提交到 Git)
.env.development      # 开发环境 (不提交)
.env.staging          # 预发布环境 (不提交)
.env.production       # 生产环境 (不提交)
```

**.env.example 模板**:
```env
# 服务器配置
NODE_ENV=development
PORT=4000

# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/lsm"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=change-me

# JWT
JWT_SECRET=change-me-to-random-string
JWT_EXPIRES_IN=15m

# 邮件
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=change-me
```

**启动脚本**:
```bash
#!/bin/bash
# quickstart.sh

if [ ! -f .env ]; then
  echo "⚠️  .env not found. Copying from .env.example..."
  cp .env.example .env
  echo "✅ Please edit .env with your settings"
  exit 1
fi

docker-compose up -d
```

---

### 3. 健康检查 (Health Checks)

**原则**: 所有服务必须有健康检查端点

**实现**:
```typescript
// GET /health
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: checkMemory(),
    uptime: process.uptime()
  };

  const isHealthy = Object.values(checks).every(
    check => check === true || check.status === 'ok'
  );

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
});
```

**Docker 健康检查**:
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

### 4. 日志管理

**原则**: 结构化日志，分级记录

**配置**:
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'lsm-backend' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// 使用
logger.info('User logged in', { userId: 123, ip: '192.168.1.1' });
logger.error('Database connection failed', { error, retryCount: 3 });
```

**日志级别**:
- `error`: 系统错误，需要立即处理
- `warn`: 警告，可能影响功能
- `info`: 一般信息，用户操作
- `debug`: 调试信息，开发使用

---

### 5. 监控告警

**原则**: 关键指标监控，阈值告警

**Prometheus 指标**:
```typescript
import { Counter, Gauge, Histogram } from 'prom-client';

// 请求计数器
const httpRequestTotal = new Counter({
  name: 'lsm_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status']
});

// 响应时间直方图
const httpRequestDuration = new Histogram({
  name: 'lsm_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

// 活跃连接数
const activeConnections = new Gauge({
  name: 'lsm_active_connections',
  help: 'Number of active connections'
});
```

**告警规则**:
```yaml
groups:
  - name: lsm-alerts
    rules:
      - alert: HighCPUUsage
        expr: lsm_health_cpu_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高 CPU 使用率"
          description: "CPU 使用率超过 90% 持续 5 分钟"

      - alert: DatabaseDown
        expr: lsm_health_database == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "数据库不可用"
```

---

## 📊 项目管理最佳实践

### 1. 任务分解方法

**原则**: 大任务拆小，小任务可执行

**分解标准**:
- ✅ 每个任务可在 4-8 小时内完成
- ✅ 任务有明确的完成标准 (Definition of Done)
- ✅ 任务之间有清晰的依赖关系
- ✅ 任务可独立测试和验证

**示例**:
```
❌ 大任务：实现用户管理系统

✅ 拆分后:
  - [ ] 创建 User 模型和数据库迁移 (2h)
  - [ ] 实现用户注册 API (3h)
  - [ ] 实现用户登录 API (3h)
  - [ ] 实现 JWT 认证中间件 (2h)
  - [ ] 实现用户信息更新 API (2h)
  - [ ] 编写单元测试 (4h)
  - [ ] 编写 API 文档 (1h)
```

---

### 2. 进度跟踪

**原则**: 每日更新，透明可见

**每日报告模板**:
```markdown
# Day X 进度报告

## 今日完成
- [ ] 任务 1 ✅
- [ ] 任务 2 ✅

## 遇到的问题
- 问题描述
- 解决方案

## 明日计划
- [ ] 任务 3
- [ ] 任务 4

## 需要帮助
- 无 / 具体事项
```

**进度可视化**:
```
项目进度：████████████░░ 67% (10/15 天)
任务完成：████████████████ 100% (31/31)
代码质量：████████████░░ 82% (覆盖率)
```

---

### 3. 风险管理

**原则**: 早期识别，主动应对

**风险登记册**:
| 风险 | 概率 | 影响 | 缓解措施 | 状态 |
|------|------|------|---------|------|
| TypeScript 编译错误 | 中 | 高 | 每日类型检查 | ✅ 已解决 |
| 性能不达标 | 低 | 高 | 早期基准测试 | ✅ 已解决 |
| 依赖漏洞 | 中 | 中 | 定期 npm audit | 🟢 监控中 |

**风险应对策略**:
- **规避**: 改变计划避免风险
- **减轻**: 降低概率或影响
- **转移**: 外包或购买保险
- **接受**: 准备应急计划

---

### 4. 沟通机制

**原则**: 及时、透明、有效

**沟通渠道**:
- **每日站会**: 09:00, 15 分钟，同步进展
- **周会**: 周五 14:00, 1 小时，回顾和规划
- **即时消息**: 紧急问题，快速响应
- **文档**: 决策记录，知识沉淀

**沟通模板**:
```
【问题报告】
标题：简短描述
严重性：P0/P1/P2
影响：影响范围
现状：当前情况
需要：需要什么帮助
```

---

## 💻 代码规范

### 1. 命名规范

```typescript
// 变量和函数：camelCase
const userName = 'john';
function getUserById() { }

// 类和类型：PascalCase
class UserService { }
interface UserDto { }

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'http://localhost:4000';

// 私有成员：前缀下划线
class Cache {
  private _cache: Map<string, any>;
}

// 文件命名：kebab-case
user-service.ts
auth.middleware.ts
```

---

### 2. 代码组织

```typescript
// ✅ 推荐：标准文件结构
import { PrismaClient } from '@prisma/client';
import { CacheService } from '../services/cache.service';
import { BusinessError } from '../utils/errors';

// 常量
const DEFAULT_TTL = 3600;

// 类型定义
interface UserData {
  id: string;
  username: string;
}

// 类实现
export class UserService {
  constructor(
    private prisma: PrismaClient,
    private cache: CacheService
  ) {}

  async getUser(id: string): Promise<UserData> {
    // 实现
  }
}

// 导出
export default UserService;
```

---

### 3. 注释规范

```typescript
// ✅ 推荐：解释"为什么"
// 使用 Redis 缓存减少数据库压力，TTL 设为 7 天
// 因为用户会话数据访问频繁但变化少
await cache.set(`session:${userId}`, session, 604800);

// ✅ 推荐：复杂算法说明
// 使用 LRU 算法计算缓存优先级
// 公式：priority = (1 / (now - lastAccess)) * accessCount
const priority = calculatePriority(item);

// ❌ 避免：重复代码
// 设置用户名为 john
user.username = 'john';

// ❌ 避免：过时注释
// TODO: 修复这个 bug (已修复但未删除注释)
```

---

## 🔄 Git 工作流

### 1. 分支策略

```
main (生产)
  ↑
develop (开发)
  ↑
feature/* (功能分支)
  ↑
fix/* (修复分支)
  ↑
hotfix/* (紧急修复)
```

**分支命名**:
```bash
# 功能分支
git checkout -b feature/user-authentication
git checkout -b feature/gpu-allocation

# 修复分支
git checkout -b fix/login-validation
git checkout -b fix/memory-leak

# 紧急修复
git checkout -b hotfix/security-patch
```

---

### 2. 提交信息规范

**Conventional Commits**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具

**示例**:
```bash
feat(auth): 实现双因素认证

添加 TOTP 双因素认证支持
- 生成 QR 码
- 验证 TOTP 码
- 备份代码生成

Closes #123

BREAKING CHANGE: 登录 API 需要 2FA 验证码
```

---

### 3. 代码审查清单

**审查前**:
- [ ] 代码通过所有测试
- [ ] 代码覆盖率不降低
- [ ] TypeScript 编译通过
- [ ] 代码格式化 (Prettier)

**审查中**:
- [ ] 代码功能正确
- [ ] 错误处理完善
- [ ] 有适当的注释
- [ ] 无敏感信息
- [ ] 性能考虑充分

**审查后**:
- [ ] 文档已更新
- [ ] Git 提交信息规范
- [ ] 相关 Issue 已关联
- [ ] 部署计划明确

---

## 🧪 测试策略

### 1. 测试金字塔

```
       /\
      /  \
     / E2E \       10% (10-20 个)
    /------\
   /        \
  /Integration\    20% (20-40 个)
 /------------\
/   Unit Test  \   70% (70+ 个)
----------------
```

---

### 2. 单元测试

**原则**: 测试单个函数/方法，快速执行

**示例**:
```typescript
describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = new MockPrisma();
    mockCache = new MockCache();
    authService = new AuthService(mockPrisma, mockCache);
  });

  describe('login', () => {
    it('should return token on valid credentials', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        username: 'test',
        passwordHash: await bcrypt.hash('password', 12)
      });

      // Act
      const result = await authService.login('test', 'password');

      // Assert
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });

    it('should throw error on invalid credentials', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.login('invalid', 'password')
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });
});
```

---

### 3. 集成测试

**原则**: 测试多个组件协作，使用真实数据库

**示例**:
```typescript
describe('User API (Integration)', () => {
  let app: Express;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    app = createApp(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it('POST /api/users should create user', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({
        username: 'test',
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.username).toBe('test');
  });
});
```

---

### 4. E2E 测试

**原则**: 模拟真实用户操作，覆盖核心流程

**示例** (Playwright):
```typescript
import { test, expect } from '@playwright/test';

test('user can login and view dashboard', async ({ page }) => {
  // 访问登录页
  await page.goto('http://localhost:3000/login');

  // 输入凭证
  await page.fill('[name="username"]', 'testuser');
  await page.fill('[name="password"]', 'password123');

  // 提交登录
  await page.click('button[type="submit"]');

  // 验证跳转到仪表盘
  await expect(page).toHaveURL('http://localhost:3000/dashboard');

  // 验证显示欢迎信息
  await expect(page.locator('text=Welcome')).toBeVisible();
});
```

---

## ⚡ 性能优化

### 1. 数据库优化

**索引策略**:
```sql
-- 高频查询字段
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);

-- 复合索引 (查询顺序重要)
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);

-- 部分索引 (仅索引活跃数据)
CREATE INDEX idx_active_servers ON servers(status) 
  WHERE status = 'ONLINE';
```

**查询优化**:
```typescript
// ✅ 推荐：只查询需要的字段
const users = await prisma.user.findMany({
  select: {
    id: true,
    username: true,
    email: true
  }
});

// ✅ 推荐：使用 include 避免 N+1
const tasks = await prisma.task.findMany({
  include: {
    user: true,
    server: true
  }
});

// ❌ 避免：查询所有字段
const users = await prisma.user.findMany();

// ❌ 避免：N+1 查询
const tasks = await prisma.task.findMany();
for (const task of tasks) {
  const user = await prisma.user.findUnique({ 
    where: { id: task.userId } 
  });
}
```

---

### 2. 缓存策略

**TTL 配置**:
```typescript
const CACHE_TTL = {
  // 用户相关 (低频)
  userSession: 604800,      // 7 天
  userList: 1800,           // 30 分钟
  
  // 服务器相关 (中频)
  serverList: 900,          // 15 分钟
  serverMetrics: 600,       // 10 分钟
  
  // GPU 相关 (高频)
  gpuList: 600,             // 10 分钟
  gpuStatus: 120,           // 2 分钟
  
  // 任务相关 (实时)
  taskList: 300,            // 5 分钟
};
```

**缓存模式**:
```typescript
// Cache-Aside (旁路缓存)
async function getUser(id: string) {
  // 1. 尝试缓存
  const cached = await cache.get(`user:${id}`);
  if (cached) return cached;

  // 2. 查询数据库
  const user = await db.user.findUnique({ where: { id } });
  
  // 3. 写入缓存
  await cache.set(`user:${id}`, user, CACHE_TTL.userSession);
  
  return user;
}

// Write-Through (写穿透)
async function updateUser(id: string, data: UserData) {
  // 同时更新数据库和缓存
  const user = await db.user.update({ where: { id }, data });
  await cache.set(`user:${id}`, user, CACHE_TTL.userSession);
  return user;
}
```

---

### 3. 前端优化

**代码分割**:
```typescript
// 路由级别代码分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// 组件级别代码分割
const HeavyChart = lazy(() => import('./components/HeavyChart'));
```

**图片优化**:
```bash
# 压缩图片
imagemin src/images/* --out-dir=dist/images

# 使用 WebP 格式
<img src="image.webp" alt="description" />

# 懒加载
<img src="image.jpg" loading="lazy" alt="description" />
```

**打包优化**:
```javascript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['antd', '@ant-design/icons']
        }
      }
    }
  }
};
```

---

## 🔒 安全检查

### 1. 认证安全

**JWT 配置**:
```typescript
const JWT_CONFIG = {
  algorithm: 'HS256' as const,
  expiresIn: '15m',        // 访问令牌
  refreshExpiresIn: '7d'   // 刷新令牌
};

// 令牌生成
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET!,
  { expiresIn: JWT_CONFIG.expiresIn }
);
```

**密码策略**:
```typescript
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  maxAge: 90 // 天
};

// 密码哈希
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);
```

---

### 2. 输入验证

**Zod Schema**:
```typescript
import { z } from 'zod';

const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/, '必须包含大写字母')
    .regex(/[0-9]/, '必须包含数字'),
  role: z.enum(['user', 'admin']).default('user')
});

// 使用
try {
  const validatedData = createUserSchema.parse(req.body);
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        details: error.errors
      }
    });
  }
}
```

---

### 3. 速率限制

**配置**:
```typescript
import rateLimit from 'express-rate-limit';

// 认证端点 (严格)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 10,              // 10 请求
  message: {
    success: false,
    error: {
      code: 'ERR_RATE_LIMIT',
      message: '请求频率超限，请稍后重试'
    }
  }
});

// API 端点 (宽松)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});

// 导出端点 (严格)
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});
```

---

### 4. 安全头

**Helmet 配置**:
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' }
}));
```

---

## 📈 持续改进

### 回顾会议模板

**会议议程** (1 小时):
1. 数据回顾 (10 分钟)
   - 完成的任务
   - 质量指标
   - 进度对比

2. 成功经验 (15 分钟)
   - 哪些做得好
   - 为什么成功
   - 如何保持

3. 改进空间 (15 分钟)
   - 哪些可以改进
   - 根本原因分析
   - 改进建议

4. 行动计划 (15 分钟)
   - 优先级排序
   - 责任分配
   - 时间计划

5. 总结 (5 分钟)
   - 关键收获
   - 下周重点

---

### 指标追踪

**开发指标**:
- 代码提交频率
- 代码审查时间
- Bug 修复时间
- 测试覆盖率趋势

**质量指标**:
- 生产 Bug 数量
- 性能指标趋势
- 安全评分
- 用户满意度

**效率指标**:
- 任务完成时间
- 部署频率
- 部署成功率
- 平均恢复时间 (MTTR)

---

---

## 🔄 自动扩缩容最佳实践

### 1. 策略设计原则

**原则**: 选择合适的扩缩容策略，平衡响应速度和稳定性

**策略选择指南**:
| 策略类型 | 适用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| REACTIVE | 负载波动大、难以预测 | 简单可靠、即时响应 | 响应滞后 |
| PREDICTIVE | 负载有规律、可预测 | 提前准备、无延迟 | 需要历史数据 |
| SCHEDULED | 固定时间周期 | 可控、可预期 | 不适应突发 |
| HYBRID | 生产环境推荐 | 综合优势 | 配置复杂 |

**实践要点**:
```typescript
// ✅ 推荐：生产环境使用混合策略
const hybridPolicy = {
  name: '生产环境混合策略',
  strategyType: 'HYBRID',
  // 预测性：基于历史数据提前扩容
  predictive: {
    lookAheadMinutes: 15,
    historyDays: 7
  },
  // 响应式：应对突发流量
  reactive: {
    metricType: 'CPU_USAGE',
    scaleUpThreshold: 80,
    scaleDownThreshold: 30
  }
};

// ✅ 推荐：设置安全边界
const safePolicy = {
  minInstances: 2,      // 最小实例数，保证高可用
  maxInstances: 50,    // 最大实例数，控制成本
  cooldownPeriod: 300  // 冷却期，防止抖动
};

// ❌ 避免：过激进的扩缩容
const badPolicy = {
  scaleUpThreshold: 50,   // 阈值过低
  scaleDownThreshold: 45, // 上下阈值太接近
  cooldownPeriod: 30      // 冷却期太短
};
```

---

### 2. 指标选择

**原则**: 选择最能反映负载的指标

**指标配置示例**:
```typescript
// CPU 密集型任务（训练、推理）
const cpuPolicy = {
  metricType: 'CPU_USAGE',
  scaleUpThreshold: 80,
  scaleDownThreshold: 30,
  scaleUpStep: 2,
  scaleDownStep: 1
};

// 内存密集型任务（数据处理）
const memoryPolicy = {
  metricType: 'MEMORY_USAGE',
  scaleUpThreshold: 85,
  scaleDownThreshold: 40,
  scaleUpStep: 1,
  scaleDownStep: 1
};

// GPU 任务（AI 训练）
const gpuPolicy = {
  metricType: 'GPU_USAGE',
  scaleUpThreshold: 85,
  scaleDownThreshold: 30,
  scaleUpStep: 2,
  scaleDownStep: 1
};

// 任务队列（异步处理）
const queuePolicy = {
  metricType: 'TASK_QUEUE_LENGTH',
  scaleUpThreshold: 50,
  scaleDownThreshold: 10,
  scaleUpStep: 3,
  scaleDownStep: 1
};
```

---

### 3. 冷却机制

**原则**: 防止扩缩容频繁抖动

```typescript
// ✅ 推荐：根据场景设置冷却期
const COOLDOWN_CONFIG = {
  // 稳定负载：较长冷却期
  stable: {
    scaleUpCooldown: 300,    // 5 分钟
    scaleDownCooldown: 600    // 10 分钟
  },
  // 波动负载：中等冷却期
  variable: {
    scaleUpCooldown: 180,    // 3 分钟
    scaleDownCooldown: 300   // 5 分钟
  },
  // 突发负载：短冷却期
  burst: {
    scaleUpCooldown: 60,     // 1 分钟
    scaleDownCooldown: 300   // 5 分钟（缩容保守）
  }
};

// ❌ 避免：无冷却期
const noCooldown = {
  cooldownPeriod: 0  // 会导致频繁扩缩容
};
```

---

### 4. 监控与告警

**关键监控指标**:
```yaml
# 扩缩容事件监控
- alert: FrequentScaling
  expr: rate(lsm_autoscaling_action_total[5m]) > 0.1
  for: 5m
  annotations:
    summary: "扩缩容频率过高"
    description: "过去 5 分钟扩缩容超过 0.1 次/秒"

- alert: InstanceAtMax
  expr: lsm_autoscaling_current_instances == lsm_autoscaling_policy_max_instances
  for: 10m
  annotations:
    summary: "实例数达到上限"
    description: "考虑增加最大实例数上限"

- alert: InstanceAtMin
  expr: lsm_autoscaling_current_instances == lsm_autoscaling_policy_min_instances
  for: 30m
  annotations:
    summary: "实例数持续在下限"
    description: "可能需要调整缩容阈值"
```

---

### 5. 常见问题处理

**问题 1: 扩缩容抖动**
```
症状: 实例数在短时间内频繁变化
原因: 冷却期太短、阈值间隔太小
解决: 增加冷却期、拉大上下阈值差距
```

**问题 2: 扩容不及时**
```
症状: 负载高峰时服务响应慢
原因: 阈值设置过高、扩容步长太小
解决: 降低扩容阈值、增加扩容步长
```

**问题 3: 缩容过度**
```
症状: 缩容后服务不可用
原因: 缩容阈值过高、最小实例数太低
解决: 降低缩容阈值、增加最小实例数
```

---

## 🛠️ 故障自愈最佳实践

### 1. 故障分级策略

**原则**: 根据影响范围和紧急程度分级处理

**故障分级标准**:
| 级别 | 名称 | 影响范围 | 响应时间 | 自动修复 |
|------|------|---------|---------|---------|
| CRITICAL | 关键 | 系统不可用 | 立即 | 需确认 |
| HIGH | 高 | 功能受损 | 5 分钟 | 自动 |
| MEDIUM | 中 | 性能下降 | 15 分钟 | 自动 |
| LOW | 低 | 潜在风险 | 30 分钟 | 自动 |

**配置示例**:
```typescript
// ✅ 推荐：明确的故障分级
const faultRules = {
  CRITICAL: {
    autoRepair: false,        // 需人工确认
    notifyImmediately: true,
    escalation: 'on-call'
  },
  HIGH: {
    autoRepair: true,
    maxRepairAttempts: 3,
    notifyAfterRepair: true
  },
  MEDIUM: {
    autoRepair: true,
    maxRepairAttempts: 2,
    notifyOnFailure: true
  },
  LOW: {
    autoRepair: true,
    maxRepairAttempts: 1,
    dailyReport: true
  }
};
```

---

### 2. 修复动作设计

**原则**: 安全、可逆、有超时

**修复动作模板**:
```typescript
// ✅ 推荐：安全修复动作
const repairActions = {
  // 低风险：自动执行
  lowRisk: {
    type: 'CLEAR_CACHE',
    requiresConfirmation: false,
    timeout: 30,
    retryCount: 2,
    retryDelay: 10
  },
  
  // 中风险：记录后执行
  mediumRisk: {
    type: 'RESTART_SERVICE',
    requiresConfirmation: false,
    timeout: 60,
    retryCount: 1,
    retryDelay: 30,
    preAction: 'backup_state',
    postAction: 'verify_health'
  },
  
  // 高风险：需要确认
  highRisk: {
    type: 'REBOOT_SERVER',
    requiresConfirmation: true,
    timeout: 120,
    retryCount: 0,
    preAction: 'drain_connections',
    postAction: 'verify_cluster'
  }
};

// ❌ 避免：危险操作无保护
const dangerousAction = {
  type: 'DELETE_DATA',
  requiresConfirmation: false,  // 危险！
  timeout: 0                     // 无超时限制
};
```

---

### 3. 故障检测配置

**原则**: 检测准确，减少误报

```typescript
// ✅ 推荐：合理的检测阈值
const detectionConfig = {
  // 服务器离线检测
  serverOffline: {
    metric: 'server_status',
    operator: 'eq',
    threshold: 0,
    duration: 60,           // 持续 60 秒才判定
    checkInterval: 10      // 每 10 秒检查一次
  },
  
  // CPU 高负载检测
  highCpu: {
    metric: 'cpu_usage',
    operator: 'gt',
    threshold: 90,
    duration: 120,          // 持续 2 分钟
    checkInterval: 15
  },
  
  // 内存不足检测
  highMemory: {
    metric: 'memory_usage',
    operator: 'gt',
    threshold: 90,
    duration: 180,          // 持续 3 分钟
    checkInterval: 30
  }
};

// ❌ 避免：过于敏感的检测
const sensitiveConfig = {
  highCpu: {
    threshold: 70,          // 阈值太低
    duration: 10,           // 持续时间太短
    checkInterval: 1        // 检查太频繁
  }
};
```

---

### 4. 人工确认机制

**原则**: 高风险操作必须人工确认

```typescript
// 需要确认的操作
const CONFIRMATION_REQUIRED = [
  'REBOOT_SERVER',
  'RESET_GPU',
  'SWITCH_DATABASE',
  'SCALE_DOWN_ALL',
  'DELETE_RESOURCES'
];

// 确认流程
interface RepairConfirmation {
  faultEventId: string;
  action: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact: string;
  timeout: number;
  approver?: string;
}

// ✅ 推荐：多级确认
async function confirmRepair(confirmation: RepairConfirmation) {
  if (confirmation.risk === 'CRITICAL') {
    // 关键故障：需要管理员确认
    await notifyAdmin(confirmation);
    return waitForConfirmation(confirmation.faultEventId, 300);
  }
  
  if (confirmation.risk === 'HIGH') {
    // 高风险：5 分钟无人干预则自动执行
    await notifyTeam(confirmation);
    return waitForConfirmationOrAuto(confirmation.faultEventId, 300);
  }
  
  // 中低风险：直接执行
  return true;
}
```

---

### 5. 修复历史追踪

**原则**: 记录所有修复操作，便于复盘

```typescript
// 修复记录结构
interface RepairHistory {
  id: string;
  faultEventId: string;
  faultType: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  result: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  startTime: Date;
  endTime: Date;
  duration: number;
  attempts: number;
  operator: 'AUTO' | 'MANUAL';
  notes?: string;
}

// ✅ 推荐：定期分析修复历史
async function analyzeRepairHistory(days: number) {
  const history = await getRepairHistory(days);
  
  return {
    totalRepairs: history.length,
    successRate: history.filter(h => h.result === 'SUCCESS').length / history.length,
    avgRepairTime: history.reduce((sum, h) => sum + h.duration, 0) / history.length,
    frequentFaults: countBy(history, 'faultType'),
    failedActions: history.filter(h => h.result === 'FAILED')
  };
}
```

---

## 🔔 智能告警降噪最佳实践

### 1. 告警去重配置

**原则**: 相同告警合并，减少重复通知

```typescript
// ✅ 推荐：合理的去重配置
const dedupConfig = {
  // 去重窗口：相同告警在窗口内只保留一个
  dedupWindow: 300,           // 5 分钟
  
  // 去重键：用于判断告警是否相同
  fingerprintFields: [
    'alertName',
    'serverId',
    'severity'
  ],
  
  // 去重计数：记录重复次数
  countDuplicates: true,
  
  // 首次立即通知，后续抑制
  notifyFirstOnly: true
};

// ❌ 避免：去重窗口过短
const badDedup = {
  dedupWindow: 30,            // 太短，无法有效去重
  fingerprintFields: ['*']     // 太宽泛，不同告警被合并
};
```

---

### 2. 告警聚合策略

**原则**: 相关告警合并，减少通知数量

```typescript
// ✅ 推荐：按维度聚合
const aggregationConfig = {
  // 聚合窗口
  aggregationWindow: 600,     // 10 分钟
  
  // 聚合维度
  groupBy: [
    'serverId',               // 按服务器
    'severity',               // 按严重程度
    'alertType'               // 按告警类型
  ],
  
  // 聚合策略
  strategy: {
    // 同一服务器的多个告警
    sameServer: {
      maxWait: 300,           // 最多等待 5 分钟
      maxCount: 10            // 最多聚合 10 个告警
    },
    // 同类型的多个告警
    sameType: {
      maxWait: 600,           // 最多等待 10 分钟
      maxCount: 20
    }
  },
  
  // 聚合通知模板
  notificationTemplate: {
    title: '[{severity}] {alertType} - {count} 个告警',
    body: '服务器 {serverId} 在过去 {duration} 分钟内产生 {count} 个告警'
  }
};
```

---

### 3. 告警抑制规则

**原则**: 源告警存在时抑制相关告警

```typescript
// ✅ 推荐：合理的抑制规则
const inhibitionRules = [
  {
    name: '服务器离线抑制',
    // 源告警：服务器离线
    sourceMatch: {
      alertName: 'ServerOffline',
      severity: 'critical'
    },
    // 目标告警：同一服务器的其他告警
    targetMatch: {
      serverId: '{source.serverId}'
    },
    // 抑制条件
    equal: ['serverId'],
    reason: '服务器离线时，抑制该服务器的其他告警'
  },
  {
    name: '网络故障抑制',
    sourceMatch: {
      alertName: 'NetworkOutage',
      severity: 'critical'
    },
    targetMatch: {
      alertType: 'connectivity'
    },
    equal: ['region'],
    reason: '网络故障时，抑制该区域的所有连接告警'
  }
];

// ❌ 避免：过度抑制
const badInhibition = {
  sourceMatch: { severity: 'warning' },  // 源级别太低
  targetMatch: { '*' },                    // 目标太宽泛
  equal: []                                // 无匹配条件
};
```

---

### 4. 告警静默管理

**原则**: 维护窗口期间静默告警

```typescript
// ✅ 推荐：规范的静默规则
const silenceRule = {
  name: '计划维护窗口',
  
  // 匹配条件
  matchers: [
    { field: 'serverId', operator: 'equals', value: 'server-001' },
    { field: 'severity', operator: 'notEquals', value: 'critical' }
  ],
  
  // 持续时间
  duration: 3600,              // 1 小时
  
  // 原因（必填）
  reason: '计划维护：系统升级',
  
  // 创建者
  createdBy: 'admin@example.com',
  
  // 自动过期
  autoExpire: true
};

// 静默规则最佳实践
const silenceBestPractices = {
  // 始终记录原因
  requireReason: true,
  
  // 设置过期时间
  maxDuration: 86400,         // 最长 24 小时
  
  // 关键告警不静默
  excludeCritical: true,
  
  // 审批流程
  requireApproval: true
};
```

---

### 5. 告警优先级计算

**原则**: 多维度评估告警优先级

```typescript
// 优先级计算因子
interface PriorityFactors {
  severity: number;           // 严重程度权重
  frequency: number;          // 出现频率
  impact: number;             // 影响范围
  recency: number;            // 时间新鲜度
  acknowledged: boolean;      // 是否已确认
}

// ✅ 推荐：加权优先级计算
function calculatePriority(factors: PriorityFactors): number {
  const weights = {
    severity: 0.4,            // 严重程度最重要
    impact: 0.25,             // 影响范围次之
    frequency: 0.15,          // 频率
    recency: 0.2              // 新鲜度
  };
  
  let priority = 0;
  priority += weights.severity * factors.severity;
  priority += weights.impact * factors.impact;
  priority += weights.frequency * Math.min(factors.frequency / 10, 1);
  priority += weights.recency * (factors.recency ? 1 : 0.5);
  
  // 已确认的告警降低优先级
  if (factors.acknowledged) {
    priority *= 0.5;
  }
  
  return Math.round(priority * 100);
}

// 优先级分级
const priorityLevels = {
  P0: { min: 80, action: '立即处理', sla: 5 },   // 5 分钟
  P1: { min: 60, action: '优先处理', sla: 30 },  // 30 分钟
  P2: { min: 40, action: '正常处理', sla: 120 }, // 2 小时
  P3: { min: 20, action: '低优先级', sla: 480 }  // 8 小时
};
```

---

### 6. 效果监控

**降噪效果指标**:
```yaml
# Prometheus 告警规则
groups:
  - name: alert-dedup-metrics
    rules:
      - alert: LowDeduplicationRate
        expr: lsm_alert_deduplication_rate < 0.3
        for: 1h
        annotations:
          summary: "降噪率低于预期"
          description: "告警降噪率低于 30%，检查去重配置"

      - alert: TooManySilences
        expr: lsm_silence_rules_active > 10
        for: 30m
        annotations:
          summary: "静默规则过多"
          description: "活跃静默规则超过 10 个，可能掩盖重要告警"
```

**定期回顾**:
```typescript
// 每周降噪效果报告
interface WeeklyReport {
  rawAlerts: number;          // 原始告警数
  deduplicated: number;       // 去重后数量
  aggregated: number;         // 聚合后数量
  suppressed: number;        // 抑制数量
  silenced: number;          // 静默数量
  finalCount: number;        // 最终通知数
  
  reductionRate: number;      // 降噪率
  avgAckTime: number;        // 平均确认时间
}
```

---

**文档版本**: 2.1  
**创建日期**: 2026-03-13  
**最后更新**: 2026-03-15  
**维护者**: AI 项目经理  
**下次审查**: 2026-04-15
