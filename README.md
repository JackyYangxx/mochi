# Mochi

桌面端智能待办助手，以萌系宠物形态悬浮在桌面，支持语音输入、全局快捷键、智能提醒、IM CLI 推送和本地知识库。

## 宠物

- 透明无边框悬浮窗
- **三种状态**：闲置、鼠标悬停、说话中（带脉冲动画）
- **自定义外观**：每个状态支持自定义 PNG / JPG / GIF 图片
- **三种尺寸**：小 / 中 / 大
- **自由拖动**：位置持久化
- **提示气泡**：闲置时显示通知

## 添加待办

三种方式：

- 点击宠物 —— 弹出输入框
- 全局快捷键 `Cmd/Ctrl+Shift+T` —— 在任何应用中都能呼出
- 按住语音 —— 说完自动转文字

输入框支持 `Enter` 提交、`Shift+Enter` 换行、`Esc` 关闭。

## 待办管理

- 增删改查、标记完成、搜索
- **子待办**：任务下挂子任务，删父项自动级联删除
- **自动排序**：未完成在上，完成沉底
- **完成动画**：勾选时粒子特效
- **详情备注**：每项可写备注，`Cmd/Ctrl+Enter` 保存

## 每日提醒

支持设置多个提醒时间，到点自动：

1. 读取当前未完成待办
2. 调用 AI 生成摘要和下一步建议
3. 通过配置的 IM 工具推送

## 日报

每天自动或手动生成 Markdown 工作日报，汇总：

- 已完成事项
- 未完成事项
- AI 总结

完成后自动归档已完成待办。

## 设置面板

顶部 4 个 Tab：

| Tab | 内容 |
|-----|------|
| 外观 | 宠物大小、三种状态的自定义图片 |
| 智能 | AI 服务地址、模型、API Key（加密存储） |
| 通知 | 提醒时间、IM 推送工具、日报保存目录 |
| 系统 | 开机自启 |

托盘右键菜单可快速打开设置。

## 安装运行

```bash
pnpm install

# Apple Silicon Mac 需重建 SQLite 模块
npx @electron/rebuild -f -w better-sqlite3

pnpm build && pnpm start
```

## 打包

```bash
# macOS
pnpm build

# Windows x64
pnpm build && pnpm electron-builder --win --x64 --dir
cd release && zip -r Mochi-vX.X.X-win-x64.zip win-unpacked
```

## License

MIT
