# Desktop Todo Agent — CLAUDE.md

## 项目概述

Electron + React 桌面端待办工具，以宠物形态悬浮在桌面，支持语音输入、全局快捷键、智能提醒和 IM CLI 通知。

## 技术栈

- Electron 28, React 18, TypeScript
- Vite (构建), better-sqlite3 (数据库), Zustand (状态)
- Web Speech API (语音), OpenAI API (LLM)

## 测试

### Electron 桌面应用测试

```bash
pnpm build && pnpm start  # 构建后在 Electron 桌面窗口中测试
```

**重要：** 这是 Electron 桌面应用，不是浏览器应用。测试时需要：
1. 运行 `pnpm build && pnpm start`
2. 应用会在桌面窗口中显示（悬浮宠物形态）
3. 全局快捷键 `CmdOrCtrl+Shift+T` 触发输入框
4. 托盘图标可以打开设置

### 单元测试

```bash
pnpm test                 # Vitest 单元测试
pnpm test:e2e             # Playwright E2E 测试（如果配置）
```

### Apple Silicon Mac native 模块重建

```bash
npx @electron/rebuild -f -w better-sqlite3  # M1/M2/M3 需要执行
```

## 开发命令

```bash
pnpm build && pnpm start  # 构建 + 运行 Electron（推荐）
pnpm dev                  # 仅启动 Vite dev server（需要单独启动 Electron）
pnpm build                # 生产构建（vite + tsc）
pnpm lint                 # ESLint 检查
pnpm format               # Prettier 格式化
```

**注意：** `pnpm dev` 仅启动 Vite 开发服务器，不会自动启动 Electron。要在开发模式下运行，需先构建再启动：`pnpm build && pnpm start`

## macOS 运行

**前提条件：native 模块重建**

Apple Silicon Mac (M1/M2/M3) 需要先重建 native 模块：

```bash
npx @electron/rebuild -f -w better-sqlite3
```

**启动命令：**

```bash
pnpm build && pnpm start    # 构建 + 运行生产版本
pnpm dev                     # 开发模式（Vite dev server + Electron）
```

**启动流程：**

1. `pnpm build` 执行 `vite build` (构建渲染进程资源) + `tsc -p tsconfig.main.json` (编译主进程 TypeScript)
2. `pnpm start` 执行 `electron dist/main/index.js` 启动 Electron 主进程
3. 主进程初始化：数据库连接 → 注册 IPC handlers → 创建主窗口 → 创建托盘图标 → 注册全局快捷键 → 启动 ReminderService

## Windows 构建

- 目标架构: **x64** (Windows 桌面端)
- 配置: `electron-builder.yml` 中 win.target 指定 `arch: x64`

## Release 发布流程

**每次推送 release 包前，必须更新版本号：**

1. 修改 `package.json` 中的 `version` 字段（语义化版本递增，如 1.0.11 → 1.0.12）
2. 提交 commit: `git add package.json && git commit -m "chore: bump version to X.X.X"`
3. 构建: `pnpm build && pnpm electron-builder --win x64 --dir`
4. 打包: `cd release && zip -r Desktop-Todo-vX.X.X-win-x64.zip win-unpacked`
5. 推送到远程: `git push origin main`
6. 创建/更新 GitHub Release，上传 zip 包

**注意：** Windows 构建在 macOS 上会因 Wine 问题导致 exe 版本信息写入失败，但 exe 本身可正常运行。

## 架构要点

### 主进程 vs 渲染进程

- **主进程** (`src/main/`): 窗口管理、系统托盘、全局快捷键、IPC、数据库、LLM 调用、CLI 执行
- **渲染进程** (`src-renderer/`): React 组件、hooks、Zustand store
- **隔离层** (`src/preload/`): contextBridge API，渲染进程通过 `window.todoAPI` 访问主进程功能

### IPC 通道

| 通道 | 功能 |
|------|------|
| `todos:getAll` | 获取所有待办 |
| `todos:add` | 添加待办（支持 `parentId` 参数创建子待办） |
| `todos:toggle` | 切换完成状态 |
| `todos:delete` | 删除待办（级联删除子待办） |
| `trigger-input` | 全局快捷键触发输入 |

### 数据库 Schema

**todos 表结构：**
- `id` TEXT PRIMARY KEY
- `content` TEXT NOT NULL
- `sort_order` INTEGER DEFAULT 0
- `created_at` DATETIME
- `updated_at` DATETIME
- `completed_at` DATETIME
- `is_completed` INTEGER DEFAULT 0
- `parent_id` TEXT DEFAULT NULL（支持子待办嵌套）

### 数据库

- SQLite with better-sqlite3
- 迁移系统: `src/database/migrations/`
- Schema: `todos`, `settings`, `migrations` 表
- **注意**: Apple Silicon Mac 运行前需执行 `npx @electron/rebuild -f -w better-sqlite3`

### 关键安全措施

- CLI 执行: `spawn` + `shell: false` + 绝对路径校验 + 超时终止
- API Key: `electron.safeStorage` 加密存储 (macOS Keychain)
- Context Isolation 启用，NodeIntegration 关闭

## 代码规范

- TypeScript strict mode
- ESLint + Prettier
- 组件: 函数组件 + hooks
- 样式: CSS Modules (`.css` 文件与组件同目录)

## 相关文档

- 设计规范: `docs/superpowers/specs/2026-05-18-desktop-todo-agent-design.md`
- 实现计划: `docs/superpowers/plans/2026-05-18-desktop-todo-agent-implementation.md`
- 任务列表: `docs/superpowers/tasks/2026-05-18-desktop-todo-tasklist.md`
- 经验反思: Settings 窗口样式调整（见 Claude Code memory 目录）