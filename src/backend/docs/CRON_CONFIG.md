# ⏰ LSM 项目定时会议提醒

**配置时间**: 2026-03-12 10:53  
**接收人**: 572CEFB3DBB4D82FAC4EE90522FDC62D  
**频道**: QQ Bot

---

## 📋 会议安排

### 1. 每日晨会
- **时间**: 周一至周五 每天 10:00
- **Cron**: `0 10 * * 1-5`
- **时区**: Asia/Shanghai
- **时长**: 15 分钟
- **参会**: AI 项目经理、后端开发、前端开发、测试工程师、DevOps

### 2. 每周周会
- **时间**: 每周五 15:00
- **Cron**: `0 15 * * 5`
- **时区**: Asia/Shanghai
- **时长**: 1 小时
- **参会**: AI 项目经理、后端开发、前端开发、测试工程师、DevOps

---

## 🔧 工具调用参数

### 晨会提醒 JSON
```json
{
  "action": "add",
  "job": {
    "name": "lsm-morning-meeting",
    "schedule": {
      "kind": "cron",
      "expr": "0 10 * * 1-5",
      "tz": "Asia/Shanghai"
    },
    "sessionTarget": "isolated",
    "wakeMode": "now",
    "deleteAfterRun": false,
    "payload": {
      "kind": "agentTurn",
      "message": "⏰ LSM 项目晨会时间到！\n\n【会议记录】\n📅 日期：2026-03-12\n⏱️ 时长：15 分钟\n👥 参会：AI 项目经理、后端开发、前端开发、测试工程师、DevOps\n\n【进度同步】\n✅ 已完成任务\n⏳ 进行中任务\n🚧 阻碍问题\n\n【今日计划】\n📋 任务分配\n🎯 目标确认\n\n详细记录已更新到文档门户。",
      "deliver": true,
      "channel": "qqbot",
      "to": "572CEFB3DBB4D82FAC4EE90522FDC62D"
    }
  }
}
```

### 周会提醒 JSON
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
    "deleteAfterRun": false,
    "payload": {
      "kind": "agentTurn",
      "message": "📊 LSM 项目周会时间到！\n\n【会议记录】\n📅 日期：2026-03-12\n⏱️ 时长：1 小时\n👥 参会：AI 项目经理、后端开发、前端开发、测试工程师、DevOps\n\n【本周总结】\n✅ 完成的功能\n📈 进度统计\n🐛 解决的问题\n\n【下周计划】\n🎯 目标规划\n📋 任务分配\n⚠️ 风险评估\n\n详细记录已更新到文档门户。",
      "deliver": true,
      "channel": "qqbot",
      "to": "572CEFB3DBB4D82FAC4EE90522FDC62D"
    }
  }
}
```

---

## 📊 提醒状态

| 任务 | Cron 表达式 | 时间 | 状态 |
|------|------------|------|------|
| 晨会 | `0 10 * * 1-5` | 工作日 10:00 | ⏳ 待激活 |
| 周会 | `0 15 * * 5` | 周五 15:00 | ⏳ 待激活 |

---

## 🗑️ 取消提醒

```json
{
  "action": "remove",
  "jobName": "lsm-morning-meeting"
}
```

```json
{
  "action": "remove",
  "jobName": "lsm-weekly-meeting"
}
```

---

## 📝 查询提醒

```json
{
  "action": "list"
}
```

---

**文档位置**: `/root/.openclaw/workspace/lsm-project/docs/CRON_CONFIG.md`
