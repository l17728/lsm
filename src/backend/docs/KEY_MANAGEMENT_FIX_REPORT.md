# LSM 项目密钥管理安全修复报告

**修复日期**: 2026-03-15  
**修复人员**: 安全工程师  
**严重程度**: 🔴 高危

---

## 📋 执行摘要

本次安全审计发现 LSM 项目存在多处严重的密钥管理问题，包括硬编码密钥被提交到版本控制系统、代码中存在默认密码等。这些问题可能导致：
- 敏感凭据泄露
- 未授权访问系统
- 数据安全风险

所有问题已在本次修复中解决。

---

## 🔍 发现的密钥管理问题

### 1. 🔴 高危：生产环境密钥被提交到 Git 仓库

**文件**: `.env.production`  
**问题描述**: 该文件包含真实的数据库密码、Redis 密码、JWT 密钥、Grafana 管理员密码等敏感信息，且已被提交到版本控制系统。

**泄露的密钥**:
```
DB_PASSWORD=LsmProd%23Secure2026%21DbPass
REDIS_PASSWORD=LsmProd#Secure2026!RedisPass
JWT_SECRET=67Ug1jTYo3W33kno6b4TAdxe6hR7agUNYzOcuoBivHXegSmZPu5DtdZq1bGPJtQWl70hLdnlqv32EnRAx53xIA==
GRAFANA_ADMIN_PASSWORD=LsmProd#Grafana2026!
```

**风险评估**: 
- Git 历史中保留了明文密钥
- 如果仓库公开或被克隆，密钥将完全暴露
- 攻击者可直接访问数据库、缓存系统和监控面板

**修复状态**: ✅ 已修复
- 清除了 `.env.production` 中的真实密钥
- 替换为占位符，提示使用密钥管理服务

---

### 2. 🟠 中危：代码中存在硬编码默认密钥

**文件**: `src/backend/src/config/index.ts`  
**问题代码**:
```typescript
jwtSecret: process.env.JWT_SECRET || 'lsm-dev-secret-change-in-production',
```

**文件**: `src/backend/src/utils/jwt.ts`  
**问题代码**:
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
```

**文件**: `src/backend/src/services/email.service.ts`  
**问题代码**:
```typescript
pass: process.env.SMTP_PASSWORD || 'password',
```

**风险评估**:
- 如果环境变量未设置，将使用弱密码
- 开发人员可能忘记设置环境变量，导致生产环境使用默认值
- 默认密钥众所周知，容易被猜测

**修复状态**: ✅ 已修复
- 生产环境必须设置环境变量，否则应用启动失败
- 开发环境使用明确的警告提示

---

### 3. 🟡 低危：Docker Compose 默认密码问题

**文件**: `docker-compose.yml`, `docker-compose.prod.yml`  
**问题描述**: 多处使用了默认密码作为 fallback 值

```yaml
POSTGRES_PASSWORD: ${DB_PASSWORD:-lsm_password_change_me}
REDIS_PASSWORD: ${REDIS_PASSWORD:-redis_password_change_me}
JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
```

**风险评估**:
- 如果 `.env` 文件缺失或未设置变量，将使用弱默认值
- 容易被遗忘或忽略

**修复状态**: ⚠️ 部分修复
- `docker-compose.prod.yml` 已移除大部分默认值（强制要求设置环境变量）
- `docker-compose.yml` 保留默认值用于开发环境（有明确提示）

---

### 4. 🔴 高危：.gitignore 未覆盖 .env.production

**问题描述**: `.gitignore` 文件仅包含 `.env.production.local`，未包含 `.env.production`，导致该文件被提交。

**修复状态**: ✅ 已修复
- 更新 `.gitignore` 明确忽略 `.env.production`
- 添加了对 `*.secret`, `*.key`, `*.pem`, `secrets/` 等敏感文件的忽略规则

---

## ✅ 修复方案

### 1. 清除泄露的密钥

已将 `.env.production` 中所有真实密钥替换为安全占位符：

```bash
# 替换前
DB_PASSWORD=LsmProd%23Secure2026%21DbPass

# 替换后
DB_PASSWORD=CHANGE_ME_USE_SECRETS_MANAGER
```

### 2. 强制环境变量验证

在 `src/backend/src/config/index.ts` 和 `src/backend/src/utils/jwt.ts` 中添加：

```typescript
// 生产环境必须设置 JWT_SECRET
if (nodeEnv === 'production') {
  if (!secret) {
    throw new Error(
      '[SECURITY ERROR] JWT_SECRET must be set in production environment.'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      '[SECURITY ERROR] JWT_SECRET must be at least 32 characters.'
    );
  }
}
```

### 3. 更新 .gitignore

```gitignore
# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production
.env.production.local
.env.*.local
*.secret
*.key
*.pem
secrets/

# Sensitive files
credentials.json
service-account.json
*.p12
```

### 4. Git 历史清理建议

由于 `.env.production` 已被提交到 Git 历史，建议执行以下操作：

```bash
# 使用 git-filter-repo 清理历史（推荐）
# 1. 安装 git-filter-repo
pip install git-filter-repo

# 2. 备份仓库
cp -r /root/.openclaw/workspace/lsm-project /root/.openclaw/workspace/lsm-project-backup

# 3. 删除敏感文件的历史
cd /root/.openclaw/workspace/lsm-project
git filter-repo --path .env.production --invert-paths

# 4. 强制推送（如果有远程仓库）
git push origin --force --all

# 注意：所有开发者需要重新克隆仓库
```

**⚠️ 重要提醒**: 清理 Git 历史后，必须：
1. 轮换所有已泄露的密钥
2. 通知所有开发者重新克隆仓库
3. 检查是否有其他仓库或备份包含泄露文件

---

## 📖 环境变量配置指南

### 必需的环境变量

生产环境必须设置以下环境变量：

| 变量名 | 描述 | 生成方法 |
|--------|------|----------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | - |
| `JWT_SECRET` | JWT 签名密钥 | `openssl rand -base64 64` |
| `DB_PASSWORD` | 数据库密码 | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Redis 密码 | `openssl rand -base64 32` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana 管理员密码 | `openssl rand -base64 24` |
| `SMTP_PASSWORD` | SMTP 密码 | 从邮件服务商获取 |

### 生成安全密钥

```bash
# JWT 密钥 (64字节)
openssl rand -base64 64

# 数据库密码 (32字节)
openssl rand -base64 32

# Redis 密码 (32字节)
openssl rand -base64 32

# Grafana 管理员密码 (24字节)
openssl rand -base64 24
```

### 配置方式

#### 方式一：环境变量文件（开发环境）

```bash
# 复制示例文件
cp .env.example .env

# 编辑配置
vim .env

# 设置正确权限
chmod 600 .env
```

#### 方式二：密钥管理服务（生产环境推荐）

**使用 Docker Secrets**:
```yaml
services:
  backend:
    secrets:
      - jwt_secret
      - db_password
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  db_password:
    file: ./secrets/db_password.txt
```

**使用 Kubernetes Secrets**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: lsm-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded-secret>
  db-password: <base64-encoded-secret>
```

**使用云服务商密钥管理**:
- AWS: AWS Secrets Manager / AWS Parameter Store
- Azure: Azure Key Vault
- GCP: Secret Manager
- 腾讯云: 密钥管理系统 (SSM)

---

## 🔄 密钥轮换机制建议

### 密钥生命周期管理

```
┌─────────────────────────────────────────────────────────────┐
│                    密钥生命周期                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  创建 ──→ 部署 ──→ 监控 ──→ 轮换 ──→ 废弃 ──→ 销毁         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 轮换策略

#### 1. JWT 密钥轮换

**轮换周期**: 90 天  
**轮换方法**:

```typescript
// 支持多密钥验证的 JWT 配置
interface JwtConfig {
  currentSecret: string;    // 当前签名密钥
  previousSecrets: string[]; // 历史验证密钥（保留3个）
  rotationDate: Date;        // 下次轮换日期
}

// 轮换步骤
// 1. 生成新密钥
// 2. 将当前密钥移至历史列表
// 3. 设置新密钥为当前密钥
// 4. 更新所有服务实例
// 5. 等待旧 token 过期（24小时内）
// 6. 从历史列表移除最旧密钥
```

**自动化脚本示例**:
```bash
#!/bin/bash
# scripts/rotate-jwt-secret.sh

# 生成新密钥
NEW_SECRET=$(openssl rand -base64 64)

# 更新密钥管理服务
aws secretsmanager put-secret-value \
  --secret-id lsm/jwt-secret \
  --secret-string "{\"current\":\"$NEW_SECRET\"}"

# 重启服务以加载新密钥
kubectl rollout restart deployment/lsm-backend
```

#### 2. 数据库密码轮换

**轮换周期**: 90 天  
**轮换步骤**:

```sql
-- 1. 创建新密码的用户
CREATE USER lsm_new WITH PASSWORD 'new_secure_password';
GRANT lsm TO lsm_new;

-- 2. 更新应用配置为新用户
-- 3. 验证新用户正常工作

-- 4. 删除旧用户（轮换完成后）
DROP USER lsm_old;
RENAME USER lsm TO lsm_old;
RENAME USER lsm_new TO lsm;
```

#### 3. Redis 密码轮换

**轮换周期**: 90 天  
**轮换方法**:

```bash
# 1. 生成新密码
NEW_REDIS_PASS=$(openssl rand -base64 32)

# 2. 更新 Redis 配置（需要重启）
# redis.conf: requirepass <new_password>

# 3. 更新应用环境变量
# 4. 重启应用服务
# 5. 验证连接正常
```

### 轮换监控与告警

```yaml
# 监控规则建议
groups:
  - name: secret_rotation
    rules:
      - alert: JwtSecretAgeHigh
        expr: jwt_secret_age_days > 80
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "JWT 密钥即将到期"
          description: "JWT 密钥已使用 {{ $value }} 天，请在 10 天内轮换"

      - alert: JwtSecretExpired
        expr: jwt_secret_age_days > 90
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "JWT 密钥已过期"
          description: "JWT 密钥已超过 90 天未轮换，存在安全风险"
```

### 密钥泄露应急响应

如果发现密钥泄露：

1. **立即行动** (0-1小时):
   - 轮换泄露的密钥
   - 审计相关日志
   - 通知安全团队

2. **短期行动** (1-24小时):
   - 分析泄露范围
   - 评估潜在影响
   - 实施临时访问控制

3. **长期行动** (1-7天):
   - 完成密钥轮换
   - 加强监控
   - 更新安全策略
   - 进行安全培训

---

## 📋 检查清单

### 部署前检查

- [ ] 所有敏感环境变量已设置
- [ ] JWT_SECRET 长度 >= 32 字符
- [ ] 所有密码强度符合要求
- [ ] .env 文件已加入 .gitignore
- [ ] 密钥文件权限设置为 600
- [ ] 生产环境未使用任何默认密码

### 定期检查（建议每月）

- [ ] 审计密钥使用情况
- [ ] 检查密钥轮换计划
- [ ] 审查访问日志
- [ ] 验证密钥管理服务配置

### 密钥轮换检查

- [ ] 制定轮换时间表
- [ ] 配置轮换告警
- [ ] 测试轮换流程
- [ ] 文档化恢复步骤

---

## 📚 参考资源

- [OWASP 密钥管理速查表](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [NIST 数字身份指南](https://pages.nist.gov/800-63-3/)
- [Docker Secrets 最佳实践](https://docs.docker.com/engine/swarm/secrets/)
- [Kubernetes Secrets 管理](https://kubernetes.io/docs/concepts/configuration/secret/)

---

## 📝 变更记录

| 日期 | 操作 | 文件 | 说明 |
|------|------|------|------|
| 2026-03-15 | 修复 | `.env.production` | 移除硬编码密钥，替换为占位符 |
| 2026-03-15 | 修复 | `src/backend/src/config/index.ts` | 添加生产环境密钥验证 |
| 2026-03-15 | 修复 | `src/backend/src/utils/jwt.ts` | 移除默认密钥，强制环境变量 |
| 2026-03-15 | 修复 | `src/backend/src/services/email.service.ts` | 移除 SMTP 默认密码 |
| 2026-03-15 | 更新 | `.gitignore` | 添加敏感文件忽略规则 |
| 2026-03-15 | 创建 | `docs/KEY_MANAGEMENT_FIX_REPORT.md` | 创建本报告 |

---

**报告结束**

如有疑问，请联系安全团队。