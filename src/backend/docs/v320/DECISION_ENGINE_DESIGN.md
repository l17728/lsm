# LSM v3.2.0 决策引擎设计文档

**版本**: 3.2.0  
**创建日期**: 2026-03-15  
**状态**: 设计稿  

---

## 1. 概述

本文档定义决策引擎（Decision Engine）的技术架构，实现三层决策机制，支持自动执行、通知确认、人工审批三种操作模式。

---

## 2. 核心架构

### 2.1 模块划分

```
DecisionEngine
├── DecisionService      # 决策分类与风险评估
├── ApprovalService      # 审批流程管理
├── RiskEvaluator        # 风险评估器
└── NotificationService  # 通知服务（复用现有）
```

### 2.2 决策流程

```
操作请求 → DecisionService.evaluate() → 返回决策结果
    │
    ├── AUTO: 直接执行 → 返回结果
    ├── NOTIFY: 执行操作 → 发送通知 → 返回结果
    └── APPROVAL: 创建审批单 → 等待审批 → 执行/拒绝
```

---

## 3. 风险评估模型

### 3.1 评估维度（各 1-5 分）

| 维度 | 说明 | 权重 |
|------|------|------|
| dataImpact | 数据影响程度 | 0.25 |
| resourceImpact | 资源影响范围 | 0.20 |
| reversibility | 操作可逆性 | 0.20 |
| costImpact | 成本影响 | 0.20 |
| securityImpact | 安全影响 | 0.15 |

### 3.2 决策阈值

```typescript
const THRESHOLDS = {
  AUTO: 1.0,      // 风险分 ≤ 1.0 自动执行
  NOTIFY: 2.5,    // 风险分 ≤ 2.5 通知确认
  APPROVAL: 5.0   // 风险分 > 2.5 人工审批
};
```

---

## 4. 操作类型定义

### 4.1 自动执行操作（低风险）

- `query:*` - 查询类操作
- `info:*` - 信息展示
- `preference:*` - 个人设置
- `task:update:description` - 任务描述更新

### 4.2 通知确认操作（中等风险）

- `reservation:create` - 资源申请
- `task:submit` - 任务提交
- `config:update` - 配置变更
- `batch:*` - 批量操作

### 4.3 人工审批操作（高风险）

- `resource:force-release` - 强制释放资源
- `permission:*` - 权限变更
- `system:config` - 系统配置
- `data:delete` - 数据删除
- `billing:*` - 费用相关

---

## 5. 审批模型设计

### 5.1 Approval 模型

```typescript
interface Approval {
  id: string;
  type: ApprovalType;           // 审批类型
  requesterId: string;          // 申请人ID
  operationType: string;        // 操作类型
  operationPayload: object;     // 操作详情
  status: ApprovalStatus;        // 审批状态
  riskScore: number;             // 风险评分
  riskFactors: object;           // 风险因素明细
  approverId?: string;           // 审批人ID
  approvedAt?: Date;             // 审批时间
  comment?: string;             // 审批意见
  escalationLevel: number;      // 升级层级
  expiresAt: Date;               // 超时时间
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 状态流转

```
PENDING → APPROVED → EXECUTED
        ↘ REJECTED
        ↘ EXPIRED → ESCALATED
```

---

## 6. 超时与升级机制

### 6.1 超时配置

```typescript
const TIMEOUT_CONFIG = {
  NORMAL: { hours: 24, action: 'escalate' },
  URGENT: { hours: 4, action: 'escalate' },
  CRITICAL: { hours: 48, action: 'remind_daily' }
};
```

### 6.2 升级流程

```
超时检测 → 通知上级管理员 → 重置计时 → 记录升级日志
```

---

## 7. 接口设计

### 7.1 DecisionService

```typescript
class DecisionService {
  evaluate(operation: Operation): DecisionResult;
  calculateRiskScore(operation: Operation): number;
  getOperationCategory(operationType: string): DecisionCategory;
}
```

### 7.2 ApprovalService

```typescript
class ApprovalService {
  createApproval(request: ApprovalRequest): Approval;
  approve(approvalId: string, approverId: string, comment?: string): Approval;
  reject(approvalId: string, approverId: string, reason: string): Approval;
  checkTimeout(): Promise<void>;  // 定时任务调用
  escalate(approvalId: string): Approval;
}
```

---

## 8. 事件与通知

### 8.1 事件类型

- `approval:created` - 审批创建
- `approval:approved` - 审批通过
- `approval:rejected` - 审批拒绝
- `approval:escalated` - 审批升级
- `approval:expired` - 审批超时

### 8.2 通知渠道

优先级：WebSocket > 邮件 > 钉钉 > 短信

---

## 9. 审计与日志

所有决策和审批操作记录到 AuditLog，保留完整操作链：

- 操作类型、申请人、审批人
- 风险评分、决策依据
- 申请时间、审批时间、执行时间
- 审批意见、执行结果

---

## 10. 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0 | 2026-03-15 | Agent | 初始设计 |