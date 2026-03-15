# LSM 服务器预约功能 - 数据库设计文档

## 1. 概述

本文档为 LSM 项目设计服务器预约功能的数据库模型，包括预约管理、时间槽管理、资源配额、审批流程等核心功能。

---

## 2. 现有模型分析

### 2.1 相关现有表

| 表名 | 用途 | 与预约的关系 |
|------|------|-------------|
| `users` | 用户表 | 预约的发起者、审批者 |
| `servers` | 服务器表 | 可预约的资源主体 |
| `gpus` | GPU表 | 可预约的细粒度资源 |
| `gpu_allocations` | GPU分配记录 | 当前分配状态，预约生效后需关联 |
| `tasks` | 任务表 | 预约可关联任务 |

### 2.2 现有枚举

```prisma
enum user_role { ADMIN, MANAGER, USER }
enum server_status { ONLINE, OFFLINE, MAINTENANCE, ERROR }
```

---

## 3. 数据库设计

### 3.1 ER 图（文字描述）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              预约系统 ER 图                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │    users     │
    │──────────────│
    │ id (PK)      │◄──────────────────────────────────────────────┐
    │ username     │                                               │
    │ role         │                                               │
    └──────┬───────┘                                               │
           │                                                       │
           │ 1:N                                                   │ 1:N
           │                                                       │
           ▼                                                       │
    ┌──────────────────┐     N:1      ┌──────────────┐            │
    │  reservations    │─────────────►│   servers    │            │
    │──────────────────│              │──────────────│            │
    │ id (PK)          │              │ id (PK)      │            │
    │ user_id (FK)     │              │ name         │            │
    │ server_id (FK)   │              │ status       │            │
    │ status           │              └──────────────┘            │
    │ start_time       │                                          │
    │ end_time         │                                          │
    └────────┬─────────┘                                          │
             │                                                    │
             │ 1:N                                                │
             │                                                    │
             ▼                                                    │
    ┌──────────────────────┐     N:1    ┌──────────────────┐      │
    │ reservation_gpus     │───────────►│      gpus        │      │
    │──────────────────────│            │──────────────────│      │
    │ id (PK)              │            │ id (PK)          │      │
    │ reservation_id (FK)  │            │ server_id (FK)   │      │
    │ gpu_id (FK)          │            │ model            │      │
    └──────────────────────┘            └──────────────────┘      │
                                                                  │
    ┌──────────────────────┐                                       │
    │ reservation_approvals│───────────────────────────────────────┘
    │──────────────────────│     N:1 (approver)
    │ id (PK)              │
    │ reservation_id (FK)  │
    │ approver_id (FK)     │
    │ status               │
    │ comment              │
    └──────────────────────┘

    ┌──────────────────────┐
    │   resource_quotas    │
    │──────────────────────│
    │ id (PK)              │
    │ user_id (FK) / role  │
    │ max_servers          │
    │ max_gpus             │
    │ max_hours_per_day    │
    └──────────────────────┘

    ┌──────────────────────┐
    │  reservation_slots   │
    │──────────────────────│
    │ id (PK)              │
    │ server_id (FK)       │
    │ start_time           │
    │ end_time             │
    │ is_available         │
    └──────────────────────┘
```

---

## 4. Prisma Schema 定义

### 4.1 新增枚举类型

```prisma
// 预约状态
enum reservation_status {
  PENDING      // 待审批
  APPROVED     // 已批准
  REJECTED     // 已拒绝
  ACTIVE       // 进行中（已开始）
  COMPLETED    // 已完成
  CANCELLED    // 已取消
  EXPIRED      // 已过期（未在规定时间开始）
}

// 审批状态
enum approval_status {
  PENDING      // 待审批
  APPROVED     // 已批准
  REJECTED     // 已拒绝
}

// 时间槽状态
enum slot_status {
  AVAILABLE    // 可预约
  RESERVED     // 已预约
  BLOCKED      // 已锁定（维护等）
}

// 配额类型
enum quota_type {
  USER         // 用户级配额
  ROLE         // 角色级配额
  GLOBAL       // 全局配额
}
```

### 4.2 预约表（reservations）

```prisma
model Reservation {
  id              String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId          String              @map("user_id") @db.Uuid
  serverId        String              @map("server_id") @db.Uuid
  title           String              @db.VarChar(200)
  description     String?             @db.Text
  status          reservation_status  @default(PENDING)
  
  // 时间信息
  startTime       DateTime            @map("start_time") @db.Timestamptz(6)
  endTime         DateTime            @map("end_time") @db.Timestamptz(6)
  actualStartTime DateTime?           @map("actual_start_time") @db.Timestamptz(6)
  actualEndTime   DateTime?           @map("actual_end_time") @db.Timestamptz(6)
  
  // 资源需求
  gpuCount        Int                 @default(0) @map("gpu_count")
  cpuCores        Int?                @map("cpu_cores")
  memoryGb        Int?                @map("memory_gb")
  
  // 关联任务
  taskId          String?             @map("task_id") @db.Uuid
  
  // 审批信息
  approvedBy      String?             @map("approved_by") @db.Uuid
  approvedAt      DateTime?           @map("approved_at") @db.Timestamptz(6)
  rejectionReason String?             @map("rejection_reason") @db.Text
  
  // 取消信息
  cancelledBy     String?             @map("cancelled_by") @db.Uuid
  cancelledAt     DateTime?           @map("cancelled_at") @db.Timestamptz(6)
  cancelReason    String?             @map("cancel_reason") @db.Text
  
  // 扩展信息
  metadata        Json?               @default("{}")
  createdAt       DateTime?           @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime?           @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  // 关联关系
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  server          Server              @relation(fields: [serverId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  task            Task?               @relation(fields: [taskId], references: [id], onDelete: SetNull, onUpdate: NoAction)
  approver        User?               @relation("ApprovedReservations", fields: [approvedBy], references: [id], onDelete: SetNull, onUpdate: NoAction)
  canceller       User?               @relation("CancelledReservations", fields: [cancelledBy], references: [id], onDelete: SetNull, onUpdate: NoAction)
  gpuReservations GpuReservation[]
  approvals       ReservationApproval[]
  
  @@index([userId], map: "idx_reservations_user_id")
  @@index([serverId], map: "idx_reservations_server_id")
  @@index([status], map: "idx_reservations_status")
  @@index([startTime], map: "idx_reservations_start_time")
  @@index([endTime], map: "idx_reservations_end_time")
  @@index([userId, status], map: "idx_reservations_user_status")
  @@index([serverId, status], map: "idx_reservations_server_status")
  @@index([startTime, endTime], map: "idx_reservations_time_range")
  @@map("reservations")
}
```

### 4.3 GPU 预约关联表（reservation_gpus）

```prisma
model GpuReservation {
  id             String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  reservationId  String      @map("reservation_id") @db.Uuid
  gpuId          String      @map("gpu_id") @db.Uuid
  allocatedAt    DateTime?   @map("allocated_at") @db.Timestamptz(6)
  releasedAt     DateTime?   @map("released_at") @db.Timestamptz(6)
  metadata       Json?       @default("{}")
  createdAt      DateTime?   @default(now()) @map("created_at") @db.Timestamptz(6)
  
  reservation    Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  gpu            Gpu         @relation(fields: [gpuId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  
  @@unique([reservationId, gpuId], map: "idx_gpu_reservations_unique")
  @@index([gpuId], map: "idx_gpu_reservations_gpu_id")
  @@index([reservationId], map: "idx_gpu_reservations_reservation_id")
  @@map("gpu_reservations")
}
```

### 4.4 审批记录表（reservation_approvals）

```prisma
model ReservationApproval {
  id             String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  reservationId  String          @map("reservation_id") @db.Uuid
  approverId     String          @map("approver_id") @db.Uuid
  status         approval_status @default(PENDING)
  level          Int             @default(1)          // 审批层级（支持多级审批）
  comment        String?         @db.Text
  approvedAt     DateTime?       @map("approved_at") @db.Timestamptz(6)
  createdAt      DateTime?       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime?       @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  reservation    Reservation     @relation(fields: [reservationId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  approver       User            @relation(fields: [approverId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  
  @@index([reservationId], map: "idx_reservation_approvals_reservation_id")
  @@index([approverId], map: "idx_reservation_approvals_approver_id")
  @@index([status], map: "idx_reservation_approvals_status")
  @@unique([reservationId, level], map: "idx_reservation_approvals_unique_level")
  @@map("reservation_approvals")
}
```

### 4.5 时间槽表（reservation_slots）

```prisma
model ReservationSlot {
  id             String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  serverId       String        @map("server_id") @db.Uuid
  startTime      DateTime      @map("start_time") @db.Timestamptz(6)
  endTime        DateTime      @map("end_time") @db.Timestamptz(6)
  status         slot_status   @default(AVAILABLE)
  reservationId  String?       @map("reservation_id") @db.Uuid
  blockReason    String?       @map("block_reason") @db.VarChar(255)
  metadata       Json?         @default("{}")
  createdAt      DateTime?     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime?     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  server         Server        @relation(fields: [serverId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  reservation    Reservation?  @relation(fields: [reservationId], references: [id], onDelete: SetNull, onUpdate: NoAction)
  
  @@index([serverId], map: "idx_reservation_slots_server_id")
  @@index([serverId, startTime, endTime], map: "idx_reservation_slots_time_range")
  @@index([status], map: "idx_reservation_slots_status")
  @@index([reservationId], map: "idx_reservation_slots_reservation_id")
  @@map("reservation_slots")
}
```

### 4.6 资源配额表（resource_quotas）

```prisma
model ResourceQuota {
  id                 String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  quotaType          quota_type  @map("quota_type")
  targetId           String?     @map("target_id") @db.Uuid   // user_id 或 role 的标识
  
  // 服务器配额
  maxServers         Int?        @map("max_servers")             // 最大同时预约服务器数
  maxServerHours     Int?        @map("max_server_hours")        // 每日最大服务器使用小时数
  
  // GPU 配额
  maxGpus            Int?        @map("max_gpus")                // 最大同时预约 GPU 数
  maxGpuHours        Int?        @map("max_gpu_hours")           // 每日最大 GPU 使用小时数
  
  // 时间限制
  maxReservationDays Int?        @map("max_reservation_days")    // 单次预约最大天数
  maxAdvanceDays     Int?        @map("max_advance_days")        // 最大提前预约天数
  maxConcurrent      Int?        @map("max_concurrent")          // 最大并发预约数
  
  // 生效时间
  effectiveFrom      DateTime?   @map("effective_from") @db.Timestamptz(6)
  effectiveUntil     DateTime?   @map("effective_until") @db.Timestamptz(6)
  
  metadata           Json?       @default("{}")
  createdAt          DateTime?   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime?   @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  @@unique([quotaType, targetId], map: "idx_resource_quotas_unique_target")
  @@index([quotaType], map: "idx_resource_quotas_type")
  @@index([targetId], map: "idx_resource_quotas_target_id")
  @@map("resource_quotas")
}
```

### 4.7 预约冲突检测视图

```prisma
// 用于检测预约冲突的复合索引（PostgreSQL 14+ 支持排除约束）
// 注意：Prisma 不直接支持排除约束，需要通过原生 SQL 迁移实现

// SQL 迁移示例：
// ALTER TABLE reservations 
// ADD CONSTRAINT no_overlapping_reservations 
// EXCLUDE USING GIST (
//   server_id WITH =,
//   tsrange(start_time, end_time) WITH &&
// ) WHERE (status IN ('APPROVED', 'ACTIVE'));
```

---

## 5. 需要修改的现有模型

### 5.1 修改 User 模型

```prisma
model User {
  // ... 现有字段 ...
  
  // 新增关联
  reservations           Reservation[]           // 发起的预约
  approvedReservations   Reservation[]           @relation("ApprovedReservations")   // 审批的预约
  cancelledReservations  Reservation[]           @relation("CancelledReservations")  // 取消的预约
  reservationApprovals   ReservationApproval[]   // 审批记录
  resourceQuotas         ResourceQuota[]         // 资源配额
  
  // ... 其他现有字段 ...
}
```

### 5.2 修改 Server 模型

```prisma
model Server {
  // ... 现有字段 ...
  
  // 新增关联
  reservations      Reservation[]
  reservationSlots  ReservationSlot[]
  
  // ... 其他现有字段 ...
}
```

### 5.3 修改 Gpu 模型

```prisma
model Gpu {
  // ... 现有字段 ...
  
  // 新增关联
  gpuReservations   GpuReservation[]
  
  // ... 其他现有字段 ...
}
```

### 5.4 修改 Task 模型

```prisma
model Task {
  // ... 现有字段 ...
  
  // 新增关联
  reservations      Reservation[]
  
  // ... 其他现有字段 ...
}
```

---

## 6. 索引设计说明

### 6.1 核心索引

| 表名 | 索引名 | 字段 | 用途 |
|------|--------|------|------|
| reservations | idx_reservations_user_id | user_id | 快速查询用户预约 |
| reservations | idx_reservations_server_id | server_id | 快速查询服务器预约 |
| reservations | idx_reservations_status | status | 按状态筛选预约 |
| reservations | idx_reservations_time_range | start_time, end_time | 时间范围查询 |
| reservations | idx_reservations_user_status | user_id, status | 查询用户特定状态预约 |
| reservations | idx_reservations_server_status | server_id, status | 查询服务器特定状态预约 |

### 6.2 冲突检测索引

```sql
-- 用于时间范围查询的 GiST 索引（需通过迁移执行）
CREATE INDEX idx_reservations_time_gist ON reservations 
USING GIST (server_id, tsrange(start_time, end_time));

-- 或使用 B-tree 复合索引（兼容性更好）
CREATE INDEX idx_reservations_conflict_check ON reservations (server_id, start_time, end_time);
```

### 6.3 性能优化建议

1. **分区表**：如果预约量大，可按时间范围分区
2. **归档策略**：定期归档历史预约（已完成超过3个月）
3. **物化视图**：为常用统计创建物化视图

---

## 7. 数据示例

### 7.1 创建预约

```json
// POST /api/reservations
{
  "title": "深度学习模型训练",
  "description": "训练 ResNet-50 模型，预计需要 48 小时",
  "serverId": "550e8400-e29b-41d4-a716-446655440000",
  "startTime": "2026-03-20T09:00:00Z",
  "endTime": "2026-03-22T09:00:00Z",
  "gpuCount": 4,
  "cpuCores": 16,
  "memoryGb": 64,
  "taskId": "660e8400-e29b-41d4-a716-446655440000"
}
```

### 7.2 预约记录示例

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "userId": "110e8400-e29b-41d4-a716-446655440000",
  "serverId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "深度学习模型训练",
  "description": "训练 ResNet-50 模型，预计需要 48 小时",
  "status": "PENDING",
  "startTime": "2026-03-20T01:00:00.000Z",
  "endTime": "2026-03-22T01:00:00.000Z",
  "gpuCount": 4,
  "cpuCores": 16,
  "memoryGb": 64,
  "taskId": "660e8400-e29b-41d4-a716-446655440000",
  "createdAt": "2026-03-15T00:00:00.000Z",
  "updatedAt": "2026-03-15T00:00:00.000Z"
}
```

### 7.3 审批记录示例

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "reservationId": "770e8400-e29b-41d4-a716-446655440000",
  "approverId": "220e8400-e29b-41d4-a716-446655440000",
  "status": "APPROVED",
  "level": 1,
  "comment": "资源充足，批准预约。",
  "approvedAt": "2026-03-15T08:30:00.000Z"
}
```

### 7.4 资源配额示例

```json
// 用户级配额
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "quotaType": "USER",
  "targetId": "110e8400-e29b-41d4-a716-446655440000",
  "maxServers": 2,
  "maxServerHours": 48,
  "maxGpus": 8,
  "maxGpuHours": 192,
  "maxReservationDays": 7,
  "maxAdvanceDays": 30,
  "maxConcurrent": 3
}

// 角色级配额
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000",
  "quotaType": "ROLE",
  "targetId": null,  // 角色标识可存 JSON 或另外设计
  "maxServers": 5,
  "maxGpus": 20,
  "maxConcurrent": 10
}

// 全局配额
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "quotaType": "GLOBAL",
  "targetId": null,
  "maxReservationDays": 14,
  "maxAdvanceDays": 60
}
```

### 7.5 时间槽示例

```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440000",
  "serverId": "550e8400-e29b-41d4-a716-446655440000",
  "startTime": "2026-03-20T09:00:00.000Z",
  "endTime": "2026-03-20T21:00:00.000Z",
  "status": "AVAILABLE",
  "reservationId": null
}
```

---

## 8. 完整 Prisma Schema 新增部分

```prisma
// ==================== 新增枚举 ====================

enum reservation_status {
  PENDING
  APPROVED
  REJECTED
  ACTIVE
  COMPLETED
  CANCELLED
  EXPIRED
}

enum approval_status {
  PENDING
  APPROVED
  REJECTED
}

enum slot_status {
  AVAILABLE
  RESERVED
  BLOCKED
}

enum quota_type {
  USER
  ROLE
  GLOBAL
}

// ==================== 新增模型 ====================

model Reservation {
  id               String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId           String              @map("user_id") @db.Uuid
  serverId         String              @map("server_id") @db.Uuid
  title            String              @db.VarChar(200)
  description      String?             @db.Text
  status           reservation_status  @default(PENDING)
  startTime        DateTime            @map("start_time") @db.Timestamptz(6)
  endTime          DateTime            @map("end_time") @db.Timestamptz(6)
  actualStartTime  DateTime?           @map("actual_start_time") @db.Timestamptz(6)
  actualEndTime    DateTime?           @map("actual_end_time") @db.Timestamptz(6)
  gpuCount         Int                 @default(0) @map("gpu_count")
  cpuCores         Int?                @map("cpu_cores")
  memoryGb         Int?                @map("memory_gb")
  taskId           String?             @map("task_id") @db.Uuid
  approvedBy       String?             @map("approved_by") @db.Uuid
  approvedAt       DateTime?           @map("approved_at") @db.Timestamptz(6)
  rejectionReason  String?             @map("rejection_reason") @db.Text
  cancelledBy      String?             @map("cancelled_by") @db.Uuid
  cancelledAt      DateTime?           @map("cancelled_at") @db.Timestamptz(6)
  cancelReason     String?             @map("cancel_reason") @db.Text
  metadata         Json?               @default("{}")
  createdAt        DateTime?           @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime?           @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  user             User                @relation(fields: [userId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  server           Server              @relation(fields: [serverId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  task             Task?               @relation(fields: [taskId], references: [id], onDelete: SetNull, onUpdate: NoAction)
  approver         User?               @relation("ApprovedReservations", fields: [approvedBy], references: [id], onDelete: SetNull, onUpdate: NoAction)
  canceller        User?               @relation("CancelledReservations", fields: [cancelledBy], references: [id], onDelete: SetNull, onUpdate: NoAction)
  gpuReservations  GpuReservation[]
  approvals        ReservationApproval[]
  slots            ReservationSlot[]

  @@index([userId], map: "idx_reservations_user_id")
  @@index([serverId], map: "idx_reservations_server_id")
  @@index([status], map: "idx_reservations_status")
  @@index([startTime], map: "idx_reservations_start_time")
  @@index([endTime], map: "idx_reservations_end_time")
  @@index([userId, status], map: "idx_reservations_user_status")
  @@index([serverId, status], map: "idx_reservations_server_status")
  @@index([startTime, endTime], map: "idx_reservations_time_range")
  @@map("reservations")
}

model GpuReservation {
  id             String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  reservationId  String      @map("reservation_id") @db.Uuid
  gpuId          String      @map("gpu_id") @db.Uuid
  allocatedAt    DateTime?   @map("allocated_at") @db.Timestamptz(6)
  releasedAt     DateTime?   @map("released_at") @db.Timestamptz(6)
  metadata       Json?       @default("{}")
  createdAt      DateTime?   @default(now()) @map("created_at") @db.Timestamptz(6)
  
  reservation    Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  gpu            Gpu         @relation(fields: [gpuId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  
  @@unique([reservationId, gpuId], map: "idx_gpu_reservations_unique")
  @@index([gpuId], map: "idx_gpu_reservations_gpu_id")
  @@index([reservationId], map: "idx_gpu_reservations_reservation_id")
  @@map("gpu_reservations")
}

model ReservationApproval {
  id             String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  reservationId  String          @map("reservation_id") @db.Uuid
  approverId      String          @map("approver_id") @db.Uuid
  status          approval_status @default(PENDING)
  level           Int             @default(1)
  comment         String?         @db.Text
  approvedAt      DateTime?       @map("approved_at") @db.Timestamptz(6)
  createdAt       DateTime?       @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime?       @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  reservation     Reservation     @relation(fields: [reservationId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  approver        User            @relation(fields: [approverId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  
  @@index([reservationId], map: "idx_reservation_approvals_reservation_id")
  @@index([approverId], map: "idx_reservation_approvals_approver_id")
  @@index([status], map: "idx_reservation_approvals_status")
  @@unique([reservationId, level], map: "idx_reservation_approvals_unique_level")
  @@map("reservation_approvals")
}

model ReservationSlot {
  id             String        @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  serverId       String        @map("server_id") @db.Uuid
  startTime      DateTime      @map("start_time") @db.Timestamptz(6)
  endTime        DateTime      @map("end_time") @db.Timestamptz(6)
  status         slot_status   @default(AVAILABLE)
  reservationId  String?       @map("reservation_id") @db.Uuid
  blockReason    String?       @map("block_reason") @db.VarChar(255)
  metadata       Json?         @default("{}")
  createdAt      DateTime?     @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime?     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  server         Server        @relation(fields: [serverId], references: [id], onDelete: Cascade, onUpdate: NoAction)
  reservation    Reservation?  @relation(fields: [reservationId], references: [id], onDelete: SetNull, onUpdate: NoAction)
  
  @@index([serverId], map: "idx_reservation_slots_server_id")
  @@index([serverId, startTime, endTime], map: "idx_reservation_slots_time_range")
  @@index([status], map: "idx_reservation_slots_status")
  @@index([reservationId], map: "idx_reservation_slots_reservation_id")
  @@map("reservation_slots")
}

model ResourceQuota {
  id                  String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  quotaType           quota_type @map("quota_type")
  targetId            String?     @map("target_id") @db.Uuid
  maxServers          Int?        @map("max_servers")
  maxServerHours      Int?        @map("max_server_hours")
  maxGpus             Int?        @map("max_gpus")
  maxGpuHours         Int?        @map("max_gpu_hours")
  maxReservationDays  Int?        @map("max_reservation_days")
  maxAdvanceDays      Int?        @map("max_advance_days")
  maxConcurrent       Int?        @map("max_concurrent")
  effectiveFrom       DateTime?   @map("effective_from") @db.Timestamptz(6)
  effectiveUntil      DateTime?   @map("effective_until") @db.Timestamptz(6)
  metadata            Json?       @default("{}")
  createdAt           DateTime?   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt           DateTime?   @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  @@unique([quotaType, targetId], map: "idx_resource_quotas_unique_target")
  @@index([quotaType], map: "idx_resource_quotas_type")
  @@index([targetId], map: "idx_resource_quotas_target_id")
  @@map("resource_quotas")
}
```

---

## 9. 现有模型修改

### 9.1 User 模型新增关联

```prisma
model User {
  // ... 现有字段 ...
  
  reservations          Reservation[]
  approvedReservations  Reservation[]    @relation("ApprovedReservations")
  cancelledReservations Reservation[]    @relation("CancelledReservations")
  reservationApprovals  ReservationApproval[]
  resourceQuotas        ResourceQuota[]  @relation("UserQuotas")
  
  // ... 其他现有字段 ...
}
```

### 9.2 Server 模型新增关联

```prisma
model Server {
  // ... 现有字段 ...
  
  reservations      Reservation[]
  reservationSlots  ReservationSlot[]
  
  // ... 其他现有字段 ...
}
```

### 9.3 Gpu 模型新增关联

```prisma
model Gpu {
  // ... 现有字段 ...
  
  gpuReservations   GpuReservation[]
  
  // ... 其他现有字段 ...
}
```

### 9.4 Task 模型新增关联

```prisma
model Task {
  // ... 现有字段 ...
  
  reservations      Reservation[]
  
  // ... 其他现有字段 ...
}
```

---

## 10. 业务约束与规则

### 10.1 预约规则

1. **时间约束**：
   - `end_time` 必须大于 `start_time`
   - 预约时长不能超过配额限制（`maxReservationDays`）
   - 提前预约天数不能超过配额限制（`maxAdvanceDays`）

2. **资源约束**：
   - GPU 数量不能超过服务器实际 GPU 数量
   - 同一时间同一 GPU 不能被多次预约（通过 `GpuReservation` 唯一约束）
   - 同一服务器的时间不能重叠（需要排除约束）

3. **状态流转**：
   ```
   PENDING → APPROVED → ACTIVE → COMPLETED
      ↓         ↓
   REJECTED  CANCELLED
   APPROVED → EXPIRED (超过开始时间未激活)
   ```

### 10.2 审批规则

1. 单级审批：一个审批人即可
2. 多级审批：按 `level` 顺序审批
3. 所有审批通过后，预约状态自动变为 `APPROVED`

### 10.3 配额检查逻辑

```typescript
// 伪代码：检查用户配额
async function checkQuota(userId: string, newReservation: ReservationInput) {
  const userQuota = await getResourceQuota('USER', userId);
  const activeReservations = await getActiveReservations(userId);
  
  // 检查并发预约数
  if (activeReservations.length >= userQuota.maxConcurrent) {
    throw new Error('超过最大并发预约数');
  }
  
  // 检查 GPU 数量
  const totalGpus = activeReservations.reduce((sum, r) => sum + r.gpuCount, 0);
  if (totalGpus + newReservation.gpuCount > userQuota.maxGpus) {
    throw new Error('超过 GPU 配额');
  }
  
  // 检查预约天数
  const days = calculateDays(newReservation.startTime, newReservation.endTime);
  if (days > userQuota.maxReservationDays) {
    throw new Error('预约天数超过限制');
  }
}
```

---

## 11. 数据库迁移脚本

### 11.1 创建迁移

```bash
# 创建迁移文件
npx prisma migrate dev --name add_reservation_system

# 生成客户端
npx prisma generate
```

### 11.2 冲突检测约束（原生 SQL）

```sql
-- 在迁移中添加排除约束
ALTER TABLE reservations 
ADD CONSTRAINT no_overlapping_reservations 
EXCLUDE USING GIST (
  server_id WITH =,
  tsrange(start_time, end_time) WITH &&
) WHERE (status IN ('APPROVED', 'ACTIVE'));
```

---

## 12. 总结

本设计包含以下核心表：

| 表名 | 说明 | 主要字段 |
|------|------|---------|
| `reservations` | 预约主表 | 用户、服务器、时间范围、状态 |
| `gpu_reservations` | GPU 预约关联 | 预约ID、GPU ID |
| `reservation_approvals` | 审批记录 | 预约ID、审批人、状态、层级 |
| `reservation_slots` | 时间槽管理 | 服务器ID、时间段、状态 |
| `resource_quotas` | 资源配额 | 配额类型、目标ID、各项限制 |

设计特点：
- ✅ 支持服务器整体预约和 GPU 级别预约
- ✅ 支持多级审批流程
- ✅ 灵活的配额管理系统（用户级、角色级、全局）
- ✅ 完整的时间槽管理
- ✅ 与现有模型无缝集成
- ✅ 完善的索引设计