# Day 9 测试指南

**日期**: 2026-03-13  
**阶段**: 第四阶段 - 生产部署与功能增强  
**Day**: 9/20  

---

## 📋 测试脚本清单

### 1. 数据库索引优化

**脚本**: `tests/database-index-optimization.js`

**功能**:
- 慢查询分析
- 缺失索引识别
- 索引创建与验证
- 生成优化报告

**使用方法**:
```bash
cd /root/.openclaw/workspace/lsm-project

# 设置环境变量
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=lsm_db
export DB_USER=lsm_user
export DB_PASSWORD=lsm_password

# 执行测试
node tests/database-index-optimization.js
```

**输出**:
- 控制台：实时进度和分析结果
- 报告：`docs/DAY9_DATABASE_OPTIMIZATION_REPORT.md`

**预计耗时**: 2-5 分钟

---

### 2. 系统稳定性测试

**脚本**: `tests/system-stability-test.js`

**功能**:
- 长时间运行测试 (默认 5 分钟，可配置 1 小时)
- 内存泄漏检测
- 连接池稳定性测试
- 生成稳定性报告

**使用方法**:
```bash
cd /root/.openclaw/workspace/lsm-project

# 设置环境变量
export API_URL=http://localhost:8080
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123
export TEST_DURATION=300000  # 5 分钟 (毫秒)

# 执行测试
node tests/system-stability-test.js
```

**配置选项**:
- `TEST_DURATION`: 测试持续时间 (毫秒)，默认 300000 (5 分钟)
- `TEST_REQUESTS`: 总请求数，默认 500
- `API_URL`: API 地址，默认 http://localhost:8080

**输出**:
- 控制台：实时测试进度和内存使用
- 报告：`docs/stability-reports/stability-test-<timestamp>.md`

**预计耗时**: 5-60 分钟 (取决于 TEST_DURATION)

---

### 3. 故障恢复演练

**脚本**: `tests/fault-recovery-drill.js`

**功能**:
- 数据库故障恢复测试
- Redis 故障恢复测试
- 服务重启测试
- API 恢复测试
- 生成演练报告

**使用方法**:
```bash
cd /root/.openclaw/workspace/lsm-project

# 设置环境变量
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=lsm_db
export DB_USER=lsm_user
export DB_PASSWORD=lsm_password

export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=your_password

export API_URL=http://localhost:8080

# 执行测试
node tests/fault-recovery-drill.js
```

**⚠️ 注意事项**:
- 此测试会重启 Docker 容器
- 建议在测试环境执行
- 生产环境执行前请通知相关人员

**输出**:
- 控制台：实时测试进度
- 报告：`docs/fault-recovery-reports/fault-recovery-drill-<timestamp>.md`

**预计耗时**: 3-5 分钟

---

### 4. 性能回归测试

**脚本**: `tests/performance-regression-test.js`

**功能**:
- 对比 Day 6 性能基线
- 验证优化效果
- 检测性能退化
- 生成回归报告

**使用方法**:
```bash
cd /root/.openclaw/workspace/lsm-project

# 设置环境变量
export API_URL=http://localhost:8080
export TEST_USERNAME=admin
export TEST_PASSWORD=admin123
export TEST_REQUESTS=200

# 执行测试
node tests/performance-regression-test.js
```

**配置选项**:
- `TEST_REQUESTS`: 测试请求数，默认 200
- `API_URL`: API 地址，默认 http://localhost:8080

**输出**:
- 控制台：实时测试进度和对比结果
- 报告：`docs/performance-reports/regression-test-<timestamp>.md`

**预计耗时**: 2-3 分钟

---

## 🚀 快速执行所有测试

**一键执行脚本**:
```bash
#!/bin/bash
# scripts/run-day9-tests.sh

cd /root/.openclaw/workspace/lsm-project

echo "🚀 开始 Day 9 测试套件..."

# 1. 数据库索引优化
echo "\n📊 测试 1: 数据库索引优化"
node tests/database-index-optimization.js

# 2. 系统稳定性测试
echo "\n🧠 测试 2: 系统稳定性测试"
export TEST_DURATION=300000  # 5 分钟
node tests/system-stability-test.js

# 3. 故障恢复演练
echo "\n🛡️ 测试 3: 故障恢复演练"
node tests/fault-recovery-drill.js

# 4. 性能回归测试
echo "\n📈 测试 4: 性能回归测试"
node tests/performance-regression-test.js

echo "\n✅ 所有测试完成!"
```

**执行**:
```bash
chmod +x scripts/run-day9-tests.sh
./scripts/run-day9-tests.sh
```

**预计总耗时**: 15-20 分钟

---

## 📊 测试报告解读

### 数据库优化报告

**关键指标**:
- 慢查询分析数量
- 索引创建数量
- 性能提升百分比

**通过标准**:
- 所有推荐索引已创建
- 查询性能提升 >50%

---

### 稳定性测试报告

**关键指标**:
- 稳定性评分 (0-100)
- 成功率 (%)
- 内存泄漏检测
- 连接错误数

**通过标准**:
- 稳定性评分 >= 90
- 成功率 >= 99%
- 无内存泄漏
- 连接错误 = 0

---

### 故障恢复报告

**关键指标**:
- 总测试项
- 通过率 (%)
- 各组件恢复时间

**通过标准**:
- 通过率 >= 90%
- PostgreSQL 恢复 < 30s
- Redis 恢复 < 15s
- Backend 恢复 < 30s
- Frontend 恢复 < 20s

---

### 性能回归报告

**关键指标**:
- API 响应时间变化 (%)
- 吞吐量变化 (%)
- 错误率变化
- 优化效果验证

**通过标准**:
- 响应时间退化 < 20%
- 吞吐量退化 < 20%
- 错误率 < 1%
- 所有优化效果已验证

---

## 🔧 故障排查

### 常见问题

#### 1. 数据库连接失败

**错误**: `ECONNREFUSED`

**解决**:
```bash
# 检查数据库是否运行
docker ps | grep postgres

# 检查连接配置
echo $DB_HOST
echo $DB_PORT

# 测试连接
psql -h localhost -U lsm_user -d lsm_db
```

---

#### 2. Redis 连接失败

**错误**: `Redis connection error`

**解决**:
```bash
# 检查 Redis 是否运行
docker ps | grep redis

# 测试连接
redis-cli ping
```

---

#### 3. API 不可用

**错误**: `ECONNREFUSED` 或 `Timeout`

**解决**:
```bash
# 检查服务状态
docker ps | grep lsm

# 查看服务日志
docker logs lsm-backend-1

# 测试健康检查
curl http://localhost:8080/health
```

---

#### 4. 测试超时

**错误**: `Test timeout`

**解决**:
```bash
# 增加超时时间
export TEST_REQUESTS=100  # 减少请求数

# 或增加超时配置
# 在测试脚本中修改 timeout: 10000 -> timeout: 30000
```

---

## 📝 最佳实践

### 测试环境

- ✅ 使用独立测试环境
- ✅ 使用测试数据
- ✅ 避免在生产环境执行故障演练
- ✅ 执行前备份关键数据

### 测试频率

- **数据库优化**: 每月一次或查询性能下降时
- **稳定性测试**: 每周一次
- **故障演练**: 每月一次
- **性能回归**: 每次重大变更后

### 结果分析

- 保存所有测试报告
- 建立性能基线
- 跟踪趋势变化
- 及时调查异常

---

## 📞 支持

如有问题，请联系:
- LSM DevOps Team
- 项目文档：`docs/` 目录
- 测试脚本注释

---

*LSM Project - Phase 4: Production Deployment & Feature Enhancement*
