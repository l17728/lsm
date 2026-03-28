# LSM 自主开发闭环系统启动报告

**版本**: v3.2.0  
**报告日期**: 2026-03-15  
**状态**: 🟢 就绪

---

## 1. 系统概述

### 1.1 设计目标

构建「自主开发闭环」系统，实现从用户问题收集、需求分析、任务生成、开发执行到用户反馈的全流程自动化。

### 1.2 闭环流程

```
用户反馈 → 问题收集 → 需求分析 → 任务生成 → 开发执行 → 测试验收 → 用户反馈
```

### 1.3 核心价值

| 维度 | 改进 |
|------|------|
| 运维效率 | 70% 常规任务自动化 |
| 响应时间 | 平均 30 分钟 → 5 分钟 |
| 故障自愈率 | 60% → 85% |

---

## 2. 模块清单

### 2.1 后端核心模块

| 模块 | 文件 | 代码行数 | 功能说明 |
|------|------|----------|----------|
| MCP Server | `mcp-server/` | 854 | OpenClaw Agent 工具层 (12 个工具) |
| Decision Service | `services/decision/` | 957 | 风险评估与三层决策 |
| Approval Service | `services/decision/` | 594 | 审批流程管理 |
| Auto Task | `services/auto-task/` | 990 | 任务编排与执行追踪 |
| Chat Service | `services/chat/` | 303 | WebSocket 聊天会话管理 |
| NLP Service | `services/nlp/` | 361 | 意图识别与实体提取 |
| Feedback Service | `services/feedback/` | 1,612 | 需求聚合与定时分析 |
| Conversation | `services/conversation/` | 878 | 上下文管理与响应构建 |
| Approval Model | `models/` | 245 | 审批数据模型 |

**后端代码总计**: ~6,794 行 (不含测试)

### 2.2 前端模块

| 模块 | 文件 | 代码行数 | 功能说明 |
|------|------|----------|----------|
| Chat 组件 | `components/Chat/` | 600 | 聊天窗口组件 |
| useChat Hook | `hooks/useChat.ts` | 234 | WebSocket 连接管理 |
| Chat Service | `services/chat.service.ts` | 65 | 聊天 API 封装 |

**前端代码总计**: ~899 行

### 2.3 数据库模型

| 模型 | 说明 |
|------|------|
| User | 用户与多租户关联 |
| Team / TeamMember | 团队与成员管理 |
| Server / Gpu | 服务器与 GPU 资源 |
| Task | 运维任务 |
| Reservation | 资源预留 |
| Approval | 审批流程 |

**Prisma Schema**: 614 行

### 2.4 设计文档

| 文档 | 行数 | 说明 |
|------|------|------|
| AUTO_DEV_LOOP_DESIGN.md | 319 | 自主开发闭环架构设计 |
| PRD.md | 258 | 产品需求文档 |
| ARCHITECTURE.md | 323 | 技术架构设计 |
| MCP_TOOLS_SPEC.md | 238 | MCP 工具规范 |
| APPROVAL_WORKFLOW.md | 237 | 审批流程设计 |

---

## 3. MCP Tools 清单

| Tool | 权限 | 描述 |
|------|------|------|
| `lsm_list_servers` | READ | 查询服务器列表 |
| `lsm_allocate_gpu` | WRITE | 分配 GPU 资源 |
| `lsm_release_gpu` | WRITE | 释放 GPU 资源 |
| `lsm_create_task` | WRITE | 创建运维任务 |
| `lsm_cancel_task` | WRITE | 取消任务 |
| `lsm_check_status` | READ | 检查系统状态 |
| `lsm_scale_cluster` | ADMIN | 集群扩缩容 |
| `lsm_heal_fault` | ADMIN | 故障自愈 |
| `lsm_list_reservations` | READ | 查询预留列表 |
| `lsm_create_reservation` | WRITE | 创建资源预留 |
| `lsm_get_metrics` | READ | 获取监控指标 |
| `lsm_update_config` | ADMIN | 更新配置项 |

---

## 4. 启动步骤

### 4.1 环境准备

```bash
# 1. 进入后端目录
cd /root/.openclaw/workspace/lsm-project/src/backend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 DATABASE_URL, REDIS_URL, JWT_SECRET 等
```

### 4.2 数据库初始化

```bash
# 生成 Prisma Client
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# (可选) 填充种子数据
npx prisma db seed
```

### 4.3 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start

# 启动 MCP Server (独立进程)
npm run mcp
```

### 4.4 Docker 部署

```bash
# 使用 docker-compose
cd /root/.openclaw/workspace/lsm-project
docker-compose up -d

# 生产环境
docker-compose -f docker-compose.prod.yml up -d
```

---

## 5. 配置说明

### 5.1 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 |
| `REDIS_URL` | ✅ | Redis 连接串 |
| `JWT_SECRET` | ✅ | JWT 密钥 |
| `OPENCLAW_API_KEY` | ✅ | OpenClaw API 密钥 |
| `MCP_PORT` | 否 | MCP Server 端口，默认 3001 |

### 5.2 三层决策配置

```yaml
decision:
  auto_execute:      # 🟢 自动执行
    - list_servers
    - check_status
    - get_metrics
  notify_confirm:    # 🟡 通知确认
    - allocate_gpu
    - create_task
    - create_reservation
  require_approval:  # 🔴 人工审批
    - scale_cluster
    - heal_fault
    - release_gpu (force=true)
```

### 5.3 定时任务

| 任务 | Cron | 说明 |
|------|------|------|
| 需求聚合 | `0 0 * * *` | 每日 00:00 全量扫描 |
| 增量聚合 | `0 */6 * * *` | 每 6 小时增量 |
| 周报生成 | `0 9 * * 1` | 每周一 09:00 |

---

## 6. 监控要点

### 6.1 关键指标

| 指标 | 阈值 | 告警级别 |
|------|------|----------|
| 问题检测延迟 | > 5s | Warning |
| 需求生成失败率 | > 5% | Warning |
| 任务执行超时 | > 4h | Error |
| 用户满意度 | < 3.5/5 | Warning |
| 闭环完成时间 | > 7d | Info |

### 6.2 健康检查端点

```
GET /health         # 服务健康检查
GET /health/db      # 数据库连接检查
GET /health/redis   # Redis 连接检查
GET /metrics        # Prometheus 指标
```

### 6.3 日志关键点

- 消息采集入库
- 问题检测触发
- 需求聚合完成
- 任务状态变更
- 审批流程流转
- 用户反馈收集

---

## 7. 集成就绪度

| 模块 | 代码 | 测试 | 文档 | 状态 |
|------|------|------|------|------|
| MCP Server | 90% | 30% | ✅ | ⚠️ 需补充测试 |
| Decision Service | 100% | 60% | ✅ | ✅ 就绪 |
| Approval Service | 100% | 0% | ✅ | ⚠️ 需补充测试 |
| Auto Task | 100% | 0% | ✅ | ⚠️ 需补充测试 |
| Chat UI | 100% | 0% | ✅ | ⚠️ 需补充测试 |

---

## 8. 待完善事项

| 优先级 | 事项 | 预计工时 |
|--------|------|----------|
| P0 | MCP Server 单元测试 | 8h |
| P0 | Approval Service 测试 | 6h |
| P1 | WebSocket 通知集成 | 6h |
| P1 | 端到端集成测试 | 12h |
| P2 | 性能压力测试 | 8h |

---

*文档版本: 1.0 | 创建日期: 2026-03-15*