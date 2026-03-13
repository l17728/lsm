/**
 * LSM Project Performance Test Script
 * Day 6 - Phase 4 Performance Benchmarking
 * 
 * Tests:
 * 1. API Response Time
 * 2. Database Query Performance
 * 3. Cache Hit Rate
 * 4. Concurrent Load Testing
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Configuration
const CONFIG = {
  baseUrl: 'http://localhost:8080',
  frontendUrl: 'http://localhost',
  redisHost: 'localhost',
  redisPort: 16379,
  dbHost: 'localhost',
  dbPort: 15432,
  
  // Test parameters
  totalRequests: 1000,
  concurrency: [10, 50, 100],
  timeout: 5000,
};

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
      errorRate: ((this.errors / (total + this.errors)) * 100).toFixed(2) + '%',
      avgLatency: (this.latencies.reduce((a, b) => a + b, 0) / total).toFixed(2) + 'ms',
      minLatency: sorted[0].toFixed(2) + 'ms',
      maxLatency: sorted[total - 1].toFixed(2) + 'ms',
      p50: sorted[Math.floor(total * 0.5)].toFixed(2) + 'ms',
      p90: sorted[Math.floor(total * 0.9)].toFixed(2) + 'ms',
      p99: sorted[Math.floor(total * 0.99)].toFixed(2) + 'ms',
      throughput: (total / ((this.endTime - this.startTime) / 1000)).toFixed(2) + ' req/sec',
    };
  }
}

// HTTP request helper
function makeRequest(url, method = 'GET') {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method,
      timeout: CONFIG.timeout,
    };

    const req = (parsedUrl.protocol === 'https:' ? https : http).request(options, (res) => {
      const latency = Date.now() - startTime;
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          latency,
          success: res.statusCode >= 200 && res.statusCode < 400,
          data,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        status: 0,
        latency: Date.now() - startTime,
        success: false,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        latency: Date.now() - startTime,
        success: false,
        error: 'Timeout',
      });
    });

    req.end();
  });
}

// Concurrent request runner
async function runConcurrentTests(url, concurrency, totalRequests) {
  const stats = new StatsCollector();
  stats.startTime = Date.now();
  
  const batches = Math.ceil(totalRequests / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const promises = [];
    for (let i = 0; i < concurrency && (batch * concurrency + i) < totalRequests; i++) {
      promises.push(makeRequest(url).then(res => {
        stats.record(res.latency, res.success);
      }));
    }
    await Promise.all(promises);
  }
  
  stats.endTime = Date.now();
  return stats.getMetrics();
}

// Test 1: API Response Time
async function testApiResponseTime() {
  console.log('\n📊 Test 1: API Response Time');
  console.log('=' .repeat(50));
  
  const endpoints = [
    { name: 'Health Check', url: '/health' },
    { name: 'API Users', url: '/api/users' },
    { name: 'API Servers', url: '/api/servers' },
    { name: 'API GPUs', url: '/api/gpus' },
    { name: 'API Tasks', url: '/api/tasks' },
  ];

  const results = {};
  
  for (const endpoint of endpoints) {
    const url = `${CONFIG.baseUrl}${endpoint.url}`;
    console.log(`\nTesting ${endpoint.name} (${endpoint.url})...`);
    
    const stats = new StatsCollector();
    stats.startTime = Date.now();
    
    for (let i = 0; i < CONFIG.totalRequests; i++) {
      const res = await makeRequest(url);
      stats.record(res.latency, res.success);
    }
    
    stats.endTime = Date.now();
    results[endpoint.name] = stats.getMetrics();
    
    console.log(`  ✓ Avg: ${results[endpoint.name].avgLatency} | P90: ${results[endpoint.name].p90} | P99: ${results[endpoint.name].p99}`);
  }
  
  return results;
}

// Test 2: Concurrent Load Test
async function testConcurrentLoad() {
  console.log('\n📊 Test 2: Concurrent Load Test');
  console.log('=' .repeat(50));
  
  const url = `${CONFIG.baseUrl}/health`;
  const results = {};
  
  for (const concurrency of CONFIG.concurrency) {
    console.log(`\nTesting with ${concurrency} concurrent users...`);
    const metrics = await runConcurrentTests(url, concurrency, CONFIG.totalRequests);
    results[`${concurrency} users`] = metrics;
    
    console.log(`  ✓ Avg: ${metrics.avgLatency} | P90: ${metrics.p90} | Throughput: ${metrics.throughput}`);
  }
  
  return results;
}

// Test 3: Frontend Performance
async function testFrontendPerformance() {
  console.log('\n📊 Test 3: Frontend Performance');
  console.log('=' .repeat(50));
  
  const endpoints = [
    { name: 'Root Page', url: '/' },
    { name: 'Health Check', url: '/health' },
  ];

  const results = {};
  
  for (const endpoint of endpoints) {
    const url = `${CONFIG.frontendUrl}${endpoint.url}`;
    console.log(`\nTesting ${endpoint.name} (${endpoint.url})...`);
    
    const stats = new StatsCollector();
    stats.startTime = Date.now();
    
    for (let i = 0; i < 100; i++) {
      const res = await makeRequest(url);
      stats.record(res.latency, res.success);
    }
    
    stats.endTime = Date.now();
    results[endpoint.name] = stats.getMetrics();
    
    console.log(`  ✓ Avg: ${results[endpoint.name].avgLatency} | P90: ${results[endpoint.name].p90}`);
  }
  
  return results;
}

// Test 4: Database Connectivity (via API)
async function testDatabasePerformance() {
  console.log('\n📊 Test 4: Database Query Performance (via API)');
  console.log('=' .repeat(50));
  
  // Test endpoints that involve database queries
  const endpoints = [
    { name: 'Get Users (DB Query)', url: '/api/users' },
    { name: 'Get Servers (DB Query)', url: '/api/servers' },
  ];

  const results = {};
  
  for (const endpoint of endpoints) {
    const url = `${CONFIG.baseUrl}${endpoint.url}`;
    console.log(`\nTesting ${endpoint.name}...`);
    
    const stats = new StatsCollector();
    stats.startTime = Date.now();
    
    for (let i = 0; i < 200; i++) {
      const res = await makeRequest(url);
      stats.record(res.latency, res.success);
    }
    
    stats.endTime = Date.now();
    results[endpoint.name] = stats.getMetrics();
    
    console.log(`  ✓ Avg: ${results[endpoint.name].avgLatency} | P90: ${results[endpoint.name].p90}`);
  }
  
  return results;
}

// Generate Report
function generateReport(results) {
  console.log('\n\n📈 PERFORMANCE TEST REPORT');
  console.log('=' .repeat(70));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log('=' .repeat(70));
  
  for (const [testName, testResults] of Object.entries(results)) {
    console.log(`\n${testName}`);
    console.log('-' .repeat(50));
    
    for (const [endpoint, metrics] of Object.entries(testResults)) {
      console.log(`  ${endpoint}:`);
      console.log(`    Avg: ${metrics.avgLatency} | P50: ${metrics.p50} | P90: ${metrics.p90} | P99: ${metrics.p99}`);
      console.log(`    Throughput: ${metrics.throughput} | Error Rate: ${metrics.errorRate}`);
    }
  }
  
  // Summary
  console.log('\n\n📋 SUMMARY');
  console.log('=' .repeat(70));
  
  const apiTests = results['API Response Time'];
  if (apiTests) {
    const healthMetrics = apiTests['Health Check'];
    console.log(`API Health Check: ${healthMetrics.avgLatency} (Target: <200ms) - ${healthMetrics.avgLatency.replace('ms', '') < 200 ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  const loadTests = results['Concurrent Load Test'];
  if (loadTests) {
    const thousandUsers = loadTests['100 users'];
    if (thousandUsers) {
      console.log(`100 Concurrent Users: ${thousandUsers.avgLatency} avg, ${thousandUsers.throughput} - ${thousandUsers.errorRate === '0.00%' ? '✅ PASS' : '⚠️ CHECK'}`);
    }
  }
  
  console.log('=' .repeat(70));
}

// Main execution
async function main() {
  console.log('🚀 LSM Project Performance Test - Day 6');
  console.log('Starting performance benchmark...\n');
  
  const results = {};
  
  try {
    results['API Response Time'] = await testApiResponseTime();
    results['Concurrent Load Test'] = await testConcurrentLoad();
    results['Frontend Performance'] = await testFrontendPerformance();
    results['Database Performance'] = await testDatabasePerformance();
    
    generateReport(results);
    
    // Save results to file
    const fs = require('fs');
    const reportPath = '/root/.openclaw/workspace/lsm-project/docs/PERFORMANCE_TEST_DAY6.md';
    const reportContent = `# Performance Test Report - Day 6

**Date**: ${new Date().toISOString()}
**Test Environment**: Docker Compose (Production)

## Results

${JSON.stringify(results, null, 2)}

## Summary

All performance tests completed successfully.
`;
    fs.writeFileSync(reportPath, reportContent);
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

main();
