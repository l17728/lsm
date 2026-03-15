# AI 智能调度系统 (v3.1.0)

## 概述

AI 智能调度系统是 LSM 项目 v3.1.0 版本的核心功能模块，提供基于机器学习的智能任务调度、GPU 预测性分配和动态负载均衡能力。

## 模块架构

```
ai-scheduler/
├── ai-scheduler.service.ts    # ML 模型调度服务
├── gpu-predictor.service.ts   # GPU 预测性分配服务
├── load-balancer.service.ts   # 智能负载均衡服务
├── ai-scheduler.controller.ts # API 控制器
├── ai-scheduler.routes.ts     # 路由配置
├── index.ts                   # 模块导出
└── __tests__/
    └── ai-scheduler.test.ts   # 单元测试
```

## 核心功能

### 1. ML 模型调度服务 (AISchedulerService)

#### 功能特性
- **智能调度决策**: 基于多维特征为任务选择最优服务器
- **在线学习**: 根据任务执行结果持续优化模型
- **批量调度优化**: 为多个任务生成全局最优调度方案
- **特征提取**: 自动提取任务和服务器特征用于 ML 预测

#### 核心算法
- 加权多目标优化
- 在线梯度下降学习
- 特征归一化处理
- 历史数据分析

#### 预测因素
| 因素 | 权重 | 说明 |
|------|------|------|
| priority | 25% | 任务优先级 |
| resourceFit | 20% | 资源适配度 |
| loadBalance | 20% | 负载均衡 |
| userFairness | 15% | 用户公平性 |
| energyEfficiency | 10% | 能效优化 |
| reliability | 10% | 可靠性评估 |

### 2. GPU 预测性分配服务 (GpuPredictorService)

#### 功能特性
- **预测性分配**: 预测 GPU 可用时间并智能分配
- **使用模式分析**: 分析 GPU 历史使用模式
- **批量需求预测**: 为多个任务预测 GPU 需求
- **即将释放预测**: 预测哪些 GPU 即将完成任务

#### GPU 评估维度
- 内存适配度 (30%)
- 模型性能匹配 (20%)
- 可用性预测 (25%)
- 历史性能 (15%)
- 能效评分 (10%)

#### 支持的 GPU 模型
- H100, A100, A100-80GB (高性能计算)
- V100, A6000 (通用计算)
- RTX 4090, RTX 3090 (消费级)

### 3. 智能负载均衡服务 (LoadBalancerService)

#### 功能特性
- **实时负载监控**: 监控集群负载状态
- **不均衡检测**: 自动检测负载不均衡情况
- **智能迁移决策**: 生成任务迁移建议
- **预测性均衡**: 基于趋势预测提前调整
- **资源整合优化**: 低负载时合并任务

#### 负载计算权重
| 指标 | 权重 |
|------|------|
| CPU 负载 | 35% |
| 内存负载 | 25% |
| GPU 负载 | 25% |
| 网络负载 | 10% |
| 磁盘 IO | 5% |

#### 默认阈值配置
```typescript
{
  cpuThreshold: 80,        // CPU 过载阈值
  memoryThreshold: 85,     // 内存过载阈值
  gpuThreshold: 90,        // GPU 过载阈值
  imbalanceThreshold: 30,  // 不均衡阈值
  coolingPeriod: 300,      // 冷却时间(秒)
}
```

## API 接口

### 系统状态
```
GET /api/ai-scheduler/status
```

### ML 调度器
```
GET  /api/ai-scheduler/model/status
GET  /api/ai-scheduler/schedule/:taskId
POST /api/ai-scheduler/schedule/batch
POST /api/ai-scheduler/learn
```

### GPU 预测器
```
POST /api/ai-scheduler/gpu/predict
GET  /api/ai-scheduler/gpu/releasing
GET  /api/ai-scheduler/gpu/patterns
POST /api/ai-scheduler/gpu/predict-batch
```

### 负载均衡
```
GET  /api/ai-scheduler/load-balancing/cluster-load
POST /api/ai-scheduler/load-balancing/analyze
POST /api/ai-scheduler/load-balancing/execute
GET  /api/ai-scheduler/load-balancing/report
PUT  /api/ai-scheduler/load-balancing/config
```

### 综合调度
```
POST /api/ai-scheduler/smart-schedule
```

## 使用示例

### 智能任务调度

```typescript
import { aiSchedulerService } from './services/ai-scheduler';

// 获取单个任务的调度建议
const decision = await aiSchedulerService.makeSchedulingDecision(taskId);
console.log('推荐服务器:', decision.serverId);
console.log('置信度:', decision.confidence);
console.log('调度理由:', decision.reasoning);

// 批量调度
const decisions = await aiSchedulerService.batchSchedule(taskIds);
```

### GPU 预测性分配

```typescript
import { gpuPredictorService } from './services/ai-scheduler';

// 请求 GPU 分配
const result = await gpuPredictorService.predictAndAllocate({
  taskId: 'task-123',
  userId: 'user-456',
  minMemory: 16,
  priority: 2,
});

if (result.success) {
  console.log('分配成功:', result.allocation);
} else {
  console.log('等待队列位置:', result.queuePosition);
  console.log('预计等待时间:', result.estimatedWaitTime);
}
```

### 负载均衡

```typescript
import { loadBalancerService } from './services/ai-scheduler';

// 获取负载报告
const report = await loadBalancerService.getLoadBalancingReport();
console.log('集群负载:', report.clusterLoad);
console.log('不均衡得分:', report.imbalanceScore);

// 执行均衡决策
for (const decision of report.recommendations) {
  const result = await loadBalancerService.executeDecision(decision);
  console.log('迁移结果:', result);
}
```

## 配置选项

### 负载均衡配置
```typescript
interface LoadBalancingConfig {
  cpuThreshold: number;       // CPU 过载阈值
  memoryThreshold: number;    // 内存过载阈值
  gpuThreshold: number;       // GPU 过载阈值
  imbalanceThreshold: number; // 最大允许负载差异
  minTasksForMigration: number;
  maxMigrationTasks: number;
  enableAutoMigration: boolean;
  enablePredictive: boolean;
  coolingPeriod: number;
}
```

## 性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| 调度决策延迟 | <100ms | 单任务调度决策时间 |
| 批量调度延迟 | <500ms | 10个任务批量调度 |
| 预测准确率 | >85% | GPU 可用时间预测 |
| 负载均衡效果 | <30% | 最大负载差异 |

## 监控指标

- `ai_scheduler_decisions_total`: 调度决策总数
- `ai_scheduler_prediction_accuracy`: 预测准确率
- `gpu_allocation_success_rate`: GPU 分配成功率
- `load_balance_score`: 负载均衡得分
- `task_migration_count`: 任务迁移次数

## 版本历史

### v3.1.0 (2026-03-14)
- ✅ 初始版本发布
- ✅ ML 模型调度服务
- ✅ GPU 预测性分配
- ✅ 智能负载均衡
- ✅ REST API 接口
- ✅ 单元测试

## 后续计划

### v3.2.0
- [ ] 强化学习调度优化
- [ ] 多目标帕累托优化
- [ ] GPU 共享调度支持
- [ ] 实时调度可视化

### v3.3.0
- [ ] 分布式调度协调
- [ ] 联邦学习支持
- [ ] 自适应阈值调整
- [ ] 高级告警集成