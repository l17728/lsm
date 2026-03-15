# LSM 服务器预约功能 UI 设计

**版本**: 1.0.0  
**创建日期**: 2026-03-15  
**状态**: 设计完成  
**作者**: AI 前端开发工程师

---

## 1. 页面设计

### 1.1 预约日历页面

**路由**: `/reservations/calendar`

**页面布局**:
```
┌─────────────────────────────────────────────────────────────┐
│  顶部导航栏                                                 │
│  [← 返回]  服务器预约日历          [我的预约] [新建预约]    │
├─────────────────────────────────────────────────────────────┤
│  筛选区域                                                   │
│  服务器: [全部 ▼]  视图: [日/周/月]  日期: [◀ 2026-03-15 ▶] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  日历主体区域                                               │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐       │
│  │ 时间 │ GPU0 │ GPU1 │ GPU2 │ GPU3 │ 状态 │ 操作 │       │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤       │
│  │ 00:00│██████│██████│      │      │ 运行中│      │       │
│  │ 02:00│██████│██████│      │      │      │      │       │
│  │ 04:00│██████│██████│░░░░░░│      │ 待执行│ 取消 │       │
│  │ 06:00│      │      │░░░░░░│      │      │      │       │
│  │ ...  │      │      │      │      │      │      │       │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘       │
│                                                             │
│  图例: ████ 已占用  ░░░░ 已预约  ▒▒▒▒ 维护中              │
├─────────────────────────────────────────────────────────────┤
│  底部操作区                                                 │
│  [导出日历] [打印]                    [新建预约]            │
└─────────────────────────────────────────────────────────────┘
```

**视图模式**:

| 模式 | 说明 | 显示内容 |
|------|------|---------|
| 日视图 | 展示当天 24 小时 | 按小时划分的时间槽 |
| 周视图 | 展示一周 7 天 | 按天划分的资源占用 |
| 月视图 | 展示一个月 | 按天的预约概览 |
| 资源视图 | 按服务器/GPU | 资源列表 + 占用率 |

### 1.2 预约申请表单

**路由**: `/reservations/new`

**表单布局**:
```
┌─────────────────────────────────────────────────────────────┐
│  新建预约                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  申请模式                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ ○ 单GPU  │ │ ○ 多GPU  │ │ ○整服务器│ │ ○时间段  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  选择服务器                                                  │
│  ┌─────────────────────────────────────────────────┐       │
│  │ 服务器 A (4x RTX 3090)    可用: 2 GPU    [选择] │       │
│  │ 服务器 B (8x A100)        可用: 0 GPU    已满   │       │
│  │ 服务器 C (4x RTX 4090)    可用: 4 GPU    [选择] │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  选择 GPU (单 GPU/多 GPU 模式)                              │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐                              │
│  │GPU0│ │GPU1│ │GPU2│ │GPU3│                              │
│  │ ✓  │ │    │ │ ✓  │ │    │   已选: 2 个                 │
│  └────┘ └────┘ └────┘ └────┘                              │
│                                                             │
│  时间设置                                                    │
│  开始时间: [2026-03-15] [10:00 ▼]                          │
│  结束时间: [2026-03-15] [18:00 ▼]                          │
│  预计时长: 8 小时                                            │
│                                                             │
│  备注说明                                                    │
│  ┌─────────────────────────────────────────────────┐       │
│  │ 请输入预约用途...                                │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  配额提示                                                    │
│  ⚠️ 您本周已使用 40 小时，剩余配额 60 小时                  │
│                                                             │
│                          [取消]  [提交预约]                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 我的预约列表

**路由**: `/reservations/mine`

**列表布局**:
```
┌─────────────────────────────────────────────────────────────┐
│  我的预约                                                    │
├─────────────────────────────────────────────────────────────┤
│  状态筛选: [全部] [待审批] [已批准] [进行中] [已完成] [已取消]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔵 进行中    服务器 A - GPU0, GPU1                   │   │
│  │ 时间: 2026-03-15 10:00 - 18:00                      │   │
│  │ 用途: 模型训练                                      │   │
│  │ 剩余: 4 小时 32 分钟                    [释放] [详情] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟡 待审批    服务器 C - 整服务器                     │   │
│  │ 时间: 2026-03-16 08:00 - 2026-03-17 20:00           │   │
│  │ 用途: 分布式训练                                    │   │
│  │ 审批人: 张教授                         [取消] [详情] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ 已完成    服务器 B - GPU2                        │   │
│  │ 时间: 2026-03-14 14:00 - 20:00                      │   │
│  │ 用途: 数据预处理                                    │   │
│  │ 实际使用: 6 小时                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [上一页] 1 / 5 [下一页]                    共 15 条记录   │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 管理员页面

**路由**: `/reservations/admin`

**功能模块**:
- 所有预约列表
- 待审批列表
- 配额管理
- 资源利用率统计
- 预约规则配置

---

## 2. 组件设计

### 2.1 CalendarView 日历组件

```typescript
interface CalendarViewProps {
  // 视图模式
  viewMode: 'day' | 'week' | 'month';
  // 当前日期
  currentDate: Date;
  // 服务器 ID (可选筛选)
  serverId?: string;
  // 预约数据
  reservations: Reservation[];
  // 点击时间槽回调
  onSlotClick?: (slot: TimeSlot) => void;
  // 点击预约回调
  onReservationClick?: (reservation: Reservation) => void;
  // 加载状态
  loading?: boolean;
}

interface TimeSlot {
  serverId: string;
  gpuId?: string;
  startTime: Date;
  endTime: Date;
  status: 'available' | 'reserved' | 'occupied' | 'maintenance';
}

interface Reservation {
  id: string;
  userId: string;
  userName: string;
  serverId: string;
  serverName: string;
  gpuIds: string[];
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';
  purpose: string;
}
```

### 2.2 ReservationForm 预约表单

```typescript
interface ReservationFormProps {
  // 初始数据 (编辑模式)
  initialValues?: Partial<ReservationFormValues>;
  // 可用服务器列表
  servers: Server[];
  // 用户配额
  quota: UserQuota;
  // 提交回调
  onSubmit: (values: ReservationFormValues) => Promise<void>;
  // 取消回调
  onCancel?: () => void;
  // 提交中状态
  submitting?: boolean;
}

interface ReservationFormValues {
  mode: 'single-gpu' | 'multi-gpu' | 'whole-server' | 'time-slot';
  serverId: string;
  gpuIds: string[];
  startTime: Date;
  endTime: Date;
  purpose: string;
}

interface Server {
  id: string;
  name: string;
  gpus: GPU[];
  availableGpuCount: number;
  status: 'online' | 'offline' | 'maintenance';
}

interface GPU {
  id: string;
  name: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
}

interface UserQuota {
  maxHoursPerWeek: number;
  usedHoursThisWeek: number;
  maxConcurrentReservations: number;
  currentReservations: number;
}
```

### 2.3 TimeSlotPicker 时间槽选择器

```typescript
interface TimeSlotPickerProps {
  // 服务器 ID
  serverId: string;
  // 日期
  date: Date;
  // 已选时间段
  selectedSlots: TimeSlot[];
  // 已占用时间段 (只读)
  occupiedSlots: TimeSlot[];
  // 选择回调
  onSelect: (slots: TimeSlot[]) => void;
  // 最小选择时长 (小时)
  minDuration?: number;
  // 最大选择时长 (小时)
  maxDuration?: number;
}
```

### 2.4 ResourceCard 资源卡片

```typescript
interface ResourceCardProps {
  // 服务器信息
  server: Server;
  // 显示模式
  mode: 'select' | 'view' | 'admin';
  // 是否选中
  selected?: boolean;
  // 选择回调
  onSelect?: () => void;
  // 查看详情回调
  onView?: () => void;
}
```

### 2.5 ReservationCard 预约卡片

```typescript
interface ReservationCardProps {
  // 预约信息
  reservation: Reservation;
  // 显示模式
  mode: 'list' | 'calendar' | 'detail';
  // 操作按钮
  actions?: ReservationAction[];
  // 点击回调
  onClick?: () => void;
}

interface ReservationAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
  confirm?: string;
}
```

---

## 3. 交互设计

### 3.1 预约创建流程

```
1. 用户点击"新建预约"
   │
2. 进入预约表单页面
   │
3. 选择申请模式
   │
4. 选择服务器 → 系统加载 GPU 状态
   │
5. 选择 GPU/时间段
   │
   ├── 无冲突 → 显示"可预约"
   │       │
   │       └── 点击提交 → 创建成功 → 跳转详情页
   │
   └── 有冲突 → 显示冲突提示
           │
           └── 显示建议时间 → 用户选择或重新选择
```

### 3.2 拖拽调整时间

```typescript
// 拖拽调整开始时间
const handleDragStart = (reservation: Reservation) => {
  // 记录原始预约
  setDraggingReservation(reservation);
  // 高亮可调整区域
  highlightAdjustableSlots(reservation);
};

// 拖拽中实时预览
const handleDragMove = (newStartTime: Date) => {
  // 检查冲突
  const conflicts = checkConflicts(newStartTime, draggingReservation);
  if (conflicts.length > 0) {
    // 显示冲突提示
    showConflictWarning(conflicts);
  } else {
    // 显示预览
    showPreview(newStartTime);
  }
};

// 拖拽结束确认
const handleDragEnd = (newStartTime: Date) => {
  // 弹出确认框
  confirm('确认调整预约时间？').then(() => {
    updateReservation(draggingReservation.id, { startTime: newStartTime });
  });
};
```

### 3.3 冲突提示交互

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ 检测到时间冲突                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  您选择的时间段与以下预约冲突:                              │
│                                                             │
│  • 服务器 A - GPU0: 2026-03-15 14:00-18:00 (用户: 张三)    │
│  • 服务器 A - GPU1: 2026-03-15 14:00-18:00 (用户: 李四)    │
│                                                             │
│  建议您选择以下时间段:                                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ✅ 服务器 A - GPU0, GPU1: 2026-03-15 18:00-22:00     │  │
│  │ ✅ 服务器 C - GPU0, GPU1: 2026-03-15 14:00-18:00     │  │
│  │ ✅ 服务器 A - GPU0: 2026-03-16 10:00-18:00           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│                              [重新选择]  [使用建议时间]     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 状态管理

### 4.1 Zustand Store 设计

```typescript
// stores/reservationStore.ts
import { create } from 'zustand';

interface ReservationState {
  // 当前视图日期
  currentDate: Date;
  // 视图模式
  viewMode: 'day' | 'week' | 'month';
  // 选中的服务器
  selectedServerId: string | null;
  // 预约列表
  reservations: Reservation[];
  // 加载状态
  loading: boolean;
  // 筛选条件
  filters: ReservationFilters;
  
  // Actions
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  setSelectedServerId: (id: string | null) => void;
  fetchReservations: (params: FetchParams) => Promise<void>;
  createReservation: (data: ReservationFormValues) => Promise<Reservation>;
  updateReservation: (id: string, data: Partial<ReservationFormValues>) => Promise<void>;
  cancelReservation: (id: string) => Promise<void>;
  releaseReservation: (id: string) => Promise<void>;
}

export const useReservationStore = create<ReservationState>((set, get) => ({
  currentDate: new Date(),
  viewMode: 'day',
  selectedServerId: null,
  reservations: [],
  loading: false,
  filters: {},
  
  setCurrentDate: (date) => set({ currentDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedServerId: (id) => set({ selectedServerId: id }),
  
  fetchReservations: async (params) => {
    set({ loading: true });
    try {
      const response = await api.get('/api/reservations', { params });
      set({ reservations: response.data.data });
    } finally {
      set({ loading: false });
    }
  },
  
  createReservation: async (data) => {
    const response = await api.post('/api/reservations', data);
    const newReservation = response.data.data;
    set((state) => ({
      reservations: [...state.reservations, newReservation]
    }));
    return newReservation;
  },
  
  // ... 其他方法
}));
```

### 4.2 数据同步策略

```typescript
// 使用 SWR 进行数据同步
import useSWR from 'swr';

export function useReservations(params: FetchParams) {
  const { data, error, mutate } = useSWR(
    ['/api/reservations', params],
    (url, params) => api.get(url, { params }).then(r => r.data.data),
    {
      refreshInterval: 30000, // 30秒自动刷新
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );
  
  return {
    reservations: data,
    loading: !error && !data,
    error,
    mutate,
  };
}

// WebSocket 实时更新
useEffect(() => {
  const ws = new WebSocket(WS_URL);
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'RESERVATION_UPDATE') {
      mutate(); // 重新获取数据
    }
  };
  
  return () => ws.close();
}, [mutate]);
```

---

## 5. 样式设计

### 5.1 响应式布局

```css
/* 断点定义 */
$breakpoints: (
  xs: 480px,   /* 手机竖屏 */
  sm: 768px,   /* 手机横屏/平板竖屏 */
  md: 1024px,  /* 平板横屏 */
  lg: 1280px,  /* 小屏桌面 */
  xl: 1920px,  /* 大屏桌面 */
);

/* 日历响应式 */
.reservation-calendar {
  @media (max-width: 768px) {
    /* 移动端: 简化视图 */
    .calendar-grid {
      display: block;
    }
    .time-column {
      width: 60px;
    }
    .gpu-columns {
      overflow-x: auto;
    }
  }
  
  @media (min-width: 1024px) {
    /* 桌面端: 完整视图 */
    .calendar-grid {
      display: grid;
      grid-template-columns: 80px repeat(auto-fit, minmax(120px, 1fr));
    }
  }
}
```

### 5.2 状态颜色规范

```css
/* 预约状态颜色 */
:root {
  --reservation-pending: #faad14;      /* 待审批 - 黄色 */
  --reservation-approved: #1890ff;     /* 已批准 - 蓝色 */
  --reservation-active: #52c41a;       /* 进行中 - 绿色 */
  --reservation-completed: #8c8c8c;    /* 已完成 - 灰色 */
  --reservation-cancelled: #ff4d4f;    /* 已取消 - 红色 */
  --reservation-conflict: #ff7a45;     /* 冲突 - 橙色 */
}

/* 资源状态颜色 */
:root {
  --resource-available: #52c41a;       /* 可用 - 绿色 */
  --resource-occupied: #1890ff;        /* 占用 - 蓝色 */
  --resource-reserved: #faad14;        /* 已预约 - 黄色 */
  --resource-maintenance: #8c8c8c;     /* 维护 - 灰色 */
  --resource-offline: #ff4d4f;         /* 离线 - 红色 */
}
```

### 5.3 暗黑模式支持

```css
/* 暗黑模式变量 */
[data-theme='dark'] {
  --calendar-bg: #1a1a2e;
  --calendar-border: #303030;
  --calendar-slot-bg: #252525;
  --calendar-slot-hover: #303030;
  
  --reservation-pending-bg: rgba(250, 173, 20, 0.2);
  --reservation-approved-bg: rgba(24, 144, 255, 0.2);
  --reservation-active-bg: rgba(82, 196, 26, 0.2);
  
  /* 文字颜色 */
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
}
```

---

## 6. 性能优化

### 6.1 虚拟滚动

```typescript
// 大量预约数据使用虚拟滚动
import { FixedSizeList } from 'react-window';

const ReservationList = ({ reservations }: { reservations: Reservation[] }) => (
  <FixedSizeList
    height={600}
    itemCount={reservations.length}
    itemSize={80}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        <ReservationCard reservation={reservations[index]} />
      </div>
    )}
  </FixedSizeList>
);
```

### 6.2 懒加载

```typescript
// 日历数据按需加载
const CalendarView = () => {
  const [visibleRange, setVisibleRange] = useState({ start: null, end: null });
  
  const { data } = useSWR(
    visibleRange.start && visibleRange.end
      ? ['/api/reservations/calendar', visibleRange]
      : null,
    fetchCalendarData
  );
  
  return (
    <Calendar
      onVisibleRangeChange={setVisibleRange}
      data={data}
    />
  );
};
```

---

## 7. 测试要点

### 7.1 单元测试

- 日历组件日期计算逻辑
- 冲突检测算法
- 配额计算逻辑
- 状态机转换

### 7.2 集成测试

- 预约创建流程
- 时间拖拽调整
- 冲突处理流程
- 审批流程

### 7.3 E2E 测试

- 完整预约流程
- 多用户并发预约
- 边界条件测试

---

**文档版本**: 1.0.0  
**创建日期**: 2026-03-15  
**维护者**: AI 前端开发工程师