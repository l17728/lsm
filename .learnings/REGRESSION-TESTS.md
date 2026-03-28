# Regression Test Checklist

## 本次修复的问题及测试覆盖

### 1. API 权限问题

| 问题 | 修复 | 单元测试 | E2E测试 |
|------|------|---------|--------|
| `/api/cluster-reservations/my` 需要 MANAGER 权限 | 改为 `authenticate` | ✅ `cluster-status-auto-update.test.ts` | ✅ `19-cluster-status-auto-update.spec.ts` |
| `/api/cluster-reservations/recommend-time-slots` 需要 MANAGER 权限 | 改为 `authenticate` | ✅ `cluster-status-auto-update.test.ts` | ✅ `19-cluster-status-auto-update.spec.ts` |

**测试用例:**
- TC-STATUS-AUTO-004: 只有 SUPER_ADMIN 可以修改状态
- TC-STATUS-AUTO-001: API 返回 effectiveStatus

### 2. 状态显示问题

| 问题 | 修复 | 单元测试 | E2E测试 |
|------|------|---------|--------|
| `STATUS_CONFIG_KEYS` 缺少大写键 | 添加大写键映射 | ✅ `CalendarView.null-safety.test.tsx` | ✅ `16-calendarview-null-safety.spec.ts` |
| 预约状态显示"待审批"但实际是 APPROVED | 修复大小写映射 | ✅ 已验证 | ✅ `17-reservation-regression.spec.ts` |

**测试用例:**
- TC-NULL-001~006: undefined 属性处理
- TC-APPROVE-001~005: 批准流程测试

### 3. 数据流问题

| 问题 | 修复 | 单元测试 | E2E测试 |
|------|------|---------|--------|
| 批准后列表不更新 | 前端本地移除记录 | ✅ `reservation.routes.test.ts` | ✅ `18-approval-status-management.spec.ts` |
| 日历不显示已批准预约 | API 参数格式修复 | ✅ API 测试 | ✅ `17-reservation-regression.spec.ts` |

**测试用例:**
- TC-APPROVE-002: 批准服务器预约
- TC-APPROVE-003: 拒绝服务器预约
- TC-CLUSTER-APPROVE-002: 批准集群预约
- TC-CLUSTER-APPROVE-003: 拒绝集群预约

### 4. 集群状态自动同步

| 功能 | 测试覆盖 |
|------|---------|
| 无预约时返回数据库状态 | ✅ TC-STATUS-001 |
| 活跃预约时返回 ALLOCATED | ✅ TC-STATUS-002 |
| 未来预约时返回 RESERVED | ✅ TC-STATUS-003 |
| 时间边界测试 | ✅ TC-STATUS-007, TC-STATUS-008 |
| 取消/完成预约被忽略 | ✅ TC-STATUS-005, TC-STATUS-006 |

## 需要举一反三检查的领域

### 1. 其他 `/my` 端点权限
- [ ] `/api/reservations/my`
- [ ] `/api/tasks/my`
- [ ] `/api/servers/my`

### 2. 其他状态映射
- [ ] Server 状态映射
- [ ] Task 状态映射
- [ ] GPU 状态映射

### 3. 其他实时状态计算
- [ ] Server effectiveStatus
- [ ] GPU effectiveStatus

## 回归测试运行命令

```bash
# 后端测试
cd src/backend && npm test -- --forceExit

# 前端测试
cd src/frontend && npm run test:run

# E2E 测试
cd e2e && npx playwright test
```

## 测试统计

| 类别 | 文件数 | 测试数 | 状态 |
|------|-------|-------|------|
| 后端单元测试 | 74 | 1058 | ✅ |
| 前端单元测试 | 27 | 287 | ✅ |
| E2E 测试 | 22 | 150+ | ✅ |

## 持续改进

1. 每次修复 bug 后必须添加对应的测试用例
2. 每次发现问题时使用 `举一反三` 检查类似问题
3. 更新此文档记录新的回归测试