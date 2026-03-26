# Windows 本地开发环境部署经验总结

**日期**: 2026-03-25  
**任务**: 在 Windows 上本地部署 LSM 管理平台  
**状态**: ✅ 成功完成  
**耗时**: 约 2 小时

---

## 1. 执行摘要

成功在 Windows 环境下部署了 LSM 全栈应用，涉及 PostgreSQL、Redis、后端 API 和前端 UI。过程中遇到多种环境限制和网络问题，最终通过系统性排查和替代方案解决。

---

## 2. 问题与解决方案矩阵

### 2.1 Docker Desktop 安装失败

| 维度 | 详情 |
|------|------|
| **现象** | winget 安装 Docker Desktop 卡住，无响应 |
| **根因** | 需要 WSL2 和 Hyper-V 虚拟化支持，用户环境未启用 |
| **尝试次数** | 3 次 |
| **最终方案** | 放弃 Docker，改用原生服务部署 |
| **教训** | Windows 上 Docker 依赖虚拟化层，并非所有环境都兼容 |

### 2.2 PostgreSQL 本地安装问题

| 维度 | 详情 |
|------|------|
| **现象 1** | Chocolatey 安装因锁文件失败 |
| **根因** | 权限不足 + NuGet 锁文件残留 |
| **解决方案** | 使用 winget 直接安装 |

| 维度 | 详情 |
|------|------|
| **现象 2** | initdb 初始化失败，提示 dict_snowball 找不到 |
| **根因** | PATH 环境变量未正确设置，导致 lib 目录未被识别 |
| **解决方案** | 使用完整路径调用 initdb，并设置 `--locale=C` |

| 维度 | 详情 |
|------|------|
| **现象 3** | PostgreSQL 无法启动，端口 5432 被占用 |
| **根因** | 之前残留的 postgres 进程占用端口 |
| **解决方案** | 修改 postgresql.conf 使用端口 5433 |

### 2.3 npm 依赖安装网络问题

| 维度 | 详情 |
|------|------|
| **现象** | npm install 持续失败，连接 `mirrors.tencentyun.com` 重置 |
| **根因** | package-lock.json 中包含腾讯云镜像 URL，该镜像不可达 |
| **解决方案** | 删除 package-lock.json 和 node_modules，使用 npmmirror 重新安装 |
| **关键命令** | `del package-lock.json && rd /s /q node_modules && npm install` |
| **教训** | 始终检查 lock 文件中的镜像源，避免使用不可达的内部镜像 |

### 2.4 Redis 安装

| 维度 | 详情 |
|------|------|
| **现象** | Redis 安装顺利 |
| **方案** | winget install Redis.Redis |
| **注意** | Redis Windows 版本是 3.0.504，较旧但够用 |

---

## 3. 成功的部署路径

```
最终成功的路径:
┌─────────────────────────────────────────────────────────────────┐
│ 1. winget install PostgreSQL.PostgreSQL.16                      │
│ 2. initdb -D "C:\Users\HW\postgres_data" -U postgres -A trust   │
│ 3. echo "port = 5433" >> postgresql.conf                        │
│ 4. pg_ctl start -D "C:\Users\HW\postgres_data"                  │
│ 5. psql -U postgres -p 5433 -c "CREATE DATABASE lsm;"           │
│ 6. winget install Redis.Redis                                   │
│ 7. redis-server (自动启动)                                       │
│ 8. cd backend && npm install && npx prisma migrate deploy       │
│ 9. del frontend/package-lock.json && npm install                │
│ 10. npm run dev (both frontend and backend)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 关键经验教训

### 4.1 环境检测优先

```
错误做法: 直接尝试安装，遇到问题再排查
正确做法: 
  1. 先检测现有环境 (netstat, where, tasklist)
  2. 识别端口占用、权限限制
  3. 选择最适合当前环境的方案
```

### 4.2 包管理器选择策略

| 包管理器 | 优点 | 缺点 | 推荐场景 |
|---------|------|------|---------|
| winget | 系统内置，无需额外安装 | 需要 Store 支持 | 首选 |
| Chocolatey | 包丰富，企业支持 | 需要管理员权限 | winget 失败时 |
| Scoop | 无需管理员权限 | 包较少 | 权限受限时 |

### 4.3 网络问题排查模式

```
npm 网络问题排查流程:
1. npm config list - 检查当前镜像源
2. 检查 package-lock.json 中的 resolved URL
3. 切换镜像: npm config set registry https://registry.npmmirror.com
4. 清理缓存: npm cache clean --force
5. 删除 lock 文件和 node_modules 重新安装
```

### 4.4 PostgreSQL 初始化注意事项

```
Windows PostgreSQL 初始化关键点:
- 使用完整路径调用 initdb.exe
- 设置 --locale=C 避免编码问题
- 数据目录放在用户目录下 (避免权限问题)
- 检查端口占用，必要时修改端口
```

---

## 5. 可复用的命令模板

### 5.1 PostgreSQL 便携部署

```powershell
# 初始化数据库
$pgPath = "C:\Program Files\PostgreSQL\16"
$dataPath = "$env:USERPROFILE\postgres_data"

& "$pgPath\bin\initdb.exe" -D $dataPath -U postgres -A trust -E utf8 --locale=C

# 修改端口 (如需)
Add-Content "$dataPath\postgresql.conf" "port = 5433"

# 启动服务
& "$pgPath\bin\pg_ctl.exe" -D $dataPath -l "$dataPath\log.txt" start

# 创建数据库
& "$pgPath\bin\psql.exe" -U postgres -p 5433 -c "CREATE DATABASE mydb;"
```

### 5.2 npm 依赖清理重装

```powershell
# 完全清理重装
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm config set registry https://registry.npmmirror.com
npm cache clean --force
npm install --legacy-peer-deps
```

---

## 6. 避免的陷阱

### ❌ 不要做的事情:

1. **不要假设 Docker 可用** - Windows 虚拟化支持不完整很常见
2. **不要忽视 package-lock.json 中的镜像源** - 可能指向不可达的内部镜像
3. **不要在 Program Files 下创建数据目录** - 权限问题
4. **不要假设默认端口可用** - 始终检查端口占用
5. **不要忽略进程残留** - 杀进程需要管理员权限

### ✅ 应该做的事情:

1. **先检查，再操作** - 使用 netstat, where, tasklist
2. **保留多种备选方案** - Docker → 原生服务 → 云服务
3. **使用完整路径** - 避免 PATH 问题
4. **日志先行** - 遇到问题先看日志文件
5. **逐步验证** - 每一步都验证成功再继续

---

## 7. 改进建议

### 7.1 对项目本身的建议

1. **添加 Windows 本地部署文档** - 当前文档假设 Docker 可用
2. **package-lock.json 不要包含特定镜像** - 使用标准 registry
3. **支持端口配置** - 允许通过环境变量修改数据库端口

### 7.2 对部署流程的建议

1. 创建 `scripts/setup-windows.ps1` 自动化脚本
2. 添加环境检测功能，提示缺失依赖
3. 提供云数据库备选方案的说明文档

---

## 8. 相关资源

- PostgreSQL Windows 下载: https://www.postgresql.org/download/windows/
- Redis Windows 版本: https://github.com/microsoftarchive/redis/releases
- npm 镜像源列表: https://npmmirror.com/
- winget 命令参考: https://learn.microsoft.com/windows/package-manager/winget/

---

## 9. 元数据

```json
{
  "category": "learning",
  "subcategory": "deployment",
  "tags": ["windows", "postgresql", "redis", "npm", "troubleshooting"],
  "difficulty": "intermediate",
  "time_spent_minutes": 120,
  "success_rate": "eventual_success",
  "reusable": true
}
```

---

*文档由 Sisyphus Agent 自动生成，用于知识积累和流程改进*