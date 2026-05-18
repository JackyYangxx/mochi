---
name: desktop-todo-agent-design
description: 桌面端快捷记录待办事项的 Agent 工具设计规范
metadata:
  type: spec
  date: 2026-05-18
---

# Desktop Todo Agent — 设计规范

## 项目概述

一款 Electron + React 桌面端工具，以宠物形态悬浮在桌面上，方便用户快速记录待办事项。支持键盘输入、语音输入、打勾完成、每日提醒，并通过 LLM 生成智能提醒内容后调用用户配置的 CLI 工具发送。

## 技术栈

- **框架：** Electron + React
- **语音识别：** Web Speech API / 系统级听写
- **本地存储：** SQLite (better-sqlite3)
- **LLM 调用：** OpenAI API 或兼容 API
- **IM 通知：** 用户配置的 CLI 工具

---

## 功能设计

### 1. 悬浮窗口

- Electron 窗口配置：
  - `frame: false`（无边框）
  - `transparent: true`（透明背景）
  - `alwaysOnTop: true`（置顶）
  - `resizable: false`（不可调整大小）
  - 窗口位置可拖动，记忆用户放置位置
- 宠物图片区域作为主要交互入口
- 无宠物图片时显示默认图标
- 点击穿透：非交互状态下（idle），鼠标事件穿透到下层窗口（`setIgnoreMouseEvents`）；hover 时恢复交互
- 多显示器 + DPI：支持跨显示器拖动，根据当前显示器 DPI 自动缩放窗口
- `skipTaskbar: true`：不在任务栏显示，仅系统托盘可见

### 2. 宠物形态

- 用户可上传一组动作图片
  - 基准尺寸 128x128 PNG/JPG，需支持 @2x（256x256）高 DPI 场景
  - 图片自动缩放适配，保持宽高比
- 支持的图片状态：
  - `idle`（默认待机）
  - `active`（hover/点击）
  - `speaking`（语音输入中）
- 状态切换时使用 CSS transition 平滑过渡（淡入淡出 200ms）
- 上传校验：仅允许 PNG/JPG/GIF，单个文件不超过 2MB
- 若未上传宠物图片，显示默认图标（内置 fallback）

### 3. 添加待办

**触发方式：**
- 全局快捷键（默认 `CmdOrCtrl+Shift+T`）
- 点击宠物区域

**交互流程：**
1. 触发后弹出输入框（带文字输入框 + 语音按钮）
2. 键盘输入文字 → 回车确认
3. 或按住语音按钮说话 → 松开自动转文字 → 回车确认
4. 保存到 SQLite → 输入框消失 → 宠物播放完成动画

**输入校验：**
- 内容不可为空（去除首尾空白后），空内容时回车无响应
- 内容最大长度 500 字符，超出时截断并提示
- 全局快捷键冲突检测：注册失败时提示用户在系统设置中手动配置快捷键

### 4. 待办列表

- 显示在悬浮窗内的列表区域
- 每条待办：内容 + 创建时间 + 完成状态
- 点击待办切换完成状态（打勾）
- 已完成的项默认折叠/隐藏（用户可切换显示）
- 支持删除待办（右击或滑动）
- 排序：默认按创建时间倒序，支持手动拖拽排序
- 搜索：输入关键字实时过滤待办列表

### 5. 语音输入

- 使用系统级语音识别（Web Speech API 或系统听写）
- 按住说话模式：按下语音键开始，松开结束识别
- 识别结果自动填入输入框
- 权限处理：首次使用时请求麦克风权限，拒绝后降级为纯键盘输入
- 离线回退：Web Speech API 不可用时（非 Chrome 环境、网络异常），提示用户改用键盘输入
- 错误状态：识别失败时显示错误提示，不阻塞键盘输入

### 6. 每日提醒

**提醒触发：**
- 用户配置提醒时间（如 "21:00"）
- 支持配置多个提醒时间点
- 到达设定时间后自动触发

**提醒流程：**
1. 读取当日未完成待办列表
2. 调用 LLM API，发送原始待办列表
3. LLM 返回摘要 + 行动建议
4. Electron 调用用户配置的 CLI 工具发送消息
5. 显示发送结果通知

**可靠性：**
- 计算机睡眠期间错过的提醒：唤醒后 5 分钟内补发（一次性，不重复）
- 应用崩溃重启后，重新注册提醒定时器
- 当日已发送过的提醒不重复发送（同一时间点的提醒每天只触发一次，记录在 `last_reminder_date`）
- 若无未完成待办，跳过 LLM 调用和消息发送，不通知用户

### 7. IM CLI 配置

- 用户可在设置中配置：
  - CLI 路径（如 `/usr/local/bin/feishu`）
  - CLI 调用参数模板（如 `send --message "{content}"`）
- 支持任意 IM 工具 CLI（飞书、企业微信、钉钉、Telegram 等）
- `{content}` 占位符表示 LLM 生成的提醒内容

**安全设计：**
- CLI 调用使用 `child_process.spawn` + 参数数组（非 shell 模式），禁止直接拼接 shell 字符串
- `{content}` 占位符作为单个参数值传入，不经过 shell 解析，避免命令注入
- CLI 路径校验：启动时检查配置的 CLI 路径是否指向合法可执行文件
- CLI 执行超时：30 秒超时，避免进程挂死

### 8. 错误处理与反馈

| 功能模块 | 失败场景 | 用户可见反馈 |
|---------|---------|-------------|
| 语音识别 | Web Speech API 不可用 | Toast："语音不可用，请使用键盘输入" |
| 语音识别 | 用户拒绝麦克风权限 | Toast："请在系统设置中开启麦克风权限" |
| 语音识别 | 识别结果为空 | 不覆盖输入框内容，保留已输入文字 |
| LLM 调用 | API 不可达/超时 | Toast："提醒生成失败，请检查 API 配置"，降级发送原始待办列表 |
| LLM 调用 | 返回格式异常 | 解析容错，尽可能提取有效内容；失败则发送原始待办 |
| CLI 调用 | 路径不存在/无权限 | Toast："IM 工具不可用，请检查 CLI 配置" |
| CLI 调用 | 执行超时 (30s) | Toast："消息发送超时"，记录日志 |
| SQLite | 写入失败 | Toast："保存失败"，保留输入框内容不关闭 |
| SQLite | 数据库损坏 | 自动重建数据库，提示用户数据已重置 |

### 9. API 密钥管理

- LLM API Key 通过 `electron.safeStorage` 加密存储（macOS Keychain / Windows DPAPI）
- 不存储在 SQLite settings 表或任何明文文件中
- Settings 中仅保留非敏感的 LLM 配置（endpoint URL、model 名称）
- 首次启动时引导用户输入 API Key

### 10. 离线模式

- 纯本地操作（添加/完成/删除待办）完全离线可用
- 语音识别在 Web Speech API 离线不可用时降级为键盘输入
- LLM 提醒生成需联网；离线时跳过 LLM，直接发送原始待办列表
- 应用顶部状态栏显示网络连接状态指示

### 11. 系统托盘与开机自启

- 关闭窗口 → 最小化到系统托盘，不退出进程
- 托盘菜单：显示主窗口 / 退出
- 退出时保存所有状态和窗口位置
- 开机自启：通过 `app.setLoginItemSettings` 注册，用户可在设置中开关

### 12. 日志与调试

- 使用 `electron-log` 记录运行日志，分级输出：
  - `info`：正常操作（待办创建、提醒发送成功）
  - `warn`：降级行为（LLM 超时回退、语音不可用）
  - `error`：异常（CLI 执行失败、数据库写入错误）
- 日志落本地文件，保留最近 7 天，自动轮转
- 开发模式下同时输出到 DevTools Console
- 日志不记录 API Key、待办内容明文（仅记录 id 和操作类型）

### 13. 测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest | Service 层（TodoService、CLIExecutor、KeyStore） |
| 组件测试 | Vitest + React Testing Library | React 组件交互逻辑 |
| E2E 测试 | Playwright + Electron | 关键用户流程（添加待办 → 完成 → 删除） |
| 安全测试 | 手动审查 + ESLint security plugin | CLI 注入防护、API Key 存储 |

- CLI 安全执行器为测试重点：验证参数数组模式防注入、超时终止、路径校验
- 核心业务流程测试覆盖率目标 ≥ 80%

### 14. 开发工作流

- 包管理：pnpm
- 构建工具：Vite（渲染进程）+ electron-builder（打包）
- 开发模式：`vite` dev server + Electron 主进程热重载
- 代码规范：ESLint + Prettier
- Git hooks：`pre-commit` 运行 lint + 单元测试

---
## 数据模型

### SQLite Schema

```sql
CREATE TABLE todos (
  id TEXT PRIMARY KEY,          -- UUID v4
  content TEXT NOT NULL,        -- 最大 500 字符
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  is_completed INTEGER DEFAULT 0
);

CREATE INDEX idx_todos_created_at ON todos(created_at);
CREATE INDEX idx_todos_is_completed ON todos(is_completed);
CREATE INDEX idx_todos_sort_order ON todos(sort_order);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE migrations (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**数据库迁移策略：**
- 启动时检查本地 SQLite `migrations` 表，按版本号顺序执行未应用的迁移
- 迁移脚本内置于 `src/database/migrations/`，按版本编号
- 每次迁移在事务中执行，失败时回滚

### Settings 配置项

| Key | 描述 |
|-----|------|
| `reminder_times` | 每日提醒时间列表，JSON 数组，如 `["09:00","21:00"]` |
| `im_cli_path` | IM CLI 工具路径 |
| `im_cli_args` | IM CLI 调用参数模板 |
| `pet_image_idle` | 宠物 idle 图片路径 |
| `pet_image_active` | 宠物 active 图片路径 |
| `pet_image_speaking` | 宠物 speaking 图片路径 |
| `window_position_x` | 窗口 X 坐标 |
| `window_position_y` | 窗口 Y 坐标 |
| `auto_launch` | 是否开机自启，`"1"` 或 `"0"` |
| `llm_endpoint` | LLM API 地址 |
| `llm_model` | LLM 模型名称 |
| `last_reminder_date` | 上次发送提醒的日期（YYYY-MM-DD），用于防止重复发送 |
| `db_version` | 当前数据库 schema 版本号 |

> 注意：LLM API Key 使用 `electron.safeStorage` 加密存储，不放入 settings 表。

### 数据导出/导入

- 导出：将 `todos` 表导出为 JSON 文件，用户选择保存路径
- 导入：从 JSON 文件导入待办，合并至当前数据库（按 id 去重）
- 支持在退出前提示导出未完成待办

---

## 模块设计

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts            # 入口
│   ├── window.ts          # 窗口管理
│   ├── shortcut.ts         # 全局快捷键
│   ├── tray.ts             # 系统托盘
│   └── ipc.ts              # IPC 处理
├── services/               # 业务逻辑层
│   ├── TodoService.ts      # 待办 CRUD
│   ├── ReminderService.ts  # 提醒调度
│   ├── SpeechService.ts    # 语音识别
│   ├── LLMService.ts       # LLM API 调用
│   ├── CLIExecutor.ts      # CLI 安全调用（spawn 封装）
│   └── KeyStore.ts         # API Key 加密存储（safeStorage）
├── database/
│   ├── sqlite.ts           # SQLite 操作
│   └── migrations/         # 迁移脚本
└── preload/
    └── index.ts            # 预加载脚本

src-renderer/               # React 渲染进程
├── App.tsx
├── components/
│   ├── PetView.tsx         # 宠物视图
│   ├── TodoList.tsx        # 待办列表
│   ├── TodoSearch.tsx      # 搜索栏
│   ├── InputModal.tsx      # 输入弹窗
│   └── NetworkStatus.tsx   # 网络状态指示
├── hooks/
│   └── useSpeechRecognition.ts
└── store/
    └── index.ts            # 状态管理
```

---

## LLM 提醒内容生成

**调用策略：**
- 当期待办为空时不调用 LLM，直接跳过提醒
- 待办过多时（>50 条），截取前 50 条发送，超出部分省略提示
- LLM 调用超时 15 秒，超时或失败则降级发送原始待办列表
- 输出格式解析容错：尽力提取「摘要」和「行动建议」，提取失败时发送 LLM 原始返回内容

**Prompt 模板：**

```
你是一个待办事项助手。用户有以下待办事项：

{待办列表}

请生成：
1. 简洁摘要（不超过50字）
2. 每条待办的行动建议（简短）
3. 优先级建议（如有）

输出格式：
【摘要】
...

【行动建议】
1. ...
2. ...
```

---

## 依赖

- `electron`: ^28.0.0
- `react`: ^18.2.0
- `better-sqlite3`: ^9.0.0
- `openai`: ^4.0.0（LLM 调用）
- `electron-log`: ^5.0.0（日志）
- `uuid`: ^9.0.0（ID 生成）
- `electron-builder`: 打包工具
- 开发依赖：`vite`、`vitest`、`@testing-library/react`、`playwright`、`eslint`、`prettier`

---

## 优先级

1. 悬浮窗口 + 宠物默认图标 + 系统托盘 ✅
2. 全局快捷键 + 点击触发输入
3. 待办 CRUD + SQLite 存储 + 搜索排序
4. 语音输入（含权限处理、离线回退）
5. CLI 安全执行器（spawn 封装）
6. API Key 加密存储
7. 每日提醒 + LLM 生成内容 + 追赶逻辑
8. IM CLI 调用
9. 宠物图片上传
10. 数据导出/导入
11. 离线模式适配
12. 开机自启