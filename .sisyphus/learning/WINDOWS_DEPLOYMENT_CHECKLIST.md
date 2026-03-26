# Windows 部署快速检查清单

> 在执行 Windows 本地部署任务前，按此清单依次检查

---

## 1. 权限检查

```powershell
# 检测是否有管理员权限
net session 2>$null; if ($LASTEXITCODE -eq 0) { "✅ Admin" } else { "❌ User" }
```

**无管理员权限时的备选方案:**
- Scoop 安装 (`Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`)
- 用户目录安装
- 便携版软件

---

## 2. 网络检查

```powershell
# 测试网络连通性
ping -n 1 registry.npmmirror.com

# 检查 npm 配置
npm config get registry

# 检查 package-lock.json 中的镜像源
findstr "resolved" package-lock.json | findstr "http"
```

**常见问题镜像源:**
- ❌ `mirrors.tencentyun.com` - 腾讯云内部镜像，外部不可达
- ❌ `registry.npm.taobao.org` - 已废弃
- ✅ `registry.npmmirror.com` - 推荐
- ✅ `registry.npmjs.org` - 官方源

---

## 3. 端口检查

```powershell
# 检查常用端口
$ports = @(80, 443, 3000, 5432, 6379, 8080, 8081)
foreach ($p in $ports) {
    $result = netstat -ano | findstr ":$p "
    if ($result) { "⚠️ Port $p in use" } else { "✅ Port $p available" }
}
```

**端口被占用时:**
1. 查找进程: `netstat -ano | findstr :PORT`
2. 结束进程: `taskkill /F /PID <PID>` (需管理员)
3. 或修改应用配置使用其他端口

---

## 4. 进程检查

```powershell
# 检查是否有残留进程
$processes = @("node", "postgres", "redis-server", "python")
foreach ($proc in $processes) {
    $found = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($found) { "⚠️ $proc running (PID: $($found.Id -join ', '))" }
}
```

---

## 5. 磁盘空间检查

```powershell
# 检查磁盘空间 (至少 5GB)
$drive = Get-PSDrive C
$freeGB = [math]::Round($drive.Free / 1GB, 2)
if ($freeGB -lt 5) { "❌ Low disk space: $freeGB GB" } else { "✅ Disk space: $freeGB GB" }
```

---

## 6. 依赖检查

```powershell
# 检查常用开发工具
$tools = @{
    "node" = "node -v"
    "npm" = "npm -v"
    "git" = "git --version"
    "python" = "python --version"
    "psql" = "psql --version"
    "redis-cli" = "redis-cli --version"
}

foreach ($tool in $tools.Keys) {
    $result = Invoke-Expression $tools[$tool] 2>$null
    if ($result) { "✅ $tool installed" } else { "❌ $tool not found" }
}
```

---

## 7. npm 问题快速修复

```powershell
# 完全清理重装
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm config set registry https://registry.npmmirror.com
npm cache clean --force
npm install --legacy-peer-deps
```

---

## 8. PostgreSQL 便携部署

```powershell
# 初始化新数据库实例
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$dataDir = "$env:USERPROFILE\postgres_data"
$port = 5433

# 初始化
& "$pgBin\initdb.exe" -D $dataDir -U postgres -A trust -E utf8 --locale=C

# 修改端口
Add-Content "$dataDir\postgresql.conf" "port = $port"

# 启动
& "$pgBin\pg_ctl.exe" -D $dataDir -l "$dataDir\log.txt" start

# 创建数据库
& "$pgBin\psql.exe" -U postgres -p $port -c "CREATE DATABASE mydb;"
```

---

## 9. 常见错误速查

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| `EPERM: operation not permitted` | 权限不足 | 以管理员身份运行 |
| `ECONNRESET` | 网络中断/镜像不可达 | 更换 npm 源，删除 lock 文件 |
| `Port already in use` | 端口被占用 | 杀进程或换端口 |
| `dict_snowball not found` | PATH 未设置 | 使用完整路径 |
| `Permission denied (bind)` | 端口被占用或防火墙 | 换端口，检查防火墙 |
| `Chocolatey lock file` | 锁文件残留 | 删除锁文件目录 |

---

## 10. 一键诊断脚本

```powershell
# 保存为 diagnose.ps1 运行
Write-Host "=== Windows 开发环境诊断 ===" -ForegroundColor Cyan

# 权限
$admin = (net session 2>$null) -ne $null
Write-Host "权限: $(if($admin){'✅ 管理员'}else{'❌ 普通用户'})"

# 网络
$net = Test-Connection -ComputerName registry.npmmirror.com -Count 1 -Quiet
Write-Host "网络: $(if($net){'✅ 正常'}else{'❌ 异常'})"

# 端口
$ports = netstat -ano | findstr ":5432 :6379 :8080 :8081"
Write-Host "端口: $(if($ports){'⚠️ 有端口占用'}else{'✅ 端口空闲'})"

# Node.js
$node = node -v 2>$null
Write-Host "Node.js: $(if($node){$node}else{'❌ 未安装'})"

# npm 源
$registry = npm config get registry
Write-Host "npm 源: $registry"

# 磁盘
$free = [math]::Round((Get-PSDrive C).Free / 1GB, 1)
Write-Host "C盘空间: $free GB"

Write-Host "=== 诊断完成 ===" -ForegroundColor Cyan
```

---

*快速检查清单 v1.0 - 2026-03-25*