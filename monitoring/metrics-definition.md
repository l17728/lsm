# LSM Project Monitoring Metrics Definition
# Version: 1.0.0
# Date: 2026-03-12

---

## 1. System Metrics (Node Exporter)

### CPU
- `node_cpu_seconds_total` - CPU 使用时间
- `node_cpu_usage_percent` - CPU 使用率
- `node_load1` - 1 分钟负载
- `node_load5` - 5 分钟负载
- `node_load15` - 15 分钟负载

### Memory
- `node_memory_MemTotal_bytes` - 总内存
- `node_memory_MemAvailable_bytes` - 可用内存
- `node_memory_usage_percent` - 内存使用率
- `node_memory_SwapTotal_bytes` - 总交换空间
- `node_memory_SwapFree_bytes` - 空闲交换空间

### Disk
- `node_filesystem_size_bytes` - 文件系统总大小
- `node_filesystem_free_bytes` - 文件系统空闲大小
- `node_filesystem_usage_percent` - 磁盘使用率
- `node_disk_read_bytes_total` - 磁盘读取总量
- `node_disk_written_bytes_total` - 磁盘写入总量

### Network
- `node_network_receive_bytes_total` - 网络接收总量
- `node_network_transmit_bytes_total` - 网络发送总量
- `node_network_receive_errors_total` - 网络接收错误
- `node_network_transmit_errors_total` - 网络发送错误

---

## 2. Database Metrics (PostgreSQL)

### Connection
- `pg_stat_database_numbackends` - 活跃连接数
- `pg_stat_activity_count` - 活动连接数
- `pg_settings_max_connections` - 最大连接数

### Query Performance
- `pg_stat_user_tables_seq_scan` - 顺序扫描次数
- `pg_stat_user_tables_idx_scan` - 索引扫描次数
- `pg_stat_statements_total_time` - 查询总耗时
- `pg_stat_statements_calls` - 查询调用次数

### Database Size
- `pg_database_size_bytes` - 数据库大小
- `pg_table_size_bytes` - 表大小
- `pg_index_size_bytes` - 索引大小

---

## 3. Cache Metrics (Redis)

### Memory
- `redis_memory_used_bytes` - 已用内存
- `redis_memory_max_bytes` - 最大内存
- `redis_memory_usage_percent` - 内存使用率

### Operations
- `redis_commands_processed_total` - 处理命令总数
- `redis_commands_per_second` - 每秒命令数
- `redis_connected_clients` - 连接客户端数

### Performance
- `redis_latency_avg_ms` - 平均延迟
- `redis_latency_max_ms` - 最大延迟
- `redis_keyspace_hits_total` - 键空间命中数
- `redis_keyspace_misses_total` - 键空间未命中数

---

## 4. Application Metrics (Backend)

### HTTP Requests
- `http_requests_total` - 请求总数
- `http_request_duration_seconds` - 请求耗时
- `http_requests_in_progress` - 进行中请求数

### API Performance
- `api_requests_total` - API 请求总数
- `api_request_duration_seconds` - API 请求耗时
- `api_errors_total` - API 错误总数

### Business Metrics
- `users_total` - 用户总数
- `servers_total` - 服务器总数
- `gpus_total` - GPU 总数
- `tasks_total` - 任务总数
- `tasks_by_status` - 按状态统计的任务数

### Cache Performance
- `cache_hits_total` - 缓存命中数
- `cache_misses_total` - 缓存未命中数
- `cache_hit_rate` - 缓存命中率

---

## 5. Alert Rules

### Critical Alerts

#### High CPU Usage
```yaml
- alert: HighCPUUsage
  expr: node_cpu_usage_percent > 90
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "CPU 使用率过高"
    description: "CPU 使用率超过 90% (当前值：{{ $value }}%)"
```

#### High Memory Usage
```yaml
- alert: HighMemoryUsage
  expr: node_memory_usage_percent > 90
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "内存使用率过高"
    description: "内存使用率超过 90% (当前值：{{ $value }}%)"
```

#### Database Connection Pool Exhausted
```yaml
- alert: DatabaseConnectionPoolExhausted
  expr: pg_stat_activity_count / pg_settings_max_connections > 0.9
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "数据库连接池即将耗尽"
    description: "数据库连接使用率超过 90% (当前值：{{ $value }}%)"
```

#### Redis Memory High
```yaml
- alert: RedisMemoryHigh
  expr: redis_memory_usage_percent > 85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Redis 内存使用率过高"
    description: "Redis 内存使用率超过 85% (当前值：{{ $value }}%)"
```

#### API Error Rate High
```yaml
- alert: APIErrorRateHigh
  expr: rate(api_errors_total[5m]) / rate(api_requests_total[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "API 错误率过高"
    description: "API 错误率超过 5% (当前值：{{ $value | humanizePercentage }})"
```

### Warning Alerts

#### Disk Space Low
```yaml
- alert: DiskSpaceLow
  expr: node_filesystem_usage_percent > 80
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "磁盘空间不足"
    description: "磁盘使用率超过 80% (当前值：{{ $value }}%)"
```

#### High Load Average
```yaml
- alert: HighLoadAverage
  expr: node_load15 > 4
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "系统负载过高"
    description: "15 分钟负载超过 4 (当前值：{{ $value }})"
```

---

## 6. Dashboard Panels

### System Overview
- CPU 使用率
- 内存使用率
- 磁盘使用率
- 网络流量
- 系统负载

### Database Performance
- 连接数
- 查询性能
- 数据库大小
- 锁等待时间

### Cache Performance
- 内存使用
- 命中率
- 命令执行速度
- 连接数

### Application Metrics
- API 请求量
- 响应时间
- 错误率
- 业务指标

---

## 7. Metrics Collection Strategy

### Collection Frequency
- 系统指标：15 秒
- 数据库指标：30 秒
- 缓存指标：15 秒
- 应用指标：30 秒

### Retention Policy
- 原始数据：7 天
- 小时聚合：30 天
- 天聚合：365 天

### Storage Requirements
- 预计每日数据量：1-2 GB
- 建议磁盘空间：50 GB+
