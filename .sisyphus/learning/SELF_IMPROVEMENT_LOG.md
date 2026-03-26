# Sisyphus Agent 自我提升日志

**目的**: 记录 Agent 在执行任务过程中的经验教训，持续改进决策能力和执行效率

---

## 2026-03-25: Windows 本地开发环境部署

### 任务背景
用户需要在 Windows 上本地运行 LSM 管理平台（全栈应用：PostgreSQL + Redis + Node.js 后端 + React 前端）

### 决策回顾

#### 决策 1: 尝试 Docker Desktop
- **结果**: ❌ 失败
- **原因**: 未先检测虚拟化支持状态
- **改进**: 应先执行 `systeminfo | findstr Virtualization` 检测

#### 决策 2: 尝试 Chocolatey 安装 PostgreSQL
- **结果**: ❌ 失败（锁文件问题）
- **原因**: 权限不足 + 未清理残留锁文件
- **改进**: 应先检测 `net session` 确认权限状态

#### 决策 3: 使用 winget 安装 PostgreSQL
- **结果**: ✅ 成功（但需要后续修复）
- **问题**: 安装后缺少服务配置
- **改进**: winget 安装的 PostgreSQL 需要手动初始化

#### 决策 4: 尝试 SQLite 替代 PostgreSQL
- **结果**: ❌ 失败
- **原因**: Schema 使用了 JSON、Enum、数组类型，SQLite 不支持
- **改进**: 对于复杂 Schema，不应尝试 SQLite 替代

#### 决策 5: 提出使用云数据库
- **结果**: 用户拒绝（希望本地部署）
- **教训**: 应先询问用户偏好，而非主动建议替代方案

#### 决策 6: 删除 package-lock.json 后重新安装
- **结果**: ✅ 成功
- **关键**: 发现腾讯云镜像不可达是根本原因

### 核心教训

```
问题诊断模式:
┌────────────────────────────────────────────────────────────┐
│ 错误模式: 遇到问题 → 猜测原因 → 尝试修复 → 再次失败       │
│ 正确模式: 遇到问题 → 收集信息 → 分析根因 → 针对性解决     │
└────────────────────────────────────────────────────────────┘

本次实际执行的改进:
1. 看到网络错误 → 检查 npm config → 发现镜像源正常
2. 继续失败 → 检查 package-lock.json → 发现腾讯云镜像 URL
3. 删除 lock 文件 → 重新安装 → 成功
```

### 决策树优化

```
Windows 环境部署决策树（修订版）:

START
  │
  ├─ 需要安装服务？
  │   ├─ YES → 检测管理员权限
  │   │        ├─ 有权限 → winget / chocolatey
  │   │        └─ 无权限 → Scoop / 用户目录安装
  │   └─ NO → 直接使用
  │
  ├─ 需要数据库？
  │   ├─ 复杂 Schema → PostgreSQL (不可用 SQLite)
  │   └─ 简单 Schema → SQLite 可作为备选
  │
  ├─ npm 安装失败？
  │   ├─ 检查网络连接
  │   ├─ 检查 npm config registry
  │   ├─ 检查 package-lock.json 中的 resolved URL
  │   └─ 删除 lock 文件重试
  │
  └─ 端口被占用？
      ├─ 查找占用进程: netstat -ano | findstr :PORT
      └─ 杀进程或换端口
```

---

## 通用原则总结

### 1. 环境检测优先原则

**Before Action, Check State:**
```
1. 权限状态: net session / whoami /priv
2. 网络状态: ping / curl / npm config
3. 端口状态: netstat -ano
4. 进程状态: tasklist / Get-Process
5. 磁盘空间: dir / wmic logicaldisk
```

### 2. 失败后升级诊断原则

```
Level 1: 表面现象 → 尝试常见解决方案
Level 2: 日志分析 → 查看详细错误信息
Level 3: 环境检测 → 检查系统状态
Level 4: 根因分析 → 追溯到配置/权限/网络层
```

### 3. 用户意图优先原则

```
错误: 用户说"运行" → 我建议"用云服务"
正确: 用户说"运行" → 确认"本地还是云端？" → 按用户选择执行
```

### 4. 锁文件/缓存敏感性

```
遇到以下问题优先检查:
- npm: package-lock.json, node_modules, .npm-cache
- pip: requirements.txt, __pycache__, pip cache
- git: .git/index.lock
- chocolatey: .chocolateyPending, *.lock
```

---

## 待改进项

| 项目 | 当前状态 | 改进方案 |
|------|---------|---------|
| Docker 检测 | 未检测虚拟化 | 添加 `systeminfo` 检测 |
| 权限检测 | 被动发现 | 任务开始时主动检测 |
| 云服务建议 | 未经确认建议 | 先询问用户偏好 |
| 网络问题诊断 | 多次尝试后找到根因 | 建立 lock 文件检查清单 |

---

## 附录：快速诊断命令

### Windows 环境诊断速查

```powershell
# 权限检测
net session 2>$null; if ($?) { "Admin" } else { "User" }

# 端口检测
netstat -ano | findstr ":8080"

# 进程检测
tasklist | findstr "node"

# 服务检测
sc query postgresql-x64-16

# 环境变量
$env:PATH -split ";"

# npm 配置
npm config list

# 磁盘空间
Get-PSDrive C
```

---

*此文档将持续更新，记录 Agent 学习过程中的关键洞察*