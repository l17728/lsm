# LSM Project - Day 8 Testing Quick Reference

**日期**: 2026-03-13  
**阶段**: Phase 4 - Production Deployment & Feature Enhancement  
**Day**: 8/20 - 挺进中原 - 集成测试与自动化

---

## 🚀 快速开始

### 环境准备

```bash
cd /root/.openclaw/workspace/lsm-project

# 设置环境变量
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123
export API_URL=http://localhost:8080
```

### 启动后端服务

```bash
cd backend
npm run dev
```

---

## 📋 测试脚本清单

### 1. 批量操作集成测试

**文件**: `tests/batch-operation-integration-test.js`

**运行**:
```bash
node tests/batch-operation-integration-test.js
```

**测试内容**:
- 批量删除功能 (5 项)
- 批量状态更新 (5 项)
- API 响应测试 (4 项)
- 认证授权测试 (3 项)
- 批量取消任务 (2 项)

**输出**: `docs/BATCH_OPERATION_TEST_REPORT.md`

---

### 2. E2E 测试

**文件**: `tests/e2e-test.js`

**运行**:
```bash
node tests/e2e-test.js
```

**测试内容**:
- 完整用户流程 (5 步骤)
- 批量操作流程 (5 步骤)
- 任务管理流程 (4 步骤)
- 暗黑模式切换 (3 步骤)
- 语言切换 (3 步骤)

**输出**: `docs/E2E_TEST_REPORT.md`

---

### 3. 性能测试自动化

**文件**: `tests/performance-automation.js`

**运行**:
```bash
node tests/performance-automation.js
```

**功能**:
- 自动化性能测试
- 性能回归检测
- Baseline 管理
- CI/CD 集成

**输出**: `docs/performance-reports/performance-YYYY-MM-DD-HH.json/md`

**CI/CD 环境变量**:
```bash
export CI_BUILD_ID=manual
export CI_BRANCH=main
export CI_COMMIT=local
```

---

### 4. 缓存命中率验证

**文件**: `tests/cache-hit-rate-verification.js`

**运行**:
```bash
node tests/cache-hit-rate-verification.js
```

**验证内容**:
- 缓存使用模式模拟
- 命中率统计分析
- TTL 配置验证
- 优化建议生成

**输出**: `docs/CACHE_HIT_RATE_VERIFICATION.md`

---

## 🔄 CI/CD 集成

### GitHub Actions Workflow

**文件**: `.github/workflows/performance-automation.yml`

**触发条件**:
- Push to main/develop
- Pull request to main
- 定时执行 (每日 2:00 AM UTC)
- 手动触发

**Jobs**:
1. `performance-test` - 性能测试
2. `batch-operation-test` - 批量操作测试
3. `e2e-automated-test` - E2E 测试
4. `performance-monitoring` - 性能监控 (定时)

**运行手动测试**:
```bash
# GitHub UI: Actions > Performance Test Automation > Run workflow
# 选项：Update baseline (true/false)
```

---

## 📊 监控仪表盘

### Grafana 仪表盘

**文件**: `monitoring/grafana-performance-dashboard.json`

**导入方法**:
1. 打开 Grafana
2. Dashboard > Import
3. Upload JSON file
4. 选择 `grafana-performance-dashboard.json`

**面板**:
- API 响应时间 (P95)
- 错误率
- 缓存命中率
- 吞吐量
- 批量操作监控
- 系统健康状态

---

## 📈 性能阈值

### 默认配置

```javascript
thresholds: {
  avgLatency: 200,    // ms
  p90Latency: 300,    // ms
  p99Latency: 500,    // ms
  errorRate: 1,       // %
  throughput: 10,     // req/sec
}
```

### 缓存目标

```javascript
targets: {
  hitRate: 85,        // %
  minHits: 100,       // minimum requests
}
```

---

## 📄 报告位置

| 报告类型 | 文件路径 |
|---------|---------|
| 批量操作测试 | `docs/BATCH_OPERATION_TEST_REPORT.md` |
| E2E 测试 | `docs/E2E_TEST_REPORT.md` |
| 缓存验证 | `docs/CACHE_HIT_RATE_VERIFICATION.md` |
| 性能测试 | `docs/performance-reports/` |
| Day 8 总结 | `docs/PHASE4_DAY8_REPORT.md` |

---

## 🔧 故障排查

### 认证失败

```bash
# 检查后端服务是否运行
curl http://localhost:8080/health

# 检查测试账号
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123
```

### 连接超时

```bash
# 检查 API URL
export API_URL=http://localhost:8080

# 测试连接
curl http://localhost:8080/api/servers
```

### 性能测试失败

```bash
# 查看详细错误
node tests/performance-automation.js 2>&1 | tee performance-test.log

# 检查 baseline
cat tests/performance-baseline.json
```

---

## 📞 支持

- **项目文档**: `docs/PHASE4_DAY8_REPORT.md`
- **测试计划**: `test-plan.md`
- **架构文档**: `architecture.md`
- **快速开始**: `QUICKSTART.md`

---

**最后更新**: 2026-03-13 23:30 GMT+8  
**维护团队**: LSM DevOps Team
