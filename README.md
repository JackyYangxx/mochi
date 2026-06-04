# Desktop Todo

桌面角落里蹲着的一只小宠物，提醒你今天还有什么没做完。

点它说话，敲快捷键加待办，到点让 LLM 整理成清单推到飞书/钉钉。数据全在本地，API Key 加密存进 macOS Keychain。

## 宠物窗口

透明无边框窗口，常驻桌面。

- 三种状态：闲置 / 鼠标悬停活动 / 说话中（带脉冲动画）
- 三个状态都能换上自己的 PNG / JPG / GIF 图
- 大小三档：小 (80px) / 中 (128px) / 大 (192px)
- 按住左键拖到任意位置，下次启动还在那里
- 闲置状态可以显示提示气泡（比如"日报已生成"）

## 怎么加待办

三种姿势：

- **点宠物** —— 弹出输入框
- **全局快捷键** `Cmd/Ctrl+Shift+T` —— 任何应用前台都能呼出
- **按住语音按钮** —— 走 Chrome 的 Web Speech API，说完直接转文字

输入框支持回车直接提交，ESC 关闭。

## 待办管理

- 增删改查、标记完成、搜索
- **子待办嵌套**：父项下挂子项，删父项会级联删子项
- 拖动排序，顺序写进数据库
- 已完成的待办默认折叠，不占视觉空间
- 详情弹窗里可以写备注

## 提醒和日报

设置每日提醒时间（支持多个），到点会：

1. 读出当前所有未完成待办
2. 调 LLM 生成摘要 + 下一步建议
3. 通过你配置的 IM CLI 推到手机

日报功能类似 —— 把当天完成的待办汇总成 Markdown 推过去。

CLI 配置里有个 `{content}` 占位符，会作为**单个参数**传（不是拼到 shell），所以就算提醒内容里有空格、引号也不会出问题。`spawn` + 绝对路径校验是默认开启的。

## 设置面板

顶部 4 个 Tab 分页：

| Tab | 内容 |
|-----|------|
| 外观 | 宠物大小、三个状态的自定义图片 |
| 智能 | LLM 服务地址、模型、API Key（带显示/隐藏切换） |
| 通知 | 每日提醒时间、IM CLI 路径与参数模板、日报保存目录 |
| 系统 | 开机自启 |

API Key 走 Electron `safeStorage`，在 macOS 上等于 Keychain，Windows 上走 DPAPI。

## 安装运行

```bash
pnpm install

# Apple Silicon Mac 必做：重建 SQLite native 模块
npx @electron/rebuild -f -w better-sqlite3

pnpm build && pnpm start
```

启动后会在桌面右下角看到宠物窗口。试用：点宠物 → 写条待办 → 试试快捷键。

## 打包

```bash
# macOS (当前平台)
pnpm build

# Windows x64
pnpm build && pnpm electron-builder --win --x64 --dir
cd release && zip -r Desktop-Todo-vX.X.X-win-x64.zip win-unpacked
```

> 在 macOS 上交叉构建 Windows 时，最后一步用 Wine 调 rcedit 写 exe 版本信息会失败（"bad CPU type"），但 exe 本身可正常运行。最终发布建议在 Windows 机器上做最后一步。

## 技术栈

- Electron 28 + React 18 + TypeScript
- Vite (构建) · electron-builder (打包)
- better-sqlite3 (本地存储)
- Zustand (状态)
- Anime.js (动画)
- Web Speech API (语音)
- OpenAI 兼容 API (LLM)
- Vitest (单测) · Playwright (E2E)

## 项目结构

```
src/
  main/             # Electron 主进程
    index.ts        # 入口
    window.ts       # 主窗口
    settingsWindow.ts  # 设置窗口
    tray.ts         # 系统托盘
    shortcut.ts     # 全局快捷键
    ipc.ts          # IPC 处理器
  services/         # 业务逻辑
    TodoService.ts
    ReminderService.ts
    DailyReportService.ts
    LLMService.ts
    CLIExecutor.ts
    KeyStore.ts
    SettingsService.ts
  database/         # SQLite schema + 迁移
  preload/          # 预加载脚本 (contextBridge)
src-renderer/       # React 渲染进程
  components/       # PetView / TodoList / SettingsPanel / ...
  hooks/            # useTodos 等
  store/            # Zustand store
tests/
  unit/             # Vitest
  e2e/              # Playwright
release/            # 构建产物
```

## IPC 通道

| 通道 | 说明 |
|------|------|
| `todos:getAll` | 获取所有待办 |
| `todos:add` | 添加（支持 `parentId` 创建子待办） |
| `todos:toggle` | 切换完成 |
| `todos:update` | 更新内容/备注 |
| `todos:delete` | 删除（级联子待办） |
| `todos:reorder` | 重新排序 |
| `settings:get` / `settings:set` | 读写设置 |
| `trigger-input` | 全局快捷键触发输入 |

## License

MIT
