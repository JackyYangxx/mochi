# Desktop Todo Agent

桌面端待办事项管理工具，以宠物形态悬浮在桌面上，支持键盘/语音输入、智能提醒和 IM 通知。

## 功能特性

- **悬浮宠物窗口** - 透明窗口 + 宠物图标，点击触发输入
- **语音输入** - 按住说话，自动转文字 (Web Speech API)
- **全局快捷键** - `Cmd/Ctrl+Shift+T` 快速添加待办
- **待办管理** - CRUD、搜索、过滤、完成/删除
- **智能提醒** - LLM 生成摘要 + 行动建议，通过 IM CLI 发送
- **数据持久化** - SQLite 本地存储
- **开机自启** - 支持注册开机启动
- **窗口记忆** - 自动保存和恢复窗口位置

## 技术栈

- **框架**: Electron 28 + React 18 + TypeScript
- **构建**: Vite + electron-builder
- **数据库**: SQLite (better-sqlite3)
- **状态管理**: Zustand
- **语音识别**: Web Speech API
- **LLM**: OpenAI API (或兼容 API)
- **测试**: Vitest + Playwright

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 生产构建
pnpm build

# 运行测试
pnpm vitest run        # 单元测试
pnpm test:e2e          # E2E 测试
```

## 项目结构

```
desktop-todo-list/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── index.ts    # 应用入口
│   │   ├── window.ts   # 窗口管理
│   │   ├── shortcut.ts  # 全局快捷键
│   │   ├── tray.ts     # 系统托盘
│   │   └── ipc.ts      # IPC 处理器
│   ├── services/       # 业务逻辑
│   │   ├── TodoService.ts
│   │   ├── ReminderService.ts
│   │   ├── LLMService.ts
│   │   ├── CLIExecutor.ts
│   │   └── KeyStore.ts
│   ├── database/       # SQLite
│   └── preload/        # 预加载脚本
├── src-renderer/       # React 渲染进程
│   ├── components/     # UI 组件
│   ├── hooks/          # React hooks
│   └── store/          # Zustand store
└── tests/              # 测试
```

## 配置说明

### LLM API 配置

在设置面板中配置：
- Endpoint URL (如 `https://api.openai.com/v1`)
- Model 名称 (如 `gpt-4`)
- API Key (加密存储)

### IM CLI 配置

配置用于发送提醒的 CLI 工具：
- CLI 路径 (如 `/usr/local/bin/feishu`)
- 参数模板 (如 `send --message "{content}"`)
- `{content}` 占位符表示提醒内容

### 每日提醒

设置提醒时间，到达时间后自动：
1. 读取未完成待办
2. 调用 LLM 生成摘要和行动建议
3. 调用配置的 IM CLI 发送消息

## 安全特性

- CLI 执行使用 `spawn` + 绝对路径校验
- `{content}` 作为单个参数传递，防止命令注入
- API Key 使用 Electron `safeStorage` 加密存储
- Context Isolation 启用，Node 集成关闭

## 开发指南

```bash
# 代码格式化和检查
pnpm lint
pnpm format

# 类型检查
pnpm typecheck
```

## License

MIT