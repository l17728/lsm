/**
 * LSM Project - Performance Test Automation for CI/CD
 * Day 8: 挺进中原 - 集成测试与自动化
 * 
 * Features:
 * 1. Automated performance test execution
 * 2. CI/CD pipeline integration
 * 3. Scheduled performance monitoring
 * 4. Performance regression detection
 * 5. Automated report generation
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.API_URL || 'http://localhost:8080',
  testCredentials: {
    username: process.env.TEST_USERNAME || 'admin',
    password: process.env.TEST_PASSWORD || 'admin123',
  },
  
  // Performance thresholds (regression detection)
  thresholds: {
    avgLatency: 200,    // ms
    p90Latency: 300,    // ms
    p99Latency: 500,    // ms
    errorRate: 1,       // %
    throughput: 10,     // req/sec (minimum)
  },
  
  // Test parameters
  totalRequests: parseInt(process.env.TEST_REQUESTS || '500'),
  concurrency: [10, 50, 100],
  timeout: 10000,
  
  // Output paths
  reportsDir: '/root/.openclaw/workspace/lsm-project/docs/performance-reports',
  baselineFile: '/root/.openclaw/workspace/lsm-project/tests/performance-baseline.json',
};

let JWT_TOKEN = null;

// Statistics collector
class StatsCollector {
  constructor() {
    this.latencies = [];
    this.errors = 0;
    this.successes = 0;
    this.startTime = null;
    this.endTime = null;
  }

  record(latency, success = true) {
    if (success) {
      this.successes++;
      this.latencies.push(latency);
    } else {
      this.errors++;
    }
  }

  getMetrics() {
    if (this.latencies.length === 0) {
      return { error: 'No data' };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const total = this.latencies.length;
    
    return {
      totalRequests: total + this.errors,
      successes: this.successes,
      errors: this.errors,
      errorRate: parseFloat(((this.errors / (total + this.errors)) * 100).toFixed(2)),
      avgLatency: parseFloat((this.latencies.reduce((a, b) => a + b, 0) / total).toFixed(2)),
      minLatency: parseFloat(sorted[0].toFixed(2)),
      maxLatency: parseFloat(sorted[total - 1].toFixed(2)),
      p50: parseFloat(sorted[Math.floor(total * 0.5)].toFixed(2)),
      p90: parseFloat(sorted[Math.floor(total * 0.9)].toFixed(2)),
      p99: parseFloat(sorted[Math.floor(total * 0.99)].toFixed(2)),
      throughput: parseFloat((total / ((this.endTime - this.startTime) / 1000)).toFixed(2)),
    };
  }
}

// HTTP request helper
function makeRequest(url, method = 'GET', token = null, body = null) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      timeout: CONFIG.timeout,
      headers: { 'Content-Type': 'application/json' },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      const latency = Date.now() - startTime;
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          latency,
          success: res.statusCode >= 200 && res.statusCode < 400,
          data: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', () => {
      resolve({ status: 0, latency: Date.now() - startTime, success: false, error: 'Connection error' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, latency: Date.now() - startTime, success: false, error: 'Timeout' });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Authenticate
async function authenticate() {
  const url = `${CONFIG.baseUrl}/api/auth/login`;
  const result = await makeRequest(url, 'POST', null, {
    username: CONFIG.testCredentials.username,
    password: CONFIG.testCredentials.password,
  });
  
  if (result.success) {
    JWT_TOKEN = result.data?.token;
    return !!JWT_TOKEN;
  }
  return false;
}

// Run concurrent tests
async function runConcurrentTests(url, concurrency, totalRequests, token = null) {
  const stats = new StatsCollector();
  stats.startTime = Date.now();
  
  const batches = Math.ceil(totalRequests / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const promises = [];
    for (let i = 0; i < concurrency && (batch * concurrency + i) < totalRequests; i++) {
      promises.push(makeRequest(url, 'GET', token).then(res => {
        stats.record(res.latency, res.success);
      }));
    }
    await Promise.all(promises);
  }
  
  stats.endTime = Date.now();
  return stats.getMetrics();
}

// Load baseline for regression detection
function loadBaseline() {
  try {
    if (fs.existsSync(CONFIG.baselineFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.baselineFile, 'utf-8'));
    }
  } catch (e) {
    console.log('⚠️  No baseline found, will create new one');
  }
  return null;
}

// Save baseline
function saveBaseline(metrics) {
  try {
    fs.mkdirSync(path.dirname(CONFIG.baselineFile), { recursive: true });
    fs.writeFileSync(CONFIG.baselineFile, JSON.stringify(metrics, null, 2));
    console.log('✅ Baseline saved');
  } catch (e) {
    console.error('❌ Failed to save baseline:', e.message);
  }
}

// Detect performance regression
function detectRegression(currentMetrics, baseline) {
  const regressions = [];
  const { thresholds } = CONFIG;
  
  // Check against absolute thresholds
  if (currentMetrics.avgLatency > thresholds.avgLatency) {
    regressions.push({
      metric: 'avgLatency',
      current: currentMetrics.avgLatency,
      threshold: thresholds.avgLatency,
      type: 'threshold',
    });
  }
  
  if (currentMetrics.p90Latency > thresholds.p90Latency) {
    regressions.push({
      metric: 'p90Latency',
      current: currentMetrics.p90Latency,
      threshold: thresholds.p90Latency,
      type: 'threshold',
    });
  }
  
  if (currentMetrics.p99Latency > thresholds.p99Latency) {
    regressions.push({
      metric: 'p99Latency',
      current: currentMetrics.p99Latency,
      threshold: thresholds.p99Latency,
      type: 'threshold',
    });
  }
  
  if (currentMetrics.errorRate > thresholds.errorRate) {
    regressions.push({
      metric: 'errorRate',
      current: currentMetrics.errorRate,
      threshold: thresholds.errorRate,
      type: 'threshold',
    });
  }
  
  if (currentMetrics.throughput < thresholds.throughput) {
    regressions.push({
      metric: 'throughput',
      current: currentMetrics.throughput,
      threshold: thresholds.throughput,
      type: 'threshold',
    });
  }
  
  // Check against baseline (if exists)
  if (baseline) {
    const regressionThreshold = 1.2; // 20% degradation
    
    if (baseline.avgLatency && currentMetrics.avgLatency > baseline.avgLatency * regressionThreshold) {
      regressions.push({
        metric: 'avgLatency',
        current: currentMetrics.avgLatency,
        baseline: baseline.avgLatency,
        change: `${((currentMetrics.avgLatency / baseline.avgLatency - 1) * 100).toFixed(1)}%`,
        type: 'baseline',
      });
    }
    
    if (baseline.p90Latency && currentMetrics.p90Latency > baseline.p90Latency * regressionThreshold) {
      regressions.push({
        metric: 'p90Latency',
        current: currentMetrics.p90Latency,
        baseline: baseline.p90Latency,
        change: `${((currentMetrics.p90Latency / baseline.p90Latency - 1) * 100).toFixed(1)}%`,
        type: 'baseline',
      });
    }
  }
  
  return regressions;
}

// Run performance tests
async function runPerformanceTests() {
  console.log('\n📊 Running Performance Tests');
  console.log('=' .repeat(60));
  
  const results = {};
  
  // Test endpoints
  const endpoints = [
    { name: 'servers', url: '/api/servers' },
    { name: 'gpu', url: '/api/gpu' },
    { name: 'tasks', url: '/api/tasks' },
    { name: 'cluster_stats', url: '/api/cluster/stats' },
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n  Testing ${endpoint.name}...`);
    const url = `${CONFIG.baseUrl}${endpoint.url}`;
    
    const metrics = await runConcurrentTests(url, 50, CONFIG.totalRequests, JWT_TOKEN);
    results[endpoint.name] = metrics;
    
    console.log(`    Avg: ${metrics.avgLatency}ms | P90: ${metrics.p90}ms | P99: ${metrics.p99}ms`);
    console.log(`    Throughput: ${metrics.throughput} req/s | Error Rate: ${metrics.errorRate}%`);
  }
  
  return results;
}

// Generate CI/CD report
function generateCICDReport(results, regressions) {
  const timestamp = new Date().toISOString();
  const hasRegressions = regressions.length > 0;
  
  // Ensure reports directory exists
  fs.mkdirSync(CONFIG.reportsDir, { recursive: true });
  
  // Generate filename with timestamp
  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].split(':')[0];
  const reportFile = path.join(CONFIG.reportsDir, `performance-${date}-${time}.json`);
  
  const report = {
    timestamp,
    ci: {
      build: process.env.CI_BUILD_ID || 'manual',
      branch: process.env.CI_BRANCH || 'main',
      commit: process.env.CI_COMMIT || 'unknown',
    },
    results,
    regressions,
    passed: !hasRegressions,
    summary: {
      totalEndpoints: Object.keys(results).length,
      avgLatency: (Object.values(results).reduce((sum, m) => sum + m.avgLatency, 0) / Object.keys(results).length).toFixed(2),
      avgThroughput: (Object.values(results).reduce((sum, m) => sum + m.throughput, 0) / Object.keys(results).length).toFixed(2),
      avgErrorRate: (Object.values(results).reduce((sum, m) => sum + m.errorRate, 0) / Object.keys(results).length).toFixed(2),
    },
  };
  
  // Save JSON report
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  // Generate Markdown summary for CI/CD
  const markdownReport = `# Performance Test Report - CI/CD

**Date**: ${timestamp}
**Build**: ${report.ci.build}
**Branch**: ${report.ci.branch}
**Commit**: ${report.ci.commit}

---

## Status

${hasRegressions ? '❌ FAILED - Performance Regressions Detected' : '✅ PASSED - No Regressions'}

---

## Summary

| Metric | Value |
|--------|-------|
| Endpoints Tested | ${report.summary.totalEndpoints} |
| Average Latency | ${report.summary.avgLatency}ms |
| Average Throughput | ${report.summary.avgThroughput} req/s |
| Average Error Rate | ${report.summary.avgErrorRate}% |

---

## Detailed Results

${Object.entries(results).map(([name, m]) => `### ${name}
- Avg Latency: ${m.avgLatency}ms
- P90 Latency: ${m.p90}ms
- P99 Latency: ${m.p99}ms
- Throughput: ${m.throughput} req/s
- Error Rate: ${m.errorRate}%
`).join('\n')}

---

## Regressions

${regressions.length === 0 ? 'No regressions detected.' : regressions.map(r => `
- **${r.metric}**: ${r.current} (${r.type === 'baseline' ? `${r.change} vs baseline` : `threshold: ${r.threshold}`})
`).join('\n')}

---

## Thresholds

| Metric | Threshold |
|--------|-----------|
| Avg Latency | <${CONFIG.thresholds.avgLatency}ms |
| P90 Latency | <${CONFIG.thresholds.p90Latency}ms |
| P99 Latency | <${CONFIG.thresholds.p99Latency}ms |
| Error Rate | <${CONFIG.thresholds.errorRate}% |
| Throughput | >${CONFIG.thresholds.throughput} req/s |

---

**Generated**: ${timestamp}
`;
  
  const markdownFile = path.join(CONFIG.reportsDir, `performance-${date}-${time}.md`);
  fs.writeFileSync(markdownFile, markdownReport);
  
  console.log(`\n📄 Reports saved:`);
  console.log(`   JSON: ${reportFile}`);
  console.log(`   Markdown: ${markdownFile}`);
  
  return report;
}

// Main CI/CD execution
async function main() {
  console.log('🚀 LSM Project - Performance Test Automation');
  console.log('Day 8: 挺进中原 - 集成测试与自动化\n');
  console.log(`CI Build: ${process.env.CI_BUILD_ID || 'manual'}`);
  console.log(`Branch: ${process.env.CI_BRANCH || 'main'}`);
  console.log(`Commit: ${process.env.CI_COMMIT || 'unknown'}`);
  
  try {
    // Step 1: Authenticate
    console.log('\n🔐 Authenticating...');
    const authSuccess = await authenticate();
    if (!authSuccess) {
      console.error('❌ Authentication failed');
      process.exit(1);
    }
    console.log('✅ Authentication successful');
    
    // Step 2: Load baseline
    console.log('\n📈 Loading baseline...');
    const baseline = loadBaseline();
    if (baseline) {
      console.log('✅ Baseline loaded');
    } else {
      console.log('⚠️  No baseline found');
    }
    
    // Step 3: Run performance tests
    const results = await runPerformanceTests();
    
    // Step 4: Detect regressions
    console.log('\n🔍 Detecting regressions...');
    const allRegressions = [];
    for (const [endpoint, metrics] of Object.entries(results)) {
      const regressions = detectRegression(metrics, baseline);
      if (regressions.length > 0) {
        console.log(`  ⚠️  Regressions detected in ${endpoint}:`);
        regressions.forEach(r => {
          console.log(`    - ${r.metric}: ${r.current} (${r.type === 'baseline' ? `${r.change} vs baseline` : `threshold: ${r.threshold}`})`);
        });
      }
      allRegressions.push(...regressions.map(r => ({ endpoint, ...r })));
    }
    
    if (allRegressions.length === 0) {
      console.log('✅ No regressions detected');
    }
    
    // Step 5: Generate report
    const report = generateCICDReport(results, allRegressions);
    
    // Step 6: Update baseline if tests passed
    if (allRegressions.length === 0 && !baseline) {
      console.log('\n💾 Saving baseline...');
      const baselineMetrics = {};
      for (const [endpoint, metrics] of Object.entries(results)) {
        baselineMetrics[endpoint] = {
          avgLatency: metrics.avgLatency,
          p90Latency: metrics.p90Latency,
          p99Latency: metrics.p99Latency,
          throughput: metrics.throughput,
          errorRate: metrics.errorRate,
        };
      }
      saveBaseline(baselineMetrics);
    }
    
    // Step 7: Exit with appropriate code
    console.log('\n' + '=' .repeat(60));
    if (allRegressions.length > 0) {
      console.log('❌ Performance tests FAILED - Regressions detected');
      console.log('=' .repeat(60));
      process.exit(1);
    } else {
      console.log('✅ Performance tests PASSED - No regressions');
      console.log('=' .repeat(60));
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Performance test automation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
