# LSM 项目维护计划 (Maintenance Plan)

**版本**: 1.0.0  
**创建日期**: 2026-03-15  
**状态**: 🟢 生效中  
**维护团队**: DevOps 团队  
**项目**: LSM (Laboratory Server Management System)

---

## 📚 目录

- [1. 概述](#1-概述)
- [2. 维护团队和职责](#2-维护团队和职责)
- [3. 日常维护任务](#3-日常维护任务)
- [4. 监控和告警配置](#4-监控和告警配置)
- [5. 备份策略](#5-备份策略)
- [6. 升级策略](#6-升级策略)
- [7. 应急预案](#7-应急预案)
- [8. 联系方式](#8-联系方式)

---

## 1. 概述

### 1.1 文档目的

本文档为 LSM 项目提供全面的维护计划，确保系统在生产环境中稳定、安全、高效运行。涵盖日常维护、监控告警、备份恢复、升级迁移、应急响应等关键运维活动。

### 1.2 适用范围

- LSM 系统生产环境
- LSM 系统测试/预发布环境
- 相关基础设施（数据库、缓存、监控等）

### 1.3 项目背景

LSM（Laboratory Server Management System）是一个实验室服务器资源管理平台，主要功能包括：

- 🖥️ 服务器管理
- 🎮 GPU 资源分配
- 📋 任务调度
- 📊 实时监控
- 🔐 安全认证
- 📧 通知推送

**技术栈**：
- 后端：Node.js 20 + TypeScript + Express + PostgreSQL 16 + Redis 7
- 前端：React 18 + TypeScript + Vite + Ant Design
- 部署：Docker + GitHub Actions CI/CD
- 监控：Prometheus + Grafana

---

## 2. 维护团队和职责

### 2.1 团队架构

```
┌─────────────────────────────────────────────────────────────┐
│                      项目经理                                │
│                   (整体协调与决策)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
┌────▼────┐         ┌─────▼─────┐        ┌──────▼──────┐
│ 后端开发 │         │  前端开发  │        │ DevOps 工程师 │
│ 团队    │         │   团队    │        │   团队       │
└─────────┘         └───────────┘        └──────────────┘
     │                     │                     │
     └─────────────────────┼─────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  测试工程师  │
                    │    团队      │
                    └─────────────┘
```

### 2.2 角色职责

| 角色 | 主要职责 | 次要职责 | 权限级别 |
|------|----------|----------|----------|
| **项目经理** | 整体协调、资源调配、风险管理 | 变更审批、报告审核 | Admin |
| **后端开发工程师** | API 维护、数据库管理、性能优化 | Bug 修复、日志分析 | Developer |
| **前端开发工程师** | UI 维护、兼容性修复、用户体验优化 | Bug 修复、性能优化 | Developer |
| **DevOps 工程师** | 部署管理、监控告警、基础设施维护 | 备份恢复、安全加固 | Admin |
| **测试工程师** | 测试用例维护、回归测试、自动化测试 | Bug 验证、质量报告 | Tester |

### 2.3 值班安排

**工作日值班** (周一至周五 09:00-18:00):

| 时间段 | 主值班 | 副值班 | 职责 |
|--------|--------|--------|------|
| 09:00-12:00 | DevOps 工程师 | 后端开发 | 日常巡检、问题处理 |
| 12:00-14:00 | 后端开发 | 前端开发 | 轮换休息 |
| 14:00-18:00 | DevOps 工程师 | 后端开发 | 日常运维、变更处理 |

**非工作时间值班** (周末、节假日、夜间):

| 时段 | 值班方式 | 响应时间 |
|------|----------|----------|
| 夜间 (18:00-09:00) | 电话值班 | P0: 15分钟 / P1: 30分钟 |
| 周末/节假日 | 远程值班 | P0: 30分钟 / P1: 2小时 |

### 2.4 值班轮换表

**本月值班表** (示例):

| 周次 | 周一 | 周二 | 周三 | 周四 | 周五 | 周末 |
|------|------|------|------|------|------|------|
| 第1周 | 张三 | 李四 | 王五 | 张三 | 李四 | 王五 |
| 第2周 | 李四 | 王五 | 张三 | 李四 | 王五 | 张三 |
| 第3周 | 王五 | 张三 | 李四 | 王五 | 张三 | 李四 |
| 第4周 | 张三 | 李四 | 王五 | 张三 | 李四 | 王五 |

---

## 3. 日常维护任务

### 3.1 每日维护任务

**执行时间**: 每日上午 09:00-10:00

| 任务 | 负责人 | 预计时间 | 检查项 | 状态 |
|------|--------|----------|--------|------|
| **系统健康检查** | DevOps | 15分钟 | 见检查清单 | ⬜ |
| **日志审查** | 后端开发 | 15分钟 | 错误日志、异常日志 | ⬜ |
| **告警处理** | 值班工程师 | 15分钟 | 未处理告警、新告警 | ⬜ |
| **备份验证** | DevOps | 10分钟 | 备份完成状态、备份文件大小 | ⬜ |
| **任务队列检查** | 后端开发 | 5分钟 | 待处理任务数、失败任务 | ⬜ |

**每日检查清单**:

```bash
# 1. 服务状态检查
docker-compose ps

# 2. 健康检查
curl -s http://localhost:4000/api/health | jq

# 3. 数据库连接检查
docker-compose exec db pg_isready -U lsm_user

# 4. Redis 连接检查
docker-compose exec redis redis-cli ping

# 5. 磁盘空间检查
df -h

# 6. 内存使用检查
free -h

# 7. 查看错误日志
docker-compose logs --since 24h backend | grep -i error

# 8. 检查待处理任务
docker-compose exec redis redis-cli LLEN task:queue

# 9. 检查备份文件
ls -lh /backups/lsm/ | tail -5

# 10. 检查告警历史
curl -s http://localhost:9090/api/v1/alerts | jq
```

**每日维护报告模板**:

```markdown
# LSM 每日维护报告

**日期**: YYYY-MM-DD  
**值班人员**: XXX

## 系统状态
- 服务状态: ✅ 正常 / ⚠️ 异常
- API 响应时间: XXms
- 错误率: X.XX%
- 在线用户数: XX

## 检查结果
| 检查项 | 结果 | 备注 |
|--------|------|------|
| 服务状态 | ✅ | - |
| 数据库 | ✅ | 连接数: XX |
| Redis | ✅ | 内存: XXMB |
| 磁盘空间 | ✅ | 使用率: XX% |
| 日志错误 | ⬜ | 数量: XX |

## 问题处理
1. [问题描述] - [处理状态] - [处理人]
2. ...

## 今日计划
1. ...
2. ...

## 备注
- ...
```

---

### 3.2 每周维护任务

**执行时间**: 每周五下午 15:00-17:00

| 任务 | 负责人 | 预计时间 | 检查项 | 状态 |
|------|--------|----------|--------|------|
| **性能趋势分析** | DevOps | 30分钟 | CPU/内存/磁盘趋势 | ⬜ |
| **安全日志审计** | 后端开发 | 30分钟 | 登录日志、操作日志 | ⬜ |
| **依赖更新检查** | 前端/后端 | 20分钟 | npm audit、安全补丁 | ⬜ |
| **备份恢复测试** | DevOps | 30分钟 | 恢复测试环境验证 | ⬜ |
| **告警规则审查** | DevOps | 20分钟 | 告警有效性、阈值调整 | ⬜ |
| **文档更新** | 项目经理 | 20分钟 | 变更记录、知识库 | ⬜ |

**每周维护检查脚本**:

```bash
#!/bin/bash
# weekly-check.sh - 每周维护检查脚本

echo "📊 LSM 每周维护检查"
echo "========================"
echo "日期: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. 性能趋势分析
echo "📈 性能趋势 (过去7天)"
echo "------------------------"
curl -s 'http://localhost:9090/api/v1/query?query=avg_over_time(lsm_health_cpu_percent[7d])' | jq '.data.result[0].value[1]'
curl -s 'http://localhost:9090/api/v1/query?query=avg_over_time(lsm_health_memory_percent[7d])' | jq '.data.result[0].value[1]'

# 2. 安全审计
echo ""
echo "🔒 安全审计"
echo "------------------------"
echo "登录失败次数:"
docker-compose exec -T db psql -U lsm_user -d lsm -t -c "SELECT count(*) FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at > now() - interval '7 days';"

echo "异常操作:"
docker-compose exec -T db psql -U lsm_user -d lsm -t -c "SELECT count(*) FROM audit_logs WHERE severity = 'WARNING' AND created_at > now() - interval '7 days';"

# 3. 依赖检查
echo ""
echo "📦 依赖安全检查"
echo "------------------------"
cd /root/.openclaw/workspace/lsm-project/backend && npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities'

# 4. 备份检查
echo ""
echo "💾 备份状态"
echo "------------------------"
ls -lh /backups/lsm/*.sql.gz 2>/dev/null | tail -3
echo "最新备份大小: $(du -sh /backups/lsm/*.sql.gz 2>/dev/null | tail -1 | cut -f1)"

# 5. 磁盘空间
echo ""
echo "💿 磁盘空间"
echo "------------------------"
df -h | grep -E '^(/dev|Filesystem)'

echo ""
echo "✅ 每周检查完成"
```

**每周维护报告模板**:

```markdown
# LSM 每周维护报告

**报告周期**: YYYY-MM-DD ~ YYYY-MM-DD  
**报告人**: XXX

## 系统概览

### 可用性
- 系统可用性: XX.XX%
- 计划停机: X 次 (X 小时)
- 非计划停机: X 次 (X 小时)

### 性能指标
| 指标 | 本周平均值 | 上周平均值 | 变化 |
|------|-----------|-----------|------|
| API 响应时间 | XXms | XXms | ↑/↓ |
| 错误率 | X.XX% | X.XX% | ↑/↓ |
| 缓存命中率 | XX% | XX% | ↑/↓ |
| 并发用户峰值 | XX | XX | ↑/↓ |

### 安全审计
- 登录失败: XX 次
- 异常操作: XX 次
- 安全告警: XX 次

### 备份恢复
- 备份执行: X/X 次 ✅
- 恢复测试: ✅ 通过 / ❌ 失败

## 问题汇总

| 问题编号 | 描述 | 优先级 | 状态 |
|----------|------|--------|------|
| ISSUE-XXX | ... | P1 | 已解决 |
| ISSUE-XXX | ... | P2 | 处理中 |

## 变更记录

| 变更编号 | 描述 | 执行人 | 日期 |
|----------|------|--------|------|
| CHANGE-XXX | ... | XXX | YYYY-MM-DD |

## 下周计划

1. ...
2. ...

## 建议

- ...
```

---

### 3.3 每月维护任务

**执行时间**: 每月最后一个工作日

| 任务 | 负责人 | 预计时间 | 检查项 | 状态 |
|------|--------|----------|--------|------|
| **系统补丁更新** | DevOps | 2小时 | OS补丁、安全更新 | ⬜ |
| **密码/密钥轮换** | DevOps | 1小时 | JWT密钥、数据库密码 | ⬜ |
| **SSL证书检查** | DevOps | 30分钟 | 有效期、续期计划 | ⬜ |
| **容量规划评估** | 项目经理 | 1小时 | 资源使用趋势、扩容计划 | ⬜ |
| **灾难恢复演练** | DevOps | 2小时 | 模拟故障、恢复验证 | ⬜ |
| **文档全面更新** | 项目经理 | 1小时 | 运维文档、应急手册 | ⬜ |
| **团队培训** | 项目经理 | 1小时 | 新功能培训、经验分享 | ⬜ |

**月度维护检查清单**:

```markdown
# LSM 月度维护检查清单

**检查日期**: YYYY-MM-DD  
**检查人**: XXX

## 1. 系统安全 (30分钟)

- [ ] 操作系统安全补丁安装
- [ ] Docker 版本更新检查
- [ ] 依赖包安全漏洞扫描 (npm audit)
- [ ] 防火墙规则审查
- [ ] SSH 访问日志审查
- [ ] 安全评分重新评估

## 2. 密钥管理 (30分钟)

- [ ] JWT 密钥轮换计划制定
- [ ] 数据库密码更新计划
- [ ] Redis 密码更新计划
- [ ] API 密钥有效期检查
- [ ] 加密密钥备份验证

## 3. 证书管理 (15分钟)

- [ ] SSL 证书有效期检查 (剩余 > 30天)
- [ ] 证书续期计划
- [ ] 证书链完整性验证

## 4. 容量规划 (30分钟)

- [ ] CPU 使用趋势分析
- [ ] 内存使用趋势分析
- [ ] 磁盘使用趋势分析
- [ ] 数据库增长趋势分析
- [ ] 网络带宽使用分析
- [ ] 扩容需求评估

## 5. 灾难恢复 (60分钟)

- [ ] 备份完整性验证
- [ ] 恢复流程演练
- [ ] RTO/RPO 验证
- [ ] 异地备份验证
- [ ] 恢复文档更新

## 6. 文档更新 (30分钟)

- [ ] 运维手册更新
- [ ] 应急预案更新
- [ ] 架构文档更新
- [ ] 联系人信息更新

## 7. 团队培训 (30分钟)

- [ ] 新功能培训
- [ ] 问题回顾
- [ ] 经验分享
- [ ] 培训记录

## 检查结果

| 类别 | 检查项数 | 通过 | 失败 | 备注 |
|------|----------|------|------|------|
| 系统安全 | 6 | X | X | |
| 密钥管理 | 5 | X | X | |
| 证书管理 | 3 | X | X | |
| 容量规划 | 6 | X | X | |
| 灾难恢复 | 5 | X | X | |
| 文档更新 | 4 | X | X | |
| 团队培训 | 4 | X | X | |

## 问题清单

1. ...
2. ...

## 改进建议

1. ...
2. ...
```

---

### 3.4 季度维护任务

**执行时间**: 每季度末最后一周

| 任务 | 负责人 | 预计时间 | 检查项 | 状态 |
|------|--------|----------|--------|------|
| **全面安全审计** | 安全团队 | 4小时 | 渗透测试、漏洞扫描 | ⬜ |
| **架构评审** | 技术负责人 | 2小时 | 架构演进、技术债务 | ⬜ |
| **成本优化** | DevOps | 2小时 | 资源利用率、成本分析 | ⬜ |
| **SLA 评估** | 项目经理 | 1小时 | 可用性指标、改进计划 | ⬜ |
| **供应商评估** | 项目经理 | 1小时 | 服务质量、合同续签 | ⬜ |

---

## 4. 监控和告警配置

### 4.1 监控架构

```
┌─────────────────────────────────────────────────────────────┐
│                      监控展示层                              │
│                    ┌─────────────┐                          │
│                    │   Grafana   │                          │
│                    │  (仪表盘)   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                      告警通知层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 邮件通知    │  │ 企业微信    │  │ 短信通知    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                    ┌─────────────┐                          │
│                    │Alertmanager │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                      数据采集层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Prometheus  │  │  Node       │  │  Redis      │         │
│  │  (应用指标) │  │  Exporter   │  │  Exporter   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 核心监控指标

#### 4.2.1 黄金四指标 (Golden Signals)

| 指标 | 说明 | 监控方式 | 告警阈值 |
|------|------|----------|----------|
| **延迟** (Latency) | 请求处理时间 | Prometheus | P95 > 1s |
| **流量** (Traffic) | 每秒请求数 | Prometheus | 突变 > 50% |
| **错误** (Errors) | 错误率 | Prometheus | > 5% |
| **饱和度** (Saturation) | 资源使用率 | Prometheus | CPU/内存 > 90% |

#### 4.2.2 系统指标

| 指标 | 说明 | 采集频率 | 告警阈值 |
|------|------|----------|----------|
| `lsm_health_cpu_percent` | CPU 使用率 | 15s | > 90% 持续5分钟 |
| `lsm_health_memory_percent` | 内存使用率 | 15s | > 90% 持续5分钟 |
| `lsm_health_disk_percent` | 磁盘使用率 | 60s | > 85% |
| `lsm_health_uptime_seconds` | 系统运行时间 | 60s | 重启告警 |

#### 4.2.3 应用指标

| 指标 | 说明 | 采集频率 | 告警阈值 |
|------|------|----------|----------|
| `lsm_app_requests_total` | 总请求数 | 15s | - |
| `lsm_app_errors_total` | 错误总数 | 15s | 错误率 > 5% |
| `lsm_app_request_duration_seconds` | 请求延迟 | 15s | P95 > 1s |
| `lsm_tasks_total` | 任务总数 | 60s | - |
| `lsm_tasks_pending` | 待处理任务 | 60s | > 100 |
| `lsm_gpus_allocated` | 已分配GPU数 | 60s | > 90% |

#### 4.2.4 数据库指标

| 指标 | 说明 | 采集频率 | 告警阈值 |
|------|------|----------|----------|
| `pg_stat_activity_count` | 活动连接数 | 15s | > 80% 最大连接数 |
| `pg_stat_database_deadlocks` | 死锁数 | 60s | > 0 |
| `pg_replication_lag_seconds` | 复制延迟 | 15s | > 30s |

#### 4.2.5 缓存指标

| 指标 | 说明 | 采集频率 | 告警阈值 |
|------|------|----------|----------|
| `redis_memory_used_bytes` | 内存使用 | 15s | > 90% 最大内存 |
| `redis_connected_clients` | 连接数 | 15s | > 80% 最大连接 |
| `lsm_cache_hit_rate_percent` | 缓存命中率 | 60s | < 70% |

### 4.3 告警规则配置

**Prometheus 告警规则** (`alerts.yml`):

```yaml
groups:
  - name: lsm-critical
    rules:
      # P0 级别告警 - 服务宕机
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
          priority: P0
        annotations:
          summary: "服务 {{ $labels.job }} 宕机"
          description: "{{ $labels.instance }} 服务已宕机超过 1 分钟"
          runbook: "https://wiki/lsm/runbook/service-down"

      # P0 级别告警 - 数据库连接失败
      - alert: DatabaseConnectionFailed
        expr: pg_up == 0
        for: 30s
        labels:
          severity: critical
          priority: P0
        annotations:
          summary: "数据库连接失败"
          description: "PostgreSQL 数据库不可用"
          runbook: "https://wiki/lsm/runbook/database-down"

  - name: lsm-warning
    rules:
      # P1 级别告警 - 高错误率
      - alert: HighErrorRate
        expr: rate(lsm_app_errors_total[5m]) / rate(lsm_app_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
          priority: P1
        annotations:
          summary: "API 错误率过高"
          description: "错误率 {{ $value | humanizePercentage }}，超过 5% 阈值"
          runbook: "https://wiki/lsm/runbook/high-error-rate"

      # P1 级别告警 - 高延迟
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(lsm_app_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
          priority: P1
        annotations:
          summary: "API 响应延迟过高"
          description: "P95 延迟 {{ $value | humanizeDuration }}，超过 1 秒阈值"
          runbook: "https://wiki/lsm/runbook/high-latency"

      # P1 级别告警 - CPU 使用率过高
      - alert: HighCPUUsage
        expr: lsm_health_cpu_percent > 90
        for: 5m
        labels:
          severity: warning
          priority: P1
        annotations:
          summary: "CPU 使用率过高"
          description: "CPU 使用率 {{ $value }}%，已超过 90% 阈值"
          runbook: "https://wiki/lsm/runbook/high-cpu"

      # P1 级别告警 - 内存使用率过高
      - alert: HighMemoryUsage
        expr: lsm_health_memory_percent > 90
        for: 5m
        labels:
          severity: warning
          priority: P1
        annotations:
          summary: "内存使用率过高"
          description: "内存使用率 {{ $value }}%，已超过 90% 阈值"
          runbook: "https://wiki/lsm/runbook/high-memory"

      # P1 级别告警 - 磁盘空间不足
      - alert: DiskSpaceLow
        expr: lsm_health_disk_percent > 85
        for: 5m
        labels:
          severity: warning
          priority: P1
        annotations:
          summary: "磁盘空间不足"
          description: "磁盘使用率 {{ $value }}%，已超过 85% 阈值"
          runbook: "https://wiki/lsm/runbook/disk-space"

  - name: lsm-business
    rules:
      # P2 级别告警 - 待处理任务过多
      - alert: PendingTasksHigh
        expr: lsm_tasks_pending > 100
        for: 10m
        labels:
          severity: info
          priority: P2
        annotations:
          summary: "待处理任务堆积"
          description: "待处理任务数 {{ $value }}，超过 100 阈值"
          runbook: "https://wiki/lsm/runbook/task-queue"

      # P2 级别告警 - GPU 资源紧张
      - alert: GPUAllocationHigh
        expr: lsm_gpus_allocated / lsm_gpus_total > 0.9
        for: 10m
        labels:
          severity: info
          priority: P2
        annotations:
          summary: "GPU 资源紧张"
          description: "GPU 分配率 {{ $value | humanizePercentage }}，已超过 90%"
          runbook: "https://wiki/lsm/runbook/gpu-allocation"
```

### 4.4 告警级别定义

| 级别 | 说明 | 响应时间 | 通知方式 | 示例 |
|------|------|----------|----------|------|
| **P0 (Critical)** | 严重故障，服务不可用 | 立即响应 (5分钟内) | 电话 + 短信 + 邮件 | 服务宕机、数据库故障 |
| **P1 (Warning)** | 重要问题，影响功能 | 30分钟内 | 短信 + 邮件 | 高延迟、高错误率 |
| **P2 (Info)** | 一般问题，需关注 | 2小时内 | 邮件 | 任务堆积、资源紧张 |

### 4.5 告警通知配置

**Alertmanager 配置** (`alertmanager.yml`):

```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'lsm-alerts@example.com'
  smtp_auth_username: 'lsm-alerts@example.com'
  smtp_auth_password: 'your-password'

route:
  group_by: ['severity', 'priority']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    # P0 级别 - 电话 + 短信 + 邮件
    - match:
        priority: P0
      receiver: 'critical'
      repeat_interval: 15m
    
    # P1 级别 - 短信 + 邮件
    - match:
        priority: P1
      receiver: 'warning'
      repeat_interval: 1h
    
    # P2 级别 - 邮件
    - match:
        priority: P2
      receiver: 'info'
      repeat_interval: 4h

receivers:
  - name: 'default'
    email_configs:
      - to: 'ops-team@example.com'
        send_resolved: true

  - name: 'critical'
    email_configs:
      - to: 'ops-team@example.com'
        send_resolved: true
    webhook_configs:
      - url: 'http://sms-gateway/alert'
        send_resolved: true
    # 电话通知配置 (需要集成第三方服务)
    
  - name: 'warning'
    email_configs:
      - to: 'ops-team@example.com'
        send_resolved: true
    webhook_configs:
      - url: 'http://sms-gateway/alert'
        send_resolved: true

  - name: 'info'
    email_configs:
      - to: 'dev-team@example.com'
        send_resolved: true

inhibit_rules:
  # P0 告警抑制 P1 告警
  - source_match:
      priority: P0
    target_match:
      priority: P1
    equal: ['alertname', 'instance']
```

### 4.6 Grafana 仪表盘

#### 主要仪表盘列表

| 仪表盘 | 用途 | 刷新间隔 | 访问权限 |
|--------|------|----------|----------|
| **系统概览** | 整体状态监控 | 30s | 所有用户 |
| **性能监控** | 性能指标分析 | 15s | 运维团队 |
| **业务监控** | 业务指标展示 | 60s | 所有用户 |
| **告警面板** | 告警状态汇总 | 10s | 运维团队 |
| **数据库监控** | 数据库性能 | 30s | DBA |

#### 系统概览仪表盘面板

```
┌─────────────────────────────────────────────────────────────────┐
│                      LSM 系统概览                                │
├────────────────┬────────────────┬────────────────┬──────────────┤
│   服务状态     │   CPU 使用率   │   内存使用率   │   磁盘使用   │
│   ✅ 正常      │     45%       │     62%       │    35%      │
│                │   [========  ] │   [=======   ] │   [====     ] │
├────────────────┴────────────────┴────────────────┴──────────────┤
│                        请求量趋势                                │
│   ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁                            │
├─────────────────────────────────────────────────────────────────┤
│   响应时间 P50: 52ms  │  P95: 112ms  │  P99: 245ms            │
├────────────────┬────────────────┬────────────────┬──────────────┤
│   任务总数     │   待处理任务   │   GPU 分配率   │   在线用户   │
│     1,234      │       12       │      78%       │      45     │
└────────────────┴────────────────┴────────────────┴──────────────┘
```

---

## 5. 备份策略

### 5.1 备份策略概述

```
┌─────────────────────────────────────────────────────────────┐
│                     备份策略架构                             │
│                                                             │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐             │
│   │ 数据库  │     │ Redis   │     │ 配置文件 │             │
│   │ (每日)  │     │ (每周)  │     │ (变更时) │             │
│   └────┬────┘     └────┬────┘     └────┬────┘             │
│        │               │               │                   │
│        └───────────────┼───────────────┘                   │
│                        ▼                                   │
│              ┌─────────────────┐                           │
│              │   本地存储      │                           │
│              │  (7天保留)     │                           │
│              └────────┬────────┘                           │
│                       │                                    │
│                       ▼                                    │
│              ┌─────────────────┐                           │
│              │   云存储        │                           │
│              │  (30天保留)    │                           │
│              └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 备份对象与频率

| 备份对象 | 备份频率 | 保留期限 | 存储位置 | 备份方式 |
|----------|----------|----------|----------|----------|
| **PostgreSQL 数据库** | 每日 02:00 | 本地 7 天，云端 30 天 | 本地 + 云存储 | pg_dump |
| **Redis 数据** | 每周日 03:00 | 本地 7 天 | 本地 | RDB 快照 |
| **配置文件** | 变更时 | 永久 | Git + 本地 | 手动备份 |
| **日志文件** | 每日 04:00 | 90 天 | 本地 + 云存储 | 自动归档 |
| **用户上传文件** | 每日 02:30 | 永久 | 云存储 | 增量同步 |

### 5.3 备份脚本

**数据库备份脚本** (`scripts/backup-database.sh`):

```bash
#!/bin/bash
# 数据库备份脚本

set -e

# 配置
BACKUP_DIR="/backups/lsm/database"
RETENTION_LOCAL=7
RETENTION_CLOUD=30
DATE=$(date +%Y%m%d-%H%M%S)
DB_NAME="lsm"
DB_USER="lsm_user"

# 云存储配置 (示例: 腾讯云 COS)
COS_BUCKET="lsm-backups"
COS_REGION="ap-guangzhou"

echo "========================================"
echo "LSM 数据库备份"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 1. 执行备份
echo "📦 开始备份数据库..."
docker-compose exec -T db pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/lsm-$DATE.sql.gz

# 检查备份文件
if [ ! -f "$BACKUP_DIR/lsm-$DATE.sql.gz" ]; then
    echo "❌ 备份失败：文件不存在"
    exit 1
fi

BACKUP_SIZE=$(du -h $BACKUP_DIR/lsm-$DATE.sql.gz | cut -f1)
echo "✅ 备份完成，大小: $BACKUP_SIZE"

# 2. 上传到云存储
echo "☁️  上传到云存储..."
# coscmd upload $BACKUP_DIR/lsm-$DATE.sql.gz /database/
echo "✅ 上传完成"

# 3. 清理过期备份
echo "🧹 清理过期备份..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_LOCAL -delete
echo "✅ 本地清理完成"

# 4. 发送通知
echo "📧 发送通知..."
# 发送邮件或企业微信通知

# 5. 记录日志
echo "$(date '+%Y-%m-%d %H:%M:%S') - 备份完成 - 大小: $BACKUP_SIZE" >> /var/log/lsm/backup.log

echo "========================================"
echo "✅ 备份任务完成"
echo "========================================"
```

**完整备份脚本** (`scripts/backup-all.sh`):

```bash
#!/bin/bash
# 完整备份脚本

set -e

BACKUP_DIR="/backups/lsm"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

echo "========================================"
echo "LSM 完整备份"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 1. 数据库备份
echo ""
echo "📦 1. 备份数据库..."
mkdir -p $BACKUP_DIR/database
docker-compose exec -T db pg_dump -U lsm_user lsm | gzip > $BACKUP_DIR/database/lsm-$DATE.sql.gz
echo "✅ 数据库备份完成"

# 2. Redis 备份 (每周日)
if [ $(date +%u) -eq 7 ]; then
    echo ""
    echo "📦 2. 备份 Redis..."
    mkdir -p $BACKUP_DIR/redis
    docker-compose exec -T redis redis-cli BGSAVE
    sleep 5
    docker cp $(docker-compose ps -q redis):/data/dump.rdb $BACKUP_DIR/redis/redis-$DATE.rdb
    echo "✅ Redis 备份完成"
fi

# 3. 配置文件备份
echo ""
echo "📦 3. 备份配置文件..."
mkdir -p $BACKUP_DIR/config
cp .env $BACKUP_DIR/config/env-$DATE
cp docker-compose.yml $BACKUP_DIR/config/docker-compose-$DATE.yml
cp docker-compose.prod.yml $BACKUP_DIR/config/docker-compose-prod-$DATE.yml 2>/dev/null || true
echo "✅ 配置备份完成"

# 4. 日志归档
echo ""
echo "📦 4. 归档日志..."
mkdir -p $BACKUP_DIR/logs
docker-compose logs --no-color > $BACKUP_DIR/logs/logs-$DATE.txt
echo "✅ 日志归档完成"

# 5. 计算备份大小
TOTAL_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
echo ""
echo "📊 备份汇总:"
echo "   总大小: $TOTAL_SIZE"
ls -lh $BACKUP_DIR/database/ | tail -1
ls -lh $BACKUP_DIR/config/ | tail -3

# 6. 清理过期备份
echo ""
echo "🧹 清理过期备份 ($RETENTION_DAYS 天前)..."
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -type d -empty -delete
echo "✅ 清理完成"

# 7. 备份验证
echo ""
echo "🔍 验证备份完整性..."
for file in $BACKUP_DIR/database/*.sql.gz; do
    if gzip -t $file 2>/dev/null; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file (损坏)"
    fi
done

echo ""
echo "========================================"
echo "✅ 完整备份完成"
echo "========================================"
```

### 5.4 恢复流程

#### 数据库恢复流程

```bash
# 1. 停止应用服务
docker-compose stop backend

# 2. 选择备份文件
ls -lh /backups/lsm/database/

# 3. 恢复数据库
gunzip -c /backups/lsm/database/lsm-20260314-020000.sql.gz | \
    docker-compose exec -T db psql -U lsm_user -d lsm

# 4. 验证数据
docker-compose exec db psql -U lsm_user -d lsm -c "SELECT count(*) FROM users;"

# 5. 重启服务
docker-compose start backend

# 6. 验证应用
curl http://localhost:4000/api/health
```

#### 灾难恢复清单

```markdown
# 灾难恢复清单

## 准备阶段
- [ ] 确认灾难范围和影响
- [ ] 通知相关团队和干系人
- [ ] 准备恢复环境和资源

## 恢复阶段
- [ ] 从备份恢复数据库
- [ ] 恢复 Redis 数据 (如有)
- [ ] 恢复配置文件
- [ ] 启动应用服务
- [ ] 验证数据完整性

## 验证阶段
- [ ] 功能验证测试
- [ ] 性能验证测试
- [ ] 安全验证测试

## 收尾阶段
- [ ] 通知用户恢复完成
- [ ] 记录恢复过程
- [ ] 进行事后分析
```

### 5.5 备份监控

**备份状态检查脚本** (`scripts/check-backup.sh`):

```bash
#!/bin/bash
# 备份状态检查

BACKUP_DIR="/backups/lsm/database"
ALERT_THRESHOLD_HOURS=26  # 超过26小时未备份则告警

# 检查最新备份文件
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.sql.gz 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ 未找到任何备份文件"
    # 发送告警
    exit 1
fi

# 检查备份时间
BACKUP_TIME=$(stat -c %Y $LATEST_BACKUP)
CURRENT_TIME=$(date +%s)
AGE_HOURS=$(( ($CURRENT_TIME - $BACKUP_TIME) / 3600 ))

if [ $AGE_HOURS -gt $ALERT_THRESHOLD_HOURS ]; then
    echo "⚠️  备份过期: 最新备份已 $AGE_HOURS 小时"
    # 发送告警
    exit 1
fi

# 检查备份大小
BACKUP_SIZE=$(du -b $LATEST_BACKUP | cut -f1)
MIN_SIZE=1000000  # 最小 1MB

if [ $BACKUP_SIZE -lt $MIN_SIZE ]; then
    echo "⚠️  备份文件过小: $BACKUP_SIZE bytes"
    # 发送告警
    exit 1
fi

echo "✅ 备份正常"
echo "   文件: $LATEST_BACKUP"
echo "   大小: $(du -h $LATEST_BACKUP | cut -f1)"
echo "   年龄: $AGE_HOURS 小时"
```

---

## 6. 升级策略

### 6.1 升级原则

1. **安全第一** - 升级前必须备份
2. **灰度发布** - 先测试环境，再生产环境
3. **可回滚** - 保留回滚能力
4. **低影响** - 选择业务低峰期进行
5. **充分测试** - 升级后全面验证

### 6.2 升级类型

| 升级类型 | 说明 | 频率 | 停机时间 | 审批级别 |
|----------|------|------|----------|----------|
| **大版本升级** | 主版本变更 (v3.x → v4.x) | 年度 | 可能需要 | 技术负责人 |
| **小版本升级** | 功能更新 (v3.1 → v3.2) | 月度 | 通常无需 | 项目经理 |
| **补丁升级** | Bug 修复 (v3.1.0 → v3.1.1) | 按需 | 无需 | 值班工程师 |
| **安全补丁** | 安全漏洞修复 | 紧急 | 可能需要 | 值班工程师 |
| **依赖升级** | 依赖包更新 | 季度 | 通常无需 | 技术负责人 |

### 6.3 升级流程

#### 标准升级流程

```
┌─────────────────────────────────────────────────────────────┐
│                      升级流程                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 计划阶段                                                 │
│     ├─ 确定升级范围和版本                                    │
│     ├─ 评估风险和影响                                        │
│     ├─ 制定回滚计划                                          │
│     └─ 申请审批                                              │
│                                                             │
│  2. 准备阶段                                                 │
│     ├─ 完整备份                                              │
│     ├─ 准备升级包                                            │
│     ├─ 通知用户                                              │
│     └─ 准备回滚脚本                                          │
│                                                             │
│  3. 执行阶段                                                 │
│     ├─ 停止服务 (如需)                                       │
│     ├─ 执行升级                                              │
│     ├─ 数据库迁移                                            │
│     └─ 启动服务                                              │
│                                                             │
│  4. 验证阶段                                                 │
│     ├─ 功能验证                                              │
│     ├─ 性能验证                                              │
│     ├─ 安全验证                                              │
│     └─ 用户验收                                              │
│                                                             │
│  5. 收尾阶段                                                 │
│     ├─ 更新文档                                              │
│     ├─ 通知用户                                              │
│     └─ 归档记录                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 升级检查清单

```markdown
# 升级检查清单

## 升级前检查

### 备份验证
- [ ] 数据库备份完成
- [ ] Redis 数据备份完成
- [ ] 配置文件备份完成
- [ ] 备份文件验证通过

### 环境准备
- [ ] 测试环境验证通过
- [ ] 升级包下载完成
- [ ] 升级脚本准备就绪
- [ ] 回滚脚本准备就绪

### 通知与审批
- [ ] 用户通知发送
- [ ] 技术审批获得
- [ ] 值班人员到位

## 升级中检查

### 服务停止
- [ ] 前端服务停止
- [ ] 后端服务停止
- [ ] 后台任务暂停

### 升级执行
- [ ] 镜像拉取成功
- [ ] 数据库迁移成功
- [ ] 服务启动成功

## 升级后检查

### 功能验证
- [ ] 用户登录正常
- [ ] 核心功能正常
- [ ] API 接口正常
- [ ] 数据完整性验证

### 性能验证
- [ ] API 响应时间正常
- [ ] 数据库查询正常
- [ ] 缓存命中率正常

### 监控验证
- [ ] 健康检查通过
- [ ] 告警规则正常
- [ ] 日志输出正常

## 问题记录

| 问题 | 影响 | 解决方案 | 状态 |
|------|------|----------|------|
| ... | ... | ... | ... |
```

### 6.4 升级脚本

**标准升级脚本** (`scripts/upgrade.sh`):

```bash
#!/bin/bash
# LSM 标准升级脚本

set -e

# 配置
NEW_VERSION="${1:-latest}"
BACKUP_DIR="/backups/lsm"
DATE=$(date +%Y%m%d-%H%M%S)

echo "========================================"
echo "LSM 系统升级"
echo "目标版本: $NEW_VERSION"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 1. 升级前检查
echo ""
echo "📋 1. 升级前检查..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

# 检查服务状态
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ 服务未运行，请先启动服务"
    exit 1
fi

echo "✅ 检查通过"

# 2. 备份
echo ""
echo "📦 2. 执行备份..."
mkdir -p $BACKUP_DIR/pre-upgrade-$DATE

# 备份数据库
docker-compose exec -T db pg_dump -U lsm_user lsm | gzip > $BACKUP_DIR/pre-upgrade-$DATE/database.sql.gz
echo "   ✅ 数据库备份完成"

# 备份配置
cp .env $BACKUP_DIR/pre-upgrade-$DATE/
cp docker-compose.yml $BACKUP_DIR/pre-upgrade-$DATE/
echo "   ✅ 配置备份完成"

# 3. 拉取新镜像
echo ""
echo "📥 3. 拉取新镜像..."
docker-compose pull
echo "✅ 镜像拉取完成"

# 4. 停止服务
echo ""
echo "🛑 4. 停止服务..."
docker-compose down
echo "✅ 服务已停止"

# 5. 启动新版本
echo ""
echo "🚀 5. 启动新版本..."
docker-compose up -d
echo "✅ 服务已启动"

# 6. 等待服务就绪
echo ""
echo "⏳ 6. 等待服务就绪..."
for i in {1..30}; do
    if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
        echo "✅ 服务就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 服务启动超时"
        exit 1
    fi
    sleep 2
done

# 7. 数据库迁移
echo ""
echo "🔄 7. 执行数据库迁移..."
docker-compose exec -T backend npx prisma migrate deploy
echo "✅ 迁移完成"

# 8. 健康检查
echo ""
echo "🏥 8. 健康检查..."
HEALTH=$(curl -s http://localhost:4000/api/health | jq -r '.status')
if [ "$HEALTH" == "ok" ]; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败"
    echo "响应: $(curl -s http://localhost:4000/api/health)"
    exit 1
fi

# 9. 验证版本
echo ""
echo "📌 9. 验证版本..."
VERSION=$(curl -s http://localhost:4000/api/health | jq -r '.version')
echo "当前版本: $VERSION"

echo ""
echo "========================================"
echo "✅ 升级完成"
echo "备份位置: $BACKUP_DIR/pre-upgrade-$DATE"
echo "========================================"
```

**回滚脚本** (`scripts/rollback.sh`):

```bash
#!/bin/bash
# LSM 回滚脚本

set -e

BACKUP_DIR="${1:-/backups/lsm/pre-upgrade-latest}"

echo "========================================"
echo "LSM 系统回滚"
echo "备份位置: $BACKUP_DIR"
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 检查备份是否存在
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ 备份目录不存在: $BACKUP_DIR"
    exit 1
fi

# 1. 停止服务
echo ""
echo "🛑 1. 停止服务..."
docker-compose down
echo "✅ 服务已停止"

# 2. 恢复配置
echo ""
echo "🔄 2. 恢复配置..."
cp $BACKUP_DIR/.env .
cp $BACKUP_DIR/docker-compose.yml .
echo "✅ 配置已恢复"

# 3. 恢复数据库
echo ""
echo "🔄 3. 恢复数据库..."
# 先启动数据库
docker-compose up -d db
sleep 10

# 恢复数据
gunzip -c $BACKUP_DIR/database.sql.gz | docker-compose exec -T db psql -U lsm_user -d lsm
echo "✅ 数据库已恢复"

# 4. 启动服务
echo ""
echo "🚀 4. 启动服务..."
docker-compose up -d
echo "✅ 服务已启动"

# 5. 健康检查
echo ""
echo "🏥 5. 健康检查..."
sleep 10
HEALTH=$(curl -s http://localhost:4000/api/health | jq -r '.status')
if [ "$HEALTH" == "ok" ]; then
    echo "✅ 健康检查通过"
else
    echo "⚠️  健康检查异常，请人工检查"
fi

echo ""
echo "========================================"
echo "✅ 回滚完成"
echo "========================================"
```

### 6.5 紧急补丁流程

**紧急补丁适用场景**：
- 安全漏洞紧急修复
- 严重 Bug 影响业务
- 数据安全问题

**紧急补丁流程**：

```markdown
# 紧急补丁流程

## 1. 发现与评估 (30分钟内)
- 确认问题严重程度
- 评估影响范围
- 确定是否需要紧急补丁

## 2. 开发与测试 (2-4小时)
- 快速开发修复方案
- 测试环境验证
- 安全审查

## 3. 部署 (30分钟内)
- 通知相关人员
- 执行快速备份
- 部署补丁
- 验证修复效果

## 4. 监控 (持续)
- 密切监控系统状态
- 验证补丁有效性
- 记录问题与解决方案

## 紧急联系人
- 技术负责人: [姓名] [电话]
- 运维负责人: [姓名] [电话]
- 安全负责人: [姓名] [电话]
```

---

## 7. 应急预案

### 7.1 应急响应级别

| 级别 | 定义 | 影响 | 响应时间 | 处理时限 |
|------|------|------|----------|----------|
| **P0** | 系统完全不可用 | 所有用户受影响 | 5分钟 | 1小时 |
| **P1** | 核心功能不可用 | 大部分用户受影响 | 30分钟 | 4小时 |
| **P2** | 部分功能异常 | 少量用户受影响 | 2小时 | 24小时 |
| **P3** | 轻微问题 | 个别用户受影响 | 24小时 | 72小时 |

### 7.2 应急响应流程

```
┌─────────────────────────────────────────────────────────────┐
│                    应急响应流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐                                               │
│  │ 发现故障 │                                               │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐     ┌──────────────────────────────────┐     │
│  │ 初步评估 │────▶│ P0: 立即升级到技术负责人         │     │
│  └────┬─────┘     │ P1: 通知值班工程师               │     │
│       │           │ P2/P3: 记录工单，正常处理       │     │
│       │           └──────────────────────────────────┘     │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐                                               │
│  │ 成立小组 │  P0/P1: 组建应急响应小组                      │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐                                               │
│  │ 问题定位 │  收集日志、指标、用户反馈                      │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐                                               │
│  │ 制定方案 │  评估影响、制定修复方案                        │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐                                               │
│  │ 执行修复 │  实施修复、验证效果                            │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐                                               │
│  │ 恢复验证 │  功能验证、性能验证、用户确认                  │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐                                               │
│  │ 事后分析 │  编写 Post-mortem 报告                        │
│  └──────────┘                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 常见故障应急预案

#### 7.3.1 服务不可用

**症状**：API 无法访问、前端页面无法加载

**排查步骤**：

```bash
# 1. 检查服务状态
docker-compose ps

# 2. 检查容器日志
docker-compose logs --tail=100 backend

# 3. 检查健康状态
curl http://localhost:4000/api/health

# 4. 检查资源使用
docker stats
```

**处理方案**：

| 场景 | 处理方式 | 预计恢复时间 |
|------|----------|--------------|
| 容器崩溃 | 自动重启或手动重启 | 1-5分钟 |
| 内存不足 | 清理内存或扩容 | 5-15分钟 |
| 配置错误 | 恢复正确配置 | 5-10分钟 |
| 代码 Bug | 回滚到稳定版本 | 10-30分钟 |

#### 7.3.2 数据库故障

**症状**：数据库连接失败、查询超时

**排查步骤**：

```bash
# 1. 检查数据库状态
docker-compose exec db pg_isready -U lsm_user

# 2. 检查连接数
docker-compose exec db psql -U lsm_user -d lsm -c "SELECT count(*) FROM pg_stat_activity;"

# 3. 检查慢查询
docker-compose exec db psql -U lsm_user -d lsm -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 5;"

# 4. 检查磁盘空间
df -h
```

**处理方案**：

| 场景 | 处理方式 | 预计恢复时间 |
|------|----------|--------------|
| 连接池耗尽 | 增加连接数或清理空闲连接 | 5分钟 |
| 慢查询阻塞 | 终止慢查询或优化 SQL | 10分钟 |
| 磁盘空间不足 | 清理数据或扩容 | 30分钟 |
| 数据库宕机 | 重启或切换到从库 | 5-30分钟 |

#### 7.3.3 缓存故障

**症状**：Redis 连接失败、缓存命中率下降

**排查步骤**：

```bash
# 1. 检查 Redis 状态
docker-compose exec redis redis-cli ping

# 2. 检查内存使用
docker-compose exec redis redis-cli INFO memory

# 3. 检查连接数
docker-compose exec redis redis-cli INFO clients

# 4. 检查持久化状态
docker-compose exec redis redis-cli INFO persistence
```

**处理方案**：

| 场景 | 处理方式 | 预计恢复时间 |
|------|----------|--------------|
| Redis 宕机 | 重启 Redis | 1-5分钟 |
| 内存满 | 清理过期键或扩容 | 5-10分钟 |
| 持久化失败 | 修复磁盘问题 | 10-30分钟 |

#### 7.3.4 网络故障

**症状**：无法访问服务、请求超时

**排查步骤**：

```bash
# 1. 检查网络连通性
ping -c 3 localhost

# 2. 检查端口监听
netstat -tlnp | grep -E ':(4000|5432|6379)'

# 3. 检查防火墙
sudo ufw status

# 4. 检查 DNS
nslookup your-domain.com
```

**处理方案**：

| 场景 | 处理方式 | 预计恢复时间 |
|------|----------|--------------|
| 端口被占用 | 停止占用进程 | 5分钟 |
| 防火墙阻止 | 调整防火墙规则 | 5分钟 |
| DNS 解析失败 | 修复 DNS 配置 | 10-30分钟 |

#### 7.3.5 安全事件

**症状**：异常登录、数据泄露、攻击行为

**处理流程**：

```
1. 立即隔离 - 限制受影响系统访问
   ↓
2. 评估影响 - 确定受影响范围和数据
   ↓
3. 保留证据 - 保存日志和取证信息
   ↓
4. 修复漏洞 - 应用安全补丁
   ↓
5. 恢复服务 - 验证安全后恢复
   ↓
6. 通知相关方 - 通知用户和管理层
```

### 7.4 应急响应小组

**P0 级别事件响应小组**：

| 角色 | 职责 | 联系方式 |
|------|------|----------|
| 指挥官 | 总体协调、决策 | [姓名] [电话] |
| 技术负责人 | 技术决策、方案制定 | [姓名] [电话] |
| 运维工程师 | 执行修复、环境操作 | [姓名] [电话] |
| 沟通协调 | 内外部沟通、用户通知 | [姓名] [电话] |

### 7.5 事后分析模板

```markdown
# 事故 Post-mortem 报告

## 基本信息

**事故编号**: INC-YYYY-XXX  
**发生时间**: YYYY-MM-DD HH:MM  
**恢复时间**: YYYY-MM-DD HH:MM  
**影响时长**: X 小时 X 分钟  
**影响级别**: P0/P1/P2/P3  
**影响范围**: [用户数量、功能模块]  

## 时间线

| 时间 | 事件 | 操作人 |
|------|------|--------|
| HH:MM | 发现问题 | XXX |
| HH:MM | 告警触发 | 系统 |
| HH:MM | 开始排查 | XXX |
| HH:MM | 确认根因 | XXX |
| HH:MM | 开始修复 | XXX |
| HH:MM | 恢复服务 | XXX |

## 影响分析

### 用户影响
- 受影响用户数: XX
- 受影响功能: XXX
- 用户反馈: XXX

### 业务影响
- 业务损失: XXX
- 声誉影响: XXX

## 根因分析

### 直接原因
[描述导致事故的直接技术原因]

### 根本原因
[使用 5 Why 方法分析根本原因]

1. 为什么发生这个问题?
2. 为什么会出现这个情况?
3. 为什么没有被及时发现?
4. 为什么没有防护措施?
5. 为什么流程存在缺陷?

## 解决方案

### 临时方案
[描述已采取的临时修复措施]

### 长期方案
[描述将采取的长期改进措施]

## 改进措施

| 措施 | 负责人 | 截止日期 | 状态 |
|------|--------|----------|------|
| XXX | XXX | YYYY-MM-DD | ⏳ 进行中 |
| XXX | XXX | YYYY-MM-DD | ⬜ 待开始 |

## 经验教训

### 做得好的
1. ...
2. ...

### 需要改进的
1. ...
2. ...

### 新的认识
1. ...
2. ...

## 附件

- 相关日志
- 监控截图
- 代码变更记录
```

---

## 8. 联系方式

### 8.1 项目团队通讯录

| 角色 | 姓名 | 电话 | 邮箱 | 企业微信 |
|------|------|------|------|----------|
| 项目经理 | [姓名] | [电话] | [邮箱] | [微信号] |
| 技术负责人 | [姓名] | [电话] | [邮箱] | [微信号] |
| 后端开发 Lead | [姓名] | [电话] | [邮箱] | [微信号] |
| 前端开发 Lead | [姓名] | [电话] | [邮箱] | [微信号] |
| DevOps 工程师 | [姓名] | [电话] | [邮箱] | [微信号] |
| 测试工程师 | [姓名] | [电话] | [邮箱] | [微信号] |

### 8.2 值班联系表

**工作日值班** (09:00-18:00):

| 时间 | 主值班 | 电话 | 副值班 | 电话 |
|------|--------|------|--------|------|
| 周一 | [姓名] | [电话] | [姓名] | [电话] |
| 周二 | [姓名] | [电话] | [姓名] | [电话] |
| 周三 | [姓名] | [电话] | [姓名] | [电话] |
| 周四 | [姓名] | [电话] | [姓名] | [电话] |
| 周五 | [姓名] | [电话] | [姓名] | [电话] |

**非工作时间值班** (18:00-09:00 及周末):

| 时段 | 值班人员 | 电话 |
|------|----------|------|
| 本周夜间 | [姓名] | [电话] |
| 本周周末 | [姓名] | [电话] |

### 8.3 供应商联系

| 服务 | 供应商 | 联系人 | 电话 | 工单系统 |
|------|--------|--------|------|----------|
| 云服务器 | [云服务商] | [联系人] | [电话] | [链接] |
| 域名服务 | [域名商] | [联系人] | [电话] | [链接] |
| SSL 证书 | [证书商] | [联系人] | [电话] | [链接] |
| CDN 服务 | [CDN商] | [联系人] | [电话] | [链接] |

### 8.4 紧急联系流程

```
P0 级别事件紧急联系流程：

1. 首先联系值班工程师 (5分钟内响应)
   ↓ 无响应
2. 联系技术负责人 (10分钟内响应)
   ↓ 无响应
3. 联系项目经理 (15分钟内响应)
   ↓ 无响应
4. 升级到部门主管
```

### 8.5 沟通渠道

| 渠道 | 用途 | 地址 |
|------|------|------|
| 邮件组 | 正式通知、报告 | lsm-team@example.com |
| 企业微信群 | 日常沟通、快速响应 | [群二维码] |
| 钉钉群 | 告警通知 | [群二维码] |
| 工单系统 | 问题跟踪、变更管理 | [链接] |
| 知识库 | 文档、FAQ | [链接] |
| 代码仓库 | 代码、CI/CD | [链接] |

---

## 附录

### 附录 A: 常用命令速查

**服务管理**:
```bash
docker-compose up -d              # 启动服务
docker-compose down               # 停止服务
docker-compose restart            # 重启服务
docker-compose ps                 # 查看状态
docker-compose logs -f            # 查看日志
docker-compose exec backend bash  # 进入容器
```

**数据库操作**:
```bash
# 连接数据库
docker-compose exec db psql -U lsm_user -d lsm

# 备份
docker-compose exec db pg_dump -U lsm_user lsm > backup.sql

# 恢复
cat backup.sql | docker-compose exec -T db psql -U lsm_user -d lsm

# 迁移
docker-compose exec backend npx prisma migrate deploy
```

**Redis 操作**:
```bash
# 连接
docker-compose exec redis redis-cli

# 查看信息
docker-compose exec redis redis-cli INFO

# 查看内存
docker-compose exec redis redis-cli INFO memory

# 清理所有键 (危险！)
docker-compose exec redis redis-cli FLUSHALL
```

**监控检查**:
```bash
# 健康检查
curl http://localhost:4000/api/health

# Prometheus 查询
curl 'http://localhost:9090/api/v1/query?query=up'

# Grafana 状态
curl http://localhost:3001/api/health
```

### 附录 B: 配置文件位置

| 配置文件 | 路径 |
|----------|------|
| Docker Compose | `/root/.openclaw/workspace/lsm-project/docker-compose.yml` |
| 环境变量 | `/root/.openclaw/workspace/lsm-project/.env` |
| Nginx 配置 | `/etc/nginx/sites-available/lsm` |
| Prometheus 配置 | `/root/.openclaw/workspace/lsm-project/monitoring/prometheus.yml` |
| 告警规则 | `/root/.openclaw/workspace/lsm-project/monitoring/alerts.yml` |
| Alertmanager 配置 | `/root/.openclaw/workspace/lsm-project/monitoring/alertmanager.yml` |

### 附录 C: 重要日期提醒

| 日期 | 事项 | 提前提醒 |
|------|------|----------|
| SSL 证书到期前 30 天 | 证书续期 | 30 天 |
| 云服务器到期前 30 天 | 续费/迁移 | 30 天 |
| 域名到期前 60 天 | 域名续费 | 60 天 |
| 每季度末 | 安全审计 | 1 周 |
| 每月最后工作日 | 月度维护 | 1 天 |

---

**文档版本**: 1.0.0  
**创建日期**: 2026-03-15  
**维护者**: AI 项目经理  
**下次审查**: 2026-04-15

---

*🔧 维护计划，确保系统稳定运行！*