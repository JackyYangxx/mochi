---
name: calendar-kanban-design
description: 日历看板窗口设计规范 —— 统计每日待办完成数，年度热力图 + 月度日历双层布局，独立 BrowserWindow + 托盘触发
metadata:
  type: spec
  date: 2026-06-19
---

# Calendar Kanban Window — 设计规范

## 概述

在 Mochi 中新增一个独立的「日历看板」窗口，可视化展示每日待办完成数量。复用 settings 窗口的架构（独立 BrowserWindow + 单独 React 入口 + 托盘菜单触发），布局采用「年度热力图 + 月度日历」双层结构。

---

## 1. 窗口架构

### 主进程

- **`src/main/calendarWindow.ts`**（新增）
  - 仿 `settingsWindow.ts` 实现窗口管理
  - 窗口 ID：`calendarWindow`（模块内单例）
  - 默认尺寸：宽 480 × 高 600（与 settings 一致）
  - 最小尺寸：宽 400 × 高 500
  - 窗口配置：`frame: true`、`resizable: true`、`title: 'Mochi - Calendar'`
  - preload 路径：`dist/preload/index.js`（与 settings 共用）

### 渲染进程

- **`src-renderer/calendar.html`**（新增）—— 入口 HTML 模板
- **`src-renderer/calendar/CalendarApp.tsx`**（新增）—— React 根组件
- **`src-renderer/calendar/CalendarApp.css`**（新增）—— 顶层样式
- **`src-renderer/calendar/YearHeatmap.tsx`**（新增）—— 顶部年度热力图
- **`src-renderer/calendar/CalendarMonth.tsx`**（新增）—— 月度日历网格
- **`src-renderer/calendar/DayDetailPanel.tsx`**（新增）—— 当日完成清单抽屉

### 数据层

- **`src/services/CalendarService.ts`**（新增）—— 三个查询方法
  - `getMonthStats(year, month): MonthStat[]`
  - `getYearHeatmap(year): DayStat[]`
  - `getDayTodos(date): Todo[]`

### IPC 通道

| 通道 | 方向 | 功能 |
|------|------|------|
| `calendar:window:open` | renderer → main | 打开或聚焦日历窗口 |
| `calendar:window:close` | renderer → main | 关闭日历窗口 |
| `calendar:getMonthStats` | renderer → main | 获取某月每日完成数 |
| `calendar:getYearHeatmap` | renderer → main | 获取某年每日完成数（年度热力图） |
| `calendar:getDayTodos` | renderer → main | 获取某日完成的待办列表 |

### 预加载脚本

- **`src/preload/index.ts`** —— 在 `window.calendarAPI` 暴露上述 IPC 方法

### 托盘菜单

- **`src/main/tray.ts`** —— 在 "Show" 与 "Settings" 之间新增 `Calendar` 菜单项，调用 `openCalendarWindow()`

### 构建配置

- **`vite.config.ts`** —— `rollupOptions.input` 增加 `calendar` entry：
  ```ts
  input: {
    main: path.resolve(__dirname, 'index.html'),
    settings: path.resolve(__dirname, 'src-renderer/settings.html'),
    calendar: path.resolve(__dirname, 'src-renderer/calendar.html'),
  }
  ```
- **`injectSettingsAssets`** 插件改名为 `injectWindowAssets`，同时处理 settings 和 calendar 的 HTML 资源注入

---

## 2. 数据模型

### 统计逻辑

- 一天定义为**本地时区**的日历日。
- "该日完成" = `is_completed = 1` 且 `completed_at` 通过 `date(completed_at, 'localtime')` 落在该日。
- 子待办（`parent_id IS NOT NULL`）也计入完成数（每条独立计数）。

### 不新增索引

当前 schema 已有 `idx_todos_is_completed`。完成数查询会先过滤 `is_completed = 1`，再按日期聚合；个人使用数据量下无需新建 `completed_at` 索引。若后续大数据量下出现性能问题再加 `(is_completed, completed_at)` 复合索引。

### 类型定义

```ts
// src/shared/types/calendar.ts
export interface MonthStat {
  day: number;       // 1-31
  count: number;     // 当日完成数
}

export interface DayStat {
  date: string;      // 'YYYY-MM-DD'
  count: number;
}

export interface CalendarTodo {
  id: string;
  content: string;
  completedAt: string;  // ISO 8601
  parentId: string | null;
}
```

---

## 3. 视觉布局

### 单屏结构

```
┌──────────────────────────────────────────┐
│ Mochi · 2026      [今天]  [<] 6月 [>]    │  ← 顶栏
├──────────────────────────────────────────┤
│ ░░▒▒▓▓▒░░  ▓▓▒░░▓▒░  ...               │  ← 年度热力图 (7 行 × 53 列)
│ (点击任一格 → 月度跳到该月)                │
├──────────────────────────────────────────┤
│ 日  一  二  三  四  五  六               │
│              1   2   3   4               │  ← 月度日历 (6 行 × 7 列)
│   5   6✓2 7   8✓1 9  10  11             │
│  12  13✓3 ...                           │
│ ...                                      │
├──────────────────────────────────────────┤
│ (点击某天 → 右侧滑出当日完成清单)          │  ← 抽屉（默认收起）
└──────────────────────────────────────────┘
```

### 颜色梯度（绿系，kawaii 软萌风）

| 完成数 | 颜色 |
|--------|------|
| 0 | `#f0f0f0`（极浅灰） |
| 1-2 | `#d8f0d4`（浅绿） |
| 3-5 | `#a8dc9e`（中绿） |
| 6-10 | `#6cc060`（深绿） |
| 11+ | `#3a9c2e`（最绿） |

所有色板透明度统一，避免刺眼。文字色根据底色深浅在 `#333` 与 `#fff` 间切换。

### 单元格视觉

- 圆角 6px；hover 时轻微放大（scale 1.05）+ 阴影
- 当日格子：外圈加柔光描边（`box-shadow: 0 0 0 2px rgba(108, 192, 96, 0.4)`）
- 数字字号 12px；完成数徽章 9px 圆形（背景绿、文字白）

### 风格与主宠物统一

- 主色：薄荷绿 / 奶油白
- 字体：与 settings 面板一致（system-ui）
- 间距：8px 网格

---

## 4. 交互细节

### 顶栏

- 左侧：「Mochi · 2026」标题（当年年份）
- 中部：月份切换器 `[<] 6月 [>]`
- 右侧：「今天」按钮，点击跳到当前月 + 高亮当日

### 年度热力图（YearHeatmap）

- 7 行（周一到周日）× 53 列（一年的周数）
- 每格代表一天，悬停显示 `YYYY-MM-DD · N 个待办` tooltip
- 点击任意格 → 月度跳到该月并定位到该日

### 月度日历（CalendarMonth）

- 6 行 × 7 列；首列周日起，周一到周六依次
- 留白处理：上月末 / 下月初的灰色占位
- 每格内容：
  - 日期数字（左上）
  - 完成数徽章（右下，仅 count > 0 时显示）
  - hover → tooltip + 轻微放大
  - click → 打开当日抽屉

### 当日抽屉（DayDetailPanel）

- 从右侧滑入，宽 280px，覆盖在日历右侧（不挤压日历）
- 关闭：右上 × 按钮 / 点击日历其他空白处 / Esc 键
- 内容：
  - 标题：「YYYY-MM-DD · N 项已完成」
  - 列表：每条 todo 显示内容 + 完成时刻（HH:mm）
  - 空日：「这天没有完成的待办 ✨」

### 键盘

- `Esc`：关闭抽屉
- `←` `→`：切换月份（在 CalendarApp 顶层监听）
- `T`（在顶栏「今天」按钮聚焦时）：跳到当前月

---

## 5. CalendarService 实现

```ts
// src/services/CalendarService.ts
import Database from 'better-sqlite3';

export class CalendarService {
  constructor(private db: Database.Database) {}

  getMonthStats(year: number, month: number): MonthStat[] {
    // month: 1-12
    // 返回当月所有日（含 count=0 的日），便于渲染月度日历占位
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const rows = this.db.prepare(`
      SELECT date(completed_at, 'localtime') AS day, COUNT(*) AS count
      FROM todos
      WHERE is_completed = 1
        AND completed_at >= ?
        AND completed_at < ?
      GROUP BY day
    `).all(start, end) as { day: string; count: number }[];
    return rows.map(r => ({
      day: parseInt(r.day.slice(-2), 10),
      count: r.count,
    }));
  }

  getYearHeatmap(year: number): DayStat[] {
    const start = `${year}-01-01`;
    const end = `${year + 1}-01-01`;
    const rows = this.db.prepare(`
      SELECT date(completed_at, 'localtime') AS day, COUNT(*) AS count
      FROM todos
      WHERE is_completed = 1
        AND completed_at >= ?
        AND completed_at < ?
      GROUP BY day
    `).all(start, end) as { day: string; count: number }[];
    return rows.map(r => ({ date: r.day, count: r.count }));
  }

  getDayTodos(date: string): CalendarTodo[] {
    // date: 'YYYY-MM-DD'（本地时区）
    const rows = this.db.prepare(`
      SELECT id, content, completed_at, parent_id
      FROM todos
      WHERE is_completed = 1
        AND date(completed_at, 'localtime') = ?
      ORDER BY completed_at ASC
    `).all(date) as {
      id: string; content: string; completed_at: string; parent_id: string | null;
    }[];
    return rows.map(r => ({
      id: r.id,
      content: r.content,
      completedAt: r.completed_at,
      parentId: r.parent_id,
    }));
  }
}
```

### 时区处理说明

SQLite 的 `date()` 函数在 `localtime` modifier 下会使用系统本地时区。Windows 和 macOS 的 better-sqlite3 都默认支持 `localtime`，无需额外配置。DST 切换日会被正确归入本地日历日（已在测试中覆盖）。

---

## 6. 状态管理

渲染进程使用 React `useState` + 自定义 `useCalendarData` hook，避免引入额外状态库。

```ts
// src-renderer/calendar/hooks/useCalendarData.ts
export function useCalendarData(year: number, month: number) {
  const [monthStats, setMonthStats] = useState<MonthStat[]>([]);
  const [heatmap, setHeatmap] = useState<DayStat[]>([]);
  const [dayTodos, setDayTodos] = useState<CalendarTodo[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 月度数据：year 或 month 变化时重查
  useEffect(() => {
    setLoading(true);
    Promise.all([
      window.calendarAPI.getMonthStats(year, month),
      window.calendarAPI.getYearHeatmap(year),
    ]).then(([m, h]) => {
      setMonthStats(m);
      setHeatmap(h);
      setLoading(false);
    });
  }, [year, month]);

  const selectDay = (date: string) => {
    setSelectedDate(date);
    window.calendarAPI.getDayTodos(date).then(setDayTodos);
  };

  return {
    monthStats, heatmap, dayTodos, selectedDate,
    loading, selectDay,
  };
}
```

---

## 7. 错误处理

| 场景 | 行为 |
|------|------|
| DB 读失败 | 顶部 toast「数据加载失败」+ 月度日历显示空态（全部灰色 0） |
| 某日查询为空 | 抽屉显示「这天没有完成的待办 ✨」 |
| 月份边界非法（month=13） | CalendarApp 入口校验，越界时自动修正 |
| 窗口重复打开 | 复用现有实例并 focus（与 settings 行为一致） |
| 完成时间在 DST 切换点 | 单元测试覆盖；本地时区下同日多条记录聚合正常 |
| `completed_at` 为 NULL | 不会出现在结果中（已被 `is_completed = 1` 隐含过滤；但 SQL 显式加 `completed_at IS NOT NULL` 防御） |

---

## 8. 文件改动汇总

### 新增

- `src/main/calendarWindow.ts`
- `src/services/CalendarService.ts`
- `src/shared/types/calendar.ts`
- `src-renderer/calendar.html`
- `src-renderer/calendar/CalendarApp.tsx`
- `src-renderer/calendar/CalendarApp.css`
- `src-renderer/calendar/YearHeatmap.tsx`
- `src-renderer/calendar/CalendarMonth.tsx`
- `src-renderer/calendar/DayDetailPanel.tsx`
- `src-renderer/calendar/hooks/useCalendarData.ts`
- `tests/unit/CalendarService.test.ts`
- `tests/unit/CalendarMonth.test.tsx`

### 修改

- `src/main/tray.ts` —— 新增 "Calendar" 菜单项
- `src/main/index.ts` —— 初始化 CalendarService、注册 IPC
- `src/main/ipc.ts` —— 注册 5 个 calendar IPC handler
- `src/preload/index.ts` —— 在 `window.calendarAPI` 暴露方法
- `vite.config.ts` —— 增加 calendar entry；插件改名 `injectWindowAssets` 同时处理 settings + calendar
- `package.json` —— version 1.0.32 → 1.0.33（releasing 时一并处理）

---

## 9. 测试策略

### 单元测试（Vitest）

`tests/unit/CalendarService.test.ts`：

- `getMonthStats`：空月份、完整月份、跨月（1 月 → 2 月边界）
- `getYearHeatmap`：跨年（12 月 → 1 月）、闰年（2024-02-29 出现/不出现）
- `getDayTodos`：当日多条记录排序、跨日边界（23:59 vs 00:01）、子待办计入
- DST：构造一个 fake 时区切换日的 fixture，验证同日聚合

`tests/unit/CalendarMonth.test.tsx`：

- 渲染 6 行 × 7 列
- 上月末 / 下月初灰色占位
- 点击格子触发 onSelect
- count=0 时不显示徽章

### 手动测试清单

- [ ] 托盘 → Calendar 打开窗口
- [ ] 默认显示当月 + 当前日高亮
- [ ] 切换月份数据正确
- [ ] 点击日期抽屉滑出，清单正确
- [ ] 点击年度热力图月份，月度跳到对应月
- [ ] 关闭/重开窗口位置保留
- [ ] 修改窗口大小（拖拽、最大化），下次保留尺寸
- [ ] Esc 关闭抽屉
- [ ] 空月份（从未用过）显示空态
- [ ] 跨平台：macOS 与 Windows 行为一致

---

## 10. 优先级与范围

### 必须实现（MVP）

1. 独立窗口 + 托盘触发
2. 月度日历 + 年度热力图
3. 三种 IPC 查询方法
4. 当日抽屉
5. 颜色梯度
6. 窗口边界持久化

### 暂不实现（YAGNI）

- 月度切换的左右滑动动画（直接切换即可）
- 多选日期对比 / 导出功能
- 与 DailyReportService 的联动（日报是文本摘要，看板是图形化）
- 自定义色板 / 主题切换
- 移动端适配（桌面端独占）

---

## 11. 依赖与构建

- 不新增 npm 依赖
- 不修改 SQLite schema（无 migration）
- Vite 增加一个 entry，对打包体积影响极小
- 重新构建即可发布（不需要额外的 native rebuild）