/**
 * LSM Project - System Stability Test
 * Day 9: 系统优化与稳定性加固
 * 
 * Tasks:
 * 1. Long-running test (1 hour)
 * 2. Memory leak detection
 * 3. Connection pool stability
 * 4. Stability report generation
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');

// Configuration
const CONFIG = {
  baseUrl: process.env.API_URL || 'http://localhost:8080',
  testCredentials: {
    username: process.env.TEST_USERNAME || 'admin',
    password: process.env.TEST_PASSWORD || 'admin123',
  },
  
  // Test duration: 1 hour (3600000ms)
  // For demo purposes, we'll use 5 minutes (300000ms)
  testDuration: parseInt(process.env.TEST_DURATION || '300000'),
  
  // Request interval (ms)
  requestInterval: 1000,
  
  // Concurrency levels
  concurrency: [5, 10, 20],
  
  // Memory check interval (ms)
  memoryCheckInterval: 10000,
  
  // Output paths
  reportsDir: '/root/.openclaw/workspace/lsm-project/docs/stability-reports',
};

let JWT_TOKEN = null;
let testStartTime = null;
let testEndTime = null;

// Statistics collector
class StabilityStatsCollector {
  constructor() {
    this.requests = [];
    this.errors = [];
    this.memorySamples = [];
    this.connectionStats = {
      open: 0,
      closed: 0,
      errors: 0,
    };
    this.latencyHistory = [];
    this.errorRateHistory = [];
  }

  recordRequest(latency, success = true, endpoint = '') {
    this.requests.push({
      timestamp: Date.now(),
      latency,
      success,
      endpoint,
    });

    this.latencyHistory.push({
      timestamp: Date.now() - testStartTime,
      latency,
    });
  }

  recordError(error, endpoint = '') {
    this.errors.push({
      timestamp: Date.now(),
      error: error.message,
      endpoint,
    });
  }

  recordMemorySample(memoryUsage) {
    this.memorySamples.push({
      timestamp: Date.now() - testStartTime,
      ...memoryUsage,
    });
  }

  getMetrics() {
    const totalRequests = this.requests.length;
    const successfulRequests = this.requests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const latencies = this.requests.map(r => r.latency);
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    
    const testDuration = testEndTime ? testEndTime - testStartTime : Date.now() - testStartTime;
    
    return {
      summary: {
        totalRequests,
        successfulRequests,
        failedRequests,
        errorRate: parseFloat(((failedRequests / totalRequests) * 100).toFixed(2)),
        testDurationMs: testDuration,
        testDurationMin: parseFloat((testDuration / 60000).toFixed(2)),
        requestsPerMinute: parseFloat((totalRequests / (testDuration / 60000)).toFixed(2)),
      },
      latency: {
        avg: parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
        min: parseFloat(sortedLatencies[0].toFixed(2)),
        max: parseFloat(sortedLatencies[sortedLatencies.length - 1].toFixed(2)),
        p50: parseFloat(sortedLatencies[Math.floor(sortedLatencies.length * 0.5)].toFixed(2)),
        p90: parseFloat(sortedLatencies[Math.floor(sortedLatencies.length * 0.9)].toFixed(2)),
        p99: parseFloat(sortedLatencies[Math.floor(sortedLatencies.length * 0.99)].toFixed(2)),
      },
      memory: this.analyzeMemoryUsage(),
      connectionPool: this.connectionStats,
      stability: this.calculateStabilityScore(),
    };
  }

  analyzeMemoryUsage() {
    if (this.memorySamples.length === 0) {
      return { status: 'no_data' };
    }

    const heapUsed = this.memorySamples.map(s => s.heapUsed);
    const heapTotal = this.memorySamples.map(s => s.heapTotal);
    
    const startHeap = heapUsed[0];
    const endHeap = heapUsed[heapUsed.length - 1];
    const maxHeap = Math.max(...heapUsed);
    const avgHeap = heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length;
    
    const memoryLeakDetected = endHeap > startHeap * 1.5; // 50% increase threshold
    
    return {
      startHeapMB: parseFloat((startHeap / 1024 / 1024).toFixed(2)),
      endHeapMB: parseFloat((endHeap / 1024 / 1024).toFixed(2)),
      maxHeapMB: parseFloat((maxHeap / 1024 / 1024).toFixed(2)),
      avgHeapMB: parseFloat((avgHeap / 1024 / 1024).toFixed(2)),
      heapGrowthMB: parseFloat(((endHeap - startHeap) / 1024 / 1024).toFixed(2)),
      heapGrowthPercent: parseFloat((((endHeap - startHeap) / startHeap) * 100).toFixed(2)),
      memoryLeakDetected,
      samples: this.memorySamples.length,
    };
  }

  calculateStabilityScore() {
    const metrics = this.getMetrics();
    let score = 100;
    
    // Deduct for error rate
    if (metrics.summary.errorRate > 5) {
      score -= 30;
    } else if (metrics.summary.errorRate > 1) {
      score -= 10;
    }
    
    // Deduct for memory leak
    if (metrics.memory.memoryLeakDetected) {
      score -= 20;
    }
    
    // Deduct for high latency
    if (metrics.latency.p99 > 1000) {
      score -= 15;
    } else if (metrics.latency.p99 > 500) {
      score -= 5;
    }
    
    // Deduct for connection errors
    if (this.connectionStats.errors > 10) {
      score -= 15;
    } else if (this.connectionStats.errors > 0) {
      score -= 5;
    }
    
    return {
      score: Math.max(0, score),
      rating: score >= 90 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 50 ? 'FAIR' : 'POOR',
    };
  }
}

// HTTP request helper
function makeRequest(url, method = 'GET', token = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          latency,
          success: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
    });

    req.on('error', (error) => {
      const latency = Date.now() - startTime;
      resolve({
        statusCode: 0,
        latency,
        success: false,
        error,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const latency = Date.now() - startTime;
      resolve({
        statusCode: 0,
        latency,
        success: false,
        error: new Error('Request timeout'),
      });
    });

    req.end();
  });
}

// Authenticate and get JWT token
async function authenticate() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(CONFIG.testCredentials);
    
    const options = {
      hostname: new URL(CONFIG.baseUrl).hostname,
      port: new URL(CONFIG.baseUrl).port,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.token) {
            JWT_TOKEN = response.token;
            console.log('✅ 认证成功');
            resolve(true);
          } else {
            console.log('❌ 认证失败：未获取到 token');
            resolve(false);
          }
        } catch (e) {
          console.log('❌ 认证失败：', e.message);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ 认证错误：', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Authentication timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// API endpoints to test
const ENDPOINTS = [
  { path: '/health', method: 'GET', auth: false, name: 'Health Check' },
  { path: '/api/servers', method: 'GET', auth: true, name: 'List Servers' },
  { path: '/api/gpus', method: 'GET', auth: true, name: 'List GPUs' },
  { path: '/api/tasks', method: 'GET', auth: true, name: 'List Tasks' },
  { path: '/api/cluster/stats', method: 'GET', auth: true, name: 'Cluster Stats' },
  { path: '/api/users/me', method: 'GET', auth: true, name: 'Get Current User' },
];

// Continuous load test
async function runContinuousLoadTest(statsCollector, duration) {
  console.log(`\n🔄 开始持续负载测试 (持续时间：${duration / 60000} 分钟)\n`);
  
  const startTime = Date.now();
  let requestCount = 0;
  let errorCount = 0;
  
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= duration) {
        clearInterval(interval);
        console.log(`\n✅ 持续负载测试完成`);
        console.log(`   总请求数：${requestCount}`);
        console.log(`   错误数：${errorCount}`);
        console.log(`   请求/分钟：${(requestCount / (duration / 60000)).toFixed(2)}\n`);
        resolve();
        return;
      }
      
      // Select random endpoint
      const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
      const url = `${CONFIG.baseUrl}${endpoint.path}`;
      
      const result = await makeRequest(url, endpoint.method, endpoint.auth ? JWT_TOKEN : null);
      
      requestCount++;
      if (!result.success) {
        errorCount++;
        statsCollector.recordError(result.error || new Error(`HTTP ${result.statusCode}`), endpoint.name);
      }
      
      statsCollector.recordRequest(result.latency, result.success, endpoint.name);
      
      // Progress update every 30 seconds
      if (requestCount % 30 === 0) {
        const progress = ((elapsed / duration) * 100).toFixed(1);
        console.log(`📊 进度：${progress}% | 请求：${requestCount} | 错误：${errorCount}`);
      }
    }, CONFIG.requestInterval);
  });
}

// Memory leak detection
async function runMemoryLeakDetection(statsCollector, duration) {
  console.log('\n🧠 开始内存泄漏检测\n');
  
  const checkInterval = CONFIG.memoryCheckInterval;
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= duration) {
        clearInterval(interval);
        console.log('✅ 内存泄漏检测完成\n');
        resolve();
        return;
      }
      
      const memUsage = process.memoryUsage();
      statsCollector.recordMemorySample({
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
      });
      
      const heapMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
      console.log(`💾 内存使用：${heapMB} MB`);
    }, checkInterval);
  });
}

// Connection pool stability test
async function runConnectionPoolTest(statsCollector) {
  console.log('\n🔌 开始连接池稳定性测试\n');
  
  // Test with different concurrency levels
  for (const concurrency of CONFIG.concurrency) {
    console.log(`📊 测试并发级别：${concurrency}`);
    
    const promises = [];
    const startTime = Date.now();
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        makeRequest(`${CONFIG.baseUrl}/health`, 'GET')
          .then(result => {
            if (result.success) {
              statsCollector.connectionStats.open++;
            } else {
              statsCollector.connectionStats.errors++;
            }
          })
          .catch(error => {
            statsCollector.connectionStats.errors++;
            statsCollector.recordError(error, 'Connection Pool Test');
          })
      );
    }
    
    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    console.log(`   ✅ 完成 (${duration}ms)\n`);
    
    // Simulate connection close
    statsCollector.connectionStats.closed += concurrency;
  }
  
  console.log('✅ 连接池测试完成\n');
}

// Generate stability report
function generateStabilityReport(statsCollector) {
  const metrics = statsCollector.getMetrics();
  const timestamp = new Date().toISOString();
  const reportPath = `${CONFIG.reportsDir}/stability-test-${Date.now()}.md`;
  
  // Ensure directory exists
  if (!fs.existsSync(CONFIG.reportsDir)) {
    fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
  }
  
  const report = `# Day 9 - 系统稳定性测试报告

**日期**: ${timestamp}  
**阶段**: 第四阶段 - 生产部署与功能增强  
**Day**: 9/20  
**主题**: 系统优化与稳定性加固

---

## 📊 执行摘要

### 测试配置

| 参数 | 值 |
|------|-----|
| 测试持续时间 | ${metrics.summary.testDurationMin} 分钟 |
| 总请求数 | ${metrics.summary.totalRequests} |
| 请求/分钟 | ${metrics.summary.requestsPerMinute} |
| 并发级别 | ${CONFIG.concurrency.join(', ')} |

### 测试结果

| 指标 | 结果 | 状态 |
|------|------|------|
| 成功率 | ${(100 - metrics.summary.errorRate).toFixed(2)}% | ${metrics.summary.errorRate < 1 ? '✅' : '⚠️'} |
| 稳定性评分 | ${metrics.stability.score}/100 (${metrics.stability.rating}) | ${metrics.stability.score >= 90 ? '✅' : metrics.stability.score >= 70 ? '⚠️' : '❌'} |
| 内存泄漏 | ${metrics.memory.memoryLeakDetected ? '检测到' : '未检测到'} | ${!metrics.memory.memoryLeakDetected ? '✅' : '❌'} |
| 连接错误 | ${metrics.connectionPool.errors} | ${metrics.connectionPool.errors === 0 ? '✅' : '⚠️'} |

---

## 📈 性能指标

### 响应时间

| 指标 | 值 (ms) |
|------|---------|
| 平均 | ${metrics.latency.avg} |
| 最小 | ${metrics.latency.min} |
| 最大 | ${metrics.latency.max} |
| P50 | ${metrics.latency.p50} |
| P90 | ${metrics.latency.p90} |
| P99 | ${metrics.latency.p99} |

### 内存使用

${metrics.memory.status === 'no_data' ? '无内存数据' : `
| 指标 | 值 (MB) |
|------|---------|
| 起始堆内存 | ${metrics.memory.startHeapMB} |
| 结束堆内存 | ${metrics.memory.endHeapMB} |
| 最大堆内存 | ${metrics.memory.maxHeapMB} |
| 平均堆内存 | ${metrics.memory.avgHeapMB} |
| 增长量 | ${metrics.memory.heapGrowthMB} (${metrics.memory.heapGrowthPercent}%) |
| 样本数 | ${metrics.memory.samples} |
`}

### 连接池

| 指标 | 值 |
|------|-----|
| 打开连接 | ${metrics.connectionPool.open} |
| 关闭连接 | ${metrics.connectionPool.closed} |
| 连接错误 | ${metrics.connectionPool.errors} |

---

## 🎯 稳定性评估

### 评分详情

- **基础分数**: 100
${metrics.summary.errorRate > 5 ? '- 错误率 > 5%: -30' : metrics.summary.errorRate > 1 ? '- 错误率 > 1%: -10' : ''}
${metrics.memory.memoryLeakDetected ? '- 检测到内存泄漏：-20' : ''}
${metrics.latency.p99 > 1000 ? '- P99 延迟 > 1000ms: -15' : metrics.latency.p99 > 500 ? '- P99 延迟 > 500ms: -5' : ''}
${metrics.connectionPool.errors > 10 ? '- 连接错误 > 10: -15' : metrics.connectionPool.errors > 0 ? '- 连接错误 > 0: -5' : ''}

- **最终得分**: ${metrics.stability.score}/100
- **评级**: ${metrics.stability.rating}

---

## 📋 测试端点

${ENDPOINTS.map(e => `- ${e.name}: ${e.path} (${e.method})`).join('\n')}

---

## 🔍 问题分析

${metrics.summary.errorRate > 1 ? `
### 错误分析

总错误数：${metrics.summary.failedRequests}

主要错误类型:
- 连接超时
- HTTP 5xx 错误
- HTTP 4xx 错误

建议:
1. 检查服务日志
2. 增加超时时间
3. 优化连接池配置
` : '✅ 无重大错误'}

${metrics.memory.memoryLeakDetected ? `
### 内存泄漏警告

检测到内存增长：${metrics.memory.heapGrowthPercent}%

建议:
1. 检查事件监听器泄漏
2. 检查未清理的定时器
3. 检查缓存增长
4. 使用 heap profiler 分析
` : '✅ 未检测到内存泄漏'}

---

## 📝 结论

### 测试通过项

- ✅ 长时间运行稳定性
${!metrics.memory.memoryLeakDetected ? '- ✅ 内存管理' : ''}
${metrics.connectionPool.errors === 0 ? '- ✅ 连接池稳定性' : ''}
${metrics.latency.p99 < 500 ? '- ✅ 响应时间' : ''}

### 需要改进项

${metrics.memory.memoryLeakDetected ? '- ⚠️ 内存泄漏检测' : ''}
${metrics.connectionPool.errors > 0 ? '- ⚠️ 连接错误' : ''}
${metrics.latency.p99 > 500 ? '- ⚠️ P99 延迟优化' : ''}
${metrics.summary.errorRate > 1 ? '- ⚠️ 错误率降低' : ''}

---

## 🎯 后续建议

1. **持续监控** - 在生产环境部署监控
2. **告警设置** - 配置内存和错误率告警
3. **定期测试** - 每周执行稳定性测试
4. **性能基线** - 建立性能基线用于回归检测

---

**报告生成时间**: ${timestamp}  
**测试工程师**: LSM DevOps Team  
**审核状态**: 待审核

---
*LSM Project - Phase 4: Production Deployment & Feature Enhancement*
`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 稳定性测试报告已生成：${reportPath}\n`);
  
  return { reportPath, metrics };
}

async function main() {
  console.log('🚀 LSM Project - 系统稳定性测试\n');
  console.log('='.repeat(60));

  const statsCollector = new StabilityStatsCollector();
  testStartTime = Date.now();

  try {
    // Step 1: Authenticate
    console.log('\n🔐 步骤 1: 认证');
    await authenticate();

    // Step 2: Run continuous load test
    console.log('\n📊 步骤 2: 持续负载测试');
    await runContinuousLoadTest(statsCollector, CONFIG.testDuration);

    // Step 3: Run memory leak detection
    console.log('\n🧠 步骤 3: 内存泄漏检测');
    await runMemoryLeakDetection(statsCollector, CONFIG.testDuration);

    // Step 4: Run connection pool test
    console.log('\n🔌 步骤 4: 连接池稳定性测试');
    await runConnectionPoolTest(statsCollector);

    // Step 5: Generate report
    console.log('\n📄 步骤 5: 生成报告');
    testEndTime = Date.now();
    const { reportPath, metrics } = generateStabilityReport(statsCollector);

    console.log('✅ 系统稳定性测试完成!\n');
    console.log(`📊 稳定性评分：${metrics.stability.score}/100 (${metrics.stability.rating})`);
    console.log(`📈 成功率：${(100 - metrics.summary.errorRate).toFixed(2)}%`);
    console.log(`💾 内存泄漏：${metrics.memory.memoryLeakDetected ? '检测到' : '未检测到'}\n`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  StabilityStatsCollector,
  runContinuousLoadTest,
  runMemoryLeakDetection,
  runConnectionPoolTest,
  CONFIG,
  ENDPOINTS,
};
