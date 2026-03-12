# ⏰ LSM 项目定时提醒配置

**创建时间**: 2026-03-12  
**提醒对象**: 572CEFB3DBB4D82FAC4EE90522FDC62D

---

## 📋 提醒任务清单

### 任务 1：每日晨会提醒
- **名称**: `lsm-morning-meeting`
- **时间**: 每天 10:00
- **Cron**: `0 10 * * *`
- **时区**: Asia/Shanghai
- **消息**: 
  ```
  ⏰ LSM 项目晨会时间到！请各位成员准备同步：
  1️⃣ 昨天完成的工作
  2️⃣ 今天的计划
  3️⃣ 遇到的阻碍
  
  15 分钟高效会议，开始！🚀
  ```

### 任务 2：每日晚报提醒
- **名称**: `lsm-daily-report`
- **时间**: 每天 18:00
- **Cron**: `0 18 * * *`
- **时区**: Asia/Shanghai
- **消息**: 
  ```
  📝 晚报时间到！请提交今日工作汇报：
  ✅ 完成的工作
  ⏳ 进行中的工作
  🚧 遇到的困难
  📅 明日计划
  
  辛苦啦！🌙
  ```

### 任务 3：每周周会提醒
- **名称**: `lsm-weekly-meeting`
- **时间**: 每周五 15:00
- **Cron**: `0 15 * * 5`
- **时区**: Asia/Shanghai
- **消息**: 
  ```
  📊 LSM 项目周会时间到！
  本周总结 + 下周计划，1 小时深度讨论。
  
  请准备好进度报告和问题清单，会议室见！👥
  ```

---

## 🔧 设置命令

使用以下 JSON 调用 cron 工具：

### 晨会提醒
```json
{
  "action": "add",
  "job": {
    "name": "lsm-morning-meeting",
    "schedule": {
      "kind": "cron",
      "expr": "0 10 * * *",
      "tz": "Asia/Shanghai"
    },
    "sessionTarget": "isolated",
    "wakeMode": "now",
    "payload": {
      "kind": "agentTurn",
      "message": "⏰ LSM 项目晨会时间到！请各位成员准备同步：1️⃣ 昨天完成的工作 2️⃣ 今天的计划 3️⃣ 遇到的阻碍。15 分钟高效会议，开始！🚀",
      "deliver": true,
      "channel": "qqbot",
      "to": "572CEFB3DBB4D82FAC4EE90522FDC62D"
    }
  }
}
```

### 晚报提醒
```json
{
  "action": "add",
  "job": {
    "name": "lsm-daily-report",
    "schedule": {
      "kind": "cron",
      "expr": "0 18 * * *",
      "tz": "Asia/Shanghai"
    },
    "sessionTarget": "isolated",
    "wakeMode": "now",
    "payload": {
      "kind": "agentTurn",
      "message": "📝 晚报时间到！请提交今日工作汇报：✅ 完成的工作 ⏳ 进行中的工作 🚧 遇到的困难 📅 明日计划。辛苦啦！🌙",
      "deliver": true,
      "channel": "qqbot",
      "to": "572CEFB3DBB4D82FAC4EE90522FDC62D"
    }
  }
}
```

### 周会提醒
```json
{
  "action": "add",
  "job": {
    "name": "lsm-weekly-meeting",
    "schedule": {
      "kind": "cron",
      "expr": "0 15 * * 5",
      "tz": "Asia/Shanghai"
    },
    "sessionTarget": "isolated",
    "wakeMode": "now",
    "payload": {
      "kind": "agentTurn",
      "message": "📊 LSM 项目周会时间到！本周总结 + 下周计划，1 小时深度讨论。请准备好进度报告和问题清单，会议室见！👥",
      "deliver": true,
      "channel": "qqbot",
      "to": "572CEFB3DBB4D82FAC4EE90522FDC62D"
    }
  }
}
```

---

## 📊 提醒统计

| 任务 | 频率 | 时间 | 状态 |
|------|------|------|------|
| 晨会 | 每天 | 10:00 | ⏳ 待设置 |
| 晚报 | 每天 | 18:00 | ⏳ 待设置 |
| 周会 | 每周五 | 15:00 | ⏳ 待设置 |

---

## 🗑️ 取消提醒

如需取消某个提醒，使用对应的任务名称：

```bash
# 取消晨会
remove lsm-morning-meeting

# 取消晚报
remove lsm-daily-report

# 取消周会
remove lsm-weekly-meeting
```

---

## 📝 查询提醒

查看当前所有提醒：
```bash
list
```

---

**文档位置**: `/root/.openclaw/workspace/lsm-project/docs/REMINDERS.md`
