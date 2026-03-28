# LSM 自主开发闭环系统架构设计

> 版本: 3.2.0 | 创建日期: 2026-03-15

---

## 1. 概述

### 1.1 设计目标

构建「自主开发闭环」系统，实现从用户问题收集、需求分析、任务生成、开发执行到用户反馈的全流程自动化。

### 1.2 闭环流程

```
用户反馈 → 问题收集 → 需求分析 → 任务生成 → 开发执行 → 测试验收 → 用户反馈
```

---

## 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OpenClaw Gateway                                │
│  [QQ Bot] [Web Chat] [API Gateway] [CLI]                                │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         消息采集层 (Collection)                          │
│  • ChatMessageStore - PostgreSQL 存储 + Redis 缓存                      │
│  • 会话上下文管理 • 消息去重归档                                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         问题识别层 (Detection)                           │
│  ProblemDetector → IntentClassifier → PriorityEvaluator                 │
│  • 关键词匹配/模式识别 • LLM 意图分类 • 优先级/影响范围评估               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         需求分析层 (Analysis)                            │
│  DemandAggregator → RequirementGen → ImpactAnalyzer                     │
│  • 相似需求聚合 • 需求文档生成 • 变更影响分析                             │
│  [定时任务: 每日00:00全量扫描 / 每6小时增量聚合 / 每周一09:00周报]        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         任务编排层 (Orchestration)                       │
│  TaskDecomposer → TeamScheduler → ProgressTracker                       │
│  • 任务拆解/依赖排序 • Agent 能力匹配/负载均衡 • 状态追踪/阻塞告警        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         开发执行层 (Execution)                           │
│  AgentPool → CodeExecutor → ArtifactManager                             │
│  • 开发/测试/运维 Agent • 代码生成/审查/重构 • 产物存储/版本管理          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         验收反馈层 (Validation)                          │
│  TestRunner → FeedbackCollector → LoopController                        │
│  • 单元/集成/回归测试 • 用户满意度收集 • 闭环检测/迭代触发                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型设计

### 3.1 核心实体

```
ChatMessage ──(检测)──▶ Problem ──(聚合)──▶ Requirement ──(拆解)──▶ DevTask
                                                                        │
                              Feedback ◀──(验收)──◀ TestResult ◀───────┘
```

### 3.2 核心表结构

```sql
-- 聊天消息表
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,  -- user/assistant/system
    content TEXT NOT NULL,
    channel VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 问题表
CREATE TABLE problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES chat_messages(id),
    type VARCHAR(50),            -- bug/feature/question/suggestion
    category VARCHAR(100),
    priority INT DEFAULT 3,      -- 1=critical ~ 4=low
    status VARCHAR(30) DEFAULT 'detected',
    impact_scope JSONB,
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 需求表
CREATE TABLE requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_ids UUID[] NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    acceptance_criteria JSONB,
    tech_proposal TEXT,
    status VARCHAR(30) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 开发任务表
CREATE TABLE dev_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    req_id UUID REFERENCES requirements(id),
    parent_id UUID REFERENCES dev_tasks(id),
    title VARCHAR(255) NOT NULL,
    assignee VARCHAR(100),       -- Agent ID
    status VARCHAR(30) DEFAULT 'pending',
    priority INT DEFAULT 3,
    est_hours DECIMAL(4,1),
    dependencies UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 反馈表
CREATE TABLE feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES dev_tasks(id),
    user_id VARCHAR(100),
    rating INT,                 -- 1-5
    comment TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. 核心流程设计

### 4.1 问题收集流程

```
消息接收 → 问题检测(LLM+规则) → 分类评估 → 持久化存储
   │            │                  │            │
所有渠道     关键词/模式识别     优先级计算    PostgreSQL
```

**检测规则：**
```yaml
problem_patterns:
  - pattern: "(报错|错误|bug|问题|故障)" → type: bug, priority_boost: +1
  - pattern: "(想要|建议|希望增加)" → type: feature, priority_boost: 0
  - pattern: "(怎么|如何|求助)" → type: question, priority_boost: -1
```

### 4.2 需求聚合流程

```
[定时扫描] → 问题提取 → 向量嵌入 → 聚类分析 → LLM生成需求文档
                │            │           │            │
            未处理问题   Embedding    HDBSCAN     需求文档
```

### 4.3 任务生成流程

```
需求分析 → 任务拆解 → DAG排序 → Agent分配
    │          │          │          │
 LLM分析    子任务生成   依赖检查   能力匹配
```

### 4.4 开发闭环流程

```
┌──────────────────────────────────────────────────────────────┐
│                          开始                                │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  1. Agent 领取任务                                           │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  2. 代码开发/修改                                             │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  3. 自动化测试 (单元/集成/回归)                               │
└─────────────────────────┬────────────────────────────────────┘
                          ▼
              ┌───────────┴───────────┐
              │       测试通过?       │
              └───────────┬───────────┘
              ┌───────┴───────┐
              ▼               ▼
           [否]            [是]
            │                │
            ▼                ▼
      返回修复          代码审查
                            │
                  ┌─────────┴─────────┐
                  │     审查通过?      │
                  └─────────┬─────────┘
                    ┌───┴───┐
                    ▼       ▼
                 [否]    [是]
                  │        │
                  ▼        ▼
              人工介入   自动发布
                         │
                         ▼
                    用户反馈
                         │
                  ┌──────┴──────┐
                  ▼             ▼
              [满意]        [不满意]
                 │              │
                 ▼              ▼
              关闭任务      创建新问题→下一轮
```

---

## 5. 技术实现方案

### 5.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 消息采集 | Go + PostgreSQL + Redis | 高性能写入 |
| 问题检测 | LLM (Qwen/GLM) + 规则引擎 | 混合检测 |
| 需求分析 | pgvector + LLM | 语义聚类 |
| 任务编排 | Go + Temporal | 可靠工作流 |
| 开发执行 | OpenClaw Subagent | 能力复用 |
| 测试验收 | Go test + Playwright | 自动化 |

### 5.2 核心组件

**ProblemDetector：**
```go
func (d *ProblemDetector) Detect(msg ChatMessage) (*Problem, error) {
    // 1. 规则引擎快速过滤
    if p := d.ruleEngine.Match(msg.Content); p != nil {
        return p, nil
    }
    // 2. LLM 深度分析
    return d.llmClient.Analyze(msg.Content)
}
```

**DemandAggregator：**
```go
func (a *DemandAggregator) Aggregate(window time.Duration) ([]*Requirement, error) {
    problems := a.fetchProblems(window)
    embeddings := a.embedder.BatchEmbed(problems)
    clusters := a.clusterer.Cluster(embeddings)  // HDBSCAN
    return a.generateRequirements(clusters)
}
```

---

## 6. OpenClaw 集成方案

### 6.1 集成架构

```
OpenClaw Gateway
├── Message Handler ──▶ AutoDevLoop.MessageCollector
├── Cron Scheduler ───▶ AutoDevLoop.DemandAggregator
└── Subagent Manager ─▶ AutoDevLoop.TaskExecutor
```

### 6.2 集成代码

```go
func RegisterAutoDevLoop(gateway *Gateway) {
    // 消息采集钩子
    gateway.OnMessage(func(msg Message) {
        AutoDevLoop.MessageCollector.Collect(msg)
    })
    
    // 定时任务
    gateway.RegisterCron("0 0 * * *", func() {
        AutoDevLoop.DemandAggregator.Aggregate(24 * time.Hour)
    })
    
    // 任务执行器
    gateway.RegisterHandler("dev_task", func(task DevTask) {
        AutoDevLoop.TaskExecutor.Execute(task)
    })
}
```

### 6.3 配置示例

```yaml
auto_dev_loop:
  enabled: true
  collection:
    channels: [qqbot, web]
    retention_days: 90
  detection:
    llm_model: "qwencode/glm-5"
    confidence_threshold: 0.7
  aggregation:
    schedule: "0 0 * * *"
    min_cluster_size: 3
  execution:
    max_concurrent_tasks: 5
    timeout_hours: 4
    agent_pool: [dev-agent, test-agent]
```

---

## 7. 监控指标

| 指标 | 阈值 | 告警 |
|------|------|------|
| 问题检测延迟 | > 5s | Warning |
| 需求生成失败率 | > 5% | Warning |
| 任务执行超时 | > 4h | Error |
| 用户满意度 | < 3.5 | Warning |
| 闭环完成时间 | > 7d | Info |

---

## 8. 演进路线

- **v3.2**: 基础消息采集、问题检测、手动需求聚合
- **v3.3**: 自动化聚合、智能任务拆解、多 Agent 协作
- **v3.4+**: 预测性分析、自适应优先级、完全自主闭环

---

*文档版本: 1.0 | 最后更新: 2026-03-15*