# 🌿 Git 分支管理策略

**版本**: 1.0  
**创建时间**: 2026-03-12  
**适用范围**: LSM 项目全体开发人员

---

## 📋 分支模型

本项目采用 **Git Flow** 简化版分支模型。

### 分支类型

```
main (生产分支)
  └─ develop (开发分支)
       ├─ feature/user-auth (功能分支)
       ├─ feature/gpu-allocation
       ├─ bugfix/login-error
       └─ hotfix/security-patch (热修复分支)
```

---

## 🔵 长期分支

### main 分支（生产分支）
- **用途**: 生产环境代码，随时可部署
- **保护**: ✅ 受保护，禁止直接推送
- **合并**: 仅从 develop 分支合并
- **标签**: 每个版本打标签（v1.0.0, v1.1.0）

### develop 分支（开发分支）
- **用途**: 日常开发集成分支
- **保护**: ✅ 受保护，需代码审查
- **合并**: 接收功能分支合并
- **部署**: 测试环境

---

## 🟢 临时分支

### feature/* （功能分支）
- **用途**: 开发新功能
- **命名**: `feature/<功能名称>`
- **来源**: develop
- **合并**: 合并回 develop
- **示例**:
  - `feature/user-auth`
  - `feature/gpu-allocation`
  - `feature/task-executor`

### bugfix/* （修复分支）
- **用途**: 修复非紧急 Bug
- **命名**: `bugfix/<问题描述>`
- **来源**: develop
- **合并**: 合并回 develop
- **示例**:
  - `bugfix/login-error`
  - `bugfix/gpu-display`

### hotfix/* （热修复分支）
- **用途**: 修复生产环境紧急问题
- **命名**: `hotfix/<问题描述>`
- **来源**: main
- **合并**: 合并到 main 和 develop
- **示例**:
  - `hotfix/security-patch`
  - `hotfix/crash-fix`

---

## 📝 提交规范

### Commit Message 格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具/配置

### 示例
```bash
# 新功能
git commit -m "feat(auth): 添加用户注册功能"

# Bug 修复
git commit -m "fix(api): 修复 GPU 分配接口错误"

# 文档更新
git commit -m "docs: 更新 API 文档"

# 重构
git commit -m "refactor(service): 优化服务层代码结构"
```

---

## 🔄 工作流程

### 开发新功能

```bash
# 1. 切换到 develop 分支
git checkout develop

# 2. 拉取最新代码
git pull origin develop

# 3. 创建功能分支
git checkout -b feature/user-auth

# 4. 开发功能
# ... 编写代码 ...

# 5. 提交代码
git add .
git commit -m "feat(auth): 实现用户注册"

# 6. 推送分支
git push origin feature/user-auth

# 7. 创建 Pull Request
# 在 GitHub/GitLab 创建 PR，请求合并到 develop

# 8. 代码审查
# 等待团队成员审查

# 9. 合并到 develop
# PR 通过后合并

# 10. 删除功能分支
git branch -d feature/user-auth
git push origin --delete feature/user-auth
```

### 修复生产 Bug

```bash
# 1. 从 main 创建热修复分支
git checkout main
git checkout -b hotfix/login-crash

# 2. 修复 Bug
# ... 编写代码 ...

# 3. 提交
git commit -m "fix(auth): 修复登录崩溃问题"

# 4. 合并到 main
git checkout main
git merge hotfix/login-crash

# 5. 打标签
git tag -a v1.0.1 -m "修复登录崩溃"

# 6. 合并到 develop
git checkout develop
git merge hotfix/login-crash

# 7. 删除热修复分支
git branch -d hotfix/login-crash
```

---

## 🛡️ 分支保护规则

### main 分支
- ✅ 禁止直接推送
- ✅ 需要 Pull Request
- ✅ 至少 1 人审查
- ✅ CI 测试通过
- ✅ 只能从 develop 合并

### develop 分支
- ✅ 禁止直接推送（建议）
- ✅ 需要 Pull Request
- ✅ 至少 1 人审查
- ✅ CI 测试通过

---

## 📊 版本管理

### 版本号格式
```
主版本号。次版本号.修订号
Major.Minor.Patch
```

### 版本规则
- **Major**: 不兼容的 API 变更
- **Minor**: 向后兼容的功能新增
- **Patch**: 向后兼容的问题修复

### 发布流程
```bash
# 1. 从 develop 创建 release 分支
git checkout -b release/v1.1.0 develop

# 2. 最终测试和修复
# ... 测试 ...

# 3. 合并到 main
git checkout main
git merge release/v1.1.0

# 4. 打标签
git tag -a v1.1.0 -m "Release v1.1.0"

# 5. 合并回 develop
git checkout develop
git merge release/v1.1.0

# 6. 删除 release 分支
git branch -d release/v1.1.0

# 7. 推送标签
git push origin v1.1.0
```

---

## 🔧 实用命令

### 查看分支
```bash
# 查看所有分支
git branch -a

# 查看远程分支
git branch -r

# 查看分支详情
git show-branch --all
```

### 切换分支
```bash
# 切换分支
git checkout <branch-name>

# 切换并创建新分支
git checkout -b <new-branch>
```

### 合并分支
```bash
# 合并分支
git merge <branch-name>

# 合并时压缩提交
git merge --squash <branch-name>
```

### 删除分支
```bash
# 删除本地分支
git branch -d <branch-name>

# 强制删除本地分支
git branch -D <branch-name>

# 删除远程分支
git push origin --delete <branch-name>
```

---

## 📋 最佳实践

### ✅ 推荐做法
1. **频繁提交**: 小步快跑，避免大提交
2. **及时推送**: 每天结束前推送到远程
3. **更新分支**: 定期从 develop 拉取最新代码
4. **代码审查**: 所有 PR 必须经过审查
5. **测试通过**: 确保 CI 测试通过后再合并
6. **删除分支**: 合并后及时删除功能分支

### ❌ 避免做法
1. ~~直接在 main/develop 上修改~~
2. ~~长时间不合并的功能分支~~
3. ~~无描述的提交信息~~
4. ~~跳过代码审查~~
5. ~~测试失败强行合并~~
6. ~~大提交（>500 行）~~

---

## 📞 问题处理

### 冲突解决
```bash
# 1. 拉取最新代码
git pull origin develop

# 2. 解决冲突
# 编辑冲突文件...

# 3. 标记解决
git add <file>

# 4. 继续合并
git commit
```

### 撤销提交
```bash
# 撤销最后一次提交（保留更改）
git reset --soft HEAD~1

# 撤销提交和更改
git reset --hard HEAD~1

# 撤销已推送的提交（谨慎使用）
git revert <commit-hash>
git push origin
```

---

## 📎 附录

### 相关文档
- [任务清单](./TASKS.md)
- [提交规范](#提交规范)
- [版本管理](#版本管理)

### 工具推荐
- **Git 客户端**: GitKraken, SourceTree
- **代码审查**: GitHub, GitLab
- **CI/CD**: GitHub Actions, GitLab CI

---

**文档维护**: 项目经理  
**最后更新**: 2026-03-12
