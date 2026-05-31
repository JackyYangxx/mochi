# Desktop Todo Agent

桌面端待办事项管理工具，以宠物形态悬浮在桌面上，支持键盘/语音输入、全局快捷键、智能提醒和 IM 通知。

## 功能特性

- **悬浮宠物窗口** - 透明窗口 + 宠物图标，点击触发输入
- **语音输入** - 按住说话，自动转文字 (Web Speech API)
- **全局快捷键** - `Cmd/Ctrl+Shift+T` 快速添加待办
- **待办管理** - CRUD、搜索、过滤、完成/删除、子待办嵌套
- **智能提醒** - LLM 生成摘要 + 行动建议，通过 IM CLI 发送
- **每日报告** - 自动生成待办总结并发送至 IM
- **数据持久化** - SQLite 本地存储
- **开机自启** - 支持注册开机启动
- **窗口记忆** - 自动保存和恢复窗口位置

## 技术栈

- **框架**: Electron 28 + React 18 + TypeScript
- **构建**: Vite + electron-builder
- **数据库**: SQLite (better-sqlite3)
- **状态管理**: Zustand
- **动画**: Anime.js
- **语音识别**: Web Speech API
- **LLM**: OpenAI API (或兼容 API)
- **测试**: Vitest + Playwright

## 快速开始

### 安装依赖

```bash
pnpm install
```

### Apple Silicon Mac 需要重建 native 模块

```bash
npx @electron/rebuild -f -w better-sqlite3
```

### 开发模式

```bash
pnpm build && pnpm start
```

应用会在桌面窗口中显示（悬浮宠物形态），全局快捷键 `CmdOrCtrl+Shift+T` 触发输入框。

### 生产构建

```bash
pnpm build
```

### 代码检查

```bash
pnpm lint        # ESLint 检查
pnpm format      # Prettier 格式化
```

### 测试

```bash
pnpm test        # 单元测试 (Vitest)
```

## 项目结构

```
desktop-todo-list/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── index.ts    # 应用入口
│   │   ├── ipc.ts      # IPC 处理器
│   │   ├── window.ts   # 窗口管理
│   │   ├── tray.ts     # 系统托盘
│   │   └── shortcut.ts # 全局快捷键
│   ├── services/       # 业务逻辑
│   │   ├── TodoService.ts
│   │   ├── ReminderService.ts
│   │   ├── DailyReportService.ts
│   │   ├── LLMService.ts
│   │   ├── CLIExecutor.ts
│   │   ├── KeyStore.ts
│   │   └── SettingsService.ts
│   ├── database/       # SQLite 数据库
│   └── preload/        # 预加载脚本
├── src-renderer/       # React 渲染进程
│   ├── components/
│   │   ├── TodoList.tsx      # 待办列表
│   │   ├── TodoItem.tsx      # 待办项
│   │   ├── InputModal.tsx    # 输入弹窗
│   │   ├── TodoDetailModal.tsx # 待办详情
│   │   ├── PetView.tsx       # 宠物视图
│   │   ├── SettingsPanel.tsx # 设置面板
│   │   ├── VoiceButton.tsx   # 语音按钮
│   │   └── NetworkStatus.tsx # 网络状态
│   ├── hooks/          # React hooks
│   └── store/          # Zustand store
├── release/            # 构建输出
└── tests/              # 测试
```

## IPC 通道

| 通道 | 功能 |
|------|------|
| `todos:getAll` | 获取所有待办 |
| `todos:add` | 添加待办（支持 `parentId` 创建子待办） |
| `todos:toggle` | 切换完成状态 |
| `todos:update` | 更新待办内容/备注 |
| `todos:delete` | 删除待办（级联删除子待办） |
| `todos:reorder` | 重新排序待办 |
| `settings:get` | 获取设置 |
| `settings:set` | 保存设置 |
| `trigger-input` | 全局快捷键触发输入 |

## 配置说明

### LLM API 配置

在设置面板中配置：
- Endpoint URL (如 `https://api.openai.com/v1`)
- Model 名称 (如 `gpt-4`)
- API Key (加密存储至 macOS Keychain)

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

### Windows 构建

```bash
pnpm electron-builder --win x64 --dir
```

打包后运行：
```bash
cd release && zip -r Desktop-Todo-vX.X.X-win-x64.zip win-unpacked
```

## License

MIT