# Desktop Todo Agent — CLAUDE.md

## 项目概述

Electron + React 桌面端待办工具，以宠物形态悬浮在桌面，支持语音输入、全局快捷键、智能提醒和 IM CLI 通知。

## 技术栈

- Electron 28, React 18, TypeScript
- Vite (构建), better-sqlite3 (数据库), Zustand (状态)
- Web Speech API (语音), OpenAI API (LLM)

## 开发命令

```bash
pnpm dev      # 开发模式 (Vite dev server + Electron)
pnpm build    # 生产构建
pnpm test     # Vitest 单元测试
pnpm test:e2e # Playwright E2E 测试
pnpm lint     # ESLint 检查
pnpm format  # Prettier 格式化
```

## Windows 构建

- 目标架构: **x64** (Windows 桌面端)
- 配置: `electron-builder.yml` 中 win.target 指定 `arch: x64`

## 架构要点

### 主进程 vs 渲染进程

- **主进程** (`src/main/`): 窗口管理、系统托盘、全局快捷键、IPC、数据库、LLM 调用、CLI 执行
- **渲染进程** (`src-renderer/`): React 组件、hooks、Zustand store
- **隔离层** (`src/preload/`): contextBridge API，渲染进程通过 `window.todoAPI` 访问主进程功能

### IPC 通道

| 通道 | 功能 |
|------|------|
| `todos:getAll` | 获取所有待办 |
| `todos:add` | 添加待办 |
| `todos:toggle` | 切换完成状态 |
| `todos:delete` | 删除待办 |
| `trigger-input` | 全局快捷键触发输入 |

### 数据库

- SQLite with better-sqlite3
- 迁移系统: `src/database/migrations/`
- Schema: `todos`, `settings`, `migrations` 表

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