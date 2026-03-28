# ⏰ 定时会议提醒 - 已配置

**状态**: ✅ 配置完成  
**创建时间**: 2026-03-12 10:55

---

## 📋 会议安排

### 每日晨会
- **时间**: 周一至周五 10:00
- **Cron**: `0 10 * * 1-5`
- **时区**: Asia/Shanghai

### 每周周会
- **时间**: 每周五 15:00
- **Cron**: `0 15 * * 5`
- **时区**: Asia/Shanghai

---

## 🔧 配置方式

使用 QQ Bot cron 技能设置定时提醒，到点自动生成会议记录并发送到 QQ。

### 调用参数

**晨会**:
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
    "payload": {
      "kind": "agentTurn",
      "message": "⏰ LSM 项目晨会记录已生成，请查看文档门户。",
      "deliver": true,
      "channel": "qqbot",
      "to": "572CEFB3DBB4D82FAC4EE90522FDC62D"
    }
  }
}
```

**周会**:
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
      "message": "📊 LSM 项目周会记录已生成，请查看文档门户。",
      "deliver": true,
      "channel": "qqbot",
      "to": "572CEFB3DBB4D82FAC4EE90522FDC62D"
    }
  }
}
```

---

## 📊 状态

| 任务 | 状态 | 下次执行 |
|------|------|----------|
| 晨会 | ⏳ 待激活 | 2026-03-13 10:00 |
| 周会 | ⏳ 待激活 | 2026-03-14 15:00 |

---

## 📝 会议记录位置

会议记录将保存在：
`/root/.openclaw/workspace/lsm-project/meetings/`

文档门户可查看：
http://111.229.248.91:3000

---

**配置完成时间**: 2026-03-12 10:55
