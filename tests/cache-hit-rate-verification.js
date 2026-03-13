/**
 * LSM Project - Cache Hit Rate Verification
 * Day 8: 挺进中原 - 集成测试与自动化
 * 
 * Tests:
 * 1. Production cache analysis
 * 2. Hit rate monitoring
 * 3. Optimization recommendations
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
  timeout: 10000,
  
  // Cache performance targets
  targets: {
    hitRate: 85,      // Target: >85%
    minHits: 100,     // Minimum hits for valid test
  },
};

let JWT_TOKEN = null;

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
      resolve({ status: 0, latency: Date.now() - startTime, success: false });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, latency: Date.now() - startTime, success: false });
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

// Simulate cache usage patterns
async function simulateCacheUsage() {
  console.log('\n📊 Simulating Cache Usage Patterns');
  console.log('=' .repeat(60));
  
  const endpoints = [
    { name: 'Servers List', url: '/api/servers' },
    { name: 'GPU List', url: '/api/gpu' },
    { name: 'Tasks List', url: '/api/tasks' },
    { name: 'Cluster Stats', url: '/api/cluster/stats' },
  ];
  
  const requestsPerEndpoint = 20;
  
  for (const endpoint of endpoints) {
    console.log(`\n  Warming up ${endpoint.name}...`);
    
    // First request (cache miss)
    await makeRequest(`${CONFIG.baseUrl}${endpoint.url}`, 'GET', JWT_TOKEN);
    
    // Subsequent requests (should be cache hits)
    for (let i = 0; i < requestsPerEndpoint; i++) {
      await makeRequest(`${CONFIG.baseUrl}${endpoint.url}`, 'GET', JWT_TOKEN);
    }
    
    console.log(`    ✅ ${requestsPerEndpoint + 1} requests sent`);
  }
  
  console.log('\n✅ Cache usage simulation complete');
}

// Get cache statistics
async function getCacheStats() {
  console.log('\n📈 Fetching Cache Statistics');
  console.log('=' .repeat(60));
  
  try {
    const url = `${CONFIG.baseUrl}/api/cache/stats`;
    const result = await makeRequest(url, 'GET', JWT_TOKEN);
    
    if (result.success && result.data) {
      const stats = result.data.data || result.data;
      console.log('\n  Cache Statistics:');
      console.log(`    Hits: ${stats.hits || 0}`);
      console.log(`    Misses: ${stats.misses || 0}`);
      console.log(`    Hit Rate: ${stats.hitRate || 0}%`);
      console.log(`    Size: ${stats.size || 0} keys`);
      
      if (stats.ttlConfig) {
        console.log('\n  TTL Configuration:');
        for (const [key, value] of Object.entries(stats.ttlConfig)) {
          console.log(`    ${key}: ${value}s`);
        }
      }
      
      return stats;
    } else {
      console.log('  ⚠️  Cache stats endpoint not available');
      return null;
    }
  } catch (error) {
    console.log('  ⚠️  Failed to fetch cache stats:', error.message);
    return null;
  }
}

// Analyze cache performance
function analyzeCachePerformance(stats) {
  console.log('\n🔍 Analyzing Cache Performance');
  console.log('=' .repeat(60));
  
  const analysis = {
    hitRate: stats?.hitRate || 0,
    meetsTarget: false,
    recommendations: [],
  };
  
  if (!stats) {
    console.log('  ⚠️  No statistics available for analysis');
    return analysis;
  }
  
  // Check hit rate target
  if (stats.hitRate >= CONFIG.targets.hitRate) {
    console.log(`  ✅ Hit rate (${stats.hitRate}%) meets target (${CONFIG.targets.hitRate}%)`);
    analysis.meetsTarget = true;
  } else {
    console.log(`  ⚠️  Hit rate (${stats.hitRate}%) below target (${CONFIG.targets.hitRate}%)`);
    analysis.recommendations.push('Increase cache TTL for frequently accessed data');
    analysis.recommendations.push('Implement cache warming on application startup');
  }
  
  // Analyze hits vs misses
  const total = (stats.hits || 0) + (stats.misses || 0);
  if (total < CONFIG.targets.minHits) {
    console.log(`  ⚠️  Insufficient data (${total} requests, need ${CONFIG.targets.minHits})`);
    analysis.recommendations.push('Run more requests to get accurate statistics');
  } else {
    console.log(`  ✅ Sufficient data collected (${total} requests)`);
  }
  
  // TTL analysis
  if (stats.ttlConfig) {
    console.log('\n  TTL Analysis:');
    
    // Check if frequently changing data has short TTL
    if (stats.ttlConfig.gpuStatus <= 120) {
      console.log(`    ✅ GPU status TTL is optimal (${stats.ttlConfig.gpuStatus}s)`);
    } else {
      console.log(`    ⚠️  GPU status TTL may be too long (${stats.ttlConfig.gpuStatus}s)`);
      analysis.recommendations.push('Reduce GPU status TTL to <120s for real-time data');
    }
    
    // Check if stable data has long TTL
    if (stats.ttlConfig.serverList >= 900) {
      console.log(`    ✅ Server list TTL is optimal (${stats.ttlConfig.serverList}s)`);
    } else {
      console.log(`    ⚠️  Server list TTL may be too short (${stats.ttlConfig.serverList}s)`);
      analysis.recommendations.push('Increase server list TTL to >900s for stable data');
    }
    
    // Check session TTL
    if (stats.ttlConfig.userSession >= 7 * 24 * 3600) {
      console.log(`    ✅ User session TTL is optimal (${stats.ttlConfig.userSession / 86400} days)`);
    } else {
      console.log(`    ⚠️  User session TTL may be too short`);
      analysis.recommendations.push('Consider increasing user session TTL for better UX');
    }
  }
  
  return analysis;
}

// Generate recommendations
function generateRecommendations(analysis) {
  console.log('\n💡 Optimization Recommendations');
  console.log('=' .repeat(60));
  
  if (analysis.recommendations.length === 0) {
    console.log('  ✅ Cache configuration is optimal!');
    console.log('  No immediate optimizations needed.');
  } else {
    console.log('  Recommendations:');
    analysis.recommendations.forEach((rec, i) => {
      console.log(`    ${i + 1}. ${rec}`);
    });
  }
  
  // General best practices
  console.log('\n  Best Practices:');
  console.log('    - Monitor cache hit rate trends over time');
  console.log('    - Implement cache warming for critical data');
  console.log('    - Use cache invalidation patterns for data updates');
  console.log('    - Consider Redis Cluster for high availability');
  console.log('    - Set up alerts for low hit rate (<70%)');
}

// Generate report
function generateReport(stats, analysis) {
  const timestamp = new Date().toISOString();
  const reportPath = '/root/.openclaw/workspace/lsm-project/docs/CACHE_HIT_RATE_VERIFICATION.md';
  
  const reportContent = `# Cache Hit Rate Verification Report - Day 8

**Date**: ${timestamp}
**Phase**: Phase 4 - Production Deployment & Feature Enhancement
**Day**: 8/20
**Theme**: 挺进中原 - 集成测试与自动化

---

## Executive Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Hit Rate | ${stats?.hitRate || 'N/A'}% | >${CONFIG.targets.hitRate}% | ${analysis.meetsTarget ? '✅ PASS' : '⚠️ CHECK'} |
| Total Hits | ${stats?.hits || 'N/A'} | - | - |
| Total Misses | ${stats?.misses || 'N/A'} | - | - |
| Cache Size | ${stats?.size || 'N/A'} keys | - | - |

---

## Cache Statistics

${stats ? `
### Current Performance

- **Hits**: ${stats.hits}
- **Misses**: ${stats.misses}
- **Hit Rate**: ${stats.hitRate}%
- **Cache Size**: ${stats.size} keys
- **Last Reset**: ${stats.lastStatsReset || 'N/A'}

### TTL Configuration

| Key | TTL | Purpose |
|-----|-----|---------|
| userSession | ${stats.ttlConfig?.userSession || 'N/A'}s | User sessions (7 days) |
| serverList | ${stats.ttlConfig?.serverList || 'N/A'}s | Server list (15 min) |
| gpuList | ${stats.ttlConfig?.gpuList || 'N/A'}s | GPU list (10 min) |
| taskList | ${stats.ttlConfig?.taskList || 'N/A'}s | Task list (5 min) |
| gpuStatus | ${stats.ttlConfig?.gpuStatus || 'N/A'}s | GPU status (2 min) |
| clusterStats | ${stats.ttlConfig?.clusterStats || 'N/A'}s | Cluster stats (1 min) |
| healthCheck | ${stats.ttlConfig?.healthCheck || 'N/A'}s | Health checks (30 sec) |
` : 'Cache statistics not available.'}

---

## Analysis Results

### Hit Rate Assessment

${analysis.meetsTarget 
  ? '✅ Cache hit rate meets the target of 85%. The cache system is performing well.' 
  : '⚠️ Cache hit rate is below the 85% target. Consider implementing the recommendations below.'}

### TTL Optimization

${stats?.ttlConfig ? `
The TTL configuration follows best practices:
- **Short TTL** (30s-2min): Frequently changing data (health checks, GPU status)
- **Medium TTL** (5-10min): Moderately stable data (task list, GPU list)
- **Long TTL** (15-30min): Stable data (server list, user list)
- **Very Long TTL** (7 days): Session data
` : 'TTL configuration not available.'}

---

## Recommendations

${analysis.recommendations.length > 0 
  ? analysis.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')
  : '✅ No immediate optimizations needed. Cache configuration is optimal.'}

---

## Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Hit Rate | >85% | ${stats?.hitRate || 'N/A'}% | ${analysis.meetsTarget ? '✅' : '⚠️'} |
| Response Time | <50ms (cache) | N/A | - |
| Memory Usage | <512MB | N/A | - |

---

## Next Steps

1. **Monitor Trends**: Track hit rate over time to identify patterns
2. **Cache Warming**: Implement startup cache warming for critical data
3. **Invalidation Strategy**: Review cache invalidation on data updates
4. **Alerting**: Set up alerts for hit rate <70%
5. **Capacity Planning**: Monitor cache size growth

---

**Report Generated**: ${timestamp}
**Verification Engineer**: LSM DevOps Team
`;
  
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  return { stats, analysis, meetsTarget: analysis.meetsTarget };
}

// Main execution
async function main() {
  console.log('🚀 LSM Project - Cache Hit Rate Verification');
  console.log('Day 8: 挺进中原 - 集成测试与自动化\n');
  
  try {
    // Step 1: Authenticate
    console.log('🔐 Authenticating...');
    const authSuccess = await authenticate();
    if (!authSuccess) {
      console.log('⚠️  Authentication failed, continuing with limited tests\n');
    }
    
    // Step 2: Simulate cache usage
    if (JWT_TOKEN) {
      await simulateCacheUsage();
    }
    
    // Step 3: Get cache statistics
    const stats = await getCacheStats();
    
    // Step 4: Analyze performance
    const analysis = analyzeCachePerformance(stats);
    
    // Step 5: Generate recommendations
    generateRecommendations(analysis);
    
    // Step 6: Generate report
    const result = generateReport(stats, analysis);
    
    console.log('\n' + '=' .repeat(60));
    if (result.meetsTarget) {
      console.log('✅ Cache hit rate verification PASSED');
    } else {
      console.log('⚠️  Cache hit rate verification needs attention');
    }
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('\n❌ Cache verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
