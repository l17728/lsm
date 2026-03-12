# 📋 LSM 项目第二阶段任务清单

**版本**: 1.0  
**更新时间**: 2026-03-12  
**状态**: 🟡 进行中

---

## 🔴 P0 任务（必须完成）

### 任务 1.1：Git 仓库初始化
| 属性 | 值 |
|------|-----|
| **ID** | TASK-001 |
| **负责人** | DevOps |
| **优先级** | P0 |
| **工作量** | 2 小时 |
| **截止时间** | Day 1 (2026-03-12) |
| **状态** | ⏳ 待开始 |
| **依赖** | 无 |

#### 任务描述
初始化项目 Git 仓库，建立版本控制体系。

#### 验收标准
- [ ] Git 仓库初始化
- [ ] .gitignore 配置完成
- [ ] 第一阶段代码提交
- [ ] 分支策略文档
- [ ] 提交规范文档

#### 执行步骤
```bash
# 1. 初始化仓库
cd /root/.openclaw/workspace/lsm-project
git init

# 2. 创建 .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
EOF

# 3. 提交代码
git add .
git commit -m "feat: 第一阶段代码提交"

# 4. 创建分支
git checkout -b develop
```

---

### 任务 1.2：Jest 测试框架搭建
| 属性 | 值 |
|------|-----|
| **ID** | TASK-002 |
| **负责人** | 测试工程师 |
| **优先级** | P0 |
| **工作量** | 4 小时 |
| **截止时间** | Day 1 (2026-03-12) |
| **状态** | ⏳ 待开始 |
| **依赖** | 无 |

#### 任务描述
配置 Jest 测试框架，建立测试基础设施。

#### 验收标准
- [ ] Jest 安装配置
- [ ] ts-jest 配置完成
- [ ] 测试脚本添加
- [ ] 示例测试通过
- [ ] 覆盖率报告生成

#### 执行步骤
```bash
# 1. 安装依赖
cd backend
npm install --save-dev jest ts-jest @types/jest

# 2. 初始化配置
npx ts-jest config:init

# 3. 更新 package.json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}

# 4. 创建示例测试
mkdir -p src/__tests__
cat > src/__tests__/example.test.ts << 'EOF'
describe('Example', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
EOF

# 5. 运行测试
npm test
```

---

### 任务 1.3：核心服务单元测试
| 属性 | 值 |
|------|-----|
| **ID** | TASK-003 |
| **负责人** | 测试工程师 + 后端开发 |
| **优先级** | P0 |
| **工作量** | 16 小时 |
| **截止时间** | Day 3 (2026-03-14) |
| **状态** | ⏳ 待开始 |
| **依赖** | TASK-002 |

#### 任务描述
为核心服务层编写单元测试，确保代码质量。

#### 验收标准
- [ ] auth.service.ts 测试
- [ ] server.service.ts 测试
- [ ] gpu.service.ts 测试
- [ ] task.service.ts 测试
- [ ] monitoring.service.ts 测试
- [ ] 覆盖率 ≥ 80%

#### 测试文件列表
```
src/__tests__/
├── services/
│   ├── auth.service.test.ts
│   ├── server.service.test.ts
│   ├── gpu.service.test.ts
│   ├── task.service.test.ts
│   └── monitoring.service.test.ts
└── middleware/
    └── auth.middleware.test.ts
```

#### 测试示例
```typescript
// auth.service.test.ts
import { AuthService } from '../services/auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('register', () => {
    it('should create user successfully', async () => {
      const user = await authService.register({
        username: 'test',
        email: 'test@example.com',
        password: 'password123'
      });
      expect(user).toBeDefined();
      expect(user.username).toBe('test');
    });
  });
});
```

---

### 任务 1.4：任务执行引擎实现
| 属性 | 值 |
|------|-----|
| **ID** | TASK-004 |
| **负责人** | 后端开发 |
| **优先级** | P0 |
| **工作量** | 12 小时 |
| **截止时间** | Day 3 (2026-03-14) |
| **状态** | ⏳ 待开始 |
| **依赖** | 无 |

#### 任务描述
实现任务执行器，支持 SSH 远程执行和本地执行。

#### 验收标准
- [ ] TaskExecutor 类实现
- [ ] SSH 远程执行功能
- [ ] 本地脚本执行
- [ ] 任务日志收集
- [ ] 失败重试机制
- [ ] 执行状态更新

#### 执行步骤
```bash
# 1. 安装依赖
npm install ssh2

# 2. 创建执行器
cat > src/services/task-executor.service.ts << 'EOF'
import { Client } from 'ssh2';

export class TaskExecutorService {
  async executeSSH(host: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) reject(err);
          let output = '';
          stream.on('close', () => {
            conn.end();
            resolve(output);
          }).on('data', (data: Buffer) => {
            output += data.toString();
          });
        });
      }).connect({
        host,
        username: 'user',
        password: 'password'
      });
    });
  }
}
EOF
```

---

## 🟡 P1 任务（重要）

### 任务 2.1：统一错误处理
| 属性 | 值 |
|------|-----|
| **ID** | TASK-005 |
| **负责人** | 后端开发 |
| **优先级** | P1 |
| **工作量** | 6 小时 |
| **截止时间** | Day 2 (2026-03-13) |
| **状态** | ⏳ 待开始 |
| **依赖** | 无 |

#### 任务描述
创建全局错误中间件，统一错误响应格式。

#### 验收标准
- [ ] 错误中间件实现
- [ ] 错误响应格式统一
- [ ] 错误日志记录
- [ ] 前端错误提示优化

#### 错误格式
```typescript
{
  success: false,
  error: {
    code: "ERR_CODE",
    message: "用户友好的错误信息",
    details: {},
    timestamp: "2026-03-12T10:00:00Z"
  }
}
```

---

### 任务 2.2：输入验证（Zod）
| 属性 | 值 |
|------|-----|
| **ID** | TASK-006 |
| **负责人** | 后端开发 |
| **优先级** | P1 |
| **工作量** | 8 小时 |
| **截止时间** | Day 3 (2026-03-14) |
| **状态** | ⏳ 待开始 |
| **依赖** | 无 |

#### 任务描述
使用 Zod 进行 API 参数验证。

#### 验收标准
- [ ] Zod 集成完成
- [ ] 所有 API 端点验证
- [ ] 验证错误信息友好
- [ ] 安全漏洞修复

---

### 任务 2.3：安全加固
| 属性 | 值 |
|------|-----|
| **ID** | TASK-007 |
| **负责人** | 后端开发 + DevOps |
| **优先级** | P1 |
| **工作量** | 8 小时 |
| **截止时间** | Day 4 (2026-03-15) |
| **状态** | ⏳ 待开始 |
| **依赖** | 无 |

#### 任务描述
添加基础安全配置。

#### 验收标准
- [ ] 速率限制生效
- [ ] 刷新令牌可用
- [ ] 审计日志记录
- [ ] CORS 配置正确
- [ ] Helmet 安全头

---

### 任务 2.4：前端错误处理优化
| 属性 | 值 |
|------|-----|
| **ID** | TASK-008 |
| **负责人** | 前端开发 |
| **优先级** | P1 |
| **工作量** | 4 小时 |
| **截止时间** | Day 2 (2026-03-13) |
| **状态** | ⏳ 待开始 |
| **依赖** | TASK-005 |

#### 任务描述
优化前端错误提示。

#### 验收标准
- [ ] 错误提示组件
- [ ] 友好错误信息
- [ ] 错误日志记录
- [ ] 用户引导提示

---

## 📊 任务统计

### 按优先级
| 优先级 | 数量 | 完成 | 进行中 | 待开始 |
|--------|------|------|--------|--------|
| P0 | 4 | 0 | 0 | 4 |
| P1 | 4 | 0 | 0 | 4 |
| **总计** | **8** | **0** | **0** | **8** |

### 按负责人
| 负责人 | 任务数 | 工作量 |
|--------|--------|--------|
| DevOps | 1 | 2h |
| 测试工程师 | 2 | 20h |
| 后端开发 | 6 | 50h |
| 前端开发 | 1 | 4h |

### 工作量估算
- **总工作量**: 76 小时
- **开发周期**: 10 天
- **日均工作**: 7.6 小时

---

## 📅 进度跟踪

### Day 1 (2026-03-12)
- [ ] TASK-001: Git 仓库初始化
- [ ] TASK-002: Jest 测试框架搭建

### Day 2 (2026-03-13)
- [ ] TASK-005: 统一错误处理
- [ ] TASK-008: 前端错误处理优化

### Day 3 (2026-03-14)
- [ ] TASK-003: 核心服务单元测试
- [ ] TASK-004: 任务执行引擎实现
- [ ] TASK-006: 输入验证

### Day 4 (2026-03-15)
- [ ] TASK-007: 安全加固

### Day 5 (2026-03-16)
- [ ] 第一周 Review

---

## 📝 更新日志

| 日期 | 操作 | 说明 |
|------|------|------|
| 2026-03-12 | 创建 | 初始任务清单 |

---

**文档位置**: `/root/.openclaw/workspace/lsm-project/TASKS.md`  
**最后更新**: 2026-03-12 10:45
