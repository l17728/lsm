# 📚 LSM 项目最佳实践

**创建时间**: 2026-03-12 11:00  
**版本**: 1.0  
**状态**: 🟢 持续更新

---

## 🎯 目标

记录开发过程中的最佳实践、工作流程、经验教训，避免重复踩坑，提高开发效率。

---

## 📋 交互流程记录

### 用户需求 → AI 执行的完整流程

#### 流程 1：功能开发流程

```
用户提出需求
   ↓
AI 理解需求并确认
   ↓
AI 设计方案并文档化
   ↓
AI 编写代码实现
   ↓
AI 编写测试用例
   ↓
AI 提交 Git 并记录
   ↓
AI 生成进展报告
   ↓
用户确认/反馈
```

**实例**: 第二阶段开发启动
- 用户："现在请组织团队启动开发"
- AI: 创建启动文档 → 分配任务 → 编写代码 → 提交 Git → 生成报告

**最佳实践**:
1. ✅ 先文档后代码
2. ✅ 任务明确分配
3. ✅ 及时 Git 提交
4. ✅ 生成进展报告

---

#### 流程 2：会议组织流程

```
用户确认会议安排
   ↓
AI 创建会议文档
   ↓
AI 配置定时提醒
   ↓
AI 到点组织会议
   ↓
AI 生成会议记录
   ↓
AI 发送给用户
```

**实例**: 定时会议提醒配置
- 用户："定时提醒主要是为了提醒你们的开发团队按时召开例会"
- AI: 理解需求 → 创建会议模板 → 配置 Cron → 生成文档

**最佳实践**:
1. ✅ 明确会议频率和时间
2. ✅ 创建标准化模板
3. ✅ 配置自动提醒
4. ✅ 记录归档

---

#### 流程 3：环境搭建流程

```
用户提出需求
   ↓
AI 检查现有环境
   ↓
AI 选择技术方案
   ↓
AI 创建项目结构
   ↓
AI 编写配置文件
   ↓
AI 安装依赖
   ↓
AI 测试验证
   ↓
AI 编写文档
   ↓
AI 提交 Git
```

**实例**: 文档门户搭建
- 用户："请把环境搭建起来可以通过 web 访问"
- AI: 检查环境 → 选择 Node.js+Express → 创建项目 → 编写代码 → 配置服务 → 测试验证

**最佳实践**:
1. ✅ 先检查后实施
2. ✅ 选择成熟技术栈
3. ✅ 配置服务自启动
4. ✅ 编写完整文档

---

## 💡 技术最佳实践

### 代码规范

#### 1. TypeScript 使用规范

```typescript
// ✅ 推荐：明确类型定义
interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'USER';
}

// ✅ 推荐：错误处理
async function getUser(id: string): Promise<User> {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');
    return user;
  } catch (error) {
    logger.error('Failed to get user', { id, error });
    throw error;
  }
}

// ❌ 避免：any 类型
function getUser(id: any): any {
  // ...
}
```

#### 2. 错误处理模式

```typescript
// ✅ 统一错误响应格式
{
  success: false,
  error: {
    code: 'ERR_CODE',
    message: '用户友好的错误信息',
    details: {}, // 开发环境
    timestamp: '2026-03-12T11:00:00Z'
  }
}

// ✅ 全局错误中间件
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    },
  });
});
```

#### 3. 测试编写规范

```typescript
// ✅ 测试文件结构
describe('ServiceName', () => {
  let service: ServiceName;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new MockPrisma();
    service = new ServiceName(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      mockPrisma.model.mockResolvedValue(expected);
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
  });
});
```

---

### Git 工作流

#### 1. 分支管理

```bash
# ✅ 推荐：功能分支开发
git checkout develop
git checkout -b feature/task-executor
# ... 开发 ...
git commit -m "feat: 实现任务执行引擎"
git push origin feature/task-executor
# 创建 PR → 审查 → 合并到 develop

# ❌ 避免：直接在 main/develop 上修改
git checkout main
git commit -m "update code"  # 禁止！
```

#### 2. 提交信息规范

```bash
# ✅ 推荐：遵循 Conventional Commits
feat: 实现任务执行引擎
fix: 修复登录验证 bug
docs: 更新 API 文档
test: 添加认证服务测试
refactor: 优化服务层代码结构
chore: 更新依赖版本

# ❌ 避免：模糊的提交信息
git commit -m "update"
git commit -m "fix bug"
git commit -m "asdfasdf"
```

#### 3. 代码审查清单

- [ ] 代码功能正确
- [ ] 有对应的测试
- [ ] 遵循代码规范
- [ ] 无敏感信息
- [ ] 文档已更新
- [ ] Git 提交信息规范

---

### 文档规范

#### 1. 文档结构

```markdown
# 标题

**元信息**: 时间、版本、状态

## 概述
简短说明文档目的

## 详细内容
分章节详细说明

## 示例
提供代码示例或使用示例

## 相关文档
链接到相关文档
```

#### 2. API 文档

```markdown
### GET /api/servers

获取所有服务器列表

**请求**:
```
GET /api/servers
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Server 1",
      "status": "ONLINE"
    }
  ]
}
```

**错误**:
- 401: 未授权
- 500: 服务器错误
```

---

## 🔧 工具使用最佳实践

### 1. Jest 测试

```javascript
// ✅ 推荐：jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};

// 运行测试
npm test                    # 运行所有测试
npm test -- --coverage      # 生成覆盖率报告
npm test -- --watch         # 监视模式
```

### 2. Git 命令

```bash
# ✅ 常用命令
git status                  # 查看状态
git add .                   # 添加文件
git commit -m "message"     # 提交
git push origin branch      # 推送
git log --oneline           # 查看历史
git diff                    # 查看差异

# ✅ 分支操作
git checkout -b feature     # 创建分支
git merge branch            # 合并分支
git branch -d feature       # 删除分支
```

---

## 📝 经验教训

### 教训 1：环境配置

**问题**: Express 5 路由语法变化导致服务启动失败

**原因**: Express 5 使用新版 path-to-regexp，不支持 `/:path(*)` 语法

**解决**: 改用查询参数方式 `/view?file=path`

**教训**:
1. ✅ 升级依赖前先查看变更日志
2. ✅ 在测试环境验证后再部署
3. ✅ 记录版本兼容性问题

---

### 教训 2：服务自启动

**问题**: 手动启动服务重启后丢失

**原因**: 未配置 systemd 服务

**解决**: 创建 systemd 服务文件，配置开机自启

**教训**:
1. ✅ 生产服务必须配置自启动
2. ✅ 使用 systemd 管理服务
3. ✅ 配置日志记录

---

### 教训 3：Git 版本控制

**问题**: 代码未纳入版本管理

**原因**: 未及时初始化 Git 仓库

**解决**: 立即初始化并提交所有代码

**教训**:
1. ✅ 项目开始先初始化 Git
2. ✅ 及时提交代码
3. ✅ 编写规范的提交信息

---

## 🎓 学习要点

### 对于 AI 团队

1. **文档先行**: 先写文档再写代码
2. **及时记录**: 每次交互都是学习机会
3. **持续改进**: 从错误中学习
4. **标准化**: 建立统一的工作流程

### 对于人类用户

1. **明确需求**: 需求越清晰，执行越准确
2. **及时反馈**: 有问题立即提出
3. **文档回顾**: 定期查看最佳实践文档
4. **流程优化**: 不断改进工作流程

---

## 📊 工作流程图

### 完整开发流程

```
需求分析 → 方案设计 → 文档编写 → 代码实现 → 测试验证 → 代码审查 → Git 提交 → 部署上线
   ↓          ↓          ↓          ↓          ↓          ↓          ↓          ↓
 记录       记录       记录       记录       记录       记录       记录       记录
```

### 会议管理流程

```
会议安排 → 模板创建 → 定时配置 → 自动召开 → 记录生成 → 发送用户 → 归档保存
   ↓          ↓          ↓          ↓          ↓          ↓          ↓
 文档化     标准化     自动化     智能化     结构化     即时化     可追溯
```

---

## 🔄 持续更新

本文档会随着项目开发持续更新，每次遇到新的经验教训都应及时记录。

### 更新日志

| 日期 | 内容 | 贡献者 |
|------|------|--------|
| 2026-03-12 | 初始版本 - 记录交互流程和技术规范 | AI 团队 |

---

**维护者**: AI 项目经理  
**最后更新**: 2026-03-12 11:00  
**下次审查**: 2026-03-19（周会）
