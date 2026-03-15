# LSM 多租户数据库设计文档 v3.2.0 Phase 1

## 1. 概述

本文档定义 LSM（GPU 资源管理系统）的多租户架构数据模型，实现团队级资源隔离。

## 2. 核心模型设计

### 2.1 Team（团队表）

```prisma
model Team {
  id          String      @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String      @unique @db.VarChar(100)
  slug        String      @unique @db.VarChar(50)   // URL友好标识
  description String?     @db.Text
  logoUrl     String?     @map("logo_url") @db.VarChar(500)
  status      team_status @default(ACTIVE)
  settings    Json?       @default("{}")           // 团队配置
  createdBy   String      @map("created_by") @db.Uuid
  createdAt   DateTime?   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime?   @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  members     TeamMember[]
  quotas      ResourceQuota[]
  servers     Server[]
  tasks       Task[]
  reservations Reservation[]
  auditLogs   AuditLog[]

  @@index([slug])
  @@index([status])
  @@map("teams")
}

enum team_status {
  ACTIVE      // 活跃
  SUSPENDED   // 暂停
  ARCHIVED    // 归档
}
```

### 2.2 TeamMember（团队成员表）

```prisma
model TeamMember {
  id        String          @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  teamId    String          @map("team_id") @db.Uuid
  userId    String          @map("user_id") @db.Uuid
  role      team_role       @default(MEMBER)
  joinedAt  DateTime?       @default(now()) @map("joined_at") @db.Timestamptz(6)
  invitedBy String?         @map("invited_by") @db.Uuid
  metadata  Json?           @default("{}")
  
  team      Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  inviter   User?           @relation("InvitedBy", fields: [invitedBy], references: [id])

  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
  @@map("team_members")
}

enum team_role {
  OWNER    // 团队所有者
  ADMIN    // 团队管理员
  MEMBER   // 普通成员
}
```

### 2.3 ResourceQuota 扩展

扩展现有 ResourceQuota 表支持团队级配额：

```prisma
model ResourceQuota {
  // 新增 team_id 字段
  teamId    String?     @map("team_id") @db.Uuid
  
  // ... 其他现有字段 ...
  
  team      Team?       @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  @@unique([quotaType, targetId, teamId])  // 修改唯一约束
}
```

## 3. 现有表改造

### 3.1 User 表扩展

```prisma
model User {
  // 新增字段
  currentTeamId  String?     @map("current_team_id") @db.Uuid
  currentTeam    Team?       @relation("CurrentTeam", fields: [currentTeamId], references: [id])
  
  // 新增关联
  teamMemberships  TeamMember[]
  invitedMembers   TeamMember[]  @relation("InvitedBy")
  
  // ... 现有字段 ...
}
```

### 3.2 Server 表扩展

```prisma
model Server {
  teamId    String?   @map("team_id") @db.Uuid
  team      Team?     @relation(fields: [teamId], references: [id], onDelete: SetNull)
  // ... 现有字段 ...
}
```

### 3.3 Task 表扩展

```prisma
model Task {
  teamId    String?   @map("team_id") @db.Uuid
  team      Team?     @relation(fields: [teamId], references: [id], onDelete: SetNull)
  // ... 现有字段 ...
}
```

### 3.4 Reservation 表扩展

```prisma
model Reservation {
  teamId    String?   @map("team_id") @db.Uuid
  team      Team?     @relation(fields: [teamId], references: [id], onDelete: SetNull)
  // ... 现有字段 ...
}
```

### 3.5 AuditLog 表扩展

```prisma
model AuditLog {
  teamId    String?   @map("team_id") @db.Uuid
  team      Team?     @relation(fields: [teamId], references: [id], onDelete: SetNull)
  // ... 现有字段 ...
}
```

## 4. 数据隔离策略

### 4.1 共享模式（Shared Database, Shared Schema）

采用 **共享数据库 + 共享Schema + 行级隔离** 策略：

- 所有租户数据在同一数据库
- 通过 `team_id` 字段区分租户
- 查询时强制过滤 `team_id`
- 支持全局资源（`team_id` 为 null）

### 4.2 隔离范围

| 资源类型 | 隔离级别 | 说明 |
|---------|---------|------|
| Server  | 团队级  | 每个团队有独立服务器池 |
| Task    | 团队级  | 任务归属团队 |
| Reservation | 团队级 | 预约按团队隔离 |
| Gpu     | 继承Server | 跟随服务器归属 |
| User    | 全局共享 | 用户可加入多团队 |
| Alert   | 继承Server | 跟随服务器归属 |

### 4.3 迁移兼容性

- 所有 `team_id` 字段设为可选（nullable）
- 现有数据 `team_id` 为 null，表示系统级/遗留数据
- 渐进式迁移，不破坏现有功能

## 5. 索引设计

```sql
-- 团队成员查询优化
CREATE INDEX idx_team_members_team_user ON team_members(team_id, user_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- 团队资源查询优化
CREATE INDEX idx_servers_team ON servers(team_id);
CREATE INDEX idx_tasks_team ON tasks(team_id);
CREATE INDEX idx_reservations_team ON reservations(team_id);

-- 配额查询优化
CREATE INDEX idx_resource_quotas_team ON resource_quotas(team_id);
```

## 6. 权限模型

### 6.1 团队角色权限矩阵

| 操作 | OWNER | ADMIN | MEMBER |
|-----|-------|-------|--------|
| 删除团队 | ✓ | ✗ | ✗ |
| 管理成员 | ✓ | ✓ | ✗ |
| 邀请成员 | ✓ | ✓ | ✗ |
| 创建资源 | ✓ | ✓ | ✓ |
| 查看资源 | ✓ | ✓ | ✓ |
| 管理配额 | ✓ | ✗ | ✗ |

### 6.2 与系统角色关系

系统角色（ADMIN/MANAGER/USER）与团队角色独立：
- 系统ADMIN拥有全局权限
- 团队OWNER/ADMIN仅拥有团队内权限
- 用户可在不同团队担任不同角色

## 7. 迁移计划

1. **Phase 1.1**: 创建 Team/TeamMember 表，不破坏现有数据
2. **Phase 1.2**: 添加 `team_id` 到各表，设为可选
3. **Phase 1.3**: 实现团队服务 API
4. **Phase 1.4**: 数据迁移脚本（可选）
5. **Phase 1.5**: 启用团队隔离中间件

## 8. 注意事项

- 用户切换团队时更新 `current_team_id`
- 查询时自动注入 `team_id` 过滤条件
- 全局管理员可跨团队查询
- 删除团队采用软删除（status=ARCHIVED）